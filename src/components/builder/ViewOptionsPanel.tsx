import React, { useEffect, useRef } from 'react';
import { PlacedAsset } from '../../types';
import { ViewBox, CANVAS_W, CANVAS_H } from './BuilderCanvas';

interface Props {
  viewBox: ViewBox;
  onViewBoxChange: (vb: ViewBox) => void;
  instances: PlacedAsset[];
  onClose: () => void;
}

export function ViewOptionsPanel({ viewBox, onViewBoxChange, instances, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const zoom = (factor: number) => {
    const cx = viewBox.x + viewBox.w / 2;
    const cy = viewBox.y + viewBox.h / 2;
    const nw = Math.max(400, Math.min(CANVAS_W, viewBox.w * factor));
    const nh = Math.max(300, Math.min(CANVAS_H, viewBox.h * factor));
    onViewBoxChange({ x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh });
  };

  const pan = (dx: number, dy: number) => {
    onViewBoxChange({ ...viewBox, x: viewBox.x + dx, y: viewBox.y + dy });
  };

  const fitToCanvas = () => {
    if (instances.length === 0) {
      onViewBoxChange({ x: 0, y: 0, w: CANVAS_W / 2, h: CANVAS_H / 2 });
      return;
    }
    const minX = Math.min(...instances.map(i => i.x)) - 100;
    const minY = Math.min(...instances.map(i => i.y)) - 100;
    const maxX = Math.max(...instances.map(i => i.x + i.width)) + 100;
    const maxY = Math.max(...instances.map(i => i.y + i.height)) + 100;
    onViewBoxChange({ x: minX, y: minY, w: maxX - minX, h: maxY - minY });
  };

  const step = viewBox.w * 0.2;

  return (
    <div
      ref={ref}
      className="absolute bottom-10 right-24 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-3 w-40"
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Zoom */}
      <div className="text-xs text-gray-500 font-semibold mb-1.5">Zoom</div>
      <div className="flex gap-1 mb-3">
        <button onClick={() => zoom(0.8)} className="flex-1 bg-gray-100 hover:bg-gray-200 rounded py-1 text-sm font-bold">+</button>
        <button onClick={() => zoom(1.25)} className="flex-1 bg-gray-100 hover:bg-gray-200 rounded py-1 text-sm font-bold">−</button>
      </div>
      {/* Pan */}
      <div className="text-xs text-gray-500 font-semibold mb-1.5">Pan</div>
      <div className="grid grid-cols-3 gap-1 mb-3">
        <div />
        <button onClick={() => pan(0, -step)} className="bg-gray-100 hover:bg-gray-200 rounded py-1 text-sm">↑</button>
        <div />
        <button onClick={() => pan(-step, 0)} className="bg-gray-100 hover:bg-gray-200 rounded py-1 text-sm">←</button>
        <div />
        <button onClick={() => pan(step, 0)} className="bg-gray-100 hover:bg-gray-200 rounded py-1 text-sm">→</button>
        <div />
        <button onClick={() => pan(0, step)} className="bg-gray-100 hover:bg-gray-200 rounded py-1 text-sm">↓</button>
        <div />
      </div>
      {/* Fit */}
      <button onClick={fitToCanvas} className="w-full bg-blue-100 hover:bg-blue-200 text-blue-800 rounded py-1 text-xs font-medium">
        Fit to Canvas
      </button>
    </div>
  );
}
