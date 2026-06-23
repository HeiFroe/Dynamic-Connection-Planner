import React, { useState } from 'react';

export interface ConnectionOption {
  /** '__direct__' for plug-to-socket, otherwise a cable asset id */
  cableAssetId: string;
  /** Display name shown in the radio label */
  label: string;
  /** Manufacturer / sub-label (gray) */
  sublabel?: string;
  /** Color dot — for cables, the cable color; for direct, gray */
  color: string;
  /** Optional warning shown in red below the label (e.g. exceeds 30m) */
  warning?: string;
  /** Cable length in meters (for display) */
  lengthMeters?: number;
}

interface Props {
  options: ConnectionOption[];
  fromLabel: string;
  toLabel: string;
  /** Optional informational note shown above the option list (e.g. cable-length budget) */
  note?: string;
  onSelect: (cableAssetId: string) => void;
  onCancel: () => void;
}

export function ConnectionPickerDialog({
  options, fromLabel, toLabel, note, onSelect, onCancel,
}: Props) {
  const [selected, setSelected] = useState(options[0]?.cableAssetId ?? '');

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 500,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#1f2937',
          border: '1px solid #374151',
          borderRadius: 12,
          padding: '20px 24px',
          minWidth: 360, maxWidth: 480,
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ color: 'white', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
          Choose connection
        </h2>
        <p style={{ color: '#9ca3af', fontSize: 12, marginBottom: note ? 8 : 16 }}>
          {fromLabel} → {toLabel}
        </p>

        {note && (
          <div style={{
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.4)',
            color: '#fbbf24',
            fontSize: 11, padding: '6px 10px',
            borderRadius: 6, marginBottom: 14,
          }}>
            {note}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {options.map(opt => {
            const isDirect = opt.cableAssetId === '__direct__';
            return (
              <label
                key={opt.cableAssetId}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1.5px solid ${selected === opt.cableAssetId ? '#3b82f6' : '#374151'}`,
                  background: selected === opt.cableAssetId ? 'rgba(59,130,246,0.1)' : '#111827',
                  cursor: 'pointer',
                  transition: 'border-color .15s, background .15s',
                }}
              >
                <input
                  type="radio"
                  name="connection-option"
                  value={opt.cableAssetId}
                  checked={selected === opt.cableAssetId}
                  onChange={() => setSelected(opt.cableAssetId)}
                  style={{ accentColor: '#3b82f6', marginTop: 2 }}
                />
                <span
                  style={{
                    display: 'inline-block',
                    width: 10, height: 10, borderRadius: '50%',
                    background: opt.color, flexShrink: 0, marginTop: 4,
                  }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 500 }}>
                      {opt.label}
                    </span>
                    {opt.sublabel && (
                      <span style={{ color: '#6b7280', fontSize: 11 }}>
                        {opt.sublabel}
                      </span>
                    )}
                    {opt.lengthMeters !== undefined && (
                      <span style={{ color: '#9ca3af', fontSize: 11 }}>
                        {opt.lengthMeters} m
                      </span>
                    )}
                    {isDirect && (
                      <span style={{
                        color: '#34d399', fontSize: 10, fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        Direct
                      </span>
                    )}
                  </span>
                  {opt.warning && (
                    <span style={{ display: 'block', color: '#f87171', fontSize: 11, marginTop: 3 }}>
                      ⚠ {opt.warning}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              padding: '7px 16px', borderRadius: 6, border: '1px solid #374151',
              background: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 13,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => selected && onSelect(selected)}
            disabled={!selected}
            style={{
              padding: '7px 16px', borderRadius: 6, border: 'none',
              background: '#2563eb', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            Connect
          </button>
        </div>
      </div>
    </div>
  );
}
