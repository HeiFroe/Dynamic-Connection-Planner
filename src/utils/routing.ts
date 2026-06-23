/**
 * Orthogonal routing engine.
 *
 * Rules:
 *  - All lines are strictly orthogonal (H/V segments only)
 *  - Rounded corners via SVG quadratic arcs (R=8px)
 *  - Labels are placed on the longest straight segment
 *  - Obstacle avoidance via A* on obstacle-edge channels
 *  - Parallel routes on shared segments are laterally offset
 *  - Crossing routes get a hop arc on the upper z-index line
 */

export interface Rect { x: number; y: number; w: number; h: number; }
export interface Pt   { x: number; y: number; }

const STUB   = 24;   // exit stub length from port
const MARGIN = 18;   // clearance around asset bounding boxes
const LANE   = 7;    // lateral spacing between parallel routes
const HOP_R  = 5;    // hop arc radius at crossings
const CORNER = 8;    // rounded corner radius
const GRID   = 10;   // routing grid resolution

function snap(v: number) { return Math.round(v / GRID) * GRID; }
function rnd(v: number)  { return Math.round(v * 10) / 10; }

// ── Port side detection ───────────────────────────────────────────────────────

type Side = 'left' | 'right' | 'top' | 'bottom';

function portSide(px: number, py: number): Side {
  const d = [px, 1 - px, py, 1 - py];
  const min = Math.min(...d);
  return (['left', 'right', 'top', 'bottom'] as Side[])[d.indexOf(min)];
}

function stubPt(pt: Pt, side: Side): Pt {
  switch (side) {
    case 'left':   return { x: pt.x - STUB, y: pt.y };
    case 'right':  return { x: pt.x + STUB, y: pt.y };
    case 'top':    return { x: pt.x, y: pt.y - STUB };
    case 'bottom': return { x: pt.x, y: pt.y + STUB };
  }
}

// ── Obstacle helpers ──────────────────────────────────────────────────────────

interface Obs { x0: number; y0: number; x1: number; y1: number; }

function expand(r: Rect): Obs {
  return { x0: r.x - MARGIN, y0: r.y - MARGIN, x1: r.x + r.w + MARGIN, y1: r.y + r.h + MARGIN };
}

function segBlocked(ax: number, ay: number, bx: number, by: number, o: Obs): boolean {
  if (Math.abs(ay - by) < 0.5) {
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx);
    return ay > o.y0 && ay < o.y1 && x0 < o.x1 && x1 > o.x0;
  }
  const y0 = Math.min(ay, by), y1 = Math.max(ay, by);
  return ax > o.x0 && ax < o.x1 && y0 < o.y1 && y1 > o.y0;
}

function blocked(a: Pt, b: Pt, obs: Obs[]): boolean {
  return obs.some(o => segBlocked(a.x, a.y, b.x, b.y, o));
}

function pathOk(pts: Pt[], obs: Obs[]): boolean {
  for (let i = 0; i < pts.length - 1; i++)
    if (blocked(pts[i], pts[i + 1], obs)) return false;
  return true;
}

function plen(pts: Pt[]): number {
  let l = 0;
  for (let i = 0; i < pts.length - 1; i++)
    l += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y);
  return l;
}

function clean(pts: Pt[]): Pt[] {
  if (pts.length <= 2) return pts;
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = out[out.length - 1], c = pts[i], n = pts[i + 1];
    if (!( (Math.abs(p.x - c.x) < 0.5 && Math.abs(c.x - n.x) < 0.5)
        || (Math.abs(p.y - c.y) < 0.5 && Math.abs(c.y - n.y) < 0.5) ))
      out.push(c);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// ── Route computation ─────────────────────────────────────────────────────────

function candidates(A: Pt, B: Pt, fs: Side, ts: Side): Pt[][] {
  const fH = fs === 'left' || fs === 'right';
  const tH = ts === 'left' || ts === 'right';
  const mx = snap((A.x + B.x) / 2), my = snap((A.y + B.y) / 2);
  const top = Math.min(A.y, B.y) - 60, bot = Math.max(A.y, B.y) + 60;
  const lft = Math.min(A.x, B.x) - 60, rgt = Math.max(A.x, B.x) + 60;

  if (fH && tH) return [
    [A, {x:mx,y:A.y}, {x:mx,y:B.y}, B],
    [A, {x:rgt,y:A.y}, {x:rgt,y:B.y}, B],
    [A, {x:lft,y:A.y}, {x:lft,y:B.y}, B],
    [A, {x:A.x,y:top}, {x:B.x,y:top}, B],
    [A, {x:A.x,y:bot}, {x:B.x,y:bot}, B],
  ];
  if (!fH && !tH) return [
    [A, {x:A.x,y:my}, {x:B.x,y:my}, B],
    [A, {x:A.x,y:top}, {x:B.x,y:top}, B],
    [A, {x:A.x,y:bot}, {x:B.x,y:bot}, B],
    [A, {x:lft,y:A.y}, {x:lft,y:B.y}, B],
    [A, {x:rgt,y:A.y}, {x:rgt,y:B.y}, B],
  ];
  if (fH) return [
    [A, {x:B.x,y:A.y}, B],
    [A, {x:A.x,y:my}, {x:B.x,y:my}, B],
    [A, {x:A.x,y:top}, {x:B.x,y:top}, B],
    [A, {x:A.x,y:bot}, {x:B.x,y:bot}, B],
    [A, {x:rgt,y:A.y}, {x:rgt,y:B.y}, B],
  ];
  return [
    [A, {x:A.x,y:B.y}, B],
    [A, {x:mx,y:A.y}, {x:mx,y:B.y}, B],
    [A, {x:lft,y:A.y}, {x:lft,y:B.y}, B],
    [A, {x:rgt,y:A.y}, {x:rgt,y:B.y}, B],
    [A, {x:A.x,y:top}, {x:B.x,y:top}, B],
  ];
}

function astar(from: Pt, fSide: Side, to: Pt, tSide: Side, obs: Obs[]): Pt[] {
  const A = stubPt(from, fSide), B = stubPt(to, tSide);
  const xs = new Set<number>([snap(A.x), snap(B.x)]);
  const ys = new Set<number>([snap(A.y), snap(B.y)]);
  for (const o of obs) {
    xs.add(snap(o.x0)); xs.add(snap(o.x1));
    ys.add(snap(o.y0)); ys.add(snap(o.y1));
  }
  const xA = [...xs].sort((a,b) => a - b);
  const yA = [...ys].sort((a,b) => a - b);

  type N = { x: number; y: number; g: number; par: N | null };
  const key = (x: number, y: number) => `${x},${y}`;
  const vis = new Map<string, number>();
  const q: N[] = [{ x: snap(A.x), y: snap(A.y), g: 0, par: null }];
  vis.set(key(q[0].x, q[0].y), 0);
  const gx = snap(B.x), gy = snap(B.y);
  let found: N | null = null;

  const push = (par: N, x: number, y: number) => {
    const ng = par.g + Math.abs(x - par.x) + Math.abs(y - par.y);
    const k = key(x, y);
    if ((vis.get(k) ?? Infinity) > ng) { vis.set(k, ng); q.push({ x, y, g: ng, par }); }
  };

  let it = 0;
  while (q.length && it++ < 8000) {
    q.sort((a, b) => (a.g + Math.abs(a.x-gx) + Math.abs(a.y-gy)) - (b.g + Math.abs(b.x-gx) + Math.abs(b.y-gy)));
    const cur = q.shift()!;
    if (cur.x === gx && cur.y === gy) { found = cur; break; }
    for (const nx of xA) if (nx !== cur.x && !blocked({x:cur.x,y:cur.y},{x:nx,y:cur.y},obs)) push(cur, nx, cur.y);
    for (const ny of yA) if (ny !== cur.y && !blocked({x:cur.x,y:cur.y},{x:cur.x,y:ny},obs)) push(cur, cur.x, ny);
  }

  if (found) {
    const pts: Pt[] = [];
    let n: N | null = found;
    while (n) { pts.unshift({ x: n.x, y: n.y }); n = n.par; }
    return clean([from, ...pts, to]);
  }
  // Cardinal bypass
  const minY = Math.min(...yA) - 40, maxY = Math.max(...yA) + 40;
  const minX = Math.min(...xA) - 40, maxX = Math.max(...xA) + 40;
  for (const pts of [
    clean([from, A, {x:A.x,y:minY}, {x:B.x,y:minY}, B, to]),
    clean([from, A, {x:A.x,y:maxY}, {x:B.x,y:maxY}, B, to]),
    clean([from, A, {x:minX,y:A.y}, {x:minX,y:B.y}, B, to]),
    clean([from, A, {x:maxX,y:A.y}, {x:maxX,y:B.y}, B, to]),
  ]) { if (pathOk(pts, obs)) return pts; }
  return clean([from, A, {x:A.x,y:minY}, {x:B.x,y:minY}, B, to]);
}

function route(from: Pt, to: Pt, fSide: Side, tSide: Side, obs: Obs[]): Pt[] {
  // Try simple candidates with both primary and secondary exit sides
  const sides: Side[] = ['right','left','top','bottom'];
  let best: Pt[] | null = null, bestL = Infinity;
  for (const fs of [fSide, ...sides.filter(s => s !== fSide)].slice(0, 2)) {
    for (const ts of [tSide, ...sides.filter(s => s !== tSide)].slice(0, 2)) {
      const A = stubPt(from, fs), B = stubPt(to, ts);
      for (const cand of candidates(A, B, fs, ts)) {
        const full = [from, ...cand, to];
        if (pathOk(full, obs)) {
          const l = plen(full);
          if (l < bestL) { bestL = l; best = clean(full); }
        }
      }
    }
  }
  return best ?? astar(from, fSide, to, tSide, obs);
}

// ── Parallel lane offset ──────────────────────────────────────────────────────

function offset(paths: Map<string, Pt[]>, ids: string[]): Map<string, Pt[]> {
  const B = (v: number) => Math.round(v / GRID) * GRID;
  const byKey = new Map<string, { id: string; si: number }[]>();

  for (const id of ids) {
    const pts = paths.get(id)!;
    for (let si = 0; si < pts.length - 1; si++) {
      const a = pts[si], b = pts[si+1];
      const k = Math.abs(a.y - b.y) < 0.5
        ? `H:${B(a.y)}:${B(Math.min(a.x,b.x))}:${B(Math.max(a.x,b.x))}`
        : `V:${B(a.x)}:${B(Math.min(a.y,b.y))}:${B(Math.max(a.y,b.y))}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push({ id, si });
    }
  }

  const shifts = new Map<string, number>();
  for (const [, entries] of byKey) {
    const uids = [...new Set(entries.map(e => e.id))];
    if (uids.length < 2) continue;
    uids.forEach((uid, rank) => {
      const sh = (rank - (uids.length - 1) / 2) * LANE;
      for (const e of entries.filter(e => e.id === uid)) shifts.set(`${e.id}:${e.si}`, sh);
    });
  }

  if (shifts.size === 0) return paths;
  const res = new Map<string, Pt[]>();
  for (const id of ids) {
    const pts = paths.get(id)!.map(p => ({ ...p }));
    for (let si = 0; si < pts.length - 1; si++) {
      const sh = shifts.get(`${id}:${si}`);
      if (!sh) continue;
      if (Math.abs(pts[si].y - pts[si+1].y) < 0.5) { pts[si].y += sh; pts[si+1].y += sh; }
      else { pts[si].x += sh; pts[si+1].x += sh; }
    }
    res.set(id, clean(pts));
  }
  return res;
}

// ── SVG path with rounded corners and hop arcs ────────────────────────────────

interface Seg { x1: number; y1: number; x2: number; y2: number; }

function segs(pts: Pt[]): Seg[] {
  return pts.slice(0,-1).map((p,i) => ({ x1:p.x, y1:p.y, x2:pts[i+1].x, y2:pts[i+1].y }));
}

function cross(a: Seg, b: Seg): Pt | null {
  const aH = Math.abs(a.y1-a.y2) < 0.5, bV = Math.abs(b.x1-b.x2) < 0.5;
  if (aH && bV) {
    const x = b.x1, y = a.y1;
    if (Math.min(a.x1,a.x2)+1<x && x<Math.max(a.x1,a.x2)-1 &&
        Math.min(b.y1,b.y2)+1<y && y<Math.max(b.y1,b.y2)-1) return {x,y};
  }
  const aV = Math.abs(a.x1-a.x2) < 0.5, bH = Math.abs(b.y1-b.y2) < 0.5;
  if (aV && bH) {
    const x = a.x1, y = b.y1;
    if (Math.min(b.x1,b.x2)+1<x && x<Math.max(b.x1,b.x2)-1 &&
        Math.min(a.y1,a.y2)+1<y && y<Math.max(a.y1,a.y2)-1) return {x,y};
  }
  return null;
}

function buildD(pts: Pt[], hops: Set<string>): string {
  if (pts.length < 2) return '';
  const R = CORNER;
  let d = `M ${rnd(pts[0].x)} ${rnd(pts[0].y)}`;

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i+1];
    const next = pts[i+2];
    const isH = Math.abs(a.y - b.y) < 0.5;
    const len = Math.abs(isH ? b.x - a.x : b.y - a.y);

    // Determine corner radius at end of this segment (0 if last segment)
    const cr = next && len > R * 2 ? Math.min(R, len / 2) : 0;

    if (isH) {
      // Horizontal segment — check for hop crosses
      const y = a.y;
      const hopXs: number[] = [];
      for (const h of hops) {
        const [hx, hy] = h.split(',').map(Number);
        if (Math.abs(hy - y) < 2 && Math.min(a.x,b.x)+HOP_R < hx && hx < Math.max(a.x,b.x)-HOP_R)
          hopXs.push(hx);
      }
      hopXs.sort((x1, x2) => a.x <= b.x ? x1 - x2 : x2 - x1);

      const dir = b.x > a.x ? 1 : -1;
      let curX = a.x;

      for (const hx of hopXs) {
        d += ` H ${rnd(hx - HOP_R * dir)}`;
        d += ` C ${rnd(hx - HOP_R * dir)} ${rnd(y - HOP_R * 2)} ${rnd(hx + HOP_R * dir)} ${rnd(y - HOP_R * 2)} ${rnd(hx + HOP_R * dir)} ${rnd(y)}`;
        curX = hx + HOP_R * dir;
      }

      // End with rounded corner if next segment exists
      if (cr > 0 && next) {
        d += ` H ${rnd(b.x - cr * dir)}`;
        // Determine turn direction
        const nextIsH = Math.abs(b.y - next.y) < 0.5;
        if (!nextIsH) {
          const downDir = next.y > b.y ? 1 : -1;
          d += ` Q ${rnd(b.x)} ${rnd(b.y)} ${rnd(b.x)} ${rnd(b.y + cr * downDir)}`;
        }
      } else {
        d += ` H ${rnd(b.x)}`;
      }
    } else {
      // Vertical segment
      const dir = b.y > a.y ? 1 : -1;
      if (cr > 0 && next) {
        d += ` V ${rnd(b.y - cr * dir)}`;
        const nextIsV = Math.abs(b.x - next.x) < 0.5;
        if (!nextIsV) {
          const rightDir = next.x > b.x ? 1 : -1;
          d += ` Q ${rnd(b.x)} ${rnd(b.y)} ${rnd(b.x + cr * rightDir)} ${rnd(b.y)}`;
        }
      } else {
        d += ` V ${rnd(b.y)}`;
      }
    }
  }
  return d;
}

// ── Label placement — longest straight segment ────────────────────────────────

export function labelPoint(pts: Pt[]): Pt {
  if (pts.length < 2) return pts[0] ?? { x: 0, y: 0 };
  let bestSeg = 0, bestLen = -1;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y);
    if (l > bestLen) { bestLen = l; bestSeg = i; }
  }
  const a = pts[bestSeg], b = pts[bestSeg + 1];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ── Public types & API ────────────────────────────────────────────────────────

export interface RouteInput {
  id: string;
  from: Pt;
  to: Pt;
  fromPos?: { x: number; y: number };
  toPos?:   { x: number; y: number };
  fromObstacleIdx?: number;
  toObstacleIdx?: number;
  waypoints: Pt[];
  color: string;
  zIndex: number;
}

export interface RouteResult {
  /** SVG path d-string */
  d: string;
  /** Computed waypoints (after obstacle avoidance + parallel offset) — use for label placement */
  pts: Pt[];
}

export function routeConnections(
  inputs: RouteInput[],
  obstacles: Rect[],
  _canvasW: number,
  _canvasH: number,
): Map<string, RouteResult> {
  const obs = obstacles.map(expand);
  const rawPaths = new Map<string, Pt[]>();

  for (const inp of inputs) {
    if (inp.waypoints.length > 0) {
      rawPaths.set(inp.id, clean([inp.from, ...inp.waypoints, inp.to]));
      continue;
    }
    const obsR = obs.filter((_, i) => i !== inp.fromObstacleIdx && i !== inp.toObstacleIdx);
    const fs: Side = inp.fromPos ? portSide(inp.fromPos.x, inp.fromPos.y) : 'right';
    const ts: Side = inp.toPos   ? portSide(inp.toPos.x,   inp.toPos.y)   : 'left';
    rawPaths.set(inp.id, route(inp.from, inp.to, fs, ts, obsR));
  }

  const ids = inputs.map(i => i.id);
  const off = offset(rawPaths, ids);

  const result = new Map<string, RouteResult>();
  for (const inp of inputs) {
    const pts = off.get(inp.id) ?? [inp.from, inp.to];
    const hopSet = new Set<string>();
    for (const other of inputs) {
      if (other.zIndex >= inp.zIndex) continue;
      const otherSegs = segs(off.get(other.id) ?? [other.from, other.to]);
      for (const sa of segs(pts))
        for (const sb of otherSegs) {
          const c = cross(sa, sb);
          if (c) hopSet.add(`${Math.round(c.x)},${Math.round(c.y)}`);
        }
    }
    result.set(inp.id, { d: buildD(pts, hopSet), pts });
  }
  return result;
}

// ── Utility exports ───────────────────────────────────────────────────────────

/** Get point at fraction t along path */
export function pathPointAtFraction(pts: Pt[], t: number): Pt {
  if (pts.length < 2) return pts[0] ?? { x: 0, y: 0 };
  const sg = segs(pts);
  const ls = sg.map(s => Math.hypot(s.x2-s.x1, s.y2-s.y1));
  const tot = ls.reduce((a,b) => a+b, 0);
  if (tot === 0) return pts[0];
  let tgt = tot * Math.max(0, Math.min(1, t));
  for (let i = 0; i < sg.length; i++) {
    if (tgt <= ls[i] + 0.001) {
      const f = ls[i] > 0 ? tgt / ls[i] : 0;
      return { x: sg[i].x1+(sg[i].x2-sg[i].x1)*f, y: sg[i].y1+(sg[i].y2-sg[i].y1)*f };
    }
    tgt -= ls[i];
  }
  return pts[pts.length-1];
}

/** Project click position onto path, return fraction 0-1 */
export function projectOntoPath(pts: Pt[], click: Pt): number {
  const sg = segs(pts);
  const ls = sg.map(s => Math.hypot(s.x2-s.x1, s.y2-s.y1));
  const tot = ls.reduce((a,b) => a+b, 0);
  if (tot === 0) return 0.5;
  let best = 0.5, bestD = Infinity, cum = 0;
  for (let i = 0; i < sg.length; i++) {
    const s = sg[i];
    const dx = s.x2-s.x1, dy = s.y2-s.y1, l2 = dx*dx+dy*dy;
    const tt = l2 > 0 ? Math.max(0, Math.min(1, ((click.x-s.x1)*dx+(click.y-s.y1)*dy)/l2)) : 0;
    const d = Math.hypot(click.x-s.x1-tt*dx, click.y-s.y1-tt*dy);
    if (d < bestD) { bestD = d; best = (cum + tt*ls[i]) / tot; }
    cum += ls[i];
  }
  return best;
}
