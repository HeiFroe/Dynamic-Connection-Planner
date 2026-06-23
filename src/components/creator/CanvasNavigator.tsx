import React, { useState } from 'react';

interface Props {
  scale: number;
  onPan: (dx: number, dy: number) => void;
  onZoom: (factor: number) => void;
  onFit: () => void;
  onReset: () => void;
  onBack?: () => void;
  canBack?: boolean;
  onOptimize?: () => void;
  onAddArea?: () => void;
  addingArea?: boolean;
}

const PAN = 100;

function Btn({ onClick, title, children, wide, disabled, accent, active }: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  disabled?: boolean;
  accent?: boolean;
  active?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: wide ? 'auto' : 26, height: 26,
        minWidth: wide ? 54 : 26,
        border: `1px solid ${active ? '#6366f1' : accent ? '#3b82f6' : '#e2e8f0'}`,
        borderRadius: 5,
        background: active ? '#eef2ff' : accent ? '#eff6ff' : 'white',
        color: disabled ? '#cbd5e1' : active ? '#4f46e5' : accent ? '#2563eb' : '#374151',
        fontSize: wide ? 10 : 13,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        lineHeight: 1,
        padding: wide ? '0 6px' : 0,
        transition: 'background .1s',
        gap: 3,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.background =
            active ? '#e0e7ff' : accent ? '#dbeafe' : '#f1f5f9';
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background =
          active ? '#eef2ff' : accent ? '#eff6ff' : 'white';
      }}
    >
      {children}
    </button>
  );
}

export function CanvasNavigator({
  scale, onPan, onZoom, onFit, onReset, onBack, canBack, onOptimize, onAddArea, addingArea,
}: Props) {
  const [collapsed, setCollapsed] = useState(true);

  if (collapsed) {
    return (
      <div
        style={{
          position: 'absolute', bottom: 12, right: 12,
          width: 44, height: 44,
          background: 'rgba(255,255,255,0.7)',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
          zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'all 0.2s ease',
          fontSize: 20,
          color: '#374151',
        }}
        onMouseDown={e => e.stopPropagation()}
        onMouseEnter={() => setCollapsed(false)}
        onClick={() => setCollapsed(false)}
        title="Open Navigator"
      >
        ⊞
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute', bottom: 12, right: 12,
        background: 'rgba(255,255,255,0.97)',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
        padding: '7px 8px',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        userSelect: 'none',
        transition: 'all 0.2s ease',
      }}
      onMouseDown={e => e.stopPropagation()}
      onMouseLeave={() => setCollapsed(true)}
    >
      {/* Pan arrows */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Btn onClick={() => onPan(0, PAN)} title="Pan Up">↑</Btn>
      </div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <Btn onClick={() => onPan(PAN, 0)} title="Pan Left">←</Btn>
        <Btn onClick={onReset} title="100% View" wide>100%</Btn>
        <Btn onClick={() => onPan(-PAN, 0)} title="Pan Right">→</Btn>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Btn onClick={() => onPan(0, -PAN)} title="Pan Down">↓</Btn>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #e2e8f0', margin: '1px 0' }} />

      {/* Zoom + Fit */}
      <div style={{ display: 'flex', gap: 3, justifyContent: 'center', alignItems: 'center' }}>
        <Btn onClick={() => onZoom(1.2)} title="Zoom In">+</Btn>
        <span style={{ fontSize: 10, color: '#94a3b8', minWidth: 32, textAlign: 'center' }}>
          {Math.round(scale * 100)}%
        </span>
        <Btn onClick={() => onZoom(1 / 1.2)} title="Zoom Out">−</Btn>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Btn onClick={onFit} title="Fit Content" wide>⊡ Fit</Btn>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #e2e8f0', margin: '1px 0' }} />

      {/* Back + Optimize */}
      <div style={{ display: 'flex', gap: 3 }}>
        <Btn onClick={onBack ?? (() => {})} title="Undo last step" disabled={!canBack} wide>
          ↩ Back
        </Btn>
      </div>
      {onOptimize && (
        <div style={{ display: 'flex' }}>
          <Btn onClick={onOptimize} title="Auto-optimize layout" wide accent>
            ✦ Layout
          </Btn>
        </div>
      )}
      {onAddArea && (
        <div style={{ display: 'flex' }}>
          <Btn
            onClick={onAddArea}
            title="Draw area on canvas"
            wide
            active={addingArea}
          >
            ⬚ Area
          </Btn>
        </div>
      )}
    </div>
  );
}
