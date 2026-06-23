import React, { useState } from 'react';
import { Asset, Plan } from '../../types';
import { BuilderAssetPanel } from './BuilderAssetPanel';
import { BuilderCanvas, ViewBox, CANVAS_W, CANVAS_H } from './BuilderCanvas';
import { LayerSelectorPanel } from './LayerSelectorPanel';
import { AreaConfigPanel } from './AreaConfigPanel';
import { ViewOptionsPanel } from './ViewOptionsPanel';
import { applyGridLayout } from '../../utils/autoLayout';

interface Props {
  plan: Plan;
  assets: Asset[];
  onUpdate: (plan: Plan) => void;
  onUpdateAsset?: (assetId: string, patch: Partial<Asset>) => void;
  onExport: () => void;
  onEditAsset: (assetId: string) => void;
}

export function BuilderModule({ plan, assets, onUpdate, onUpdateAsset, onExport, onEditAsset }: Props) {
  const [search, setSearch]                             = useState('');
  const [selectedPanelAssetId, setSelectedPanelAssetId] = useState<string | null>(null);
  const [viewBox, setViewBox]                           = useState<ViewBox>({ x: 0, y: 0, w: CANVAS_W / 2, h: CANVAS_H / 2 });
  const [showLayerSelector, setShowLayerSelector]       = useState(false);
  const [showAreaConfig, setShowAreaConfig]             = useState(false);
  const [showViewOptions, setShowViewOptions]           = useState(false);

  const handleDragStart = (assetId: string, e: React.DragEvent) => {
    e.dataTransfer.setData('assetId', assetId);
  };

  return (
    <div className="h-full flex flex-col" style={{ position: 'relative' }}>
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-gray-50 flex-shrink-0">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets…"
          className="max-w-xs border rounded px-3 py-1 text-sm focus:ring-1 ring-blue-400 outline-none" />
        <button onClick={() => selectedPanelAssetId && onEditAsset(selectedPanelAssetId)} disabled={!selectedPanelAssetId}
          className="text-sm px-3 py-1 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-white border-gray-300 hover:bg-gray-100 text-gray-700">
          Edit
        </button>
        <div className="flex-1" />
        <button onClick={onExport} className="text-sm bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-4 py-1 rounded">
          Export HTML
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-48 flex-shrink-0">
          <BuilderAssetPanel assets={assets} search={search} selectedAssetId={selectedPanelAssetId}
            onSelect={setSelectedPanelAssetId} onDragStart={handleDragStart} />
        </div>
        <div className="flex-1 overflow-hidden">
          <BuilderCanvas plan={plan} assets={assets} onUpdate={onUpdate} onUpdateAsset={onUpdateAsset}
            viewBox={viewBox} onViewBoxChange={setViewBox} onEditAsset={onEditAsset} />
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 py-1.5 border-t bg-gray-50 flex-shrink-0" style={{ position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <button onClick={() => { setShowAreaConfig(v => !v); setShowLayerSelector(false); setShowViewOptions(false); }}
            className={`text-xs px-3 py-1 rounded border transition-colors ${showAreaConfig?'bg-blue-100 border-blue-300 text-blue-800':'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'}`}>
            Config Canvas
          </button>
          {showAreaConfig && <AreaConfigPanel plan={plan} onUpdate={onUpdate} onClose={() => setShowAreaConfig(false)} />}
        </div>

        <div style={{ position: 'relative' }}>
          <button onClick={() => { setShowLayerSelector(v => !v); setShowAreaConfig(false); setShowViewOptions(false); }}
            className={`text-xs px-3 py-1 rounded border transition-colors ${showLayerSelector?'bg-blue-100 border-blue-300 text-blue-800':'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'}`}>
            Layers
          </button>
          {showLayerSelector && <LayerSelectorPanel plan={plan} onUpdate={onUpdate} onClose={() => setShowLayerSelector(false)} />}
        </div>

        <div style={{ position: 'relative' }}>
          <button onClick={() => { setShowViewOptions(v => !v); setShowAreaConfig(false); setShowLayerSelector(false); }}
            className={`text-xs px-3 py-1 rounded border transition-colors ${showViewOptions?'bg-blue-100 border-blue-300 text-blue-800':'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'}`}>
            View
          </button>
          {showViewOptions && <ViewOptionsPanel viewBox={viewBox} onViewBoxChange={setViewBox} instances={plan.instances} onClose={() => setShowViewOptions(false)} />}
        </div>

        <button onClick={() => onUpdate(applyGridLayout(plan))}
          className="text-xs px-3 py-1 rounded border bg-white border-gray-300 text-gray-700 hover:bg-gray-100">
          Auto Layout
        </button>

        <div className="flex-1" />
        <span className="text-xs text-gray-400">{plan.instances.length} assets · {plan.connections.length} connections · {plan.areas.length} areas</span>
      </div>
    </div>
  );
}
