import React from 'react';
import { Asset, PlacedAsset, PORT_COLORS, LAYER_META } from '../../types';

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize',
  e: 'ew-resize', se: 'nwse-resize', s: 'ns-resize',
  sw: 'nesw-resize', w: 'ew-resize',
};

const ROTATE_HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\'%3E%3Cpath d=\'M8 2a6 6 0 1 0 6 6\' stroke=\'black\' fill=\'none\' stroke-width=\'2\'/%3E%3Cpath d=\'M14 2l-2 4 4-1z\' fill=\'black\'/%3E%3C/svg%3E") 8 8, crosshair',
  n: 'crosshair', ne: 'crosshair', e: 'crosshair',
  se: 'crosshair', s: 'crosshair', sw: 'crosshair', w: 'crosshair',
};

function handleStyle(h: ResizeHandle): React.CSSProperties {
  const mid = { left: '50%', transform: 'translateX(-50%)' };
  const vmid = { top: '50%', transform: 'translateY(-50%)' };
  const map: Record<ResizeHandle, React.CSSProperties> = {
    nw: { top: -4, left: -4 },
    n:  { top: -4, ...mid },
    ne: { top: -4, right: -4 },
    e:  { right: -4, ...vmid },
    se: { bottom: -4, right: -4 },
    s:  { bottom: -4, ...mid },
    sw: { bottom: -4, left: -4 },
    w:  { left: -4, ...vmid },
  };
  return map[h];
}

interface ConnectingFrom {
  instanceId: string;
  portId: string;
}

interface Props {
  instance: PlacedAsset;
  asset: Asset;
  tileWidth: number;
  tileHeight: number;
  isSelected: boolean;
  visibleLayers: Record<string, boolean>;
  connectingFrom: ConnectingFrom | null;
  /** When true, resize handles act as rotation handles */
  rotationMode?: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onPortClick: (instanceId: string, portId: string) => void;
  onDeleteInstance: (instanceId: string) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onResizeHandleMouseDown: (e: React.MouseEvent, handle: ResizeHandle) => void;
  snapHighlight: boolean;
}

export function CanvasAsset({
  instance, asset, tileWidth, tileHeight,
  isSelected, visibleLayers, connectingFrom,
  rotationMode,
  onMouseDown, onPortClick, onDeleteInstance,
  onContextMenu, onResizeHandleMouseDown, snapHighlight,
}: Props) {
  const showPorts = Object.keys(visibleLayers).some(l => visibleLayers[l] && l !== 'hardware');
  const hasImage = !!(asset.frontImage || asset.rearImage);
  const displayImage = instance.viewMode === 'rear'
    ? (asset.rearImage ?? asset.frontImage)
    : (asset.frontImage ?? asset.rearImage);

  // Port dot size scales with the asset tile (min 8, proportional to base asset width)
  const basePortDotSize = 12;
  const scaleRatio = hasImage && asset.imageAspectRatio
    ? tileWidth / (asset.width)
    : 1;
  const portDotSize = Math.max(6, Math.round(basePortDotSize * Math.min(scaleRatio, 2)));

  const rotation = (instance as any).rotation ?? 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: instance.x,
        top: instance.y,
        width: tileWidth,
        height: tileHeight,
        background: hasImage ? 'transparent' : asset.color,
        borderRadius: 6,
        cursor: 'grab',
        userSelect: 'none',
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: 'center center',
        boxShadow: snapHighlight
          ? '0 0 0 3px #10B981, 0 4px 16px rgba(0,0,0,0.4)'
          : isSelected
            ? rotationMode
              ? '0 0 0 2px #F59E0B, 0 4px 16px rgba(0,0,0,0.4)'
              : '0 0 0 2px #3B82F6, 0 4px 16px rgba(0,0,0,0.4)'
            : '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'box-shadow .1s',
        zIndex: isSelected ? 10 : 1,
      }}
      onMouseDown={onMouseDown}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onContextMenu(e); }}
    >
      {/* Asset image — objectFit:fill so port positions align exactly */}
      {hasImage && displayImage && (
        <img
          src={displayImage}
          alt={asset.name}
          draggable={false}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'fill',
            borderRadius: 6,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Label (only when no image) */}
      {!hasImage && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', padding: 4, pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#f1f5f9', textAlign: 'center', lineHeight: 1.2 }}>
            {asset.name}
          </span>
          <span style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center' }}>
            {asset.manufacturer}
          </span>
        </div>
      )}

      {/* Rotation mode indicator */}
      {rotationMode && isSelected && (
        <div style={{
          position: 'absolute', inset: 0,
          border: '2px dashed #F59E0B',
          borderRadius: 6,
          pointerEvents: 'none',
          zIndex: 18,
        }} />
      )}

      {/* Delete button */}
      {isSelected && !instance.resizeHandlesEnabled && !rotationMode && (
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={() => onDeleteInstance(instance.instanceId)}
          style={{
            position: 'absolute', top: -10, right: -10,
            width: 20, height: 20, borderRadius: '50%',
            background: '#EF4444', border: '2px solid white',
            color: 'white', fontSize: 11, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, zIndex: 20, lineHeight: 1,
          }}
          title="Remove asset"
        >×</button>
      )}

      {/* Resize / Rotate handles */}
      {instance.resizeHandlesEnabled && (['nw','n','ne','e','se','s','sw','w'] as ResizeHandle[]).map(h => (
        <div
          key={h}
          style={{
            position: 'absolute',
            width: 8, height: 8,
            background: rotationMode ? '#F59E0B' : 'white',
            border: `1.5px solid ${rotationMode ? '#B45309' : '#3B82F6'}`,
            borderRadius: rotationMode ? '50%' : 2,
            zIndex: 25,
            cursor: rotationMode ? 'crosshair' : HANDLE_CURSORS[h],
            ...handleStyle(h),
          }}
          title={rotationMode ? 'Drag to rotate' : undefined}
          onMouseDown={e => { e.stopPropagation(); onResizeHandleMouseDown(e, h); }}
        />
      ))}

      {/* Port markers — size scales with the tile */}
      {showPorts && asset.ports.map(port => {
        if (!visibleLayers[port.layer]) return null;
        const isSourcePort = connectingFrom?.instanceId === instance.instanceId &&
          connectingFrom?.portId === port.id;
        const color = PORT_COLORS[port.type] ?? '#888';

        return (
          <div
            key={port.id}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onPortClick(instance.instanceId, port.id); }}
            title={`${port.label} (${LAYER_META[port.layer]?.label})`}
            style={{
              position: 'absolute',
              left: port.position.x * tileWidth,
              top: port.position.y * tileHeight,
              width: portDotSize, height: portDotSize,
              borderRadius: '50%',
              background: isSourcePort ? '#FBBF24' : color,
              border: `${Math.max(1, portDotSize / 6)}px solid ${isSourcePort ? '#92400E' : '#fff'}`,
              transform: 'translate(-50%, -50%)',
              cursor: connectingFrom ? 'crosshair' : 'pointer',
              zIndex: 15,
              boxShadow: isSourcePort ? '0 0 0 3px rgba(251,191,36,0.5)' : undefined,
            }}
          />
        );
      })}

      {/* Attachment point indicators */}
      {asset.attachmentPoints.map(ap => (
        <div key={ap.id} style={{
          position: 'absolute',
          ...(ap.edge === 'top'    ? { top: -4,    left: `${ap.position * 100}%`, transform: 'translateX(-50%)' } :
             ap.edge === 'bottom' ? { bottom: -4,  left: `${ap.position * 100}%`, transform: 'translateX(-50%)' } :
             ap.edge === 'left'   ? { left: -4,    top:  `${ap.position * 100}%`, transform: 'translateY(-50%)' } :
                                    { right: -4,   top:  `${ap.position * 100}%`, transform: 'translateY(-50%)' }),
          width: 8, height: 8, borderRadius: '50%',
          background: ap.role === 'host' ? '#6EE7B7' : '#FCA5A5',
          border: '1.5px solid white', zIndex: 5,
        }}
          title={`${ap.role === 'host' ? 'Andockpunkt' : 'Befestigung'}: ${ap.edge}`}
        />
      ))}
    </div>
  );
}

export type { ResizeHandle };
