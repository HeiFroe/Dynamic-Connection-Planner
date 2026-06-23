import React from 'react';
import { RoutingConfig, DEFAULT_ROUTING_CONFIG, LineStyle, Layer, LAYER_META } from '../../types';

interface Props {
  config: RoutingConfig;
  onChange: (patch: Partial<RoutingConfig>) => void;
  onClose: () => void;
}

const LAYERS: Layer[] = ['hardware', 'video', 'usb', 'power', 'ethernet', 'other'];

const LINE_STYLES: { value: LineStyle; label: string }[] = [
  { value: 'solid',  label: 'Solid'  },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

function SliderRow({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 11, color: '#d1d5db', width: 100, flexShrink: 0 }}>{label}</span>
      <input
        type="range"
        min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: '#6366f1', cursor: 'pointer' }}
      />
      <span style={{ fontSize: 11, color: '#9ca3af', width: 30, textAlign: 'right' }}>{value}px</span>
    </div>
  );
}

function StyleToggle({ value, onChange }: {
  value: LineStyle;
  onChange: (v: LineStyle) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {LINE_STYLES.map(s => (
        <button
          key={s.value}
          onClick={() => onChange(s.value)}
          style={{
            padding: '3px 8px',
            fontSize: 10, fontWeight: 600,
            border: `1px solid ${value === s.value ? '#6366f1' : '#374151'}`,
            borderRadius: 4,
            background: value === s.value ? '#4f46e5' : '#1f2937',
            color: value === s.value ? '#fff' : '#9ca3af',
            cursor: 'pointer',
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export function RoutingConfigPanel({ config, onChange, onClose }: Props) {
  return (
    <div
      style={{
        position: 'absolute', top: 40, right: 0,
        background: '#111827', border: '1px solid #374151',
        borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        zIndex: 200, width: 320, padding: '12px 14px',
        color: 'white',
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: '#9ca3af', textTransform: 'uppercase' }}>
          Routing &amp; Style
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
        >✕</button>
      </div>

      {/* Default line style */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          Default Line Style
        </div>
        <StyleToggle
          value={config.defaultLineStyle}
          onChange={v => onChange({ defaultLineStyle: v })}
        />
      </div>

      {/* Per-layer overrides */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          Per-Layer Override
        </div>
        {LAYERS.map(layer => {
          const { label, color } = LAYER_META[layer];
          const current = config.layerLineStyle[layer] ?? config.defaultLineStyle;
          const isOverridden = layer in config.layerLineStyle;
          return (
            <div key={layer} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, width: 80, flexShrink: 0 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: '#d1d5db' }}>{label}</span>
              </span>
              <StyleToggle
                value={current}
                onChange={v => {
                  const layerLineStyle = { ...config.layerLineStyle, [layer]: v };
                  onChange({ layerLineStyle });
                }}
              />
              {isOverridden && (
                <button
                  onClick={() => {
                    const { [layer]: _removed, ...rest } = config.layerLineStyle;
                    onChange({ layerLineStyle: rest });
                  }}
                  title="Reset to default"
                  style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 11, padding: '0 2px' }}
                >↺</button>
              )}
            </div>
          );
        })}
      </div>

      {/* Routing constants */}
      <div style={{ borderTop: '1px solid #1f2937', paddingTop: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Routing
        </div>
        <SliderRow label="Stub length"    value={config.stubLen}      min={4}  max={60} onChange={v => onChange({ stubLen: v })} />
        <SliderRow label="Corner radius"  value={config.cornerR}      min={0}  max={24} onChange={v => onChange({ cornerR: v })} />
        <SliderRow label="Parallel gap"   value={config.parallelGap}  min={2}  max={20} onChange={v => onChange({ parallelGap: v })} />
        <SliderRow label="Box padding"    value={config.boxPad}       min={4}  max={40} onChange={v => onChange({ boxPad: v })} />
        <SliderRow label="Crossover r"    value={config.crossR}       min={2}  max={12} onChange={v => onChange({ crossR: v })} />
      </div>

      {/* Reset */}
      <button
        onClick={() => onChange({ ...DEFAULT_ROUTING_CONFIG })}
        style={{
          width: '100%', padding: '5px 0',
          background: '#1f2937', border: '1px solid #374151',
          borderRadius: 5, color: '#9ca3af', fontSize: 11,
          cursor: 'pointer', fontWeight: 600,
        }}
      >
        Reset Defaults
      </button>
    </div>
  );
}
