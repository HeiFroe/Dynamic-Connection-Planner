import React, {
  useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle,
} from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Plan, Asset, Connection, PlacedAsset, Area, RoutingConfig } from '../../types';
import {
  arePortsCompatible, getAttachPosition,
  findCompatibleCables, canConnectDirectly, getCableLengthSum,
} from '../../utils/compatibility';
import { CanvasAsset, ResizeHandle } from './CanvasAsset';
import { ConnectionLayer } from './ConnectionLayer';
import { ConnectionPickerDialog, ConnectionOption } from './CablePickerDialog';
import { ContextMenu } from './ContextMenu';
import { CanvasNavigator } from './CanvasNavigator';
import { AreaLayer } from './AreaLayer';

const SNAP_DISTANCE = 40;
const CANVAS_W = 2400;
const CANVAS_H = 1600;
const AREA_INSET = 8; // px inset for locked-area containment
// Alignment guide snap tolerance in canvas pixels
const ALIGN_SNAP = 6;

interface ConnectingFrom { instanceId: string; portId: string; }
interface CtxMenu {
  x: number; y: number;
  items: { label: string; action: () => void; danger?: boolean }[];
}
interface PickerState {
  options: ConnectionOption[];
  fromInst: string; fromPort: string;
  toInst: string; toPort: string;
  fromLabel: string; toLabel: string;
  note?: string;
}

/** Rect defined during area-draw drag */
interface AreaDraft {
  startX: number; startY: number;
  endX: number; endY: number;
}

/** State for the inline confirm/name UI shown after draft drag ends */
interface AreaPending {
  x: number; y: number;
  width: number; height: number;
  /** true while showing name input */
  naming: boolean;
  name: string;
}

/** Guide lines computed during a drag */
interface AlignGuide {
  type: 'v' | 'h';   // vertical (x=const) or horizontal (y=const)
  coord: number;
  label?: string;
}

export interface CanvasHandle {
  getViewport: () => { offset: { x: number; y: number }; scale: number };
}

interface Props {
  plan: Plan;
  assets: Asset[];
  onUpdatePlan: (plan: Plan) => void;
  onEditAsset: (assetId: string) => void;
  routingConfig?: RoutingConfig;
}

/** Returns a normalised rect (positive width/height) from two arbitrary points */
function normaliseRect(x1: number, y1: number, x2: number, y2: number) {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width:  Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

/** Check if a point (cx, cy) lies within an Area */
function pointInArea(cx: number, cy: number, area: Area): boolean {
  return cx >= area.x && cx <= area.x + area.width &&
         cy >= area.y && cy <= area.y + area.height;
}

/** Clamp a placed-asset position so its centre stays within a locked area (with inset) */
function clampToArea(newX: number, newY: number, assetW: number, assetH: number, area: Area): { x: number; y: number } {
  const minX = area.x + AREA_INSET;
  const minY = area.y + AREA_INSET;
  const maxX = area.x + area.width  - AREA_INSET - assetW;
  const maxY = area.y + area.height - AREA_INSET - assetH;
  return {
    x: Math.max(minX, Math.min(maxX, newX)),
    y: Math.max(minY, Math.min(maxY, newY)),
  };
}

export const Canvas = forwardRef<CanvasHandle, Props>(function Canvas(
  { plan, assets, onUpdatePlan, onEditAsset, routingConfig }, ref
) {
  const assetMap = Object.fromEntries(assets.map(a => [a.id, a]));
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [vpOffset, setVpOffset] = useState({ x: 40, y: 40 });
  const [vpScale, setVpScale] = useState(1);
  const vpDragging = useRef(false);
  const vpPanning = useRef(false);
  const vpLast = useRef({ x: 0, y: 0 });
  // touch pinch state
  const touchPinchDist = useRef<number | null>(null);
  const touchPinchMid  = useRef<{ x: number; y: number } | null>(null);
  // history for Back button (up to 30 snapshots)
  const history = useRef<{ instances: PlacedAsset[]; connections: Connection[] }[]>([]);
  const historyPushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const draggingAsset = useRef<{
    instanceId: string;
    startMouseX: number; startMouseY: number;
    startX: number; startY: number;
  } | null>(null);

  const draggingWaypoint = useRef<{
    connId: string; waypointIdx: number;
    startMouseX: number; startMouseY: number;
    origPos: { x: number; y: number };
  } | null>(null);

  const draggingResize = useRef<{
    instanceId: string; handle: ResizeHandle;
    startMouseX: number; startMouseY: number;
    startX: number; startY: number;
    startW: number; startH: number;
    aspectRatio: number | null;
  } | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceHeldRef = useRef(false); // ref copy of spaceHeld for use in capture-phase listeners
  const [connectingFrom, setConnectingFrom] = useState<ConnectingFrom | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [snapTarget, setSnapTarget] = useState<{ instanceId: string; pointId: string } | null>(null);
  const [cablePicker, setCablePicker] = useState<PickerState | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  /** instanceId of asset currently in rotation mode (resize → rotate) */
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  /** Per-connection label position (0..1 along path) */
  const [labelPositions, setLabelPositions] = useState<Record<string, number>>({});
  /** Active alignment guides while dragging */
  const [alignGuides, setAlignGuides] = useState<AlignGuide[]>([]);

  // ── Area drawing state ────────────────────────────────────────────────────
  const [addingArea, setAddingArea] = useState(false);
  const [areaDraft, setAreaDraft]   = useState<AreaDraft | null>(null);
  const [areaPending, setAreaPending] = useState<AreaPending | null>(null);
  const areaDragging = useRef(false);
  const areaDragStart = useRef<{ x: number; y: number } | null>(null);

  // Inline rename state for areas
  const [renamingAreaId, setRenamingAreaId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useImperativeHandle(ref, () => ({
    getViewport: () => ({ offset: vpOffset, scale: vpScale }),
  }), [vpOffset, vpScale]);

  const { setNodeRef, isOver } = useDroppable({ id: 'canvas-drop' });

  const setRefs = useCallback((node: HTMLDivElement | null) => {
    (wrapperRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    setNodeRef(node);
  }, [setNodeRef]);

  const toCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - vpOffset.x) / vpScale,
      y: (clientY - rect.top  - vpOffset.y) / vpScale,
    };
  }, [vpOffset, vpScale]);

  const getTileSize = useCallback((inst: PlacedAsset) => {
    const asset = assetMap[inst.assetId];
    if (!asset) return { w: 80, h: 40 };
    const w = inst.instanceWidth ?? asset.width;
    const h = inst.instanceHeight ?? (asset.imageAspectRatio ? w / asset.imageAspectRatio : asset.height);
    return { w, h };
  }, [assetMap]);

  // Native pointerdown listener bypasses DndKit's PointerSensor so Space+drag works
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || !spaceHeldRef.current) return;
      e.stopPropagation(); // prevent DndKit from capturing this event
      el.setPointerCapture(e.pointerId);
      vpLast.current = { x: e.clientX, y: e.clientY };
      vpPanning.current = true;
      setIsPanning(true);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!vpPanning.current) return;
      setVpOffset(o => ({ x: o.x + e.clientX - vpLast.current.x, y: o.y + e.clientY - vpLast.current.y }));
      vpLast.current = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = () => {
      if (!vpPanning.current) return;
      vpPanning.current = false;
      setIsPanning(false);
    };
    el.addEventListener('pointerdown', onPointerDown, { capture: true });
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown, { capture: true });
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
    };
  });  // runs every render to pick up current spaceHeldRef

  // ── Wheel zoom + middle-button pan ──────────────────────────────────────────
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        // zoom
        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.08 : 0.93;
        setVpScale(s => {
          const next = Math.min(4, Math.max(0.15, s * factor));
          setVpOffset(o => ({
            x: mouseX - (mouseX - o.x) * (next / s),
            y: mouseY - (mouseY - o.y) * (next / s),
          }));
          return next;
        });
      } else {
        // pan
        setVpOffset(o => ({ x: o.x - e.deltaX, y: o.y - e.deltaY }));
      }
    };

    const onMiddleDown = (e: PointerEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      vpLast.current = { x: e.clientX, y: e.clientY };
      vpPanning.current = true;
      setIsPanning(true);
    };
    const onMiddleMove = (e: PointerEvent) => {
      if (!vpPanning.current || e.buttons !== 4) return;
      setVpOffset(o => ({ x: o.x + e.clientX - vpLast.current.x, y: o.y + e.clientY - vpLast.current.y }));
      vpLast.current = { x: e.clientX, y: e.clientY };
    };
    const onMiddleUp = (e: PointerEvent) => {
      if (e.button !== 1) return;
      vpPanning.current = false;
      setIsPanning(false);
    };

    // Touch pinch-to-zoom + two-finger pan
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        touchPinchDist.current = Math.hypot(dx, dy);
        touchPinchMid.current = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || touchPinchDist.current === null) return;
      e.preventDefault();
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const newDist = Math.hypot(dx, dy);
      const factor = newDist / touchPinchDist.current;
      const mid = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      const rect = el.getBoundingClientRect();
      const mx = mid.x - rect.left;
      const my = mid.y - rect.top;
      setVpScale(s => {
        const next = Math.min(4, Math.max(0.15, s * factor));
        const panDx = mid.x - (touchPinchMid.current?.x ?? mid.x);
        const panDy = mid.y - (touchPinchMid.current?.y ?? mid.y);
        setVpOffset(o => ({
          x: mx - (mx - o.x) * (next / s) + panDx,
          y: my - (my - o.y) * (next / s) + panDy,
        }));
        return next;
      });
      touchPinchDist.current = newDist;
      touchPinchMid.current = mid;
    };
    const onTouchEnd = () => {
      touchPinchDist.current = null;
      touchPinchMid.current = null;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onMiddleDown);
    el.addEventListener('pointermove', onMiddleMove);
    el.addEventListener('pointerup', onMiddleUp);
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onMiddleDown);
      el.removeEventListener('pointermove', onMiddleMove);
      el.removeEventListener('pointerup', onMiddleUp);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);  // stable — only touches refs and setters

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConnectingFrom(null);
        setCtxMenu(null);
        setCablePicker(null);
        setAddingArea(false);
        setAreaDraft(null);
        setAreaPending(null);
        setRenamingAreaId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        spaceHeldRef.current = true;
        setSpaceHeld(true);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false;
        setSpaceHeld(false);
        setIsPanning(false);
        vpPanning.current = false;
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  const handleAssetMouseDown = useCallback((e: React.MouseEvent, instanceId: string) => {
    if (e.button !== 0 || connectingFrom) return;
    e.stopPropagation();
    const inst = plan.instances.find(i => i.instanceId === instanceId);
    if (!inst) return;
    // Disable resize handles on all OTHER instances when selecting this one
    const othersHaveHandles = plan.instances.some(i => i.instanceId !== instanceId && i.resizeHandlesEnabled);
    if (othersHaveHandles) {
      onUpdatePlan({
        ...plan,
        instances: plan.instances.map(i =>
          i.instanceId !== instanceId ? { ...i, resizeHandlesEnabled: false } : i
        ),
      });
    }
    draggingAsset.current = {
      instanceId,
      startMouseX: e.clientX, startMouseY: e.clientY,
      startX: inst.x, startY: inst.y,
    };
    setSelectedId(instanceId);
    setCtxMenu(null);
  }, [plan, connectingFrom, onUpdatePlan]);

  const handleResizeHandleMouseDown = useCallback((
    e: React.MouseEvent, instanceId: string, handle: ResizeHandle
  ) => {
    e.stopPropagation();
    const inst = plan.instances.find(i => i.instanceId === instanceId);
    if (!inst) return;
    const asset = assetMap[inst.assetId];
    if (!asset) return;

    // Rotation mode: compute rotation from drag angle
    if (rotatingId === instanceId) {
      const { w, h } = getTileSize(inst);
      const centerX = inst.x + w / 2;
      const centerY = inst.y + h / 2;
      const startAngle = (inst as any).rotation ?? 0;

      const onMove = (me: MouseEvent) => {
        const canvasPos = toCanvasCoords(me.clientX, me.clientY);
        const angle = Math.atan2(canvasPos.y - centerY, canvasPos.x - centerX) * (180 / Math.PI) + 90;
        const snappedAngle = Math.round(angle / 15) * 15; // snap to 15° increments
        onUpdatePlan({
          ...plan,
          instances: plan.instances.map(i =>
            i.instanceId === instanceId ? { ...i, rotation: snappedAngle } as any : i
          ),
        });
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return;
    }

    const { w, h } = getTileSize(inst);
    const hasImage = !!(asset.frontImage || asset.rearImage);
    // Force aspect ratio for image assets
    const aspectRatio = asset.imageAspectRatio ?? (hasImage ? w / h : null);
    draggingResize.current = {
      instanceId, handle,
      startMouseX: e.clientX, startMouseY: e.clientY,
      startX: inst.x, startY: inst.y,
      startW: w, startH: h,
      aspectRatio,
    };
  }, [plan.instances, assetMap, getTileSize, rotatingId, toCanvasCoords, onUpdatePlan, plan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvasPos = toCanvasCoords(e.clientX, e.clientY);
    setMousePos(canvasPos);

    // ── Area draft drag ──
    if (areaDragging.current && areaDragStart.current) {
      setAreaDraft({
        startX: areaDragStart.current.x,
        startY: areaDragStart.current.y,
        endX: canvasPos.x,
        endY: canvasPos.y,
      });
      return;
    }

    if (draggingResize.current) {
      const { instanceId, handle, startMouseX, startMouseY, startX, startY, startW, startH, aspectRatio } = draggingResize.current;
      const dx = (e.clientX - startMouseX) / vpScale;
      const dy = (e.clientY - startMouseY) / vpScale;
      let newX = startX, newY = startY, newW = startW, newH = startH;

      if (handle.includes('e')) newW = Math.max(40, startW + dx);
      if (handle.includes('w')) { newW = Math.max(40, startW - dx); newX = startX + startW - newW; }
      if (handle.includes('s')) newH = Math.max(20, startH + dy);
      if (handle.includes('n')) { newH = Math.max(20, startH - dy); newY = startY + startH - newH; }

      // Always maintain aspect ratio (required for image assets; also applied to non-image for uniformity)
      if (aspectRatio !== null) {
        if (handle === 'n' || handle === 's') {
          // Vertical drag → derive width
          newW = newH * aspectRatio;
        } else if (handle === 'e' || handle === 'w') {
          // Horizontal drag → derive height
          newH = newW / aspectRatio;
        } else {
          // Corner drag → scale uniformly by larger axis
          const r = Math.max(newW / startW, newH / startH);
          newW = startW * r; newH = startH * r;
          if (handle.includes('w')) newX = startX + startW - newW;
          if (handle.includes('n')) newY = startY + startH - newH;
        }
      }

      onUpdatePlan({
        ...plan,
        instances: plan.instances.map(i =>
          i.instanceId === instanceId
            ? { ...i, x: newX, y: newY, instanceWidth: Math.round(newW), instanceHeight: Math.round(newH) }
            : i
        ),
      });
      return;
    }

    if (draggingAsset.current) {
      const { instanceId, startMouseX, startMouseY, startX, startY } = draggingAsset.current;
      let newX = startX + (e.clientX - startMouseX) / vpScale;
      let newY = startY + (e.clientY - startMouseY) / vpScale;

      const movingInst = plan.instances.find(i => i.instanceId === instanceId);
      const movingAsset = assetMap[movingInst?.assetId ?? ''];
      const { w: assetW, h: assetH } = movingInst ? getTileSize(movingInst) : { w: 80, h: 40 };
      let snapFound: typeof snapTarget = null;

      for (const host of plan.instances) {
        if (host.instanceId === instanceId) continue;
        const hostAsset = assetMap[host.assetId];
        if (!hostAsset || !movingAsset) continue;
        for (const ap of hostAsset.attachmentPoints) {
          if (ap.role !== 'host' || !ap.accepts.includes(movingAsset.category)) continue;
          const snapPos = getAttachPosition(
            host.x, host.y, hostAsset.width, hostAsset.height,
            ap, movingAsset.width, movingAsset.height
          );
          if (Math.hypot(newX - snapPos.x, newY - snapPos.y) < SNAP_DISTANCE) {
            newX = snapPos.x; newY = snapPos.y;
            snapFound = { instanceId: host.instanceId, pointId: ap.id };
            break;
          }
        }
        if (snapFound) break;
      }

      // ── Locked-area containment ──
      if (!snapFound && movingInst) {
        const areas = plan.areas ?? [];
        const cx = newX + assetW / 2;
        const cy = newY + assetH / 2;
        for (const area of areas) {
          if (!area.locked) continue;
          // Check if asset centre was originally inside this area at drag-start
          const origCx = startX + assetW / 2;
          const origCy = startY + assetH / 2;
          if (pointInArea(origCx, origCy, area)) {
            // Clamp new position to area bounds
            if (!pointInArea(cx, cy, area)) {
              const clamped = clampToArea(newX, newY, assetW, assetH, area);
              newX = clamped.x;
              newY = clamped.y;
            }
            break;
          }
        }
      }

      setSnapTarget(snapFound);
      // ── Alignment guides ──
      if (!snapFound) {
        const guides: AlignGuide[] = [];
        const movingAssetDef = movingAsset;
        if (movingAssetDef) {
          for (const other of plan.instances) {
            if (other.instanceId === instanceId) continue;
            const { w: ow, h: oh } = getTileSize(other);
            // Centers
            const otherCx = other.x + ow / 2;
            const otherCy = other.y + oh / 2;
            const myCx = newX + assetW / 2;
            const myCy = newY + assetH / 2;
            if (Math.abs(myCx - otherCx) < ALIGN_SNAP) {
              guides.push({ type: 'v', coord: otherCx });
              newX = otherCx - assetW / 2;
            }
            if (Math.abs(myCy - otherCy) < ALIGN_SNAP) {
              guides.push({ type: 'h', coord: otherCy });
              newY = otherCy - assetH / 2;
            }
            // Top edges
            if (Math.abs(newY - other.y) < ALIGN_SNAP) {
              guides.push({ type: 'h', coord: other.y });
              newY = other.y;
            }
            // Bottom edges
            if (Math.abs((newY + assetH) - (other.y + oh)) < ALIGN_SNAP) {
              guides.push({ type: 'h', coord: other.y + oh });
              newY = other.y + oh - assetH;
            }
            // Left edges
            if (Math.abs(newX - other.x) < ALIGN_SNAP) {
              guides.push({ type: 'v', coord: other.x });
              newX = other.x;
            }
            // Right edges
            if (Math.abs((newX + assetW) - (other.x + ow)) < ALIGN_SNAP) {
              guides.push({ type: 'v', coord: other.x + ow });
              newX = other.x + ow - assetW;
            }
          }
        }
        setAlignGuides(guides);
      } else {
        setAlignGuides([]);
      }
      onUpdatePlan({
        ...plan,
        instances: plan.instances.map(inst =>
          inst.instanceId === instanceId
            ? { ...inst, x: newX, y: newY, attachedTo: snapFound ? { instanceId: snapFound.instanceId, attachmentPointId: snapFound.pointId } : undefined }
            : inst
        ),
      });
      return;
    }

    if (draggingWaypoint.current) {
      const { connId, waypointIdx, startMouseX, startMouseY, origPos } = draggingWaypoint.current;
      const dx = (e.clientX - startMouseX) / vpScale;
      const dy = (e.clientY - startMouseY) / vpScale;
      onUpdatePlan({
        ...plan,
        connections: plan.connections.map(c =>
          c.id !== connId ? c : {
            ...c,
            waypoints: c.waypoints.map((w, i) =>
              i === waypointIdx ? { x: origPos.x + dx, y: origPos.y + dy } : w
            ),
          }
        ),
      });
      return;
    }
  }, [toCanvasCoords, vpScale, plan, assetMap, onUpdatePlan, getTileSize]);

  const handleMouseUp = useCallback(() => {
    // Finish area draft drag
    if (areaDragging.current && areaDraft) {
      areaDragging.current = false;
      areaDragStart.current = null;
      const rect = normaliseRect(areaDraft.startX, areaDraft.startY, areaDraft.endX, areaDraft.endY);
      if (rect.width > 20 && rect.height > 20) {
        setAreaPending({ ...rect, naming: false, name: '' });
      }
      setAreaDraft(null);
      return;
    }

    draggingAsset.current = null;
    draggingWaypoint.current = null;
    draggingResize.current = null;
    vpDragging.current = false;
    vpPanning.current = false;
    setIsPanning(false);
    setSnapTarget(null);
    setAlignGuides([]);
  }, [areaDraft]);

  const handleCanvasBgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;

    // ── Area drawing mode ──
    if (addingArea && !areaPending) {
      e.stopPropagation();
      const pos = toCanvasCoords(e.clientX, e.clientY);
      areaDragging.current = true;
      areaDragStart.current = pos;
      setAreaDraft({ startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y });
      return;
    }

    setSelectedId(null);
    setCtxMenu(null);
    setRotatingId(null);
    if (connectingFrom) { setConnectingFrom(null); return; }
    // Disable resize handles on all instances when clicking empty canvas
    if (plan.instances.some(i => i.resizeHandlesEnabled)) {
      onUpdatePlan({ ...plan, instances: plan.instances.map(i => ({ ...i, resizeHandlesEnabled: false })) });
    }
    if (!spaceHeld) return; // Panning only when Space is held
    vpLast.current = { x: e.clientX, y: e.clientY };
    vpPanning.current = true;
    setIsPanning(true); // for cursor style only
  }, [connectingFrom, plan, onUpdatePlan, spaceHeld, addingArea, areaPending, toCanvasCoords]);

  const handlePortClick = useCallback((instanceId: string, portId: string) => {
    if (!connectingFrom) { setConnectingFrom({ instanceId, portId }); return; }
    if (connectingFrom.instanceId === instanceId && connectingFrom.portId === portId) {
      setConnectingFrom(null); return;
    }
    const fromInst = plan.instances.find(i => i.instanceId === connectingFrom.instanceId);
    const toInst   = plan.instances.find(i => i.instanceId === instanceId);
    if (!fromInst || !toInst) { setConnectingFrom(null); return; }
    const fromAsset = assetMap[fromInst.assetId];
    const toAsset   = assetMap[toInst.assetId];
    const fromPort  = fromAsset?.ports.find(p => p.id === connectingFrom.portId);
    const toPort    = toAsset?.ports.find(p => p.id === portId);
    if (!fromPort || !toPort || !fromAsset || !toAsset) { setConnectingFrom(null); return; }

    if (!arePortsCompatible(fromPort, toPort)) {
      alert(`Incompatible ports:\n${fromPort.label} (${fromPort.type}) ↔ ${toPort.label} (${toPort.type})`);
      setConnectingFrom(null); return;
    }
    const duplicate = plan.connections.some(
      c => (c.fromInstanceId === connectingFrom.instanceId && c.fromPortId === connectingFrom.portId &&
            c.toInstanceId === instanceId && c.toPortId === portId) ||
           (c.fromInstanceId === instanceId && c.fromPortId === portId &&
            c.toInstanceId === connectingFrom.instanceId && c.toPortId === connectingFrom.portId)
    );
    if (duplicate) { setConnectingFrom(null); return; }

    // Collect all valid connection options (direct + compatible cables)
    const options: ConnectionOption[] = [];

    if (canConnectDirectly(fromPort, fromAsset, toPort, toAsset)) {
      options.push({
        cableAssetId: '__direct__',
        label: 'Direct connection (plug → port)',
        sublabel: 'no cable',
        color: '#6b7280',
      });
    }

    // Compute cable-length budget warnings: check both endpoints' cableLengthLimit
    const lengthChecks: { instanceId: string; limit: NonNullable<Asset['cableLengthLimit']>; existingSum: number; touchedPortId: string }[] = [];
    for (const [inst, port] of [[fromInst, fromPort], [toInst, toPort]] as const) {
      const asset = assetMap[inst.assetId];
      if (asset?.cableLengthLimit && asset.cableLengthLimit.portIds.includes(port.id)) {
        lengthChecks.push({
          instanceId: inst.instanceId,
          limit: asset.cableLengthLimit,
          existingSum: getCableLengthSum(plan.connections, inst.instanceId, asset.cableLengthLimit.portIds, assetMap),
          touchedPortId: port.id,
        });
      }
    }

    // RULE-003: Sort compatible cables — bundled cables first, then by length ascending
    const bundledIds = new Set([
      ...(fromAsset.requires ?? []),
      ...(toAsset.requires ?? []),
    ]);
    const compatibleCables = findCompatibleCables(fromPort, fromAsset, toPort, toAsset, assets)
      .sort((a, b) => {
        const aBundled = bundledIds.has(a.id) ? 0 : 1;
        const bBundled = bundledIds.has(b.id) ? 0 : 1;
        if (aBundled !== bBundled) return aBundled - bBundled;
        return (a.cableLength ?? 0) - (b.cableLength ?? 0);
      });
    for (const cable of compatibleCables) {
      let warning: string | undefined;
      for (const lc of lengthChecks) {
        const newSum = lc.existingSum + (cable.cableLength ?? 0);
        if (newSum > lc.limit.maxMeters) {
          warning = `Exceeds ${lc.limit.maxMeters} m limit (Σ ${newSum.toFixed(1)} m)`;
        }
      }
      options.push({
        cableAssetId: cable.id,
        label: cable.name,
        sublabel: bundledIds.has(cable.id) ? `${cable.manufacturer} · bundled` : cable.manufacturer,
        color: cable.color,
        lengthMeters: cable.cableLength,
        warning,
      });
    }

    if (options.length === 0) {
      alert(`No compatible connection available for:\n${fromPort.label} (${fromPort.type}) ↔ ${toPort.label} (${toPort.type})`);
      setConnectingFrom(null); return;
    }
    setConnectingFrom(null);

    let note: string | undefined;
    if (lengthChecks.length > 0) {
      const lc = lengthChecks[0];
      note = `${lc.limit.description ?? `Cable-length limit ${lc.limit.maxMeters} m`} · already used: ${lc.existingSum.toFixed(1)} m`;
    }

    setCablePicker({
      options,
      fromInst: fromInst.instanceId, fromPort: fromPort.id,
      toInst: toInst.instanceId, toPort: toPort.id,
      fromLabel: `${fromAsset.name} · ${fromPort.label}`,
      toLabel: `${toAsset.name} · ${toPort.label}`,
      note,
    });
  }, [connectingFrom, plan, assetMap, assets]);

  const handleCableSelected = useCallback((cableAssetId: string) => {
    if (!cablePicker) return;
    const fromInstObj = plan.instances.find(i => i.instanceId === cablePicker.fromInst);
    const fromPort = assetMap[fromInstObj?.assetId ?? '']?.ports.find(p => p.id === cablePicker.fromPort);
    if (!fromPort) { setCablePicker(null); return; }
    onUpdatePlan({ ...plan, connections: [...plan.connections, {
      id: crypto.randomUUID(),
      fromInstanceId: cablePicker.fromInst, fromPortId: cablePicker.fromPort,
      toInstanceId: cablePicker.toInst, toPortId: cablePicker.toPort,
      cableAssetId, layer: fromPort.layer, waypoints: [],
    } as Connection] });
    setCablePicker(null);
  }, [cablePicker, plan, assetMap, onUpdatePlan]);

  const handleDeleteInstance = useCallback((instanceId: string) => {
    onUpdatePlan({
      ...plan,
      instances:   plan.instances.filter(i => i.instanceId !== instanceId),
      connections: plan.connections.filter(c => c.fromInstanceId !== instanceId && c.toInstanceId !== instanceId),
    });
    setSelectedId(null);
    setCtxMenu(null);
  }, [plan, onUpdatePlan]);

  const handleLineClick = useCallback((connId: string, clientX: number, clientY: number) => {
    const pos = toCanvasCoords(clientX, clientY);
    onUpdatePlan({
      ...plan,
      connections: plan.connections.map(c =>
        c.id !== connId ? c : { ...c, waypoints: [...(c.waypoints ?? []), pos] }
      ),
    });
  }, [plan, onUpdatePlan, toCanvasCoords]);

  const handleWaypointMouseDown = useCallback((connId: string, wpIdx: number, clientX: number, clientY: number) => {
    const conn = plan.connections.find(c => c.id === connId);
    if (!conn?.waypoints?.[wpIdx]) return;
    draggingWaypoint.current = {
      connId, waypointIdx: wpIdx,
      startMouseX: clientX, startMouseY: clientY,
      origPos: { ...conn.waypoints[wpIdx] },
    };
  }, [plan.connections]);

  const handleConnectionContextMenu = useCallback((
    e: React.MouseEvent, connId: string, type: 'line' | 'waypoint', wpIdx?: number
  ) => {
    if (type === 'waypoint' && wpIdx !== undefined) {
      setCtxMenu({ x: e.clientX, y: e.clientY, items: [{
        label: 'Remove waypoint', danger: true,
        action: () => onUpdatePlan({
          ...plan,
          connections: plan.connections.map(c =>
            c.id !== connId ? c : { ...c, waypoints: c.waypoints.filter((_, i) => i !== wpIdx) }
          ),
        }),
      }] });
    } else {
      setCtxMenu({ x: e.clientX, y: e.clientY, items: [{
        label: 'Delete connection', danger: true,
        action: () => onUpdatePlan({ ...plan, connections: plan.connections.filter(c => c.id !== connId) }),
      }] });
    }
  }, [plan, onUpdatePlan]);

  const handleAssetContextMenu = useCallback((e: React.MouseEvent, instanceId: string) => {
    const inst = plan.instances.find(i => i.instanceId === instanceId);
    if (!inst) return;
    const asset = assetMap[inst.assetId];
    if (!asset) return;

    const items: CtxMenu['items'] = [];

    // Front/Rear toggle
    if (asset.rearImage) {
      items.push({
        label: inst.viewMode === 'rear' ? 'Show Front' : 'Show Rear',
        action: () => onUpdatePlan({
          ...plan,
          instances: plan.instances.map(i =>
            i.instanceId === instanceId ? { ...i, viewMode: inst.viewMode === 'rear' ? 'front' : 'rear' } : i
          ),
        }),
      });
    }

    // Rotate mode (toggles rotate vs resize)
    const isRotating = rotatingId === instanceId;
    items.push({
      label: isRotating ? 'Stop Rotating' : 'Rotate',
      action: () => {
        if (isRotating) {
          setRotatingId(null);
        } else {
          setRotatingId(instanceId);
          // Enable resize handles so user can drag (rotation uses same drag handles)
          onUpdatePlan({
            ...plan,
            instances: plan.instances.map(i =>
              i.instanceId === instanceId ? { ...i, resizeHandlesEnabled: true } : { ...i, resizeHandlesEnabled: false }
            ),
          });
        }
        setCtxMenu(null);
      },
    });

    // Resize handles toggle (only when NOT in rotate mode)
    if (!isRotating) {
      items.push({
        label: inst.resizeHandlesEnabled ? 'Disable Resize' : 'Enable Resize',
        action: () => onUpdatePlan({
          ...plan,
          instances: plan.instances.map(i =>
            i.instanceId === instanceId ? { ...i, resizeHandlesEnabled: !i.resizeHandlesEnabled } : i
          ),
        }),
      });
    }

    // Edit asset (switch to Asset Manager)
    items.push({
      label: 'Edit',
      action: () => {
        onEditAsset(asset.id);
        setCtxMenu(null);
      },
    });

    // Delete
    items.push({
      label: 'Delete', danger: true,
      action: () => handleDeleteInstance(instanceId),
    });

    setCtxMenu({ x: e.clientX, y: e.clientY, items });
  }, [plan, assetMap, onUpdatePlan, onEditAsset, handleDeleteInstance, rotatingId]);

  // ── Area handlers ──────────────────────────────────────────────────────────

  const handleAreaToggleLock = useCallback((areaId: string) => {
    onUpdatePlan({
      ...plan,
      areas: (plan.areas ?? []).map(a =>
        a.id === areaId ? { ...a, locked: !a.locked } : a
      ),
    });
  }, [plan, onUpdatePlan]);

  const handleAreaContextMenu = useCallback((e: React.MouseEvent, areaId: string) => {
    const area = (plan.areas ?? []).find(a => a.id === areaId);
    if (!area) return;

    const items: CtxMenu['items'] = [
      {
        label: 'Rename Area',
        action: () => {
          setRenamingAreaId(areaId);
          setRenameValue(area.name);
          setCtxMenu(null);
        },
      },
      {
        label: area.locked ? 'Unlock Area' : 'Lock Area',
        action: () => {
          onUpdatePlan({
            ...plan,
            areas: (plan.areas ?? []).map(a =>
              a.id === areaId ? { ...a, locked: !a.locked } : a
            ),
          });
        },
      },
      {
        label: 'Delete Area',
        danger: true,
        action: () => {
          onUpdatePlan({
            ...plan,
            areas: (plan.areas ?? []).filter(a => a.id !== areaId),
          });
        },
      },
    ];
    setCtxMenu({ x: e.clientX, y: e.clientY, items });
  }, [plan, onUpdatePlan]);

  // Canvas-level context menu: hit-test areas first so right-clicking anywhere
  // inside an area (even on top of assets) opens the area menu
  const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    const coords = toCanvasCoords(e.clientX, e.clientY);
    const hit = (plan.areas ?? []).find(a =>
      coords.x >= a.x && coords.x <= a.x + a.width &&
      coords.y >= a.y && coords.y <= a.y + a.height
    );
    if (hit) {
      e.preventDefault();
      e.stopPropagation();
      handleAreaContextMenu(e, hit.id);
    }
  }, [toCanvasCoords, plan.areas, handleAreaContextMenu]);

  const commitAreaPending = useCallback((name: string) => {
    if (!areaPending) return;

    // Anti-overlap: reject if this rect intersects any existing area
    const existing = plan.areas ?? [];
    const nx1 = areaPending.x, ny1 = areaPending.y;
    const nx2 = nx1 + areaPending.width, ny2 = ny1 + areaPending.height;
    const overlaps = existing.some(a => {
      const ax2 = a.x + a.width, ay2 = a.y + a.height;
      return nx1 < ax2 && nx2 > a.x && ny1 < ay2 && ny2 > a.y;
    });
    if (overlaps) {
      alert('Areas cannot overlap. Please choose a different location.');
      return; // keep pending so user can cancel manually
    }

    // Cycle through a set of area colours for variety
    const AREA_COLORS = ['#ffffff', '#6366F1', '#0891B2', '#7C3AED', '#0D9488', '#B45309', '#BE185D'];
    const color = AREA_COLORS[existing.length % AREA_COLORS.length];

    const newArea: Area = {
      id: crypto.randomUUID(),
      name: name.trim() || 'New Area',
      x: areaPending.x, y: areaPending.y,
      width: areaPending.width, height: areaPending.height,
      locked: true,
      color,
    };
    onUpdatePlan({
      ...plan,
      areas: [...existing, newArea],
    });
    setAreaPending(null);
    setAddingArea(false);
  }, [areaPending, plan, onUpdatePlan]);

  const cancelAreaPending = useCallback(() => {
    setAreaPending(null);
    setAddingArea(false);
  }, []);

  // ── Label drag handler ────────────────────────────────────────────────────
  const handleLabelDrag = useCallback((connId: string, newT: number) => {
    setLabelPositions(prev => ({ ...prev, [connId]: newT }));
  }, []);
  const handlePan = useCallback((dx: number, dy: number) => {
    setVpOffset(o => ({ x: o.x + dx, y: o.y + dy }));
  }, []);

  const handleZoom = useCallback((factor: number) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 0;
    const cy = rect ? rect.height / 2 : 0;
    setVpScale(s => {
      const next = Math.min(4, Math.max(0.15, s * factor));
      setVpOffset(o => ({
        x: cx - (cx - o.x) * (next / s),
        y: cy - (cy - o.y) * (next / s),
      }));
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setVpScale(1);
    setVpOffset({ x: 40, y: 40 });
  }, []);

  const handleFit = useCallback(() => {
    if (plan.instances.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const inst of plan.instances) {
      const { w, h } = getTileSize(inst);
      minX = Math.min(minX, inst.x);
      minY = Math.min(minY, inst.y);
      maxX = Math.max(maxX, inst.x + w);
      maxY = Math.max(maxY, inst.y + h);
    }
    const PAD = 60;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const newScale = Math.max(0.1, Math.min(
      rect.width  / (maxX - minX + 2 * PAD),
      rect.height / (maxY - minY + 2 * PAD),
      2,
    ));
    setVpScale(newScale);
    setVpOffset({ x: -(minX - PAD) * newScale, y: -(minY - PAD) * newScale });
  }, [plan.instances, getTileSize]);

  // ── History (Back button) ────────────────────────────────────────────────────
  const pushHistory = useCallback(() => {
    history.current = [
      ...history.current.slice(-29),
      { instances: plan.instances.map(i => ({ ...i })), connections: plan.connections.map(c => ({ ...c })) },
    ];
  }, [plan.instances, plan.connections]);

  // Auto-push on asset moves with debounce
  const debouncedPushHistory = useCallback(() => {
    if (historyPushTimer.current) clearTimeout(historyPushTimer.current);
    historyPushTimer.current = setTimeout(() => { pushHistory(); }, 600);
  }, [pushHistory]);

  const handleBack = useCallback(() => {
    const snap = history.current.pop();
    if (!snap) return;
    onUpdatePlan({ ...plan, instances: snap.instances, connections: snap.connections });
  }, [plan, onUpdatePlan]);

  // ── Layout-Optimieren ────────────────────────────────────────────────────────
  const handleOptimizeLayout = useCallback(() => {
    if (plan.instances.length === 0) return;
    pushHistory();

    const CANVAS_TARGET_W = 1800;  // target width (leave margins)
    const CANVAS_TARGET_H = 980;   // target height
    const MARGIN = 80;             // outer margin
    const COL_GAP = 120;           // minimum horizontal gap between nodes
    const ROW_GAP = 140;           // minimum vertical gap between rows

    const sizeOf = (id: string) => {
      const inst = plan.instances.find(i => i.instanceId === id);
      if (!inst) return { w: 80, h: 40 };
      return getTileSize(inst);
    };

    // Build undirected adjacency
    const adj: Record<string, string[]> = {};
    for (const inst of plan.instances) adj[inst.instanceId] = [];
    for (const c of plan.connections) {
      adj[c.fromInstanceId]?.push(c.toInstanceId);
      adj[c.toInstanceId]?.push(c.fromInstanceId);
    }

    // Find connected components
    const visited = new Set<string>();
    const components: string[][] = [];
    for (const inst of plan.instances) {
      if (visited.has(inst.instanceId)) continue;
      const component: string[] = [];
      const bfsQ = [inst.instanceId];
      visited.add(inst.instanceId);
      while (bfsQ.length > 0) {
        const cur = bfsQ.shift()!;
        component.push(cur);
        for (const nb of (adj[cur] ?? [])) {
          if (!visited.has(nb)) { visited.add(nb); bfsQ.push(nb); }
        }
      }
      components.push(component);
    }

    // Sort each component: start from most-connected node, do BFS for levels
    const allPositions: Record<string, { x: number; y: number }> = {};
    let compOffsetX = MARGIN;

    for (const comp of components) {
      // Sort by degree desc to pick root
      const root = [...comp].sort((a, b) => (adj[b]?.length ?? 0) - (adj[a]?.length ?? 0))[0];
      if (!root) continue;

      // BFS level assignment within component
      const levels: Record<string, number> = {};
      const bfsQ2 = [root];
      levels[root] = 0;
      while (bfsQ2.length > 0) {
        const cur = bfsQ2.shift()!;
        for (const nb of (adj[cur] ?? [])) {
          if (levels[nb] === undefined) {
            levels[nb] = levels[cur] + 1;
            bfsQ2.push(nb);
          }
        }
      }
      // Any unvisited nodes in component get max+1
      let maxLvl = Math.max(0, ...Object.values(levels));
      for (const id of comp) {
        if (levels[id] === undefined) levels[id] = ++maxLvl;
      }

      // Group by level, sort within level by connection order
      const byLevel: Record<number, string[]> = {};
      for (const id of comp) {
        const lvl = levels[id];
        if (!byLevel[lvl]) byLevel[lvl] = [];
        byLevel[lvl].push(id);
      }

      // Compute component bounding box
      let compW = 0;
      let compH = 0;
      let rowY = MARGIN;
      const compPos: Record<string, { x: number; y: number }> = {};

      for (let lvl = 0; lvl <= maxLvl; lvl++) {
        const ids = byLevel[lvl] ?? [];
        if (ids.length === 0) continue;
        const rowH = Math.max(...ids.map(id => sizeOf(id).h));
        let rowX = 0;
        for (const id of ids) {
          compPos[id] = { x: rowX, y: rowY };
          rowX += sizeOf(id).w + COL_GAP;
        }
        compW = Math.max(compW, rowX - COL_GAP);
        compH = rowY + rowH;
        rowY += rowH + ROW_GAP;
      }

      // Place component at current offset
      for (const [id, pos] of Object.entries(compPos)) {
        allPositions[id] = { x: compOffsetX + pos.x, y: pos.y };
      }

      compOffsetX += compW + COL_GAP * 2;
    }

    // Collision resolution: push overlapping nodes apart
    const resolveOverlaps = (positions: Record<string, { x: number; y: number }>, iterations = 4) => {
      for (let iter = 0; iter < iterations; iter++) {
        const ids = Object.keys(positions);
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const a = ids[i], b = ids[j];
            const pa = positions[a], pb = positions[b];
            const sa = sizeOf(a), sb = sizeOf(b);
            const GAP = 30;
            const overlapX = (pa.x + sa.w + GAP) - pb.x;
            const overlapY = (pa.y + sa.h + GAP) - pb.y;
            if (overlapX > 0 && overlapY > 0 &&
                pa.x < pb.x + sb.w + GAP &&
                pa.y < pb.y + sb.h + GAP) {
              // Push apart on the smaller overlap axis
              if (overlapX < overlapY) {
                const shift = overlapX / 2;
                positions[a] = { ...pa, x: pa.x - shift };
                positions[b] = { ...pb, x: pb.x + shift };
              } else {
                const shift = overlapY / 2;
                positions[a] = { ...pa, y: pa.y - shift };
                positions[b] = { ...pb, y: pb.y + shift };
              }
            }
          }
        }
      }
    };

    resolveOverlaps(allPositions);

    // Ensure all positions are within bounds and positive
    for (const id of Object.keys(allPositions)) {
      allPositions[id] = {
        x: Math.max(MARGIN, allPositions[id].x),
        y: Math.max(MARGIN, allPositions[id].y),
      };
    }

    onUpdatePlan({
      ...plan,
      instances: plan.instances.map(inst => {
        const pos = allPositions[inst.instanceId];
        return pos ? { ...inst, x: Math.round(pos.x), y: Math.round(pos.y) } : inst;
      }),
    });

    setTimeout(handleFit, 120);
  }, [plan, getTileSize, pushHistory, onUpdatePlan, handleFit]);

  const isEmpty = plan.instances.length === 0;

  // Determine cursor style
  const cursorStyle = addingArea
    ? 'crosshair'
    : connectingFrom
      ? 'crosshair'
      : spaceHeld
        ? (isPanning ? 'grabbing' : 'grab')
        : 'default';

  // Compute visible area draft rect (in canvas coords, translated for display)
  const draftRect = areaDraft
    ? normaliseRect(areaDraft.startX, areaDraft.startY, areaDraft.endX, areaDraft.endY)
    : null;

  // Check whether the current draft overlaps any existing area (live feedback)
  const draftHasOverlap = draftRect !== null && (plan.areas ?? []).some(a => {
    const nx2 = draftRect.x + draftRect.width, ny2 = draftRect.y + draftRect.height;
    const ax2 = a.x + a.width, ay2 = a.y + a.height;
    return draftRect.x < ax2 && nx2 > a.x && draftRect.y < ay2 && ny2 > a.y;
  });

  return (
    <>
      <div
        ref={setRefs}
        style={{
          width: '100%', height: '100%',
          position: 'relative', overflow: 'hidden',
          background: '#f8fafc',
          cursor: cursorStyle,
          outline: isOver ? '3px dashed #3B82F6' : '3px solid #e2e8f0',
          outlineOffset: '-3px',
        }}
        onMouseDown={handleCanvasBgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleCanvasContextMenu}
      >
        {/* Grid */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <defs>
            <pattern id="smallGrid"
              width={20 * vpScale} height={20 * vpScale}
              x={vpOffset.x % (20 * vpScale)} y={vpOffset.y % (20 * vpScale)}
              patternUnits="userSpaceOnUse">
              <path d={`M ${20 * vpScale} 0 L 0 0 0 ${20 * vpScale}`} fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
            </pattern>
            <pattern id="bigGrid"
              width={100 * vpScale} height={100 * vpScale}
              x={vpOffset.x % (100 * vpScale)} y={vpOffset.y % (100 * vpScale)}
              patternUnits="userSpaceOnUse">
              <rect width={100 * vpScale} height={100 * vpScale} fill="url(#smallGrid)" />
              <path d={`M ${100 * vpScale} 0 L 0 0 0 ${100 * vpScale}`} fill="none" stroke="#cbd5e1" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#bigGrid)" />
        </svg>

        <div style={{
          position: 'absolute', top: 12, left: 12,
          background: 'white', border: '1px solid #e2e8f0',
          borderRadius: 6, padding: '3px 10px',
          fontSize: 11, fontWeight: 600, color: '#94a3b8',
          pointerEvents: 'none', zIndex: 5, letterSpacing: '0.05em', userSelect: 'none',
        }}>
          PLAN CANVAS — drag assets here from the left panel
        </div>

        {isEmpty && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', zIndex: 4,
          }}>
            <div style={{
              textAlign: 'center', color: '#94a3b8',
              border: '2px dashed #cbd5e1', borderRadius: 12, padding: '32px 48px',
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⊕</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Drag an asset onto the canvas</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Pick a device from the left panel</div>
            </div>
          </div>
        )}

        {/* Transformable content */}
        <div style={{
          position: 'absolute',
          transform: `translate(${vpOffset.x}px, ${vpOffset.y}px) scale(${vpScale})`,
          transformOrigin: '0 0',
          width: CANVAS_W, height: CANVAS_H,
        }}>
          {/* Area layer — rendered BEFORE assets so areas appear behind them */}
          {(plan.areas ?? []).length > 0 && (
            <AreaLayer
              areas={plan.areas ?? []}
              onContextMenu={handleAreaContextMenu}
            />
          )}

          <ConnectionLayer
            connections={plan.connections}
            instances={plan.instances}
            assetMap={assetMap}
            visibleLayers={plan.layerVisibility}
            cableLabelVisibility={plan.cableLabelVisibility}
            portLabelVisibility={plan.portLabelVisibility}
            connectingFrom={connectingFrom}
            mousePos={mousePos}
            onLineClick={handleLineClick}
            onWaypointMouseDown={handleWaypointMouseDown}
            onContextMenu={handleConnectionContextMenu}
            labelPositions={labelPositions}
            onLabelDrag={handleLabelDrag}
            routingConfig={routingConfig}
          />

          {plan.instances.map(inst => {
            const asset = assetMap[inst.assetId];
            if (!asset) return null;
            const { w, h } = getTileSize(inst);
            return (
              <CanvasAsset
                key={inst.instanceId}
                instance={inst}
                asset={asset}
                tileWidth={w}
                tileHeight={h}
                isSelected={selectedId === inst.instanceId}
                visibleLayers={plan.layerVisibility}
                connectingFrom={connectingFrom}
                rotationMode={rotatingId === inst.instanceId}
                onMouseDown={e => handleAssetMouseDown(e, inst.instanceId)}
                onPortClick={handlePortClick}
                onDeleteInstance={handleDeleteInstance}
                onContextMenu={e => handleAssetContextMenu(e, inst.instanceId)}
                onResizeHandleMouseDown={(e, handle) => handleResizeHandleMouseDown(e, inst.instanceId, handle)}
                snapHighlight={snapTarget?.instanceId === inst.instanceId}
              />
            );
          })}

          {/* Alignment guide lines — shown while dragging */}
          {alignGuides.length > 0 && (
            <svg
              style={{
                position: 'absolute', top: 0, left: 0,
                overflow: 'visible', pointerEvents: 'none',
                width: '100%', height: '100%',
                zIndex: 50,
              }}
            >
              {alignGuides.map((guide, i) =>
                guide.type === 'v' ? (
                  <line
                    key={i}
                    x1={guide.coord} y1={-2000}
                    x2={guide.coord} y2={CANVAS_H + 2000}
                    stroke="#3B82F6" strokeWidth={1}
                    strokeDasharray="4 4" opacity={0.7}
                  />
                ) : (
                  <line
                    key={i}
                    x1={-2000} y1={guide.coord}
                    x2={CANVAS_W + 2000} y2={guide.coord}
                    stroke="#3B82F6" strokeWidth={1}
                    strokeDasharray="4 4" opacity={0.7}
                  />
                )
              )}
            </svg>
          )}

          {/* Live area-draft overlay while drawing */}
          {draftRect && (
            <svg
              style={{
                position: 'absolute', top: 0, left: 0,
                overflow: 'visible', pointerEvents: 'none',
                width: '100%', height: '100%',
              }}
            >
              <rect
                x={draftRect.x} y={draftRect.y}
                width={draftRect.width} height={draftRect.height}
                fill={draftHasOverlap ? '#EF4444' : '#6366F1'}
                fillOpacity={draftHasOverlap ? 0.12 : 0.08}
                stroke={draftHasOverlap ? '#EF4444' : '#6366F1'}
                strokeWidth={draftHasOverlap ? 2 : 1.5}
                strokeDasharray="8 4"
                rx={4}
              />
              {draftHasOverlap && (
                <text
                  x={draftRect.x + draftRect.width / 2}
                  y={draftRect.y + draftRect.height / 2}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={12} fontWeight={600} fill="#EF4444" fillOpacity={0.8}
                >
                  Overlap!
                </text>
              )}
            </svg>
          )}

          {/* Pending area confirm/name UI */}
          {areaPending && (
            <>
              {/* Pending area preview rect */}
              <svg
                style={{
                  position: 'absolute', top: 0, left: 0,
                  overflow: 'visible', pointerEvents: 'none',
                  width: '100%', height: '100%',
                }}
              >
                <rect
                  x={areaPending.x} y={areaPending.y}
                  width={areaPending.width} height={areaPending.height}
                  fill="#6366F1" fillOpacity={0.08}
                  stroke="#6366F1" strokeWidth={2}
                  strokeDasharray="8 4"
                  rx={4}
                />
              </svg>

              {/* Confirm/cancel buttons or name input — positioned at bottom-centre of the rect */}
              <div
                style={{
                  position: 'absolute',
                  left: areaPending.x + areaPending.width / 2,
                  top: areaPending.y + areaPending.height + 8,
                  transform: 'translateX(-50%)',
                  display: 'flex', gap: 6, alignItems: 'center',
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '5px 8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  zIndex: 20,
                }}
                onMouseDown={e => e.stopPropagation()}
              >
                {areaPending.naming ? (
                  <>
                    <input
                      autoFocus
                      value={areaPending.name}
                      onChange={e => setAreaPending(p => p ? { ...p, name: e.target.value } : p)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitAreaPending(areaPending.name);
                        if (e.key === 'Escape') cancelAreaPending();
                      }}
                      placeholder="Area name..."
                      style={{
                        fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4,
                        padding: '3px 6px', outline: 'none', width: 140,
                      }}
                    />
                    <button
                      onClick={() => commitAreaPending(areaPending.name)}
                      style={{
                        background: '#22c55e', color: 'white', border: 'none',
                        borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 13,
                      }}
                    >✓</button>
                    <button
                      onClick={cancelAreaPending}
                      style={{
                        background: '#ef4444', color: 'white', border: 'none',
                        borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 13,
                      }}
                    >✕</button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setAreaPending(p => p ? { ...p, naming: true, name: '' } : p)}
                      style={{
                        background: '#22c55e', color: 'white', border: 'none',
                        borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      }}
                      title="Confirm area"
                    >✓</button>
                    <button
                      onClick={cancelAreaPending}
                      style={{
                        background: '#ef4444', color: 'white', border: 'none',
                        borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      }}
                      title="Abbrechen"
                    >✕</button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Area renaming overlay (outside canvas transform, uses screen coords) */}
        {renamingAreaId && (() => {
          const area = (plan.areas ?? []).find(a => a.id === renamingAreaId);
          if (!area) return null;
          // Position the input near the top of the area (screen-space)
          const screenX = area.x * vpScale + vpOffset.x;
          const screenY = area.y * vpScale + vpOffset.y;
          return (
            <div
              style={{
                position: 'absolute',
                left: screenX + 8, top: screenY + 8,
                display: 'flex', gap: 4, alignItems: 'center',
                background: 'white', border: '1px solid #e2e8f0',
                borderRadius: 6, padding: '4px 6px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                zIndex: 30,
              }}
              onMouseDown={e => e.stopPropagation()}
            >
              <input
                autoFocus
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    onUpdatePlan({
                      ...plan,
                      areas: (plan.areas ?? []).map(a =>
                        a.id === renamingAreaId ? { ...a, name: renameValue.trim() || a.name } : a
                      ),
                    });
                    setRenamingAreaId(null);
                  }
                  if (e.key === 'Escape') setRenamingAreaId(null);
                }}
                style={{
                  fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4,
                  padding: '2px 6px', outline: 'none', width: 130,
                }}
              />
              <button
                onClick={() => {
                  onUpdatePlan({
                    ...plan,
                    areas: (plan.areas ?? []).map(a =>
                      a.id === renamingAreaId ? { ...a, name: renameValue.trim() || a.name } : a
                    ),
                  });
                  setRenamingAreaId(null);
                }}
                style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: 4, padding: '3px 6px', cursor: 'pointer' }}
              >✓</button>
              <button
                onClick={() => setRenamingAreaId(null)}
                style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, padding: '3px 6px', cursor: 'pointer' }}
              >✕</button>
            </div>
          );
        })()}

        {/* Connection mode hint */}
        {connectingFrom && (
          <div style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            background: '#2563EB', color: 'white', fontSize: 12, fontWeight: 500,
            padding: '6px 16px', borderRadius: 999, boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            pointerEvents: 'none', zIndex: 20, whiteSpace: 'nowrap',
          }}>
            Click a second port to connect · ESC to cancel
          </div>
        )}

        {/* Area drawing mode hint */}
        {addingArea && !areaPending && (
          <div style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            background: '#6366F1', color: 'white', fontSize: 12, fontWeight: 500,
            padding: '6px 16px', borderRadius: 999, boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            pointerEvents: 'none', zIndex: 20, whiteSpace: 'nowrap',
          }}>
            Drag area · ESC to cancel
          </div>
        )}

        {/* Navigator */}
        <CanvasNavigator
          scale={vpScale}
          onPan={handlePan}
          onZoom={handleZoom}
          onFit={handleFit}
          onReset={handleReset}
          onBack={handleBack}
          canBack={history.current.length > 0}
          onOptimize={handleOptimizeLayout}
          onAddArea={() => {
            setAddingArea(v => !v);
            setAreaPending(null);
            setAreaDraft(null);
          }}
          addingArea={addingArea}
        />
      </div>

      {cablePicker && (
        <ConnectionPickerDialog
          options={cablePicker.options}
          fromLabel={cablePicker.fromLabel}
          toLabel={cablePicker.toLabel}
          note={cablePicker.note}
          onSelect={handleCableSelected}
          onCancel={() => setCablePicker(null)}
        />
      )}

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  );
});
