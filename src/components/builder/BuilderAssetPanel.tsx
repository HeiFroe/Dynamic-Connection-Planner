import React, { useState } from 'react';
import { Asset, AssetCategory, CATEGORY_LABELS } from '../../types';

interface Props {
  assets: Asset[];
  search: string;
  selectedAssetId: string | null;
  onSelect: (id: string) => void;
  onDragStart: (assetId: string, e: React.DragEvent) => void;
}

export function BuilderAssetPanel({ assets, search, selectedAssetId, onSelect, onDragStart }: Props) {
  const [category, setCategory] = useState<AssetCategory | 'all'>('all');

  // Cable assets are not shown in the builder panel
  const filterable = assets.filter(a => a.category !== 'cable');

  const visible = filterable.filter(a => {
    if (category !== 'all' && a.category !== category) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (a.vendor ?? '').toLowerCase().includes(q) || (a.model ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  const usedCategories = Array.from(new Set(filterable.map(a => a.category)));

  return (
    <div className="flex flex-col h-full border-r bg-white">
      {/* Category selector */}
      <div className="px-2 pt-2 pb-1 flex-shrink-0">
        <select
          value={category}
          onChange={e => setCategory(e.target.value as AssetCategory | 'all')}
          className="w-full border rounded px-2 py-1 text-xs bg-amber-50 focus:ring-1 ring-amber-400 outline-none"
        >
          <option value="all">All Categories</option>
          {usedCategories.map(c => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>

      {/* Asset list */}
      <div className="flex-1 overflow-y-auto px-1 space-y-1 pb-2">
        {visible.length === 0 ? (
          <div className="text-gray-400 text-xs text-center py-4">No assets</div>
        ) : visible.map(asset => (
          <div
            key={asset.id}
            draggable
            onClick={() => onSelect(asset.id)}
            onDragStart={e => onDragStart(asset.id, e)}
            className={`flex items-center gap-2 px-2 py-1.5 rounded border cursor-grab active:cursor-grabbing select-none ${
              selectedAssetId === asset.id
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300'
            }`}
          >
            {asset.frontImage ? (
              <img src={asset.frontImage} alt="" className="w-8 h-8 object-contain flex-shrink-0 rounded" />
            ) : (
              <div className="w-8 h-8 flex-shrink-0 rounded bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold">
                {(asset.vendor?.[0] ?? asset.model?.[0] ?? '?').toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs font-medium text-gray-800 truncate">{asset.model}</div>
              <div className="text-xs text-gray-400 truncate">{asset.vendor}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
