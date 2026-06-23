import React, { useEffect, useRef } from 'react';
import { Plan, ALL_LAYERS, LAYER_META } from '../../types';

interface Props {
  plan: Plan;
  onUpdate: (plan: Plan) => void;
  onClose: () => void;
}

export function LayerSelectorPanel({ plan, onUpdate, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const toggleLayer = (layer: typeof ALL_LAYERS[number]) => {
    onUpdate({ ...plan, layerVisibility: { ...plan.layerVisibility, [layer]: !plan.layerVisibility[layer] } });
  };

  const togglePortLabel = (layer: typeof ALL_LAYERS[number]) => {
    onUpdate({ ...plan, portLabelVisibility: { ...plan.portLabelVisibility, [layer]: plan.portLabelVisibility?.[layer] !== true } });
  };

  const toggleCableLabel = (layer: typeof ALL_LAYERS[number]) => {
    onUpdate({ ...plan, cableLabelVisibility: { ...plan.cableLabelVisibility, [layer]: plan.cableLabelVisibility?.[layer] !== true } });
  };

  return (
    <div
      ref={ref}
      className="absolute bottom-10 left-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-80 py-2"
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="px-3 py-1.5 border-b mb-1">
        <div className="grid grid-cols-12 text-xs text-gray-400 font-medium">
          <span className="col-span-5">Layer</span>
          <span className="col-span-2 text-center">Visible</span>
          <span className="col-span-2 text-center">Ports</span>
          <span className="col-span-3 text-center">Cable Labels</span>
        </div>
      </div>
      {ALL_LAYERS.map(layer => {
        const meta     = LAYER_META[layer];
        const layerOn  = plan.layerVisibility[layer] !== false;
        const portsOn  = plan.portLabelVisibility?.[layer] !== false;
        const cablesOn = plan.cableLabelVisibility?.[layer] !== false;
        const isHardware = layer === 'hardware';

        return (
          <div key={layer} className={`grid grid-cols-12 items-center px-3 py-1.5 hover:bg-gray-50 ${isHardware ? 'bg-slate-50' : ''}`}>
            <div className="col-span-5 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: meta.color }} />
              <span className="text-sm text-gray-700">{meta.label}</span>
            </div>
            <div className="col-span-2 flex justify-center">
              <button
                onClick={() => toggleLayer(layer)}
                className={`text-base leading-none transition-opacity ${layerOn ? 'opacity-100' : 'opacity-30'}`}
                title={isHardware ? 'Show/hide asset image' : 'Show/hide layer'}
              >👁</button>
            </div>
            <div className="col-span-2 flex justify-center">
              <button
                onClick={() => togglePortLabel(layer)}
                className={`text-xs px-1.5 py-0.5 rounded font-medium transition-opacity ${portsOn ? 'opacity-100' : 'opacity-30'}`}
                style={{ background: meta.color + '33', color: meta.color, border: `1px solid ${meta.color}` }}
                title={isHardware ? 'Show/hide asset name' : 'Show/hide connector labels'}
              >{isHardware ? 'A' : '●'}</button>
            </div>
            <div className="col-span-3 flex justify-center">
              {!isHardware && (
                <button
                  onClick={() => toggleCableLabel(layer)}
                  className={`text-xs px-1.5 py-0.5 rounded font-medium transition-opacity ${cablesOn ? 'opacity-100' : 'opacity-30'}`}
                  style={{ background: meta.color + '33', color: meta.color, border: `1px solid ${meta.color}` }}
                  title="Show/hide cable labels"
                >—</button>
              )}
            </div>
          </div>
        );
      })}
      <div className="px-3 pt-2 pb-1 border-t text-xs text-gray-400">
        Hardware 👁 = Asset image · Hardware A = Asset name
      </div>
    </div>
  );
}
