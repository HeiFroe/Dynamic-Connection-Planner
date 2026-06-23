/**
 * Plan ↔ JSON Canvas 1.0 mapper.
 *
 * The .canvas file follows the public spec (https://jsoncanvas.org/spec/1.0/):
 *   nodes: [{id, type, x, y, width, height, file?, text?, label?, color?}]
 *   edges: [{id, fromNode, toNode, fromSide, toSide, fromEnd?, toEnd?, color?, label?}]
 *
 * DCDC stores extra fields that the JSON Canvas spec can't represent:
 *   - waypoints, fromPortId, toPortId, layer, isDirect (on connections)
 *   - layerVisibility, port/cableLabelVisibility (on plan)
 *   - area color
 * These live in a sidecar `<plan>.dcdc.json` next to the .canvas file.
 *
 * Identity mapping:
 *   - canvas node.id    = PlacedAsset.instanceId
 *   - canvas edge.id    = Connection.id
 *   - canvas node.file  = vault-relative path to the asset's .md file
 *   - sidecar.instanceMap holds Asset UUID per node so we can re-resolve
 *     even if the .md was renamed in Obsidian.
 */

import {
  Plan, PlacedAsset, Connection, Area, Asset, Layer,
} from '../types';
import { slugify, joinVaultPath } from './slugify';
import { assetVaultPath } from './assetMapper';

type Side = 'top' | 'right' | 'bottom' | 'left';

export interface CanvasNode {
  id: string;
  type: 'text' | 'file' | 'link' | 'group';
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  file?: string;
  text?: string;
  label?: string;
}

export interface CanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: Side;
  toSide?: Side;
  fromEnd?: 'none' | 'arrow';
  toEnd?: 'none' | 'arrow';
  color?: string;
  label?: string;
}

export interface CanvasFile {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export interface PlanSidecar {
  planId: string;
  name: string;
  layerVisibility: Record<Layer, boolean>;
  portLabelVisibility?: Partial<Record<Layer, boolean>>;
  cableLabelVisibility?: Partial<Record<Layer, boolean>>;
  connections: Record<string, {
    fromPortId: string;
    toPortId: string;
    layer: Layer;
    waypoints: { x: number; y: number }[];
    isDirect?: boolean;
  }>;
  areas: Record<string, { color?: string; name: string }>;
  /** Maps canvas node.id (instanceId) → DCDC assetId (UUID), so renames in Obsidian don't break references. */
  instanceMap: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

// ── Path generation ─────────────────────────────────────────────────────────

export function planVaultPaths(plan: Plan, subfolder: string): { canvas: string; sidecar: string } {
  const slug = slugify(plan.name) || `plan-${plan.id.slice(0, 8)}`;
  return {
    canvas:  joinVaultPath(subfolder, 'Plans', `${slug}.canvas`),
    sidecar: joinVaultPath(subfolder, 'Plans', `${slug}.dcdc.json`),
  };
}

// ── Plan → Canvas + Sidecar ─────────────────────────────────────────────────

const LAYER_COLORS: Record<Layer, string> = {
  hardware: '#6B7280',
  video:    '#3B82F6',
  usb:      '#10B981',
  power:    '#EF4444',
  ethernet: '#F59E0B',
  other:    '#A855F7',
};

export function planToCanvas(
  plan: Plan,
  assets: Asset[],
  subfolder: string,
): { canvas: CanvasFile; sidecar: PlanSidecar } {
  const assetById = new Map(assets.map(a => [a.id, a]));

  // Nodes: PlacedAssets (file nodes) + Areas (group nodes)
  const nodes: CanvasNode[] = [];
  for (const inst of plan.instances) {
    const asset = assetById.get(inst.assetId);
    nodes.push({
      id:    inst.instanceId,
      type:  asset ? 'file' : 'text',
      x:     Math.round(inst.x),
      y:     Math.round(inst.y),
      width: Math.round(inst.width),
      height:Math.round(inst.height),
      ...(asset
        ? { file: assetVaultPath(asset, subfolder) }
        : { text: `Missing asset ${inst.assetId}` }),
    });
  }
  for (const area of plan.areas) {
    nodes.push({
      id:    area.id,
      type:  'group',
      x:     Math.round(area.x),
      y:     Math.round(area.y),
      width: Math.round(area.width),
      height:Math.round(area.height),
      label: area.name,
      ...(area.color !== undefined && { color: area.color }),
    });
  }

  // Edges: connections
  const instanceById = new Map(plan.instances.map(i => [i.instanceId, i]));
  const edges: CanvasEdge[] = [];
  for (const conn of plan.connections) {
    const fromInst = instanceById.get(conn.fromInstanceId);
    const toInst   = instanceById.get(conn.toInstanceId);
    if (!fromInst || !toInst) continue;
    const fromAsset = assetById.get(fromInst.assetId);
    const toAsset   = assetById.get(toInst.assetId);
    const fromPort  = fromAsset?.ports.find(p => p.id === conn.fromPortId);
    const toPort    = toAsset?.ports.find(p => p.id === conn.toPortId);
    edges.push({
      id:       conn.id,
      fromNode: conn.fromInstanceId,
      toNode:   conn.toInstanceId,
      fromSide: portToSide(fromPort?.position),
      toSide:   portToSide(toPort?.position),
      fromEnd:  'none',
      toEnd:    'none',
      color:    LAYER_COLORS[conn.layer],
      label:    fromPort?.name && toPort?.name
                  ? `${fromPort.name} → ${toPort.name}`
                  : undefined,
    });
  }

  // Sidecar
  const connectionsSidecar: PlanSidecar['connections'] = {};
  for (const c of plan.connections) {
    connectionsSidecar[c.id] = {
      fromPortId: c.fromPortId,
      toPortId:   c.toPortId,
      layer:      c.layer,
      waypoints:  c.waypoints,
      ...(c.isDirect !== undefined && { isDirect: c.isDirect }),
    };
  }
  const areasSidecar: PlanSidecar['areas'] = {};
  for (const a of plan.areas) {
    areasSidecar[a.id] = {
      name: a.name,
      ...(a.color !== undefined && { color: a.color }),
    };
  }
  const instanceMap: Record<string, string> = {};
  for (const inst of plan.instances) instanceMap[inst.instanceId] = inst.assetId;

  const sidecar: PlanSidecar = {
    planId:               plan.id,
    name:                 plan.name,
    layerVisibility:      plan.layerVisibility,
    portLabelVisibility:  plan.portLabelVisibility,
    cableLabelVisibility: plan.cableLabelVisibility,
    connections:          connectionsSidecar,
    areas:                areasSidecar,
    instanceMap,
    createdAt:            plan.createdAt,
    updatedAt:            plan.updatedAt,
  };

  return { canvas: { nodes, edges }, sidecar };
}

function portToSide(pos?: { x: number; y: number }): Side {
  if (!pos) return 'right';
  const d = [pos.x, 1 - pos.x, pos.y, 1 - pos.y];
  const sides: Side[] = ['left', 'right', 'top', 'bottom'];
  return sides[d.indexOf(Math.min(...d))];
}

/** Generate a UUID without depending on `crypto.randomUUID` (not in jest-jsdom). */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
    return (crypto as any).randomUUID();
  }
  // Fallback — sufficient for test environments
  return 'plan-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
}

// ── Canvas + Sidecar → Plan ─────────────────────────────────────────────────

export function canvasToPlan(
  canvas: CanvasFile,
  sidecar: PlanSidecar | null,
  /** Map from vault path → asset, used to resolve file-nodes back to assetIds */
  assetsByVaultPath: Map<string, Asset>,
  /** Map from UUID → asset, used as fallback via sidecar.instanceMap */
  assetsById: Map<string, Asset>,
  existingPlan?: Plan,
): Plan {
  const planId = sidecar?.planId ?? existingPlan?.id ?? generateId();
  const now    = new Date().toISOString();

  // Instances: file-typed canvas nodes
  const instances: PlacedAsset[] = [];
  const fallbackLayerVis: Record<Layer, boolean> = {
    hardware: true, video: true, usb: true, power: true, ethernet: true, other: true,
  };

  for (const node of canvas.nodes) {
    if (node.type === 'group') continue;
    // Resolve assetId — first by sidecar.instanceMap (survives renames), then by file path
    let assetId: string | undefined;
    if (sidecar?.instanceMap?.[node.id]) {
      assetId = sidecar.instanceMap[node.id];
    } else if (node.type === 'file' && node.file) {
      const asset = assetsByVaultPath.get(node.file);
      if (asset) assetId = asset.id;
    }
    if (!assetId) continue;  // orphan node — skip
    // Verify the asset still exists; if not, keep instance with that ID so user sees orphan
    if (!assetsById.has(assetId)) continue;
    instances.push({
      instanceId: node.id,
      assetId,
      x:      node.x,
      y:      node.y,
      width:  node.width,
      height: node.height,
    });
  }

  // Areas: group-typed canvas nodes
  const areas: Area[] = [];
  for (const node of canvas.nodes) {
    if (node.type !== 'group') continue;
    areas.push({
      id:     node.id,
      name:   node.label ?? sidecar?.areas?.[node.id]?.name ?? 'Area',
      x:      node.x,
      y:      node.y,
      width:  node.width,
      height: node.height,
      color:  sidecar?.areas?.[node.id]?.color ?? node.color,
    });
  }

  // Connections: edges + sidecar
  const connections: Connection[] = [];
  for (const edge of canvas.edges) {
    const fromInst = instances.find(i => i.instanceId === edge.fromNode);
    const toInst   = instances.find(i => i.instanceId === edge.toNode);
    if (!fromInst || !toInst) continue;

    const side = sidecar?.connections?.[edge.id];
    if (side) {
      connections.push({
        id:             edge.id,
        fromInstanceId: edge.fromNode,
        fromPortId:     side.fromPortId,
        toInstanceId:   edge.toNode,
        toPortId:       side.toPortId,
        layer:          side.layer,
        waypoints:      side.waypoints ?? [],
        ...(side.isDirect !== undefined && { isDirect: side.isDirect }),
      });
    } else {
      // No sidecar — degraded restore: pick first port on each asset that matches edge sides
      const fromAsset = assetsById.get(fromInst.assetId);
      const toAsset   = assetsById.get(toInst.assetId);
      const fromPort  = fromAsset?.ports.find(p => portToSide(p.position) === edge.fromSide) ?? fromAsset?.ports[0];
      const toPort    = toAsset?.ports.find(p => portToSide(p.position) === edge.toSide)   ?? toAsset?.ports[0];
      if (!fromPort || !toPort) continue;
      connections.push({
        id:             edge.id,
        fromInstanceId: edge.fromNode,
        fromPortId:     fromPort.id,
        toInstanceId:   edge.toNode,
        toPortId:       toPort.id,
        layer:          fromPort.layer,
        waypoints:      [],
      });
    }
  }

  return {
    id:                   planId,
    name:                 sidecar?.name ?? existingPlan?.name ?? 'Plan',
    instances,
    connections,
    areas,
    layerVisibility:      sidecar?.layerVisibility      ?? existingPlan?.layerVisibility      ?? fallbackLayerVis,
    portLabelVisibility:  sidecar?.portLabelVisibility  ?? existingPlan?.portLabelVisibility,
    cableLabelVisibility: sidecar?.cableLabelVisibility ?? existingPlan?.cableLabelVisibility,
    createdAt:            sidecar?.createdAt ?? existingPlan?.createdAt ?? now,
    updatedAt:            sidecar?.updatedAt ?? now,
  };
}
