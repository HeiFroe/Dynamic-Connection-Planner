import React, { useEffect } from 'react';

interface Item {
  label: string;
  action: () => void;
  danger?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: Item[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        background: '#1f2937',
        border: '1px solid #374151',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        zIndex: 1000,
        minWidth: 160,
        padding: '4px 0',
      }}
      onClick={e => e.stopPropagation()}
      onContextMenu={e => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.action(); onClose(); }}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '8px 14px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            color: item.danger ? '#f87171' : '#e5e7eb',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = item.danger ? 'rgba(239,68,68,0.12)' : '#374151';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'none';
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
