import { Plan, Asset, Layer } from '../types';
import { planToCanvas, canvasToPlan, planVaultPaths } from './canvasMapper';
import { assetVaultPath } from './assetMapper';

const ALL_LAYERS_TRUE: Record<Layer, boolean> = {
  hardware: true, video: true, usb: true, power: true, ethernet: true, other: true,
};

const ASSET_A: Asset = {
  id: 'asset-a', dbNumber: 1, vendor: 'Logitech', model: 'Rally Bar',
  category: 'collaboration-system',
  ports: [
    { id: 'p1', name: 'HDMI OUT', layer: 'video', standard: 'hdmi-out', maleFemale: 'female', position: { x: 1, y: 0.5 } },
    { id: 'p2', name: 'Power IN', layer: 'power', standard: 'power-adapter', maleFemale: 'female', position: { x: 0, y: 0.5 } },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const ASSET_B: Asset = {
  id: 'asset-b', dbNumber: 2, vendor: 'LG', model: '55-UH5-Q',
  category: 'display',
  ports: [
    { id: 'p3', name: 'HDMI IN 1', layer: 'video', standard: 'hdmi-in', maleFemale: 'female', position: { x: 1, y: 0.8 } },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const PLAN: Plan = {
  id: 'plan-1', name: 'Test Plan',
  instances: [
    { instanceId: 'inst-a', assetId: 'asset-a', x: 100, y: 100, width: 200, height: 50 },
    { instanceId: 'inst-b', assetId: 'asset-b', x: 500, y: 80, width: 300, height: 180 },
  ],
  connections: [
    {
      id: 'conn-1',
      fromInstanceId: 'inst-a', fromPortId: 'p1',
      toInstanceId:   'inst-b', toPortId:   'p3',
      layer: 'video',
      waypoints: [{ x: 350, y: 100 }],
      isDirect: false,
    },
  ],
  areas: [
    { id: 'area-1', name: 'Wall', x: 50, y: 50, width: 800, height: 220, color: '#888888' },
  ],
  layerVisibility: ALL_LAYERS_TRUE,
  portLabelVisibility:  { video: true },
  cableLabelVisibility: { video: true },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-06-20T00:00:00.000Z',
};

describe('canvasMapper', () => {
  test('round-trip preserves instances, connections, areas', () => {
    const assets = [ASSET_A, ASSET_B];
    const { canvas, sidecar } = planToCanvas(PLAN, assets, 'DCDC');

    const byPath = new Map(assets.map(a => [assetVaultPath(a, 'DCDC'), a]));
    const byId   = new Map(assets.map(a => [a.id, a]));
    const back   = canvasToPlan(canvas, sidecar, byPath, byId);

    expect(back.id).toBe(PLAN.id);
    expect(back.name).toBe(PLAN.name);
    expect(back.instances).toEqual(PLAN.instances);
    expect(back.connections.length).toBe(1);
    expect(back.connections[0].fromPortId).toBe('p1');
    expect(back.connections[0].toPortId).toBe('p3');
    expect(back.connections[0].waypoints).toEqual([{ x: 350, y: 100 }]);
    expect(back.areas.length).toBe(1);
    expect(back.areas[0].name).toBe('Wall');
  });

  test('canvas has correct node types', () => {
    const { canvas } = planToCanvas(PLAN, [ASSET_A, ASSET_B], 'DCDC');
    expect(canvas.nodes.filter(n => n.type === 'file').length).toBe(2);
    expect(canvas.nodes.filter(n => n.type === 'group').length).toBe(1);
    const fileNode = canvas.nodes.find(n => n.id === 'inst-a');
    expect(fileNode?.file).toBe('DCDC/Assets/collaboration-system/logitech/rally-bar--1.md');
  });

  test('degraded restore: missing sidecar picks first compatible port', () => {
    const { canvas } = planToCanvas(PLAN, [ASSET_A, ASSET_B], 'DCDC');
    const byPath = new Map([
      [assetVaultPath(ASSET_A, 'DCDC'), ASSET_A],
      [assetVaultPath(ASSET_B, 'DCDC'), ASSET_B],
    ]);
    const byId = new Map([[ASSET_A.id, ASSET_A], [ASSET_B.id, ASSET_B]]);

    const back = canvasToPlan(canvas, null, byPath, byId);

    expect(back.connections.length).toBe(1);
    // Without sidecar: still picks a port (degraded restore)
    expect(back.connections[0].fromPortId).toBeTruthy();
    expect(back.connections[0].toPortId).toBeTruthy();
    expect(back.connections[0].waypoints).toEqual([]); // waypoints not in canvas, lost
  });

  test('planVaultPaths slugifies the plan name', () => {
    const { canvas, sidecar } = planVaultPaths({ ...PLAN, name: 'Conference Room A/B' } as Plan, 'DCDC');
    expect(canvas).toBe('DCDC/Plans/conference-room-a-b.canvas');
    expect(sidecar).toBe('DCDC/Plans/conference-room-a-b.dcdc.json');
  });
});
