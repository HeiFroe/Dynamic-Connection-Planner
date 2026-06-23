import React, { useMemo, useState, useCallback } from 'react';
import { Connection, LAYER_META, PlacedAsset, Asset, Layer, RoutingConfig, DEFAULT_ROUTING_CONFIG } from '../../types';
import {
  getPortStub, buildOrthoPathFull, buildOrthoPreview,
  OrthoSeg, findCrossings, buildPathWithCrossovers, RoutingParams,
} from '../../utils/routing';

interface Props {
  connections: Connection[];
  instances: PlacedAsset[];
  assetMap: Record<string, Asset>;
  visibleLayers: Record<string, boolean>;
  cableLabelVisibility?: Partial<Record<Layer, boolean>>;
  portLabelVisibility?: Partial<Record<Layer, boolean>>;
  /** @deprecated legacy single-toggle */
  labelVisibility?: Partial<Record<Layer, boolean>>;
  connectingFrom: { instanceId: string; portId: string } | null;
  mousePos: { x: number; y: number } | null;
  onLineClick: (connId: string, clientX: number, clientY: number) => void;
  onWaypointMouseDown: (connId: string, wpIdx: number, clientX: number, clientY: number) => void;
  onContextMenu: (e: React.MouseEvent, connId: string, type: 'line' | 'waypoint', wpIdx?: number) => void;
  labelPositions?: Record<string, number>;
  onLabelDrag?: (connId: string, newT: number) => void;
  routingConfig?: RoutingConfig;
}

// Pick a good label position: the longest straight segment of the ortho path
function bestLabelPoint(
  exit1: { x: number; y: number },
  exit2: { x: number; y: number },
  waypoints: { x: number; y: number }[],
  segments: OrthoSeg[],
  tOverride?: number,
): { x: number; y: number } {
  if (tOverride !== undefined && segments.length > 0) {
    return pointAtT(segments, tOverride);
  }

  const pts = [exit1, ...waypoints, exit2];
  if (pts.length < 2) return exit1;

  let bestLen = -1;
  let bestMid = { x: (exit1.x + exit2.x) / 2, y: (exit1.y + exit2.y) / 2 };

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (len > bestLen) {
      bestLen = len;
      bestMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  }
  return bestMid;
}

// Get total path length from segments
function pathLength(segments: OrthoSeg[]): number {
  return segments.reduce((acc, s) =>
    acc + Math.abs(s.x2 - s.x1) + Math.abs(s.y2 - s.y1), 0);
}

// Get point at parameter t (0..1) along the path
function pointAtT(segments: OrthoSeg[], t: number): { x: number; y: number } {
  const total = pathLength(segments);
  if (total < 1) return { x: segments[0]?.x1 ?? 0, y: segments[0]?.y1 ?? 0 };
  let target = total * Math.max(0, Math.min(1, t));
  for (const seg of segments) {
    const len = Math.abs(seg.x2 - seg.x1) + Math.abs(seg.y2 - seg.y1);
    if (target <= len) {
      const frac = len > 0 ? target / len : 0;
      return {
        x: seg.x1 + (seg.x2 - seg.x1) * frac,
        y: seg.y1 + (seg.y2 - seg.y1) * frac,
      };
    }
    target -= len;
  }
  const last = segments[segments.length - 1];
  return { x: last.x2, y: last.y2 };
}

// Get T parameter at a click point along the path
function tAtPoint(segments: OrthoSeg[], px: number, py: number): number {
  const total = pathLength(segments);
  if (total < 1) return 0.5;

  let accumulated = 0;
  let bestDist = Infinity;
  let bestT = 0.5;

  for (const seg of segments) {
    const len = Math.abs(seg.x2 - seg.x1) + Math.abs(seg.y2 - seg.y1);
    if (len < 0.1) { accumulated += len; continue; }

    // Project point onto segment
    let frac: number;
    if (seg.isHorizontal) {
      const minX = Math.min(seg.x1, seg.x2), maxX = Math.max(seg.x1, seg.x2);
      frac = (px - seg.x1) / (seg.x2 - seg.x1);
      const clampedX = Math.max(minX, Math.min(maxX, px));
      const dist = Math.abs(py - seg.y1) + Math.abs(px - clampedX);
      if (dist < bestDist) {
        bestDist = dist;
        bestT = (accumulated + Math.abs(clampedX - seg.x1)) / total;
      }
    } else {
      const minY = Math.min(seg.y1, seg.y2), maxY = Math.max(seg.y1, seg.y2);
      frac = (py - seg.y1) / (seg.y2 - seg.y1);
      const clampedY = Math.max(minY, Math.min(maxY, py));
      const dist = Math.abs(px - seg.x1) + Math.abs(py - clampedY);
      if (dist < bestDist) {
        bestDist = dist;
        bestT = (accumulated + Math.abs(clampedY - seg.y1)) / total;
      }
    }
    accumulated += len;
  }

  return Math.max(0.05, Math.min(0.95, bestT));
}

function portGroupKey(instanceId: string, portId: string): string {
  return `${instanceId}::${portId}`;
}

export function ConnectionLayer({
  connections, instances, assetMap, visibleLayers,
  cableLabelVisibility, portLabelVisibility, labelVisibility,
  connectingFrom, mousePos,
  onLineClick, onWaypointMouseDown, onContextMenu,
  labelPositions, onLabelDrag,
  routingConfig,
}: Props) {

  const [draggingLabel, setDraggingLabel] = useState<string | null>(null);
  const rp: RoutingParams = routingConfig ?? DEFAULT_ROUTING_CONFIG;

  // Build a map of asset bounding boxes for routing avoidance
  const boxes = instances.map(inst => {
    const asset = assetMap[inst.assetId];
    if (!asset) return null;
    const w = inst.instanceWidth ?? asset.width;
    const h = inst.instanceHeight ?? (asset.imageAspectRatio ? w / asset.imageAspectRatio : asset.height);
    return { id: inst.instanceId, x: inst.x, y: inst.y, w, h };
  }).filter(Boolean) as { id: string; x: number; y: number; w: number; h: number }[];

  // ── First pass: collect all visible connections and compute parallel groups ──
  const visibleConns = useMemo(() => {
    return connections.filter(c => visibleLayers[c.layer]);
  }, [connections, visibleLayers]);

  // Group connections that share the same source-asset pair (for parallel offset)
  const parallelGroups = useMemo(() => {
    type GroupKey = string;
    const groups: Record<GroupKey, string[]> = {};

    for (const conn of visibleConns) {
      // Normalise endpoint pair key
      const ids = [conn.fromInstanceId, conn.toInstanceId].sort();
      const key: GroupKey = `${ids[0]}::${ids[1]}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(conn.id);
    }

    const result: Record<string, { parallelIndex: number; totalParallel: number }> = {};
    for (const ids of Object.values(groups)) {
      ids.forEach((id, idx) => {
        result[id] = { parallelIndex: idx, totalParallel: ids.length };
      });
    }
    return result;
  }, [visibleConns]);

  // Pre-compute per-port label offset indices
  const fromPortCount: Record<string, number> = {};
  const toPortCount:   Record<string, number> = {};

  type ConnMeta = {
    conn: Connection;
    fromStub: NonNullable<ReturnType<typeof getPortStub>>;
    toStub:   NonNullable<ReturnType<typeof getPortStub>>;
    fromPort: Asset['ports'][0] | undefined;
    toPort:   Asset['ports'][0] | undefined;
    strokeColor: string;
    strokeDash: string | undefined;
    segments: OrthoSeg[];
    rawPathD: string;
    labelPt: { x: number; y: number };
    showCableLabel: boolean;
    showPortLabel: boolean;
    cableName: string | undefined;
    fromOffsetIndex: number;
    toOffsetIndex: number;
  };

  const connMetas: ConnMeta[] = [];

  for (const conn of visibleConns) {
    const fromInst = instances.find(i => i.instanceId === conn.fromInstanceId);
    const toInst   = instances.find(i => i.instanceId === conn.toInstanceId);
    if (!fromInst || !toInst) continue;

    const fromAsset = assetMap[fromInst.assetId];
    const toAsset   = assetMap[toInst.assetId];
    if (!fromAsset || !toAsset) continue;

    const fromStub = getPortStub(fromInst, fromAsset, conn.fromPortId, rp);
    const toStub   = getPortStub(toInst,   toAsset,   conn.toPortId,   rp);
    if (!fromStub || !toStub) continue;

    const fromPort = fromAsset.ports.find(p => p.id === conn.fromPortId);
    const toPort   = toAsset.ports.find(p => p.id === conn.toPortId);

    const color = LAYER_META[conn.layer]?.color ?? '#888';
    const layer = conn.layer as Layer;

    const lineStyle = routingConfig?.layerLineStyle?.[layer] ?? routingConfig?.defaultLineStyle ?? 'solid';
    const strokeDash = lineStyle === 'dashed' ? '6 4' : lineStyle === 'dotted' ? '2 3' : undefined;
    const strokeColor = color;

    const showCableLabel = cableLabelVisibility?.[layer]
      ?? labelVisibility?.[layer]
      ?? true;
    const showPortLabel = portLabelVisibility?.[layer]
      ?? labelVisibility?.[layer]
      ?? true;

    const avoidBoxes = boxes.filter(b =>
      b.id !== conn.fromInstanceId && b.id !== conn.toInstanceId
    );

    const pg = parallelGroups[conn.id] ?? { parallelIndex: 0, totalParallel: 1 };

    const routed = buildOrthoPathFull(
      fromStub.exit,
      toStub.exit,
      conn.waypoints ?? [],
      fromStub.direction,
      toStub.direction,
      avoidBoxes,
      pg.parallelIndex,
      pg.totalParallel,
      rp,
    );

    const isDirect = conn.cableAssetId === '__direct__';
    const isLegacy = conn.cableAssetId === '__legacy__' || !conn.cableAssetId;
    const cableName = isLegacy
      ? undefined
      : isDirect
        ? 'Direct'
        : assetMap[conn.cableAssetId]?.name;

    // Anchor label at midpoint of first segment (stays near source asset)
    const labelPt = routed.segments.length > 0
      ? { x: (routed.segments[0].x1 + routed.segments[0].x2) / 2, y: (routed.segments[0].y1 + routed.segments[0].y2) / 2 }
      : fromStub.exit;

    const fromKey = portGroupKey(conn.fromInstanceId, conn.fromPortId);
    const toKey   = portGroupKey(conn.toInstanceId,   conn.toPortId);
    const fromOffsetIndex = fromPortCount[fromKey] ?? 0;
    const toOffsetIndex   = toPortCount[toKey]     ?? 0;
    fromPortCount[fromKey] = fromOffsetIndex + 1;
    toPortCount[toKey]     = toOffsetIndex   + 1;

    connMetas.push({
      conn, fromStub, toStub, fromPort, toPort,
      strokeColor, strokeDash,
      segments: routed.segments,
      rawPathD: routed.d,
      labelPt,
      showCableLabel, showPortLabel, cableName,
      fromOffsetIndex, toOffsetIndex,
    });
  }

  // ── Second pass: compute crossover arcs ───────────────────────────────────
  // For each connection pair that intersects, add arc on the one with lower id
  const finalPaths: Record<string, string> = {};

  for (let i = 0; i < connMetas.length; i++) {
    const me = connMetas[i];
    let crossings: ReturnType<typeof findCrossings> = [];

    for (let j = 0; j < connMetas.length; j++) {
      if (i === j) continue;
      const other = connMetas[j];
      const c = findCrossings(me.segments, other.segments, me.conn.id, other.conn.id);
      crossings = crossings.concat(c);
    }

    if (crossings.length > 0) {
      finalPaths[me.conn.id] = buildPathWithCrossovers(me.segments, crossings, rp);
    } else {
      finalPaths[me.conn.id] = me.rawPathD;
    }
  }

  // ── Label drag handler ───────────────────────────────────────────────────
  const handleLabelMouseDown = useCallback((
    e: React.MouseEvent, connId: string, segments: OrthoSeg[]
  ) => {
    if (!onLabelDrag) return;
    e.stopPropagation();
    e.preventDefault();
    setDraggingLabel(connId);

    const onMove = (me: MouseEvent) => {
      // We need canvas coordinates — approximate using the SVG parent
      const svg = (e.target as SVGElement)?.closest('svg');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      // The SVG is inside the transformable div, so coords are in canvas space
      const pt = svg.createSVGPoint();
      pt.x = me.clientX;
      pt.y = me.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const svgPt = pt.matrixTransform(ctm.inverse());
      const t = tAtPoint(segments, svgPt.x, svgPt.y);
      onLabelDrag(connId, t);
    };

    const onUp = () => {
      setDraggingLabel(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [onLabelDrag]);

  return (
    <svg
      style={{
        position: 'absolute', top: 0, left: 0,
        overflow: 'visible', pointerEvents: 'none',
        width: '100%', height: '100%',
      }}
    >
      {connMetas.map(({
        conn, fromStub, toStub, fromPort, toPort,
        strokeColor, strokeDash, segments, labelPt,
        showCableLabel, showPortLabel, cableName,
        fromOffsetIndex, toOffsetIndex,
      }) => {
        const strokeW = 2;
        const pathD = finalPaths[conn.id] ?? '';

        return (
          <g key={conn.id}>
            {/* Wide invisible hit area */}
            <path
              d={pathD}
              stroke="transparent"
              strokeWidth={16}
              fill="none"
              style={{ pointerEvents: 'stroke', cursor: 'crosshair' }}
              onClick={e => { e.stopPropagation(); onLineClick(conn.id, e.clientX, e.clientY); }}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, conn.id, 'line'); }}
            />

            {/* Edge stubs — from port dot to tile edge */}
            <line x1={fromStub.edge.x} y1={fromStub.edge.y} x2={fromStub.exit.x} y2={fromStub.exit.y}
              stroke={strokeColor} strokeWidth={strokeW} strokeDasharray={strokeDash} opacity={0.9} style={{ pointerEvents: 'none' }} />
            <line x1={toStub.edge.x}   y1={toStub.edge.y}   x2={toStub.exit.x}   y2={toStub.exit.y}
              stroke={strokeColor} strokeWidth={strokeW} strokeDasharray={strokeDash} opacity={0.9} style={{ pointerEvents: 'none' }} />

            {/* Main routed line */}
            <path d={pathD} stroke={strokeColor} strokeWidth={strokeW} strokeDasharray={strokeDash}
              fill="none" opacity={0.9} style={{ pointerEvents: 'none' }} />

            {/* Cable label — pill badge, draggable along line */}
            {showCableLabel && cableName && (
              <CableLabel
                x={labelPt.x} y={labelPt.y}
                text={cableName} color={strokeColor}
                isDragging={draggingLabel === conn.id}
                onMouseDown={onLabelDrag
                  ? e => handleLabelMouseDown(e, conn.id, segments)
                  : undefined}
              />
            )}

            {/* Port labels — at the stub exit (just outside the asset), not inside */}
            {showPortLabel && fromPort?.label && (
              <PortAnchorLabel
                x={fromStub.exit.x}
                y={fromStub.exit.y}
                dir={fromStub.direction}
                text={fromPort.label}
                color={strokeColor}
                offsetIndex={fromOffsetIndex}
              />
            )}
            {showPortLabel && toPort?.label && (
              <PortAnchorLabel
                x={toStub.exit.x}
                y={toStub.exit.y}
                dir={toStub.direction}
                text={toPort.label}
                color={strokeColor}
                offsetIndex={toOffsetIndex}
              />
            )}

            {/* Waypoint dots */}
            {(conn.waypoints ?? []).map((wp, wpIdx) => (
              <circle
                key={wpIdx}
                cx={wp.x} cy={wp.y} r={6}
                fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1.5}
                style={{ pointerEvents: 'auto', cursor: 'grab' }}
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onWaypointMouseDown(conn.id, wpIdx, e.clientX, e.clientY); }}
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, conn.id, 'waypoint', wpIdx); }}
              />
            ))}
          </g>
        );
      })}

      {/* In-progress connection preview */}
      {connectingFrom && mousePos && (() => {
        const fromInst = instances.find(i => i.instanceId === connectingFrom.instanceId);
        if (!fromInst) return null;
        const fromAsset = assetMap[fromInst.assetId];
        if (!fromAsset) return null;
        const fromStub = getPortStub(fromInst, fromAsset, connectingFrom.portId);
        if (!fromStub) return null;
        return (
          <path
            d={buildOrthoPreview(fromStub.exit, mousePos, fromStub.direction, rp)}
            stroke="#94A3B8" strokeWidth={2} strokeDasharray="6 4"
            fill="none" opacity={0.8} style={{ pointerEvents: 'none' }}
          />
        );
      })()}
    </svg>
  );
}

// Pill badge — floats over the line on a white background, draggable
function CableLabel({
  x, y, text, color, isDragging, onMouseDown,
}: {
  x: number; y: number; text: string; color: string;
  isDragging?: boolean;
  onMouseDown?: (e: React.MouseEvent<SVGGElement>) => void;
}) {
  const PAD_X = 6, PAD_Y = 3;
  const fontSize = 9;
  const estW = text.length * fontSize * 0.58 + PAD_X * 2;
  const estH = fontSize + PAD_Y * 2;
  const canDrag = !!onMouseDown;
  return (
    <g
      style={{
        pointerEvents: canDrag ? 'auto' : 'none',
        cursor: isDragging ? 'grabbing' : canDrag ? 'grab' : 'default',
      }}
      onMouseDown={onMouseDown}
    >
      {/* White knockout so the line doesn't show through */}
      <rect x={-estW / 2 + x} y={-estH / 2 + y} width={estW} height={estH}
        rx={estH / 2} fill="white" opacity={1} />
      <rect x={-estW / 2 + x} y={-estH / 2 + y} width={estW} height={estH}
        rx={estH / 2} fill="white" stroke={color} strokeWidth={isDragging ? 2 : 1} opacity={0.97} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="middle"
        fontSize={fontSize} fontWeight={700} fill={color}
        style={{ userSelect: 'none' }}>
        {text}
      </text>
    </g>
  );
}

// Port name badge — positioned just outside the asset edge (at stub exit)
function PortAnchorLabel({ x, y, dir, text, color, offsetIndex = 0 }: {
  x: number; y: number;
  dir: 'top' | 'bottom' | 'left' | 'right';
  text: string; color: string;
  offsetIndex?: number;
}) {
  const OFFSET = 2;
  const STAGGER = 12;
  const fontSize = 8;
  const estW = text.length * fontSize * 0.58 + 8;
  const estH = fontSize + 6;

  const staggerOffset = offsetIndex * STAGGER;

  let bx = x, by = y;
  if (dir === 'top')    { by = y - estH / 2 - OFFSET; bx = x + staggerOffset; }
  if (dir === 'bottom') { by = y + estH / 2 + OFFSET; bx = x + staggerOffset; }
  if (dir === 'left')   { bx = x - estW / 2 - OFFSET; by = y + staggerOffset; }
  if (dir === 'right')  { bx = x + estW / 2 + OFFSET; by = y + staggerOffset; }

  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect x={bx - estW / 2} y={by - estH / 2} width={estW} height={estH}
        rx={3} fill="rgba(255,255,255,0.95)" stroke={color} strokeWidth={0.8} />
      <text x={bx} y={by} textAnchor="middle" dominantBaseline="middle"
        fontSize={fontSize} fontWeight={500} fill={color}>
        {text}
      </text>
    </g>
  );
}
