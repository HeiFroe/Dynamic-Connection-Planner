import React, { useEffect, useRef } from 'react';
import { Plan, Area } from '../../types';
import { CANVAS_W, CANVAS_H } from './BuilderCanvas';

interface Props {
  plan: Plan;
  onUpdate: (plan: Plan) => void;
  onClose: () => void;
}

const AREA_COLORS = ['#ffffff', '#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#A855F7'];

export function AreaConfigPanel({ plan, onUpdate, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const addArea = () => {
    const color = AREA_COLORS[plan.areas.length % AREA_COLORS.length];
    const area: Area = {
      id: crypto.randomUUID(),
      name: 'New Area',
      x: Math.round(CANVAS_W / 2 - 200),
      y: Math.round(CANVAS_H / 2 - 100),
      width: 400,
      height: 200,
      color,
    };
    onUpdate({ ...plan, areas: [...plan.areas, area] });
  };

  const updateArea = (id: string, patch: Partial<Area>) => {
    onUpdate({ ...plan, areas: plan.areas.map(a => a.id === id ? { ...a, ...patch } : a) });
  };

  const deleteArea = (id: string) => {
    onUpdate({ ...plan, areas: plan.areas.filter(a => a.id !== id) });
  };

  const parseNum = (v: string, fallback: number) => {
    const n = parseInt(v, 10);
    return isNaN(n) || n < 1 ? fallback : n;
  };

  return (
    <div
      ref={ref}
      className="absolute bottom-10 left-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-80"
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-semibold text-gray-700">Canvas Areas</span>
        <button onClick={addArea} className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700">
          + Add
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {plan.areas.length === 0 ? (
          <div className="text-gray-400 text-xs px-3 py-4 text-center">No areas yet — add one to group assets</div>
        ) : plan.areas.map(area => (
          <div key={area.id} className="px-3 py-2 border-b last:border-b-0 space-y-1.5">
            {/* Row 1: color + name + delete */}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={area.color ?? '#6366F1'}
                onChange={e => updateArea(area.id, { color: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border-0 p-0 flex-shrink-0"
                title="Area color"
              />
              <input
                value={area.name}
                onChange={e => updateArea(area.id, { name: e.target.value })}
                className="flex-1 text-sm border rounded px-2 py-0.5 focus:ring-1 ring-blue-400 outline-none"
                placeholder="Area name"
              />
              <button
                onClick={() => deleteArea(area.id)}
                className="text-red-400 hover:text-red-600 text-sm flex-shrink-0 w-5 text-center"
                title="Delete area"
              >✕</button>
            </div>
            {/* Row 2: W / H / X / Y inputs */}
            <div className="grid grid-cols-4 gap-1">
              {[
                { label: 'W', key: 'width' as const, val: area.width },
                { label: 'H', key: 'height' as const, val: area.height },
                { label: 'X', key: 'x' as const, val: area.x },
                { label: 'Y', key: 'y' as const, val: area.y },
              ].map(({ label, key, val }) => (
                <div key={key} className="flex flex-col">
                  <span className="text-xs text-gray-400 text-center leading-none mb-0.5">{label}</span>
                  <input
                    type="number"
                    value={val}
                    min={key === 'width' ? 80 : key === 'height' ? 60 : 0}
                    onChange={e => updateArea(area.id, { [key]: parseNum(e.target.value, val) })}
                    className="text-xs border rounded px-1 py-0.5 text-center focus:ring-1 ring-blue-400 outline-none w-full"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 border-t text-xs text-gray-400">
        Drag areas on canvas to move · Drag ◼ handle to resize
      </div>
    </div>
  );
}
