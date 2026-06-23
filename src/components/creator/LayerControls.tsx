import React, { useState } from 'react';
import { Layer, LAYER_META } from '../../types';

interface Props {
  visibility: Record<Layer, boolean>;
  cableLabelVisibility?: Partial<Record<Layer, boolean>>;
  portLabelVisibility?: Partial<Record<Layer, boolean>>;
  /** @deprecated fallback */
  labelVisibility?: Partial<Record<Layer, boolean>>;
  onChange: (layer: Layer, visible: boolean) => void;
  onCableLabelChange?: (layer: Layer, show: boolean) => void;
  onPortLabelChange?: (layer: Layer, show: boolean) => void;
  /** @deprecated */
  onLabelChange?: (layer: Layer, show: boolean) => void;
}

const LAYERS: Layer[] = ['hardware', 'video', 'usb', 'power', 'ethernet', 'other'];

function MicroBtn({
  active, activeColor, title, children, onClick, layerActive,
}: {
  active: boolean;
  activeColor: string;
  title: string;
  children: React.ReactNode;
  onClick: () => void;
  layerActive: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 18, height: '100%',
        border: 'none',
        borderLeft: '1px solid rgba(255,255,255,0.25)',
        background: active && layerActive ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)',
        color: layerActive ? (active ? '#fff' : 'rgba(255,255,255,0.5)') : 'rgba(255,255,255,0.3)',
        fontSize: 8,
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0,
        lineHeight: 1,
        flexShrink: 0,
        transition: 'all .12s',
        textDecoration: active ? 'none' : 'line-through',
      }}
    >
      {children}
    </button>
  );
}

export function LayerControls({
  visibility, cableLabelVisibility, portLabelVisibility,
  onChange, onCableLabelChange, onPortLabelChange,
}: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
      <span style={{
        fontSize: 10, fontWeight: 700, color: '#9ca3af',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 2,
      }}>
        Layers:
      </span>
      {LAYERS.map(layer => {
        const { label, color } = LAYER_META[layer];
        const active = visibility[layer];
        const showCable = cableLabelVisibility?.[layer] ?? true;
        const showPort  = portLabelVisibility?.[layer]  ?? true;

        return (
          <div
            key={layer}
            style={{
              display: 'flex', alignItems: 'stretch',
              borderRadius: 20,
              overflow: 'hidden',
              border: `1.5px solid ${active ? color : color + '60'}`,
              background: active ? color : 'transparent',
              height: 24,
              transition: 'all .15s',
            }}
          >
            {/* Main layer toggle */}
            <button
              onClick={() => onChange(layer, !active)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                paddingLeft: 9, paddingRight: onCableLabelChange ? 6 : 9,
                border: 'none', background: 'transparent',
                color: active ? '#fff' : color,
                fontSize: 10, fontWeight: 700,
                cursor: 'pointer',
                transition: 'all .15s',
                userSelect: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: active ? 'rgba(255,255,255,0.8)' : color,
                flexShrink: 0,
              }} />
              {label}
            </button>

            {/* Kabel-Label toggle */}
            {onCableLabelChange && (
              <MicroBtn
                active={showCable}
                activeColor={color}
                title={showCable ? 'Hide cable labels' : 'Show cable labels'}
                onClick={() => onCableLabelChange(layer, !showCable)}
                layerActive={active}
              >
                K
              </MicroBtn>
            )}

            {/* Port-Label toggle */}
            {onPortLabelChange && (
              <MicroBtn
                active={showPort}
                activeColor={color}
                title={showPort ? 'Hide port labels' : 'Show port labels'}
                onClick={() => onPortLabelChange(layer, !showPort)}
                layerActive={active}
              >
                P
              </MicroBtn>
            )}
          </div>
        );
      })}
    </div>
  );
}
