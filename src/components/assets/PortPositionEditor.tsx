import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Asset, PortDef, LAYER_META, PORT_TYPE_LABELS } from '../../types';

interface Props {
  asset: Asset;
  onChange: (asset: Asset) => void;
  onClose: () => void;
}

const SNAP_THRESHOLD = 0.015; // 1.5% of container — alignment snap distance
const EQUAL_SPACING_THRESHOLD = 0.02; // 2% — close-enough for equal-spacing guide

interface Guide {
  type: 'h' | 'v' | 'spacing-h' | 'spacing-v';
  value: number;      // 0-1 position in container
  label?: string;
}

function computeGuides(ports: PortDef[], draggingId: string, dragPos: { x: number; y: number }): Guide[] {
  const guides: Guide[] = [];
  const others = ports.filter(p => p.id !== draggingId && p.position);

  // Alignment guides: same x or same y as another dot
  for (const p of others) {
    if (Math.abs(p.position!.x - dragPos.x) <= SNAP_THRESHOLD) {
      guides.push({ type: 'v', value: p.position!.x });
    }
    if (Math.abs(p.position!.y - dragPos.y) <= SNAP_THRESHOLD) {
      guides.push({ type: 'h', value: p.position!.y });
    }
  }

  // Equal spacing guides — check if dragged dot is equidistant between two others
  for (let i = 0; i < others.length; i++) {
    for (let j = i + 1; j < others.length; j++) {
      const a = others[i].position!;
      const b = others[j].position!;
      // Horizontal spacing: a.x + spacing = drag.x, drag.x + spacing = b.x
      const midX = (a.x + b.x) / 2;
      if (Math.abs(dragPos.x - midX) <= SNAP_THRESHOLD && Math.abs(a.y - b.y) <= SNAP_THRESHOLD) {
        guides.push({ type: 'spacing-h', value: a.y, label: `Δ${Math.round(Math.abs(b.x - a.x) / 2 * 100)}%` });
      }
      // Vertical spacing
      const midY = (a.y + b.y) / 2;
      if (Math.abs(dragPos.y - midY) <= SNAP_THRESHOLD && Math.abs(a.x - b.x) <= SNAP_THRESHOLD) {
        guides.push({ type: 'spacing-v', value: a.x, label: `Δ${Math.round(Math.abs(b.y - a.y) / 2 * 100)}%` });
      }
    }
  }

  return guides;
}

export function PortPositionEditor({ asset, onChange, onClose }: Props) {
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
  const [draggingPortId, setDraggingPortId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  // Track drag-from-list: portId being dragged from the list (HTML drag)
  const listDragPortId = useRef<string | null>(null);

  const updatePort = useCallback((portId: string, patch: Partial<PortDef>) => {
    const ports = asset.ports.map(p => p.id === portId ? { ...p, ...patch } : p);
    onChange({ ...asset, ports, updatedAt: new Date().toISOString() });
  }, [asset, onChange]);

  const getContainerRect = () => containerRef.current?.getBoundingClientRect() ?? null;

  const toRelative = (clientX: number, clientY: number) => {
    const rect = getContainerRect();
    if (!rect) return { x: 0.5, y: 0.5 };
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  };

  // Document-level mouse handlers for dot dragging on picture
  useEffect(() => {
    if (!draggingPortId) return;

    const onMove = (e: MouseEvent) => {
      const pos = toRelative(e.clientX, e.clientY);
      setDragPos(pos);
      const newGuides = computeGuides(asset.ports, draggingPortId, pos);
      setGuides(newGuides);
      updatePort(draggingPortId, { position: pos });
    };

    const onUp = () => {
      setDraggingPortId(null);
      setDragPos(null);
      setGuides([]);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingPortId, asset.ports]);

  const handleSet = () => {
    if (!selectedPortId) return;
    const port = asset.ports.find(p => p.id === selectedPortId);
    if (port && !port.position) {
      updatePort(selectedPortId, { position: { x: 0.5, y: 0.5 } });
    }
  };

  const handleDel = () => {
    if (!selectedPortId) return;
    updatePort(selectedPortId, { position: undefined });
  };

  const handleDoubleClick = (portId: string) => {
    const port = asset.ports.find(p => p.id === portId);
    if (!port) return;
    if (!port.position) updatePort(portId, { position: { x: 0.5, y: 0.5 } });
    setSelectedPortId(portId);
  };

  // ── Drag from list (HTML drag) onto picture ────────────────────────────────
  const handleListDragStart = (e: React.DragEvent, portId: string) => {
    listDragPortId.current = portId;
    e.dataTransfer.effectAllowed = 'copy';
    setSelectedPortId(portId);
  };

  const handlePictureDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handlePictureDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const portId = listDragPortId.current;
    if (!portId) return;
    const pos = toRelative(e.clientX, e.clientY);
    updatePort(portId, { position: pos });
    setSelectedPortId(portId);
    listDragPortId.current = null;
  };

  const selectedPort = asset.ports.find(p => p.id === selectedPortId) ?? null;

  // Aspect ratio for the picture container
  const ar = asset.imageAspectRatio ?? (16 / 9);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50 flex-shrink-0">
        <span className="text-sm font-semibold text-gray-700">
          Configure Connection Positions — #{asset.dbNumber} {asset.vendor} {asset.model}
        </span>
        <button
          onClick={onClose}
          className="text-sm bg-pink-200 hover:bg-pink-300 text-pink-900 px-3 py-1 rounded font-medium"
        >
          Close
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Connection Selector */}
        <div className="w-52 flex-shrink-0 border-r bg-white flex flex-col">
          <div className="px-3 py-2 border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Connections
          </div>
          <div className="flex-1 overflow-y-auto divide-y">
            {asset.ports.length === 0 ? (
              <div className="text-gray-400 text-xs px-3 py-4 text-center">No connections defined</div>
            ) : asset.ports.map(p => (
              <div
                key={p.id}
                draggable
                onDragStart={e => handleListDragStart(e, p.id)}
                onClick={() => setSelectedPortId(p.id === selectedPortId ? null : p.id)}
                onDoubleClick={() => handleDoubleClick(p.id)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 cursor-grab active:cursor-grabbing select-none hover:bg-gray-50 ${
                  selectedPortId === p.id ? 'bg-blue-50' : ''
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: LAYER_META[p.layer].color }}
                />
                <span className="text-xs text-gray-800 truncate flex-1">
                  {p.name || <em className="text-gray-400">unnamed</em>}
                </span>
                {p.position ? (
                  <span className="text-xs text-green-600 flex-shrink-0">✓</span>
                ) : (
                  <span className="text-xs text-gray-300 flex-shrink-0" title="Drag to picture to place">⊕</span>
                )}
              </div>
            ))}
          </div>
          {/* SET / DEL buttons */}
          <div className="flex gap-1 p-2 border-t">
            <button
              onClick={handleSet}
              disabled={!selectedPortId || !!selectedPort?.position}
              className="flex-1 text-xs bg-pink-200 hover:bg-pink-300 text-pink-900 px-2 py-1 rounded disabled:opacity-40"
            >
              SET
            </button>
            <button
              onClick={handleDel}
              disabled={!selectedPortId || !selectedPort?.position}
              className="flex-1 text-xs bg-pink-200 hover:bg-pink-300 text-pink-900 px-2 py-1 rounded disabled:opacity-40"
            >
              DEL
            </button>
          </div>
          <div className="px-3 pb-2 text-xs text-gray-400 leading-tight">
            Drag connector to picture · Double-click to place at center
          </div>
        </div>

        {/* Right: Picture View */}
        <div className="flex-1 overflow-hidden bg-gray-200 flex items-center justify-center p-6" style={{ minHeight: 0 }}>
          <div
            ref={containerRef}
            className="relative select-none"
            style={{
              // Fill available space while respecting aspect ratio
              // height drives the layout; width is derived from ar
              maxWidth: '100%',
              maxHeight: '100%',
              width: `min(100%, calc(100vh * ${ar}))`,
              aspectRatio: String(ar),
              // Checkerboard to show PNG transparency
              backgroundImage: asset.frontImage
                ? 'linear-gradient(45deg,#bbb 25%,transparent 25%),linear-gradient(-45deg,#bbb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#bbb 75%),linear-gradient(-45deg,transparent 75%,#bbb 75%)'
                : undefined,
              backgroundSize: '12px 12px',
              backgroundPosition: '0 0,0 6px,6px -6px,-6px 0',
              backgroundColor: '#e5e7eb',
              border: '2px solid #6b7280',
            }}
            onDragOver={handlePictureDragOver}
            onDrop={handlePictureDrop}
            onClick={e => {
              if (e.target === containerRef.current) setSelectedPortId(null);
            }}
          >
            {/* Image */}
            {asset.frontImage ? (
              <img
                src={asset.frontImage}
                alt="asset"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-gray-500 text-sm">
                  <div className="text-3xl mb-1">📷</div>
                  <div className="font-medium">{asset.vendor || 'Vendor'}</div>
                  <div>{asset.model || 'Model'}</div>
                  <div className="text-xs mt-1 text-gray-400">Drop connectors here</div>
                </div>
              </div>
            )}

            {/* Smart Guides (SVG overlay) */}
            {guides.length > 0 && (
              <svg
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
              >
                {guides.map((g, i) => {
                  if (g.type === 'h') {
                    return (
                      <line key={i}
                        x1="0%" y1={`${g.value * 100}%`} x2="100%" y2={`${g.value * 100}%`}
                        stroke="#FF2D87" strokeWidth={1} strokeDasharray="6 4" opacity={0.85}
                      />
                    );
                  }
                  if (g.type === 'v') {
                    return (
                      <line key={i}
                        x1={`${g.value * 100}%`} y1="0%" x2={`${g.value * 100}%`} y2="100%"
                        stroke="#FF2D87" strokeWidth={1} strokeDasharray="6 4" opacity={0.85}
                      />
                    );
                  }
                  if (g.type === 'spacing-h') {
                    // Horizontal dashed line at y=g.value indicating equal horizontal spacing
                    return (
                      <g key={i}>
                        <line
                          x1="0%" y1={`${g.value * 100}%`} x2="100%" y2={`${g.value * 100}%`}
                          stroke="#22C55E" strokeWidth={1} strokeDasharray="4 6" opacity={0.85}
                        />
                        {g.label && (
                          <text x="2%" y={`${g.value * 100 - 2}%`} fill="#22C55E" fontSize={9} opacity={0.9}>{g.label}</text>
                        )}
                      </g>
                    );
                  }
                  if (g.type === 'spacing-v') {
                    return (
                      <g key={i}>
                        <line
                          x1={`${g.value * 100}%`} y1="0%" x2={`${g.value * 100}%`} y2="100%"
                          stroke="#22C55E" strokeWidth={1} strokeDasharray="4 6" opacity={0.85}
                        />
                        {g.label && (
                          <text x={`${g.value * 100 + 1}%`} y="5%" fill="#22C55E" fontSize={9} opacity={0.9}>{g.label}</text>
                        )}
                      </g>
                    );
                  }
                  return null;
                })}
              </svg>
            )}

            {/* Port dots */}
            {asset.ports.filter(p => p.position).map(p => {
              const color = LAYER_META[p.layer].color;
              const isSelected = p.id === selectedPortId;
              const isDragging = p.id === draggingPortId;
              return (
                <div
                  key={p.id}
                  title={`${p.name} — ${PORT_TYPE_LABELS[p.standard]}`}
                  onMouseDown={e => {
                    e.stopPropagation();
                    setSelectedPortId(p.id);
                    setDraggingPortId(p.id);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${p.position!.x * 100}%`,
                    top: `${p.position!.y * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    width: isSelected ? 18 : 14,
                    height: isSelected ? 18 : 14,
                    borderRadius: '50%',
                    background: color,
                    border: isSelected ? '2px solid white' : '2px solid rgba(255,255,255,0.5)',
                    boxShadow: isSelected
                      ? `0 0 0 2px ${color}, 0 2px 6px rgba(0,0,0,0.5)`
                      : '0 1px 4px rgba(0,0,0,0.5)',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    zIndex: isSelected ? 20 : 10,
                    transition: isDragging ? 'none' : 'width 0.1s, height 0.1s',
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
