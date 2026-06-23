import { PlacedAsset, Asset } from '../types';

type Point = { x: number; y: number };
export type ExitDir = 'top' | 'bottom' | 'left' | 'right';

export interface RoutingParams {
  stubLen?: number;
  boxPad?: number;
  cornerR?: number;
  parallelGap?: number;
  crossR?: number;
}

const DEFAULTS: Required<RoutingParams> = {
  stubLen: 24,
  boxPad: 18,
  cornerR: 8,
  parallelGap: 6,
  crossR: 5,
};

export interface PortStub {
  center: Point;
  edge:   Point;
  exit:   Point;
  direction: ExitDir;
}

export interface BBox {
  id: string;
  x: number; y: number;
  w: number; h: number;
}

function getExitDir(px: number, py: number): ExitDir {
  if (py <= 0.15) return 'top';
  if (py >= 0.85) return 'bottom';
  if (px <= 0.15) return 'left';
  if (px >= 0.85) return 'right';
  return 'bottom';
}

export function getPortStub(inst: PlacedAsset, asset: Asset, portId: string, params?: RoutingParams): PortStub | null {
  const port = asset.ports.find(p => p.id === portId);
  if (!port) return null;

  const stubLen = params?.stubLen ?? DEFAULTS.stubLen;
  const tileW = inst.instanceWidth ?? asset.width;
  const tileH = inst.instanceHeight ?? (
    asset.imageAspectRatio
      ? (inst.instanceWidth ?? asset.width) / asset.imageAspectRatio
      : asset.height
  );

  const cx = inst.x + port.position.x * tileW;
  const cy = inst.y + port.position.y * tileH;
  const dir = getExitDir(port.position.x, port.position.y);

  let edgeX = cx, edgeY = cy;
  if (dir === 'right')  edgeX = inst.x + tileW;
  else if (dir === 'left')  edgeX = inst.x;
  if (dir === 'bottom') edgeY = inst.y + tileH;
  else if (dir === 'top')   edgeY = inst.y;

  const exit: Point = {
    x: edgeX + (dir === 'right' ? stubLen : dir === 'left' ? -stubLen : 0),
    y: edgeY + (dir === 'bottom' ? stubLen : dir === 'top' ? -stubLen : 0),
  };

  return { center: { x: cx, y: cy }, edge: { x: edgeX, y: edgeY }, exit, direction: dir };
}

function f(n: number): string { return n.toFixed(1); }

function hSegHitsBox(x1: number, x2: number, y: number, box: BBox, boxPad: number): boolean {
  const lx = Math.min(x1, x2), rx = Math.max(x1, x2);
  const bx1 = box.x - boxPad, bx2 = box.x + box.w + boxPad;
  const by1 = box.y - boxPad, by2 = box.y + box.h + boxPad;
  if (y < by1 || y > by2) return false;
  if (lx > bx2 || rx < bx1) return false;
  return true;
}

function vSegHitsBox(x: number, y1: number, y2: number, box: BBox, boxPad: number): boolean {
  const ty = Math.min(y1, y2), by = Math.max(y1, y2);
  const bx1 = box.x - boxPad, bx2 = box.x + box.w + boxPad;
  const by1 = box.y - boxPad, by2 = box.y + box.h + boxPad;
  if (x < bx1 || x > bx2) return false;
  if (ty > by2 || by < by1) return false;
  return true;
}

function clearYForH(x1: number, x2: number, preferredY: number, boxes: BBox[], boxPad: number): number {
  const blocking = boxes.filter(b => hSegHitsBox(x1, x2, preferredY, b, boxPad));
  if (blocking.length === 0) return preferredY;
  const candidates: number[] = [];
  for (const b of blocking) {
    candidates.push(b.y - boxPad - 4);
    candidates.push(b.y + b.h + boxPad + 4);
  }
  return candidates.sort((a, b) => Math.abs(a - preferredY) - Math.abs(b - preferredY))[0] ?? preferredY;
}

function clearXForV(y1: number, y2: number, preferredX: number, boxes: BBox[], boxPad: number): number {
  const blocking = boxes.filter(b => vSegHitsBox(preferredX, y1, y2, b, boxPad));
  if (blocking.length === 0) return preferredX;
  const candidates: number[] = [];
  for (const b of blocking) {
    candidates.push(b.x - boxPad - 4);
    candidates.push(b.x + b.w + boxPad + 4);
  }
  return candidates.sort((a, b) => Math.abs(a - preferredX) - Math.abs(b - preferredX))[0] ?? preferredX;
}

function arcCorner(
  fromX: number, fromY: number,
  cornerX: number, cornerY: number,
  toX: number, toY: number,
  cornerR: number,
): string {
  const dx1 = cornerX - fromX, dy1 = cornerY - fromY;
  const dx2 = toX - cornerX,   dy2 = toY - cornerY;
  const r = Math.min(
    cornerR,
    Math.abs(dx1 || dy1) / 2,
    Math.abs(dx2 || dy2) / 2,
  );
  if (r < 1) return ` L${f(cornerX)},${f(cornerY)}`;
  const sx1 = dx1 !== 0 ? Math.sign(dx1) : 0;
  const sy1 = dy1 !== 0 ? Math.sign(dy1) : 0;
  const sx2 = dx2 !== 0 ? Math.sign(dx2) : 0;
  const sy2 = dy2 !== 0 ? Math.sign(dy2) : 0;
  return (
    ` L${f(cornerX - sx1 * r)},${f(cornerY - sy1 * r)}` +
    ` Q${f(cornerX)},${f(cornerY)} ${f(cornerX + sx2 * r)},${f(cornerY + sy2 * r)}`
  );
}

// ── Normalised segment representation for parallel-offset and intersection logic ──

export interface OrthoSeg {
  x1: number; y1: number;
  x2: number; y2: number;
  isHorizontal: boolean;
}

export interface RoutedPath {
  /** SVG path data */
  d: string;
  /** Axis-aligned segments (for intersection detection) */
  segments: OrthoSeg[];
  /** The axis-aligned key corridors used (for grouping parallel lines) */
  corridors: { isH: boolean; coord: number; x1: number; x2: number; y1: number; y2: number }[];
}

// Build an obstacle-aware orthogonal path between two stub exits.
export function buildOrthoPath(
  exit1: Point,
  exit2: Point,
  waypoints: Point[],
  dir1?: ExitDir,
  dir2?: ExitDir,
  avoidBoxes?: BBox[],
  parallelIndex?: number,
  totalParallel?: number,
  params?: RoutingParams,
): string {
  if (waypoints.length > 0) return buildOrthoPathManual(exit1, exit2, waypoints);

  const boxes = avoidBoxes ?? [];
  const pidx = parallelIndex ?? 0;
  const total = totalParallel ?? 1;
  const p = { ...DEFAULTS, ...params };

  const hFirstPref = (dir1 === 'left' || dir1 === 'right')
    ? true
    : (dir1 === 'top' || dir1 === 'bottom')
      ? false
      : Math.abs(exit2.x - exit1.x) >= Math.abs(exit2.y - exit1.y);

  const pathH = buildAvoidingPath(exit1, exit2, true,  boxes, pidx, total, p);
  const pathV = buildAvoidingPath(exit1, exit2, false, boxes, pidx, total, p);

  const scoreH = countIntersections(pathH.segments, boxes, p.boxPad);
  const scoreV = countIntersections(pathV.segments, boxes, p.boxPad);

  const chosen = (scoreH <= scoreV)
    ? (hFirstPref ? pathH : (scoreV < scoreH ? pathV : pathH))
    : pathV;

  return chosen.d;
}

// Full routed path with segment info — used by ConnectionLayer for intersection detection
export function buildOrthoPathFull(
  exit1: Point,
  exit2: Point,
  waypoints: Point[],
  dir1?: ExitDir,
  dir2?: ExitDir,
  avoidBoxes?: BBox[],
  parallelIndex?: number,
  totalParallel?: number,
  params?: RoutingParams,
): RoutedPath {
  if (waypoints.length > 0) {
    const d = buildOrthoPathManual(exit1, exit2, waypoints);
    const segments = buildManualSegments(exit1, exit2, waypoints);
    return { d, segments, corridors: [] };
  }

  const boxes = avoidBoxes ?? [];
  const pidx = parallelIndex ?? 0;
  const total = totalParallel ?? 1;
  const p = { ...DEFAULTS, ...params };

  const hFirstPref = (dir1 === 'left' || dir1 === 'right')
    ? true
    : (dir1 === 'top' || dir1 === 'bottom')
      ? false
      : Math.abs(exit2.x - exit1.x) >= Math.abs(exit2.y - exit1.y);

  const pathH = buildAvoidingPath(exit1, exit2, true,  boxes, pidx, total, p);
  const pathV = buildAvoidingPath(exit1, exit2, false, boxes, pidx, total, p);

  const scoreH = countIntersections(pathH.segments, boxes, p.boxPad);
  const scoreV = countIntersections(pathV.segments, boxes, p.boxPad);

  const chosen = (scoreH <= scoreV)
    ? (hFirstPref ? pathH : (scoreV < scoreH ? pathV : pathH))
    : pathV;

  const corridors = chosen.segments.map(s => ({
    isH: s.isHorizontal,
    coord: s.isHorizontal ? s.y1 : s.x1,
    x1: s.x1, x2: s.x2, y1: s.y1, y2: s.y2,
  }));

  return { d: chosen.d, segments: chosen.segments, corridors };
}

interface PathResult { d: string; segments: OrthoSeg[] }

function parallelOffset(pidx: number, total: number, parallelGap: number): number {
  if (total <= 1) return 0;
  const centre = (total - 1) / 2;
  return (pidx - centre) * parallelGap;
}

function buildAvoidingPath(
  p1: Point, p2: Point, hFirst: boolean, boxes: BBox[],
  pidx = 0, total = 1,
  rp: Required<RoutingParams> = DEFAULTS,
): PathResult {
  const { boxPad, cornerR, parallelGap } = rp;
  const segments: OrthoSeg[] = [];
  const off = parallelOffset(pidx, total, parallelGap);

  if (Math.abs(p1.x - p2.x) < 1) {
    const cx = clearXForV(p1.y, p2.y, p1.x + off, boxes, boxPad);
    segments.push({ x1: p1.x, y1: p1.y, x2: cx, y2: p1.y, isHorizontal: true });
    segments.push({ x1: cx,   y1: p1.y, x2: cx, y2: p2.y, isHorizontal: false });
    segments.push({ x1: cx,   y1: p2.y, x2: p2.x, y2: p2.y, isHorizontal: true });
    const d = `M${f(p1.x)},${f(p1.y)}`
      + arcCorner(p1.x, p1.y, cx, p1.y, cx, p2.y, cornerR)
      + ` L${f(cx)},${f(p2.y)}`
      + arcCorner(cx, p2.y, cx, p2.y, p2.x, p2.y, cornerR)
      + ` L${f(p2.x)},${f(p2.y)}`;
    return { d, segments };
  }

  if (Math.abs(p1.y - p2.y) < 1) {
    const cy = clearYForH(p1.x, p2.x, p1.y + off, boxes, boxPad);
    segments.push({ x1: p1.x, y1: p1.y, x2: p1.x, y2: cy, isHorizontal: false });
    segments.push({ x1: p1.x, y1: cy,   x2: p2.x, y2: cy, isHorizontal: true });
    segments.push({ x1: p2.x, y1: cy,   x2: p2.x, y2: p2.y, isHorizontal: false });
    const d = `M${f(p1.x)},${f(p1.y)}`
      + arcCorner(p1.x, p1.y, p1.x, cy, p2.x, cy, cornerR)
      + ` L${f(p2.x)},${f(cy)}`
      + arcCorner(p2.x, cy, p2.x, cy, p2.x, p2.y, cornerR)
      + ` L${f(p2.x)},${f(p2.y)}`;
    return { d, segments };
  }

  if (hFirst) {
    const cornerX = p2.x;
    const cornerY = p1.y + off;

    if (boxes.some(b => hSegHitsBox(p1.x, cornerX, cornerY, b, boxPad))) {
      const detourY = clearYForH(p1.x, cornerX, cornerY, boxes, boxPad);
      segments.push({ x1: p1.x, y1: p1.y, x2: p1.x, y2: detourY, isHorizontal: false });
      segments.push({ x1: p1.x, y1: detourY, x2: cornerX, y2: detourY, isHorizontal: true });
      segments.push({ x1: cornerX, y1: detourY, x2: cornerX, y2: p2.y, isHorizontal: false });
      const d = `M${f(p1.x)},${f(p1.y)}`
        + arcCorner(p1.x, p1.y, p1.x, detourY, cornerX, detourY, cornerR)
        + ` L${f(cornerX)},${f(detourY)}`
        + arcCorner(cornerX, detourY, cornerX, detourY, cornerX, p2.y, cornerR)
        + ` L${f(cornerX)},${f(p2.y)}`
        + arcCorner(cornerX, p2.y, cornerX, p2.y, p2.x, p2.y, cornerR)
        + ` L${f(p2.x)},${f(p2.y)}`;
      return { d, segments };
    }

    if (boxes.some(b => vSegHitsBox(cornerX, cornerY, p2.y, b, boxPad))) {
      const detourX = clearXForV(cornerY, p2.y, cornerX + off, boxes, boxPad);
      segments.push({ x1: p1.x, y1: p1.y, x2: detourX, y2: p1.y, isHorizontal: true });
      segments.push({ x1: detourX, y1: p1.y, x2: detourX, y2: p2.y, isHorizontal: false });
      segments.push({ x1: detourX, y1: p2.y, x2: p2.x, y2: p2.y, isHorizontal: true });
      const d = `M${f(p1.x)},${f(p1.y)}`
        + arcCorner(p1.x, p1.y, detourX, p1.y, detourX, p2.y, cornerR)
        + ` L${f(detourX)},${f(p2.y)}`
        + arcCorner(detourX, p2.y, detourX, p2.y, p2.x, p2.y, cornerR)
        + ` L${f(p2.x)},${f(p2.y)}`;
      return { d, segments };
    }

    segments.push({ x1: p1.x, y1: p1.y, x2: cornerX, y2: cornerY, isHorizontal: true });
    segments.push({ x1: cornerX, y1: cornerY, x2: p2.x, y2: p2.y, isHorizontal: false });
    const d = `M${f(p1.x)},${f(p1.y)}`
      + arcCorner(p1.x, p1.y, cornerX, cornerY, p2.x, p2.y, cornerR)
      + ` L${f(p2.x)},${f(p2.y)}`;
    return { d, segments };

  } else {
    const cornerX = p1.x + off;
    const cornerY = p2.y;

    if (boxes.some(b => vSegHitsBox(cornerX, p1.y, cornerY, b, boxPad))) {
      const detourX = clearXForV(p1.y, cornerY, cornerX, boxes, boxPad);
      segments.push({ x1: p1.x, y1: p1.y, x2: detourX, y2: p1.y, isHorizontal: true });
      segments.push({ x1: detourX, y1: p1.y, x2: detourX, y2: p2.y, isHorizontal: false });
      segments.push({ x1: detourX, y1: p2.y, x2: p2.x, y2: p2.y, isHorizontal: true });
      const d = `M${f(p1.x)},${f(p1.y)}`
        + arcCorner(p1.x, p1.y, detourX, p1.y, detourX, p2.y, cornerR)
        + ` L${f(detourX)},${f(p2.y)}`
        + arcCorner(detourX, p2.y, detourX, p2.y, p2.x, p2.y, cornerR)
        + ` L${f(p2.x)},${f(p2.y)}`;
      return { d, segments };
    }

    if (boxes.some(b => hSegHitsBox(cornerX, p2.x, cornerY, b, boxPad))) {
      const detourY = clearYForH(cornerX, p2.x, cornerY + off, boxes, boxPad);
      segments.push({ x1: p1.x, y1: p1.y, x2: p1.x, y2: detourY, isHorizontal: false });
      segments.push({ x1: p1.x, y1: detourY, x2: p2.x, y2: detourY, isHorizontal: true });
      segments.push({ x1: p2.x, y1: detourY, x2: p2.x, y2: p2.y, isHorizontal: false });
      const d = `M${f(p1.x)},${f(p1.y)}`
        + arcCorner(p1.x, p1.y, p1.x, detourY, p2.x, detourY, cornerR)
        + ` L${f(p2.x)},${f(detourY)}`
        + arcCorner(p2.x, detourY, p2.x, detourY, p2.x, p2.y, cornerR)
        + ` L${f(p2.x)},${f(p2.y)}`;
      return { d, segments };
    }

    segments.push({ x1: p1.x, y1: p1.y, x2: cornerX, y2: cornerY, isHorizontal: false });
    segments.push({ x1: cornerX, y1: cornerY, x2: p2.x, y2: p2.y, isHorizontal: true });
    const d = `M${f(p1.x)},${f(p1.y)}`
      + arcCorner(p1.x, p1.y, cornerX, cornerY, p2.x, p2.y, cornerR)
      + ` L${f(p2.x)},${f(p2.y)}`;
    return { d, segments };
  }
}

function buildManualSegments(exit1: Point, exit2: Point, waypoints: Point[]): OrthoSeg[] {
  const pts = [exit1, ...waypoints, exit2];
  const segs: OrthoSeg[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, isHorizontal: Math.abs(b.y - a.y) < 1 });
  }
  return segs;
}

function buildOrthoPathManual(
  exit1: Point, exit2: Point, waypoints: Point[]
): string {
  const pts = [exit1, ...waypoints, exit2];
  let d = `M${f(pts[0].x)},${f(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) < 1 || Math.abs(dy) < 1) {
      d += ` L${f(b.x)},${f(b.y)}`;
    } else {
      const hFirst = Math.abs(dx) >= Math.abs(dy);
      const cx = hFirst ? b.x : a.x;
      const cy = hFirst ? a.y : b.y;
      d += arcCorner(a.x, a.y, cx, cy, b.x, b.y, DEFAULTS.cornerR) + ` L${f(b.x)},${f(b.y)}`;
    }
  }
  return d;
}

function countIntersections(segments: OrthoSeg[], boxes: BBox[], boxPad: number): number {
  let count = 0;
  for (const seg of segments) {
    for (const box of boxes) {
      if (seg.isHorizontal && hSegHitsBox(seg.x1, seg.x2, seg.y1, box, boxPad)) count++;
      if (!seg.isHorizontal && vSegHitsBox(seg.x1, seg.y1, seg.y2, box, boxPad)) count++;
    }
  }
  return count;
}

export function buildOrthoPreview(exit1: Point, to: Point, dir1?: ExitDir, params?: RoutingParams): string {
  const hFirst = dir1 ? (dir1 === 'left' || dir1 === 'right') : true;
  const rp = { ...DEFAULTS, ...params };
  const result = buildAvoidingPath(exit1, to, hFirst, [], 0, 1, rp);
  return result.d;
}

// ── Crossover arc injection ────────────────────────────────────────────────────
// Takes a rendered path d and a list of crossing points on that path,
// and returns a modified path with small arcs at each crossing.

export interface CrossPoint {
  /** Parameter 0..1 along the segment that contains the crossing */
  t: number;
  /** The exact coordinate of the crossing */
  x: number; y: number;
  /** Whether the crossing segment is horizontal */
  isHorizontal: boolean;
}

// Find crossings between this path's segments and all OTHER paths' segments.
// Returns crossing points sorted by parameter along path.
export function findCrossings(
  mySegments: OrthoSeg[],
  otherSegments: OrthoSeg[],
  myConnId: string,
  otherConnId: string,
): CrossPoint[] {
  // Only draw arc on one of the two crossing lines (lower id wins)
  if (myConnId >= otherConnId) return [];

  const crossings: CrossPoint[] = [];

  for (const my of mySegments) {
    for (const other of otherSegments) {
      // H × V intersection only (orthogonal crossings)
      if (my.isHorizontal === other.isHorizontal) continue;

      const hSeg = my.isHorizontal ? my : other;
      const vSeg = my.isHorizontal ? other : my;
      const hIsMe = my.isHorizontal;

      const hMinX = Math.min(hSeg.x1, hSeg.x2);
      const hMaxX = Math.max(hSeg.x1, hSeg.x2);
      const vMinY = Math.min(vSeg.y1, vSeg.y2);
      const vMaxY = Math.max(vSeg.y1, vSeg.y2);

      const x = vSeg.x1;
      const y = hSeg.y1;

      // Check crossing (with small tolerance, exclude endpoints)
      const tol = 2;
      if (x < hMinX + tol || x > hMaxX - tol) continue;
      if (y < vMinY + tol || y > vMaxY - tol) continue;

      // Only add crossing on the horizontal segment of MY path
      if (!hIsMe) continue;

      // Compute parameter t along the horizontal segment
      const segLen = hMaxX - hMinX;
      if (segLen < 1) continue;
      const t = (x - Math.min(hSeg.x1, hSeg.x2)) / segLen;

      crossings.push({ t, x, y, isHorizontal: true });
    }
  }

  return crossings;
}

// Build a path d string with crossover arcs injected at given crossing x-coords on horizontal segments
export function buildPathWithCrossovers(
  segments: OrthoSeg[],
  crossings: CrossPoint[],
  params?: RoutingParams,
): string {
  if (crossings.length === 0 || segments.length === 0) return segmentsToPath(segments);
  const crossR = params?.crossR ?? DEFAULTS.crossR;

  const crossByY: Record<string, number[]> = {};
  for (const cr of crossings) {
    const key = `${Math.round(cr.y)}`;
    if (!crossByY[key]) crossByY[key] = [];
    crossByY[key].push(cr.x);
  }

  let d = '';
  let started = false;

  for (const seg of segments) {
    if (!started) {
      d += `M${f(seg.x1)},${f(seg.y1)}`;
      started = true;
    }

    if (!seg.isHorizontal) {
      d += ` L${f(seg.x2)},${f(seg.y2)}`;
      continue;
    }

    const yKey = `${Math.round(seg.y1)}`;
    const xCrossings = crossByY[yKey];
    if (!xCrossings || xCrossings.length === 0) {
      d += ` L${f(seg.x2)},${f(seg.y2)}`;
      continue;
    }

    const goRight = seg.x2 >= seg.x1;
    const sorted = [...xCrossings]
      .filter(x => {
        const minX = Math.min(seg.x1, seg.x2) + crossR + 2;
        const maxX = Math.max(seg.x1, seg.x2) - crossR - 2;
        return x >= minX && x <= maxX;
      })
      .sort((a, b) => goRight ? a - b : b - a);

    for (const cx of sorted) {
      const arcStart = cx - (goRight ? crossR : -crossR);
      const arcEnd   = cx + (goRight ? crossR : -crossR);
      const sweepFlag = goRight ? 0 : 1;
      d += ` L${f(arcStart)},${f(seg.y1)}`;
      d += ` A${f(crossR)},${f(crossR)} 0 0,${sweepFlag} ${f(arcEnd)},${f(seg.y1)}`;
    }
    d += ` L${f(seg.x2)},${f(seg.y2)}`;
  }

  return d;
}

function segmentsToPath(segments: OrthoSeg[]): string {
  if (segments.length === 0) return '';
  let d = `M${f(segments[0].x1)},${f(segments[0].y1)}`;
  for (const seg of segments) {
    d += ` L${f(seg.x2)},${f(seg.y2)}`;
  }
  return d;
}

// ── Corridor-based parallel grouping ────────────────────────────────────────
// Given a set of connections and their routing results, return for each connection
// the number of parallel connections sharing its main corridor and this connection's
// index among them.

export interface ParallelInfo {
  connId: string;
  parallelIndex: number;
  totalParallel: number;
}

/**
 * Detect connections that share a corridor (same approximate x or y within tolerance)
 * between the same general endpoint pair region.
 * Returns a map from connId → { parallelIndex, totalParallel }
 */
export function computeParallelGroups(
  connections: { id: string; fromInstanceId: string; toInstanceId: string }[],
  getExit1: (connId: string) => Point | null,
  getExit2: (connId: string) => Point | null,
): Record<string, ParallelInfo> {
  const CORRIDOR_TOL = 20; // px tolerance to consider two corridors "the same"

  // Group connections by their endpoint pair (order-normalised)
  type GroupKey = string;
  const groups: Record<GroupKey, string[]> = {};

  for (const conn of connections) {
    const e1 = getExit1(conn.id);
    const e2 = getExit2(conn.id);
    if (!e1 || !e2) continue;

    // Normalise: smaller coords first
    const ax = Math.min(e1.x, e2.x), ay = Math.min(e1.y, e2.y);
    const bx = Math.max(e1.x, e2.x), by = Math.max(e1.y, e2.y);

    // Quantise to grid to allow grouping of "close" corridors
    const qax = Math.round(ax / CORRIDOR_TOL);
    const qay = Math.round(ay / CORRIDOR_TOL);
    const qbx = Math.round(bx / CORRIDOR_TOL);
    const qby = Math.round(by / CORRIDOR_TOL);

    const key: GroupKey = `${qax},${qay}-${qbx},${qby}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(conn.id);
  }

  const result: Record<string, ParallelInfo> = {};
  for (const ids of Object.values(groups)) {
    ids.forEach((id, idx) => {
      result[id] = { connId: id, parallelIndex: idx, totalParallel: ids.length };
    });
  }
  return result;
}
