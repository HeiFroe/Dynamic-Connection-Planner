import { Plan, PlacedAsset } from '../types';

const GRID    = 20;
const PAD     = 80;   // canvas padding
const COL_GAP = 120;  // horizontal gap between assets — room for connections
const ROW_GAP = 100;  // vertical gap — room for connections to route around

function snap(v: number) { return Math.round(v / GRID) * GRID; }

export function applyGridLayout(plan: Plan): Plan {
  if (plan.instances.length === 0) return plan;

  // Group assets by rough category (based on their position cluster or just sequentially)
  // Simple approach: arrange in a grid sorted left-to-right, top-to-bottom
  // with enough spacing that connections can route cleanly between them.
  const count = plan.instances.length;
  const cols  = Math.ceil(Math.sqrt(count * 1.5)); // slightly wider than square

  // Sort instances to keep relative order stable
  const sorted = [...plan.instances].sort((a, b) => {
    const aRow = Math.round(a.y / 100), bRow = Math.round(b.y / 100);
    if (aRow !== bRow) return aRow - bRow;
    return a.x - b.x;
  });

  // First pass: compute max width and height per column/row for even spacing
  const colWidths:  number[] = Array(cols).fill(0);
  const rowHeights: number[] = [];

  sorted.forEach((inst, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    colWidths[col]  = Math.max(colWidths[col],  inst.width);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, inst.height);
  });

  // Second pass: position each asset
  const instances: PlacedAsset[] = sorted.map((inst, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);

    let x = PAD;
    for (let c = 0; c < col; c++) x += colWidths[c] + COL_GAP;

    let y = PAD;
    for (let r = 0; r < row; r++) y += rowHeights[r] + ROW_GAP;

    return { ...inst, x: snap(x), y: snap(y) };
  });

  // Re-sort back to original order (preserve instanceId order)
  const orderedMap = new Map(instances.map(i => [i.instanceId, i]));
  const result = plan.instances.map(i => orderedMap.get(i.instanceId) ?? i);

  return { ...plan, instances: result };
}
