import React from 'react';
import { EdgeProps, BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';
import { LAYER_META, Layer } from '../../types';

export interface DcdcEdgeData {
  layer: Layer;
  cableName?: string;
  isLegacy?: boolean;
  visibleLayers: Record<Layer, boolean>;
  showCableLabel?: boolean;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  [key: string]: unknown;
}

/**
 * Orthogonal step-path edge with layer-based colour and visibility filter.
 *
 * React Flow's built-in `getSmoothStepPath` gives us a clean L-shaped path with
 * rounded corners that respects source/target handle positions. For the more
 * complex obstacle-avoidance routing from our custom engine (utils/routing.ts)
 * we'd need a custom path builder — but the step path covers >90% of cases
 * cleanly because handles already snap to the correct edge of each node.
 */
export function DcdcOrthogonalEdge(props: EdgeProps) {
  const {
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    data, markerEnd, selected,
  } = props;

  const d = (data ?? {}) as DcdcEdgeData;
  if (!d.visibleLayers[d.layer]) return null;

  const meta  = LAYER_META[d.layer];
  const color = d.isLegacy ? '#6b7280' : meta.color;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 8,
    offset: 18,
  });

  const strokeDasharray =
    d.isLegacy            ? '6 4'   :
    d.lineStyle === 'dashed' ? '6 4' :
    d.lineStyle === 'dotted' ? '2 4' :
    undefined;

  return (
    <>
      <BaseEdge
        id={props.id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth: selected ? 3 : 2,
          strokeDasharray,
          opacity: 0.9,
        }}
      />
      {d.showCableLabel && d.cableName && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: '#fff',
              border: `1px solid ${color}`,
              color: '#1f2937',
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 4,
              pointerEvents: 'all',
              whiteSpace: 'nowrap',
            }}
            className="nodrag nopan"
          >
            {d.cableName}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
