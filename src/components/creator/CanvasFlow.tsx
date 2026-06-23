import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeChange,
  applyNodeChanges,
  Connection as RFConnection,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Plan, Asset, PlacedAsset, Connection, Layer, RoutingConfig } from '../../types';
import { DcdcAssetNode, DcdcAssetNodeData } from './DcdcAssetNode';
import { DcdcOrthogonalEdge, DcdcEdgeData } from './DcdcOrthogonalEdge';

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

// Node / edge type registries — declared outside the component so React Flow
// does not re-create them on every render (would trigger console warnings).
const nodeTypes = { dcdcAsset: DcdcAssetNode };
const edgeTypes = { dcdcOrthogonal: DcdcOrthogonalEdge };

// ── Areas as background "group" nodes ────────────────────────────────────────
// We render areas as non-draggable, non-selectable nodes with a low z-index
// so they appear behind asset nodes. React Flow has no built-in concept of
// "regions" but using a node with custom styling works cleanly.

function areaToNode(area: { id: string; name: string; x: number; y: number; width: number; height: number; color?: string; locked: boolean }): Node {
  return {
    id: `area-${area.id}`,
    type: 'group',
    position: { x: area.x, y: area.y },
    style: {
      width: area.width,
      height: area.height,
      background: (area.color ?? '#6366F1') + '18',
      border: `2px ${area.locked ? 'solid' : 'dashed'} ${area.color ?? '#6366F1'}`,
      borderRadius: 8,
      zIndex: -1,
    },
    data: { label: area.name, isArea: true },
    draggable: false,
    selectable: false,
    deletable: false,
  };
}

function placedAssetToNode(
  inst: PlacedAsset,
  asset: Asset,
  visibleLayers: Record<Layer, boolean>,
  showPortLabels: boolean,
): Node<DcdcAssetNodeData> {
  return {
    id: inst.instanceId,
    type: 'dcdcAsset',
    position: { x: inst.x, y: inst.y },
    data: {
      asset,
      viewMode: inst.viewMode ?? 'front',
      instanceWidth:  inst.instanceWidth,
      instanceHeight: inst.instanceHeight,
      visibleLayers,
      showPortLabels,
    },
    // Width/height let React Flow compute the correct bounding box for routing
    width:  inst.instanceWidth  ?? asset.width,
    height: inst.instanceHeight ?? asset.height,
  };
}

function connectionToEdge(
  conn: Connection,
  cableName: string | undefined,
  visibleLayers: Record<Layer, boolean>,
  showCableLabel: boolean,
  lineStyle?: 'solid' | 'dashed' | 'dotted',
): Edge<DcdcEdgeData> {
  return {
    id: conn.id,
    source: conn.fromInstanceId,
    sourceHandle: conn.fromPortId,
    target: conn.toInstanceId,
    targetHandle: conn.toPortId,
    type: 'dcdcOrthogonal',
    data: {
      layer: conn.layer,
      cableName,
      isLegacy: !conn.cableAssetId || conn.cableAssetId === '__legacy__',
      visibleLayers,
      showCableLabel,
      lineStyle,
    },
  };
}

function CanvasFlowInner(
  { plan, assets, onUpdatePlan, onEditAsset, routingConfig }: Props,
  ref: React.Ref<CanvasHandle>,
) {
  const rf = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    getViewport: () => {
      const vp = rf.getViewport();
      return { offset: { x: vp.x, y: vp.y }, scale: vp.zoom };
    },
  }), [rf]);

  const assetMap = useMemo(
    () => Object.fromEntries(assets.map(a => [a.id, a])),
    [assets],
  );

  // Build nodes: areas first (background z-index), then assets
  const nodes: Node[] = useMemo(() => {
    const areaNodes = (plan.areas ?? []).map(areaToNode);
    const showPortLabels = Object.values(plan.portLabelVisibility ?? {}).some(Boolean) ||
                           !plan.portLabelVisibility;
    const assetNodes = plan.instances
      .map(inst => {
        const asset = assetMap[inst.assetId];
        return asset ? placedAssetToNode(inst, asset, plan.layerVisibility, showPortLabels) : null;
      })
      .filter((n): n is Node<DcdcAssetNodeData> => n !== null);
    return [...areaNodes, ...assetNodes];
  }, [plan.areas, plan.instances, plan.layerVisibility, plan.portLabelVisibility, assetMap]);

  const edges: Edge[] = useMemo(() => {
    const showCableLabel = Object.values(plan.cableLabelVisibility ?? {}).some(Boolean) ||
                           !plan.cableLabelVisibility;
    return plan.connections
      .map(conn => {
        const cable = conn.cableAssetId ? assetMap[conn.cableAssetId] : undefined;
        const layerStyle = routingConfig?.layerLineStyle?.[conn.layer];
        const lineStyle = layerStyle ?? routingConfig?.defaultLineStyle;
        return connectionToEdge(conn, cable?.name, plan.layerVisibility, showCableLabel, lineStyle);
      });
  }, [plan.connections, plan.layerVisibility, plan.cableLabelVisibility, assetMap, routingConfig]);

  // Drag → update instance position in the plan
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    // We only care about position changes that complete (dragging=false)
    const updated = applyNodeChanges(changes, nodes);

    const positionChanges = changes.filter(
      c => c.type === 'position' && c.dragging === false,
    );
    if (positionChanges.length === 0) return;

    const newInstances = plan.instances.map(inst => {
      const moved = updated.find(n => n.id === inst.instanceId);
      if (!moved || moved.position.x === inst.x && moved.position.y === inst.y) return inst;
      return { ...inst, x: moved.position.x, y: moved.position.y };
    });
    onUpdatePlan({ ...plan, instances: newInstances, updatedAt: new Date().toISOString() });
  }, [nodes, plan, onUpdatePlan]);

  // New connection drawn by user
  const handleConnect = useCallback((conn: RFConnection) => {
    if (!conn.source || !conn.target || !conn.sourceHandle || !conn.targetHandle) return;

    const fromInst = plan.instances.find(i => i.instanceId === conn.source);
    const toInst   = plan.instances.find(i => i.instanceId === conn.target);
    if (!fromInst || !toInst) return;

    const fromAsset = assetMap[fromInst.assetId];
    const fromPort  = fromAsset?.ports.find(p => p.id === conn.sourceHandle);
    if (!fromPort) return;

    const newConn: Connection = {
      id: crypto.randomUUID(),
      fromInstanceId: conn.source,
      fromPortId: conn.sourceHandle,
      toInstanceId: conn.target,
      toPortId: conn.targetHandle,
      cableAssetId: '__legacy__', // Cable picker would go here; left for follow-up
      layer: fromPort.layer,
      waypoints: [],
    };
    onUpdatePlan({
      ...plan,
      connections: [...plan.connections, newConn],
      updatedAt: new Date().toISOString(),
    });
  }, [plan, assetMap, onUpdatePlan]);

  const handleNodeDoubleClick = useCallback((_e: React.MouseEvent, node: Node) => {
    const inst = plan.instances.find(i => i.instanceId === node.id);
    if (inst) onEditAsset(inst.assetId);
  }, [plan.instances, onEditAsset]);

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onConnect={handleConnect}
        onNodeDoubleClick={handleNodeDoubleClick}
        defaultViewport={{ x: 40, y: 40, zoom: 1 }}
        minZoom={0.2}
        maxZoom={3}
        fitView={plan.instances.length > 0}
        fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="#e2e8f0" />
        <Controls position="bottom-right" />
        <MiniMap
          position="top-right"
          pannable
          zoomable
          maskColor="rgba(15,23,42,0.6)"
          nodeColor={(n) => {
            const data = n.data as DcdcAssetNodeData | undefined;
            return data?.asset?.color ?? '#94a3b8';
          }}
        />
      </ReactFlow>
    </div>
  );
}

const CanvasFlowImpl = forwardRef<CanvasHandle, Props>(CanvasFlowInner);

/**
 * Public wrapper — provides the ReactFlowProvider so multiple consumers can
 * share the same flow instance if needed in future.
 */
export const CanvasFlow = forwardRef<CanvasHandle, Props>(function CanvasFlow(props, ref) {
  return (
    <ReactFlowProvider>
      <CanvasFlowImpl {...props} ref={ref} />
    </ReactFlowProvider>
  );
});
