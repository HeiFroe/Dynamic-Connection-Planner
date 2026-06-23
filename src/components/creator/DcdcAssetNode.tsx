import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Asset, Port, PORT_COLORS } from '../../types';

export interface DcdcAssetNodeData {
  asset: Asset;
  viewMode: 'front' | 'rear';
  instanceWidth?: number;
  instanceHeight?: number;
  visibleLayers: Record<string, boolean>;
  showPortLabels?: boolean;
  [key: string]: unknown;
}

/**
 * Map a port's 0..1 relative position to the nearest React Flow Position edge.
 * Port handles must attach to a specific side; we pick the closest edge based
 * on which axis is more extreme.
 */
function portToHandlePosition(port: Port): Position {
  const { x, y } = port.position;
  // Distance to each edge
  const dLeft   = x;
  const dRight  = 1 - x;
  const dTop    = y;
  const dBottom = 1 - y;
  const min = Math.min(dLeft, dRight, dTop, dBottom);
  if (min === dTop)    return Position.Top;
  if (min === dBottom) return Position.Bottom;
  if (min === dLeft)   return Position.Left;
  return Position.Right;
}

/**
 * Convert a port's 0..1 position into a CSS offset along its edge.
 * Returns the percentage offset on the perpendicular axis.
 */
function portOffsetStyle(port: Port, pos: Position): React.CSSProperties {
  const { x, y } = port.position;
  if (pos === Position.Top || pos === Position.Bottom) {
    return { left: `${x * 100}%`, transform: 'translateX(-50%)' };
  }
  return { top: `${y * 100}%`, transform: 'translateY(-50%)' };
}

export const DcdcAssetNode = memo(function DcdcAssetNode({ data, selected }: NodeProps) {
  const { asset, viewMode, instanceWidth, instanceHeight, visibleLayers, showPortLabels } = data as DcdcAssetNodeData;

  const w = instanceWidth ?? asset.width;
  const h = instanceHeight ?? asset.height;
  const image = viewMode === 'rear'
    ? (asset.rearImage || asset.frontImage)
    : (asset.frontImage || asset.rearImage);

  return (
    <div
      style={{
        width: w,
        height: h,
        background: image ? asset.color : asset.color,
        borderRadius: 6,
        border: selected ? '2px solid #3b82f6' : '1px solid rgba(0,0,0,0.15)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        position: 'relative',
        overflow: 'visible',
      }}
    >
      {image ? (
        <img
          src={image}
          alt={asset.name}
          draggable={false}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'contain', borderRadius: 6, pointerEvents: 'none',
          }}
        />
      ) : (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: '#fff', fontSize: '0.65rem',
          fontWeight: 600, textAlign: 'center', padding: 4, lineHeight: 1.2,
        }}>
          {asset.manufacturer} {asset.model}
        </div>
      )}

      {/* Port handles — one per port, hidden when its layer is off */}
      {asset.ports.map((port) => {
        if (!visibleLayers[port.layer]) return null;
        const pos = portToHandlePosition(port);
        const offset = portOffsetStyle(port, pos);
        const color = PORT_COLORS[port.type] ?? '#888';

        return (
          <React.Fragment key={port.id}>
            <Handle
              id={port.id}
              type="source"   // Allow both directions; we filter via cable picker
              position={pos}
              style={{
                ...offset,
                width: 10, height: 10, borderRadius: '50%',
                background: color, border: '2px solid #fff',
                zIndex: 10,
              }}
            />
            {showPortLabels && (
              <div
                style={{
                  position: 'absolute',
                  ...offset,
                  ...(pos === Position.Top    ? { top:    -18 } : {}),
                  ...(pos === Position.Bottom ? { bottom: -18 } : {}),
                  ...(pos === Position.Left   ? { left:   -4, transform: 'translateX(-100%) translateY(-50%)' } : {}),
                  ...(pos === Position.Right  ? { right:  -4, transform: 'translateX(100%) translateY(-50%)' } : {}),
                  fontSize: 9,
                  fontWeight: 600,
                  background: 'rgba(30,41,59,0.92)',
                  color: '#e2e8f0',
                  padding: '1px 4px',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  zIndex: 11,
                }}
              >
                {port.label}
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* Asset name label at top — only when no image (rare) */}
      {!image && (
        <div style={{
          position: 'absolute', bottom: -16, left: 0, right: 0,
          textAlign: 'center', fontSize: 10, color: '#475569',
          pointerEvents: 'none',
        }}>
          {asset.name}
        </div>
      )}
    </div>
  );
});
