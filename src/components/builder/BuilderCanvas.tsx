import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  Asset, Plan, PlacedAsset, Connection, Area,
  LAYER_META, PORT_COLORS, PORT_TYPE_LABELS,
} from '../../types';
import {
  routeConnections, pathPointAtFraction, projectOntoPath, labelPoint,
  Rect, Pt, RouteInput, RouteResult,
} from '../../utils/routing';
import { validateConnection, buildCableSuggestion, CableSuggestion, CableOption } from '../../utils/connectionRules';
import { PortPositionEditor } from '../assets/PortPositionEditor';

export const CANVAS_W = 2400;
export const CANVAS_H = 1600;
const GRID = 20;
const SNAP_THRESHOLD = 8;

function snap(v: number) { return Math.round(v / GRID) * GRID; }

export interface ViewBox { x: number; y: number; w: number; h: number; }

type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';
const RESIZE_CURSOR: Record<ResizeCorner, string> = { nw: 'nw-resize', ne: 'ne-resize', sw: 'sw-resize', se: 'se-resize' };
type RotateHandle = 'top';

interface AlignLine { x1: number; y1: number; x2: number; y2: number; }

function getAlignmentLines(moving: PlacedAsset, all: PlacedAsset[]): AlignLine[] {
  const lines: AlignLine[] = [];
  const mCx = moving.x + moving.width / 2, mCy = moving.y + moving.height / 2;
  const mR = moving.x + moving.width, mB = moving.y + moving.height;
  for (const o of all) {
    if (o.instanceId === moving.instanceId) continue;
    const oCx = o.x + o.width / 2, oCy = o.y + o.height / 2;
    const oR = o.x + o.width, oB = o.y + o.height;
    if (Math.abs(moving.x - o.x)  < SNAP_THRESHOLD) lines.push({ x1: o.x,  y1: 0, x2: o.x,  y2: CANVAS_H });
    if (Math.abs(mR - oR)          < SNAP_THRESHOLD) lines.push({ x1: oR,   y1: 0, x2: oR,   y2: CANVAS_H });
    if (Math.abs(mCx - oCx)        < SNAP_THRESHOLD) lines.push({ x1: oCx,  y1: 0, x2: oCx,  y2: CANVAS_H });
    if (Math.abs(moving.y - o.y)  < SNAP_THRESHOLD) lines.push({ x1: 0, y1: o.y,  x2: CANVAS_W, y2: o.y  });
    if (Math.abs(mB - oB)          < SNAP_THRESHOLD) lines.push({ x1: 0, y1: oB,   x2: CANVAS_W, y2: oB  });
    if (Math.abs(mCy - oCy)        < SNAP_THRESHOLD) lines.push({ x1: 0, y1: oCy,  x2: CANVAS_W, y2: oCy });
  }
  return lines;
}

interface ConnCtxMenu { kind: 'connection'; screenX: number; screenY: number; connId: string; waypointIdx: number | null; }
interface AssetCtxMenu { kind: 'asset'; screenX: number; screenY: number; instanceId: string; }
type CtxMenu = ConnCtxMenu | AssetCtxMenu;

interface Props {
  plan: Plan;
  assets: Asset[];
  onUpdate: (plan: Plan) => void;
  onUpdateAsset?: (assetId: string, patch: Partial<Asset>) => void;
  viewBox: ViewBox;
  onViewBoxChange: (vb: ViewBox) => void;
  onEditAsset?: (assetId: string) => void;
}

export function BuilderCanvas({ plan, assets, onUpdate, onUpdateAsset, viewBox, onViewBoxChange, onEditAsset }: Props) {
  const svgRef     = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [panning, setPanning]   = useState(false);
  const [panStart, setPanStart] = useState({ mx: 0, my: 0, vx: 0, vy: 0 });

  const [draggingInstanceId, setDraggingInstanceId] = useState<string | null>(null);
  const [dragOffset, setDragOffset]                 = useState({ dx: 0, dy: 0 });
  const [alignLines, setAlignLines]                 = useState<AlignLine[]>([]);

  const [draggingAreaId, setDraggingAreaId]     = useState<string | null>(null);
  const [areaDragOffset, setAreaDragOffset]     = useState({ dx: 0, dy: 0 });
  const [resizingAreaId, setResizingAreaId]     = useState<string | null>(null);
  const [areaResizeStart, setAreaResizeStart]   = useState<{ mx: number; my: number; w: number; h: number } | null>(null);

  const [connectingFrom, setConnectingFrom]         = useState<{ instanceId: string; portId: string } | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  const [resizingInstanceId, setResizingInstanceId] = useState<string | null>(null);
  const [resizeCorner, setResizeCorner]             = useState<ResizeCorner | null>(null);
  const [resizeStart, setResizeStart]               = useState<{ mx: number; my: number; inst: PlacedAsset } | null>(null);

  const [rotations, setRotations]               = useState<Record<string, number>>({});
  // rotatingInstanceId: set by context menu "Drehen", cleared by click outside
  const [rotatingInstanceId, setRotatingInstanceId] = useState<string | null>(null);
  // draggingRotateId: true only while actively dragging the handle
  const [draggingRotateId, setDraggingRotateId] = useState<string | null>(null);
  const [rotateCenter, setRotateCenter]         = useState<Pt | null>(null);
  // moveConnectorsAssetId: set by context menu "Move Connectors"
  const [moveConnectorsAssetId, setMoveConnectorsAssetId] = useState<string | null>(null);

  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);
  const [draggingWaypoint, setDraggingWaypoint]       = useState<{ connId: string; wpIdx: number } | null>(null);
  const [draggingLabelConnId, setDraggingLabelConnId] = useState<string | null>(null);
  const [labelPositions, setLabelPositions]           = useState<Record<string, number>>({});

  const [contextMenu, setContextMenu] = useState<CtxMenu | null>(null);

  interface CableDialog {
    fromInstanceId: string; fromPortId: string;
    toInstanceId: string;   toPortId: string;
    suggestion: CableSuggestion;
    layer: string;
    selectedCable: string | null;
    selectedIntermediate: string | null;
  }
  const [cableDialog, setCableDialog] = useState<CableDialog | null>(null);

  const assetMap = useMemo(() => new Map(assets.map(a => [a.id, a])), [assets]);

  // ── Port position (rotation-aware) ────────────────────────────────────────

  const getPortPos = useCallback((inst: PlacedAsset, portId: string): Pt => {
    const asset = assetMap.get(inst.assetId);
    const port  = asset?.ports.find(p => p.id === portId);
    let rx: number, ry: number;
    if (port?.position) {
      rx = inst.x + port.position.x * inst.width;
      ry = inst.y + port.position.y * inst.height;
    } else {
      const idx   = asset?.ports.findIndex(p => p.id === portId) ?? 0;
      const total = asset?.ports.length ?? 1;
      rx = inst.x + inst.width;
      ry = inst.y + ((idx + 1) / (total + 1)) * inst.height;
    }
    // Apply rotation around asset center
    const deg = rotations[inst.instanceId] ?? 0;
    if (deg === 0) return { x: rx, y: ry };
    const cx = inst.x + inst.width / 2;
    const cy = inst.y + inst.height / 2;
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const dx = rx - cx, dy = ry - cy;
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    };
  }, [assetMap, rotations]);

  // ── Routing ────────────────────────────────────────────────────────────────

  const routedPaths = useMemo(() => {
    const obstacles: Rect[] = plan.instances.map(i => ({ x: i.x, y: i.y, w: i.width, h: i.height }));
    const instObsIdx = new Map(plan.instances.map((inst, idx) => [inst.instanceId, idx]));
    const visible = plan.connections.filter(c => plan.layerVisibility[c.layer] !== false);
    const inputs: RouteInput[] = visible.map((conn, idx) => {
      const fromInst  = plan.instances.find(i => i.instanceId === conn.fromInstanceId);
      const toInst    = plan.instances.find(i => i.instanceId === conn.toInstanceId);
      if (!fromInst || !toInst) return null;
      const fromPort = assetMap.get(fromInst.assetId)?.ports.find(p => p.id === conn.fromPortId);
      const toPort   = assetMap.get(toInst.assetId)?.ports.find(p => p.id === conn.toPortId);
      return {
        id: conn.id,
        from:    getPortPos(fromInst, conn.fromPortId),
        to:      getPortPos(toInst,   conn.toPortId),
        fromPos: fromPort?.position,
        toPos:   toPort?.position,
        fromObstacleIdx: instObsIdx.get(conn.fromInstanceId),
        toObstacleIdx:   instObsIdx.get(conn.toInstanceId),
        waypoints: conn.waypoints,
        color: LAYER_META[conn.layer]?.color ?? '#6B7280',
        zIndex: idx,
      };
    }).filter(Boolean) as RouteInput[];
    return routeConnections(inputs, obstacles, CANVAS_W, CANVAS_H);
  }, [plan.instances, plan.connections, plan.layerVisibility, getPortPos, assetMap]);

  // ── Coordinate helper ──────────────────────────────────────────────────────

  const svgPt = useCallback((e: React.MouseEvent | React.DragEvent): Pt => {
    const svg  = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    return {
      x: viewBox.x + (e.clientX - rect.left) * (viewBox.w / rect.width),
      y: viewBox.y + (e.clientY - rect.top)  * (viewBox.h / rect.height),
    };
  }, [viewBox]);

  // ── Background / pan ───────────────────────────────────────────────────────

  const onBgMouseDown = (e: React.MouseEvent) => {
    setContextMenu(null);
    // Click outside any asset exits rotation mode
    if (rotatingInstanceId) { setRotatingInstanceId(null); setDraggingRotateId(null); return; }
    if (draggingRotateId) return;
    if (e.target !== svgRef.current && !(e.target as Element).classList.contains('bg-rect')) return;
    setPanning(true);
    setPanStart({ mx: e.clientX, my: e.clientY, vx: viewBox.x, vy: viewBox.y });
    setConnectingFrom(null);
    setSelectedInstanceId(null);
  };

  // ── Mouse move ─────────────────────────────────────────────────────────────

  const onMouseMove = (e: React.MouseEvent) => {
    if (draggingRotateId && rotateCenter) {
      const pt  = svgPt(e);
      const deg = Math.round(Math.atan2(pt.y - rotateCenter.y, pt.x - rotateCenter.x) * 180 / Math.PI + 90);
      setRotations(prev => ({ ...prev, [draggingRotateId]: ((deg % 360) + 360) % 360 }));
      return;
    }
    if (resizingInstanceId && resizeStart && resizeCorner) {
      const pt   = svgPt(e);
      const orig = resizeStart.inst;
      const aspect = assetMap.get(orig.assetId)?.imageAspectRatio;
      const dx = pt.x - resizeStart.mx, dy = pt.y - resizeStart.my;
      let nx = orig.x, ny = orig.y, nw = orig.width, nh = orig.height;
      if (aspect) {
        const delta = (resizeCorner === 'se' || resizeCorner === 'sw')
          ? (Math.abs(dx) > Math.abs(dy) ? dx : dy * aspect)
          : (Math.abs(dx) > Math.abs(dy) ? -dx : -dy * aspect);
        if (resizeCorner === 'se') { nw = snap(orig.width + delta); nh = snap(nw / aspect); }
        else if (resizeCorner === 'sw') { nw = snap(orig.width - delta); nh = snap(nw / aspect); nx = snap(orig.x + orig.width - nw); }
        else if (resizeCorner === 'ne') { nw = snap(orig.width + delta); nh = snap(nw / aspect); ny = snap(orig.y + orig.height - nh); }
        else { nw = snap(orig.width - delta); nh = snap(nw / aspect); nx = snap(orig.x + orig.width - nw); ny = snap(orig.y + orig.height - nh); }
      } else {
        if (resizeCorner === 'se') { nw = snap(orig.width + dx); nh = snap(orig.height + dy); }
        else if (resizeCorner === 'sw') { nx = snap(orig.x + dx); nw = snap(orig.width - dx); nh = snap(orig.height + dy); }
        else if (resizeCorner === 'ne') { ny = snap(orig.y + dy); nw = snap(orig.width + dx); nh = snap(orig.height - dy); }
        else { nx = snap(orig.x + dx); ny = snap(orig.y + dy); nw = snap(orig.width - dx); nh = snap(orig.height - dy); }
      }
      nw = Math.max(40, nw); nh = Math.max(30, nh);
      onUpdate({ ...plan, instances: plan.instances.map(i => i.instanceId === resizingInstanceId ? { ...i, x: nx, y: ny, width: nw, height: nh } : i) });
      return;
    }
    if (resizingAreaId && areaResizeStart) {
      const pt = svgPt(e);
      onUpdate({ ...plan, areas: plan.areas.map(a => a.id === resizingAreaId ? { ...a, width: Math.max(80, snap(areaResizeStart.w + pt.x - areaResizeStart.mx)), height: Math.max(60, snap(areaResizeStart.h + pt.y - areaResizeStart.my)) } : a) });
      return;
    }
    if (draggingWaypoint) {
      const pt = svgPt(e);
      onUpdate({ ...plan, connections: plan.connections.map(c => c.id === draggingWaypoint.connId ? { ...c, waypoints: c.waypoints.map((wp, i) => i === draggingWaypoint.wpIdx ? { x: snap(pt.x), y: snap(pt.y) } : wp) } : c) });
      return;
    }
    if (draggingLabelConnId) {
      const pt   = svgPt(e);
      const result = routedPaths.get(draggingLabelConnId);
      if (result) {
        const frac = projectOntoPath(result.pts, pt);
        setLabelPositions(prev => ({ ...prev, [draggingLabelConnId]: frac }));
      }
      return;
    }
    if (panning) {
      const rect = svgRef.current!.getBoundingClientRect();
      onViewBoxChange({ ...viewBox, x: panStart.vx - (e.clientX - panStart.mx) * (viewBox.w / rect.width), y: panStart.vy - (e.clientY - panStart.my) * (viewBox.h / rect.height) });
      return;
    }
    if (draggingAreaId) {
      const pt = svgPt(e);
      onUpdate({ ...plan, areas: plan.areas.map(a => a.id === draggingAreaId ? { ...a, x: snap(pt.x - areaDragOffset.dx), y: snap(pt.y - areaDragOffset.dy) } : a) });
      return;
    }
    if (draggingInstanceId) {
      const pt   = svgPt(e);
      const inst = plan.instances.find(i => i.instanceId === draggingInstanceId)!;
      const nx   = snap(pt.x - dragOffset.dx), ny = snap(pt.y - dragOffset.dy);
      if (nx !== inst.x || ny !== inst.y) {
        const updated = { ...inst, x: nx, y: ny };
        setAlignLines(getAlignmentLines(updated, plan.instances));
        onUpdate({ ...plan, instances: plan.instances.map(i => i.instanceId === draggingInstanceId ? updated : i) });
      }
    }
  };

  const onMouseUp = () => {
    if (resizingInstanceId && resizeStart && onUpdateAsset) {
      const inst = plan.instances.find(i => i.instanceId === resizingInstanceId);
      if (inst) onUpdateAsset(inst.assetId, { physicalWidth: Math.round(inst.width / 4), physicalHeight: Math.round(inst.height / 4) });
    }
    setPanning(false);
    setDraggingInstanceId(null); setDraggingAreaId(null);
    setResizingInstanceId(null); setResizeCorner(null); setResizeStart(null);
    setDraggingWaypoint(null);   setResizingAreaId(null); setAreaResizeStart(null);
    setDraggingLabelConnId(null); setDraggingRotateId(null); setAlignLines([]);
    // Note: rotatingInstanceId stays set until click outside
  };

  // ── Wheel zoom ─────────────────────────────────────────────────────────────

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    const pt = svgPt(e as any);
    const nw = Math.max(400, Math.min(CANVAS_W, viewBox.w * factor));
    const nh = Math.max(300, Math.min(CANVAS_H, viewBox.h * factor));
    onViewBoxChange({ x: pt.x - (pt.x - viewBox.x) * (nw / viewBox.w), y: pt.y - (pt.y - viewBox.y) * (nh / viewBox.h), w: nw, h: nh });
  };

  // ── Drop ───────────────────────────────────────────────────────────────────

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const assetId = e.dataTransfer.getData('assetId');
    if (!assetId) return;
    const pt    = svgPt(e);
    const asset = assetMap.get(assetId);
    if (!asset) return;
    const aspect = asset.imageAspectRatio;
    const baseW  = asset.physicalWidth ? asset.physicalWidth * 4 : 120;
    const baseH  = aspect ? Math.round(baseW / aspect) : (asset.physicalHeight ? asset.physicalHeight * 4 : 60);
    const newInst: PlacedAsset = { instanceId: crypto.randomUUID(), assetId, x: snap(pt.x - baseW / 2), y: snap(pt.y - baseH / 2), width: baseW, height: baseH };
    const extras: PlacedAsset[] = (asset.requires ?? []).map(rid => assetMap.get(rid)).filter(Boolean).map((req, i) => {
      const rW = req!.physicalWidth ? req!.physicalWidth * 4 : 80;
      const rH = req!.imageAspectRatio ? Math.round(rW / req!.imageAspectRatio) : (req!.physicalHeight ? req!.physicalHeight * 4 : 50);
      return { instanceId: crypto.randomUUID(), assetId: req!.id, x: snap(newInst.x + (i + 1) * 140), y: newInst.y, width: rW, height: rH };
    });
    onUpdate({ ...plan, instances: [...plan.instances, newInst, ...extras] });
  };

  // ── Asset interaction ──────────────────────────────────────────────────────

  const onAssetMouseDown = (e: React.MouseEvent, inst: PlacedAsset) => {
    e.stopPropagation();
    // Clicking on asset clears rotation mode for OTHER assets
    if (rotatingInstanceId && rotatingInstanceId !== inst.instanceId) {
      setRotatingInstanceId(null); setDraggingRotateId(null);
    }
    if (e.button === 2 || connectingFrom || resizingInstanceId || draggingRotateId) return;
    setSelectedInstanceId(inst.instanceId);
    setDraggingInstanceId(inst.instanceId);
    const pt = svgPt(e);
    setDragOffset({ dx: pt.x - inst.x, dy: pt.y - inst.y });
  };

  const onAssetContextMenu = (e: React.MouseEvent, inst: PlacedAsset) => {
    e.preventDefault(); e.stopPropagation();
    const wRect = wrapperRef.current!.getBoundingClientRect();
    setContextMenu({ kind: 'asset', screenX: e.clientX - wRect.left, screenY: e.clientY - wRect.top, instanceId: inst.instanceId });
  };

  const onRotateHandleMouseDown = (e: React.MouseEvent, inst: PlacedAsset) => {
    e.stopPropagation();
    setDraggingRotateId(inst.instanceId);
    setRotateCenter({ x: inst.x + inst.width / 2, y: inst.y + inst.height / 2 });
  };

  // ── Area ───────────────────────────────────────────────────────────────────

  const onAreaMouseDown = (e: React.MouseEvent, area: Area) => {
    e.stopPropagation();
    const pt = svgPt(e);
    setDraggingAreaId(area.id);
    setAreaDragOffset({ dx: pt.x - area.x, dy: pt.y - area.y });
  };

  const onAreaResizeMouseDown = (e: React.MouseEvent, area: Area) => {
    e.stopPropagation();
    const pt = svgPt(e);
    setResizingAreaId(area.id);
    setAreaResizeStart({ mx: pt.x, my: pt.y, w: area.width, h: area.height });
  };

  // ── Asset resize ───────────────────────────────────────────────────────────

  const onResizeMouseDown = (e: React.MouseEvent, inst: PlacedAsset, corner: ResizeCorner) => {
    e.stopPropagation();
    setResizingInstanceId(inst.instanceId); setResizeCorner(corner);
    const pt = svgPt(e);
    setResizeStart({ mx: pt.x, my: pt.y, inst: { ...inst } });
  };

  // ── Port click ─────────────────────────────────────────────────────────────

  const onPortClick = (e: React.MouseEvent, instanceId: string, portId: string) => {
    e.stopPropagation();
    if (!connectingFrom) { setConnectingFrom({ instanceId, portId }); return; }
    if (connectingFrom.instanceId === instanceId && connectingFrom.portId === portId) { setConnectingFrom(null); return; }

    const fromInst = plan.instances.find(i => i.instanceId === connectingFrom.instanceId);
    const toInst   = plan.instances.find(i => i.instanceId === instanceId);
    const fromPort = assetMap.get(fromInst?.assetId ?? '')?.ports.find(p => p.id === connectingFrom.portId);
    const toPort   = assetMap.get(toInst?.assetId ?? '')?.ports.find(p => p.id === portId);

    if (!fromPort || !toPort) { setConnectingFrom(null); return; }

    const result = validateConnection(fromPort, toPort);
    if (!result.valid) { setConnectingFrom(null); alert(`Connection not possible:\n${result.error}`); return; }

    const suggestion = buildCableSuggestion(fromPort, toPort, assets);
    if (suggestion) {
      setCableDialog({ fromInstanceId: connectingFrom.instanceId, fromPortId: connectingFrom.portId, toInstanceId: instanceId, toPortId: portId, suggestion, layer: fromPort.layer, selectedCable: suggestion.cableOptions[0]?.assetId ?? null, selectedIntermediate: suggestion.intermediateOptions?.[0]?.assetId ?? null });
      setConnectingFrom(null);
    } else {
      onUpdate({ ...plan, connections: [...plan.connections, { id: crypto.randomUUID(), fromInstanceId: connectingFrom.instanceId, fromPortId: connectingFrom.portId, toInstanceId: instanceId, toPortId: portId, layer: fromPort.layer, waypoints: [] }]});
      setConnectingFrom(null);
    }
  };

  // ── Cable dialog ───────────────────────────────────────────────────────────

  const confirmCableDialog = () => {
    if (!cableDialog) return;
    const { fromInstanceId, fromPortId, toInstanceId, toPortId, layer, suggestion } = cableDialog;
    if (suggestion.rule.kind === 'intermediate' && cableDialog.selectedIntermediate) {
      const ia = assets.find(a => a.id === cableDialog.selectedIntermediate);
      if (ia) {
        const fi = plan.instances.find(i => i.instanceId === fromInstanceId);
        const ti = plan.instances.find(i => i.instanceId === toInstanceId);
        const mx = fi && ti ? Math.round(((fi.x + fi.width/2) + (ti.x + ti.width/2)) / 2) : 400;
        const my = fi ? fi.y + fi.height + 60 : 400;
        const iW = ia.physicalWidth ? ia.physicalWidth * 4 : 80;
        const iH = ia.imageAspectRatio ? Math.round(iW / ia.imageAspectRatio) : 50;
        const ii: PlacedAsset = { instanceId: crypto.randomUUID(), assetId: ia.id, x: mx - iW/2, y: my, width: iW, height: iH };
        const aop = ia.ports.find(p => p.standard === 'power-adapter' && p.maleFemale === 'male');
        const pop = ia.ports.find(p => p.standard === 'power' && p.maleFemale === 'male');
        const fp  = assetMap.get(plan.instances.find(i => i.instanceId === fromInstanceId)?.assetId ?? '')?.ports.find(p => p.id === fromPortId);
        const tp  = assetMap.get(plan.instances.find(i => i.instanceId === toInstanceId)?.assetId ?? '')?.ports.find(p => p.id === toPortId);
        const nc: Connection[] = [];
        if (aop && fp?.standard === 'power-adapter') nc.push({ id: crypto.randomUUID(), fromInstanceId, fromPortId, toInstanceId: ii.instanceId, toPortId: aop.id, layer: 'power', waypoints: [] });
        if (pop && tp?.standard === 'power')         nc.push({ id: crypto.randomUUID(), fromInstanceId: ii.instanceId, fromPortId: pop.id, toInstanceId, toPortId, layer: 'power', waypoints: [] });
        onUpdate({ ...plan, instances: [...plan.instances, ii], connections: [...plan.connections, ...nc] });
      }
    } else {
      onUpdate({ ...plan, connections: [...plan.connections, { id: crypto.randomUUID(), fromInstanceId, fromPortId, toInstanceId, toPortId, layer: layer as any, waypoints: [], isDirect: suggestion.rule.kind === 'direct-connect' }]});
    }
    setCableDialog(null);
  };

  // ── Waypoint click ─────────────────────────────────────────────────────────

  const onConnectionClick = (e: React.MouseEvent, conn: Connection) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const pt = svgPt(e);
    // Use routed pts for finding the closest segment (accurate to actual rendered line)
    const routedResult = routedPaths.get(conn.id);
    const routedPts    = routedResult?.pts;
    if (!routedPts || routedPts.length < 2) return;
    // Find the segment of the routed path closest to the click
    let bestSeg = 0, minDist = Infinity;
    for (let i = 0; i < routedPts.length - 1; i++) {
      const d = distToSeg(pt, routedPts[i], routedPts[i + 1]);
      if (d < minDist) { minDist = d; bestSeg = i; }
    }
    // Insert a waypoint at the click position
    // To preserve routing, we add the snapped click point as a manual waypoint
    // and find where in the existing waypoints array it belongs
    const fromInst = plan.instances.find(i => i.instanceId === conn.fromInstanceId);
    const toInst   = plan.instances.find(i => i.instanceId === conn.toInstanceId);
    if (!fromInst || !toInst) return;
    const allPts = [getPortPos(fromInst, conn.fromPortId), ...conn.waypoints, getPortPos(toInst, conn.toPortId)];
    let bestIdx = conn.waypoints.length, minUserDist = Infinity;
    for (let i = 0; i < allPts.length - 1; i++) {
      const d = distToSeg(pt, allPts[i], allPts[i + 1]);
      if (d < minUserDist) { minUserDist = d; bestIdx = i; }
    }
    const newWp = [...conn.waypoints.slice(0, bestIdx), { x: snap(pt.x), y: snap(pt.y) }, ...conn.waypoints.slice(bestIdx)];
    onUpdate({ ...plan, connections: plan.connections.map(c => c.id === conn.id ? { ...c, waypoints: newWp } : c) });
  };

  const openConnCtxMenu = (e: React.MouseEvent, connId: string, waypointIdx: number | null) => {
    e.preventDefault(); e.stopPropagation();
    const wRect = wrapperRef.current!.getBoundingClientRect();
    setContextMenu({ kind: 'connection', screenX: e.clientX - wRect.left, screenY: e.clientY - wRect.top, connId, waypointIdx });
  };

  const removeConnection    = (connId: string) => { onUpdate({ ...plan, connections: plan.connections.filter(c => c.id !== connId) }); setContextMenu(null); };
  const removeWaypoint      = (connId: string, wpIdx: number) => { onUpdate({ ...plan, connections: plan.connections.map(c => c.id === connId ? { ...c, waypoints: c.waypoints.filter((_, i) => i !== wpIdx) } : c) }); setContextMenu(null); };
  const removeAssetInstance = (instanceId: string) => {
    onUpdate({ ...plan, instances: plan.instances.filter(i => i.instanceId !== instanceId), connections: plan.connections.filter(c => c.fromInstanceId !== instanceId && c.toInstanceId !== instanceId) });
    setContextMenu(null);
    if (selectedInstanceId === instanceId) setSelectedInstanceId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setContextMenu(null); setConnectingFrom(null); setRotatingInstanceId(null); setDraggingRotateId(null); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedInstanceId) removeAssetInstance(selectedInstanceId);
  };

  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
      onClick={() => setContextMenu(null)}>
      <svg ref={svgRef} viewBox={vb}
        style={{ display: 'block', width: '100%', height: '100%', outline: 'none', cursor: panning ? 'grabbing' : (draggingRotateId ? 'crosshair' : 'default') }}
        tabIndex={0}
        onMouseDown={onBgMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
        onWheel={onWheel} onDragOver={e => e.preventDefault()} onDrop={onDrop} onKeyDown={handleKeyDown}
      >
        <rect className="bg-rect" x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#1e293b" />
        <defs>
          <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
            <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#334155" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" className="bg-rect" />

        {/* Areas */}
        {plan.areas.map(area => {
          const col = area.color ?? '#ffffff';
          return (
            <g key={area.id}>
              <rect x={area.x} y={area.y} width={area.width} height={area.height} fill={col+'18'} stroke={col} strokeWidth={2} strokeDasharray="8 4" rx={4} style={{ cursor: 'grab' }} onMouseDown={e => onAreaMouseDown(e, area)} />
              <text x={area.x+8} y={area.y+18} fill={col} fontSize={12} opacity={0.9} style={{ pointerEvents: 'none' }}>{area.name}</text>
              <rect x={area.x+area.width-7} y={area.y+area.height-7} width={14} height={14} fill="white" stroke={col} strokeWidth={1.5} rx={2} style={{ cursor: 'se-resize' }} onMouseDown={e => onAreaResizeMouseDown(e, area)} />
            </g>
          );
        })}

        {/* Connections */}
        {plan.connections.filter(c => plan.layerVisibility[c.layer] !== false).map(conn => {
          const fromInst = plan.instances.find(i => i.instanceId === conn.fromInstanceId);
          const toInst   = plan.instances.find(i => i.instanceId === conn.toInstanceId);
          if (!fromInst || !toInst) return null;
          const result = routedPaths.get(conn.id);
          if (!result) return null;
          const { d: pathD, pts: routedPts } = result;
          const color     = LAYER_META[conn.layer]?.color ?? '#6B7280';
          const isHovered = hoveredConnectionId === conn.id;
          // Label placed on the actual routed path (not the straight connection line)
          const labelPt   = labelPositions[conn.id] !== undefined
            ? pathPointAtFraction(routedPts, labelPositions[conn.id])
            : labelPoint(routedPts);
          const fromPort   = assetMap.get(fromInst.assetId)?.ports.find(p => p.id === conn.fromPortId);
          const cableLabel = conn.isDirect ? 'DIRECT' : (fromPort ? (PORT_TYPE_LABELS[fromPort.standard] ?? fromPort.standard) : '');
          const showLabel  = plan.cableLabelVisibility?.[conn.layer] !== false && !!cableLabel;
          return (
            <g key={conn.id}>
              <path d={pathD} fill="none" stroke={color} strokeWidth={isHovered ? 2.5 : 1.5} opacity={0.95} style={{ pointerEvents: 'none' }} />
              <path d={pathD} fill="none" stroke="transparent" strokeWidth={16} style={{ cursor: 'crosshair' }}
                onMouseEnter={() => setHoveredConnectionId(conn.id)}
                onMouseLeave={() => setHoveredConnectionId(null)}
                onClick={e => onConnectionClick(e, conn)}
                onContextMenu={e => openConnCtxMenu(e, conn.id, null)} />
              {showLabel && (
                <g style={{ cursor: 'grab' }}
                  onMouseDown={e => { e.stopPropagation(); setDraggingLabelConnId(conn.id); }}
                  onMouseUp={() => setDraggingLabelConnId(null)}>
                  <rect x={labelPt.x - 24} y={labelPt.y - 9} width={48} height={14} rx={3} fill={color} opacity={0.95} />
                  <text x={labelPt.x} y={labelPt.y + 1} textAnchor="middle" fill="white" fontSize={8} fontWeight="600" style={{ pointerEvents: 'none' }}>{cableLabel}</text>
                </g>
              )}
              {isHovered && fromPort && (
                <g style={{ pointerEvents: 'none' }}>
                  <rect x={labelPt.x - 80} y={labelPt.y - 52} width={160} height={44} rx={4} fill="#0f172a" opacity={0.92} />
                  <text x={labelPt.x} y={labelPt.y - 36} textAnchor="middle" fill="white" fontSize={10} fontWeight="600">{fromPort.name}</text>
                  <text x={labelPt.x} y={labelPt.y - 22} textAnchor="middle" fill="#94a3b8" fontSize={8}>{cableLabel}</text>
                  <text x={labelPt.x} y={labelPt.y - 12} textAnchor="middle" fill="#64748b" fontSize={7}>Click: waypoint · Right-click: menu</text>
                </g>
              )}
              {conn.waypoints.map((wp, wpIdx) => (
                <g key={wpIdx} style={{ cursor: 'grab' }}
                  onMouseDown={e => { e.stopPropagation(); setDraggingWaypoint({ connId: conn.id, wpIdx }); }}
                  onContextMenu={e => openConnCtxMenu(e, conn.id, wpIdx)}>
                  <circle cx={wp.x} cy={wp.y} r={5} fill={color} stroke="white" strokeWidth={1.5} />
                </g>
              ))}
            </g>
          );
        })}

        {/* Assets */}
        {plan.instances.map(inst => {
          const asset      = assetMap.get(inst.assetId);
          if (!asset) return null;
          const selected   = inst.instanceId === selectedInstanceId;
          const isRotating = rotatingInstanceId === inst.instanceId; // set by context menu
          const isDraggingRotate = draggingRotateId === inst.instanceId;
          const rotation   = rotations[inst.instanceId] ?? 0;
          const cx = inst.x + inst.width / 2, cy = inst.y + inst.height / 2;
          const showImage  = plan.layerVisibility['hardware'] !== false;
          const showName   = plan.portLabelVisibility?.['hardware'] !== false;
          const corners: { key: ResizeCorner; cx: number; cy: number }[] = [
            { key: 'nw', cx: inst.x,             cy: inst.y              },
            { key: 'ne', cx: inst.x + inst.width, cy: inst.y              },
            { key: 'sw', cx: inst.x,             cy: inst.y + inst.height },
            { key: 'se', cx: inst.x + inst.width, cy: inst.y + inst.height },
          ];
          return (
            <g key={inst.instanceId}
              onMouseDown={e => onAssetMouseDown(e, inst)}
              onContextMenu={e => onAssetContextMenu(e, inst)}
              style={{ cursor: isDraggingRotate ? 'crosshair' : 'grab' }}
              transform={rotation !== 0 ? `rotate(${rotation},${cx},${cy})` : undefined}>
              {asset.frontImage && showImage ? (
                <>
                  {selected && <rect x={inst.x-2} y={inst.y-2} width={inst.width+4} height={inst.height+4} fill="none" stroke="#3B82F6" strokeWidth={2} rx={2} style={{ pointerEvents: 'none' }} />}
                  <image href={asset.frontImage} x={inst.x} y={inst.y} width={inst.width} height={inst.height} preserveAspectRatio="xMidYMid meet" />
                </>
              ) : (
                <>
                  <rect x={inst.x} y={inst.y} width={inst.width} height={inst.height} fill={showImage?'#F59E0B':'#334155'} stroke={selected?'#3B82F6':(showImage?'#D97706':'#475569')} strokeWidth={selected?2:1} rx={4} />
                  {(showName||!showImage) && <>
                    <text x={cx} y={cy-6} textAnchor="middle" fill={showImage?'#1F2937':'#94a3b8'} fontSize={11} fontWeight="600" style={{ pointerEvents: 'none' }}>{asset.vendor}</text>
                    <text x={cx} y={cy+8} textAnchor="middle" fill={showImage?'#1F2937':'#94a3b8'} fontSize={10} style={{ pointerEvents: 'none' }}>{asset.model}</text>
                  </>}
                </>
              )}
              {asset.frontImage && showImage && showName && (
                <text x={cx} y={inst.y+inst.height+12} textAnchor="middle" fill="white" fontSize={10} opacity={0.8} style={{ pointerEvents: 'none' }}>{asset.vendor} {asset.model}</text>
              )}
              {asset.ports.filter(p => plan.layerVisibility[p.layer] !== false).map(port => {
                const pos    = getPortPos(inst, port.id);
                const color  = PORT_COLORS[port.standard] ?? '#9CA3AF';
                const isConn = connectingFrom?.instanceId === inst.instanceId && connectingFrom?.portId === port.id;
                return (
                  <g key={port.id} onClick={e => onPortClick(e, inst.instanceId, port.id)} style={{ cursor: 'crosshair' }}>
                    <circle cx={pos.x} cy={pos.y} r={10} fill="transparent" />
                    <circle cx={pos.x} cy={pos.y} r={6} fill={color} stroke={isConn?'#fff':'rgba(0,0,0,0.4)'} strokeWidth={isConn?2.5:1} />
                    {plan.portLabelVisibility?.[port.layer] !== false && (
                      <text x={pos.x+9} y={pos.y+4} fill="white" fontSize={9} opacity={0.75} style={{ pointerEvents: 'none' }}>{port.name}</text>
                    )}
                    <title>{port.name} ({port.maleFemale})</title>
                  </g>
                );
              })}
              {selected && !isRotating && corners.map(c => (
                <rect key={c.key} x={c.cx-5} y={c.cy-5} width={10} height={10} fill="white" stroke="#3B82F6" strokeWidth={1.5} rx={1} style={{ cursor: RESIZE_CURSOR[c.key] }} onMouseDown={e => onResizeMouseDown(e, inst, c.key)} />
              ))}
              {/* Rotation handle — only visible when rotation mode is active for this asset */}
              {isRotating && (
                <g onMouseDown={e => onRotateHandleMouseDown(e, inst)} style={{ cursor: 'crosshair' }}>
                  <line x1={cx} y1={inst.y-8} x2={cx} y2={inst.y-20} stroke="#F59E0B" strokeWidth={1.5} />
                  <circle cx={cx} cy={inst.y-24} r={6} fill="#F59E0B" stroke="white" strokeWidth={1.5} />
                  <text x={cx} y={inst.y-20} textAnchor="middle" fill="white" fontSize={7} style={{ pointerEvents: 'none' }}>↺</text>
                </g>
              )}
              {rotation !== 0 && isRotating && (
                <text x={cx} y={inst.y-34} textAnchor="middle" fill="#F59E0B" fontSize={9} style={{ pointerEvents: 'none' }}>{rotation}°</text>
              )}
            </g>
          );
        })}

        {/* Alignment guides */}
        {alignLines.map((line, i) => (
          <line key={i} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="#F472B6" strokeWidth={1} strokeDasharray="6 4" opacity={0.8} style={{ pointerEvents: 'none' }} />
        ))}
      </svg>

      {/* Connection context menu */}
      {contextMenu?.kind === 'connection' && (
        <div style={{ position:'absolute', left:Math.min(contextMenu.screenX,(wrapperRef.current?.clientWidth??600)-180), top:Math.min(contextMenu.screenY,(wrapperRef.current?.clientHeight??400)-120), zIndex:200, background:'white', border:'1px solid #e2e8f0', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.18)', minWidth:160, padding:'4px 0' }}
          onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
          {contextMenu.waypointIdx !== null && <button onClick={() => removeWaypoint(contextMenu.connId, contextMenu.waypointIdx!)} className="w-full text-left px-4 py-2 text-sm text-orange-700 hover:bg-orange-50">✕ Remove waypoint</button>}
          <button onClick={() => removeConnection(contextMenu.connId)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">⌫ Remove connection</button>
          <div className="border-t my-1" />
          <button onClick={() => setContextMenu(null)} className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
        </div>
      )}

      {/* Asset context menu */}
      {contextMenu?.kind === 'asset' && (() => {
        const inst  = plan.instances.find(i => i.instanceId === (contextMenu as AssetCtxMenu).instanceId);
        const asset = inst ? assetMap.get(inst.assetId) : undefined;
        return (
          <div style={{ position:'absolute', left:Math.min(contextMenu.screenX,(wrapperRef.current?.clientWidth??600)-180), top:Math.min(contextMenu.screenY,(wrapperRef.current?.clientHeight??400)-180), zIndex:200, background:'white', border:'1px solid #e2e8f0', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.18)', minWidth:160, padding:'4px 0' }}
            onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
            {asset && <div className="px-4 py-1.5 text-xs text-gray-400 border-b font-medium truncate max-w-[160px]">{asset.vendor} {asset.model}</div>}
            <button onClick={() => {
              setRotatingInstanceId((contextMenu as AssetCtxMenu).instanceId);
              setSelectedInstanceId((contextMenu as AssetCtxMenu).instanceId);
              setContextMenu(null);
            }} className="w-full text-left px-4 py-2 text-sm text-amber-600 hover:bg-amber-50">↺ Rotate</button>
            <button onClick={() => {
              const ctxInst = plan.instances.find(i => i.instanceId === (contextMenu as AssetCtxMenu).instanceId);
              if (ctxInst) setMoveConnectorsAssetId(ctxInst.assetId);
              setContextMenu(null);
            }} className="w-full text-left px-4 py-2 text-sm text-purple-600 hover:bg-purple-50">⊕ Move Connectors</button>
            {onEditAsset && inst && <button onClick={() => { onEditAsset(inst.assetId); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50">✏ Edit</button>}
            <button onClick={() => removeAssetInstance((contextMenu as AssetCtxMenu).instanceId)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">⌫ Delete</button>
            <div className="border-t my-1" />
            <button onClick={() => setContextMenu(null)} className="w-full text-left px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
          </div>
        );
      })()}

      {/* Cable dialog */}
      {cableDialog && (
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setCableDialog(null)}>
          <div style={{ background:'white', borderRadius:12, padding:'20px 24px', minWidth:300, maxWidth:400, boxShadow:'0 8px 32px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div className="text-sm font-semibold text-gray-800 mb-1">Create connection</div>
            <div className="text-xs text-gray-400 mb-3">
              {cableDialog.suggestion.fromPort.name} ({cableDialog.suggestion.fromPort.maleFemale==='male'?'plug':'socket'}) → {cableDialog.suggestion.toPort.name} ({cableDialog.suggestion.toPort.maleFemale==='male'?'plug':'socket'})
            </div>
            {cableDialog.suggestion.rule.kind === 'direct-connect' && (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg mb-3">
                <span className="text-2xl">🔗</span>
                <div><div className="text-sm font-semibold text-green-800">Direct Connect</div><div className="text-xs text-green-600">No cable needed — plug into socket</div></div>
              </div>
            )}
            {cableDialog.suggestion.rule.warning && <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 mb-3"><span>⚠</span><span>{cableDialog.suggestion.rule.warning}</span></div>}
            {cableDialog.suggestion.rule.kind === 'intermediate' && (
              <div className="mb-3">
                <div className="text-xs font-medium text-gray-600 mb-1">Required intermediate device:</div>
                {(cableDialog.suggestion.intermediateOptions ?? []).length === 0
                  ? <div className="text-xs text-red-500 p-2 bg-red-50 rounded">No matching device found in database.</div>
                  : (cableDialog.suggestion.intermediateOptions ?? []).map((opt: CableOption) => (
                    <label key={opt.assetId??'x'} className={`flex items-center gap-2 p-2 rounded border cursor-pointer mb-1 ${cableDialog.selectedIntermediate===opt.assetId?'border-blue-400 bg-blue-50':'border-gray-200'}`}>
                      <input type="radio" checked={cableDialog.selectedIntermediate===opt.assetId} onChange={() => setCableDialog((d: any) => ({...d, selectedIntermediate: opt.assetId}))} />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
              </div>
            )}
            {(cableDialog.suggestion.rule.kind==='direct'||cableDialog.suggestion.rule.kind==='adapter-cable') && cableDialog.suggestion.cableOptions.length>0 && (
              <div className="mb-3">
                <div className="text-xs font-medium text-gray-600 mb-1">{cableDialog.suggestion.rule.kind==='adapter-cable'?'Adapter cable:':'Cable:'}</div>
                {cableDialog.suggestion.cableOptions.map((opt: CableOption) => (
                  <label key={opt.assetId??'x'} className={`flex items-center gap-2 p-2 rounded border cursor-pointer mb-1 ${cableDialog.selectedCable===opt.assetId?'border-blue-400 bg-blue-50':'border-gray-200'}`}>
                    <input type="radio" checked={cableDialog.selectedCable===opt.assetId} onChange={() => setCableDialog((d: any) => ({...d, selectedCable: opt.assetId}))} />
                    <div><div className="text-sm">{opt.label}</div>{opt.assetId===null&&<div className="text-xs text-gray-400">Generic</div>}</div>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-2 justify-end mt-2">
              <button onClick={() => setCableDialog(null)} className="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
              <button onClick={confirmCableDialog} disabled={cableDialog.suggestion.rule.kind==='intermediate'&&!cableDialog.selectedIntermediate}
                className={`px-4 py-1.5 text-sm rounded font-medium disabled:opacity-40 ${cableDialog.suggestion.rule.kind==='direct-connect'?'bg-green-600 hover:bg-green-700 text-white':'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                {cableDialog.suggestion.rule.kind==='direct-connect'?'Direct Connect':'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Connectors popup — PortPositionEditor in a modal overlay */}
      {moveConnectorsAssetId && (() => {
        const editAsset = assets.find(a => a.id === moveConnectorsAssetId);
        if (!editAsset) return null;
        return (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setMoveConnectorsAssetId(null)}>
            <div style={{ background: 'white', borderRadius: 12, width: '85%', height: '80%', maxWidth: 900, boxShadow: '0 12px 48px rgba(0,0,0,0.4)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
              onClick={e => e.stopPropagation()}>
              <PortPositionEditor
                asset={editAsset}
                onChange={updated => {
                  if (onUpdateAsset) onUpdateAsset(updated.id, updated);
                }}
                onClose={() => setMoveConnectorsAssetId(null)}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x-a.x, dy = b.y-a.y, len2 = dx*dx+dy*dy;
  if (len2===0) return Math.hypot(p.x-a.x, p.y-a.y);
  const t = Math.max(0, Math.min(1, ((p.x-a.x)*dx+(p.y-a.y)*dy)/len2));
  return Math.hypot(p.x-a.x-t*dx, p.y-a.y-t*dy);
}
