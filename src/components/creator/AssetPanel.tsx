import React, { useState } from 'react';
import { Asset, AssetCategory, CATEGORY_LABELS } from '../../types';
import { useDraggable } from '@dnd-kit/core';
import { searchAssets } from '../../utils/assetSearch';

const CATEGORY_ORDER: AssetCategory[] = [
  'collaboration-system',
  'collab-extension',
  'controller',
  'display',
  'pc',
  'device-content',
  'other-devices',
  'mount',
  'infrastructure',
  // 'cable' intentionally excluded — cables are chosen via the cable picker, not dragged
];

function DraggableAsset({ asset }: { asset: Asset }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `panel-${asset.id}`,
    data: { assetId: asset.id },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 p-2 rounded-lg border cursor-grab hover:bg-blue-50 hover:border-blue-300 transition-colors select-none ${isDragging ? 'opacity-50 border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'}`}
      data-testid={`panel-asset-${asset.id}`}
    >
      {asset.frontImage
        ? <img src={asset.frontImage} alt={asset.name} className="rounded w-8 h-5 flex-shrink-0 border border-gray-300 object-contain bg-gray-900" />
        : <div className="rounded w-8 h-5 flex-shrink-0 border border-gray-300" style={{ background: asset.color }} />
      }
      <div className="min-w-0">
        <div className="text-xs font-semibold text-gray-800 truncate">{asset.name}</div>
        <div className="text-xs text-gray-400 truncate">{asset.manufacturer}</div>
      </div>
    </div>
  );
}

interface Props {
  assets: Asset[];
}

export function AssetPanel({ assets }: Props) {
  const [query, setQuery] = useState('');

  const visibleAssets = query.trim() ? searchAssets(assets, query) : assets;

  const groups = visibleAssets.reduce<Record<string, Asset[]>>((acc, a) => {
    if (a.category === 'cable') return acc;
    if (!acc[a.category]) acc[a.category] = [];
    acc[a.category].push(a);
    return acc;
  }, {});

  const knownOrdered = CATEGORY_ORDER.filter(cat => groups[cat]?.length > 0);
  const unknownCats = Object.keys(groups).filter(
    cat => cat !== 'cable' && !CATEGORY_ORDER.includes(cat as AssetCategory) && groups[cat]?.length > 0
  );
  const orderedCategories = [...knownOrdered, ...unknownCats];

  return (
    <div className="w-56 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col">
      <div className="p-3 border-b border-gray-200">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Assets</h3>
        <p className="text-xs text-gray-400 mt-0.5">Drag onto the canvas</p>
      </div>

      {/* Search field */}
      <div className="px-2 py-2 border-b border-gray-200">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search assets..."
            className="w-full text-xs rounded-md border border-gray-200 bg-white px-2 py-1.5 pr-6 text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 leading-none"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {orderedCategories.map(category => (
          <div key={category}>
            <div className="text-xs font-semibold text-gray-400 px-1 pb-1 uppercase tracking-wide">
              {CATEGORY_LABELS[category as AssetCategory] ?? category}
            </div>
            <div className="space-y-1">
              {groups[category].map(asset => (
                <DraggableAsset key={asset.id} asset={asset} />
              ))}
            </div>
          </div>
        ))}
        {orderedCategories.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-8">
            {query ? `No results for "${query}"` : 'No assets available.\nCreate some in Asset Manager first.'}
          </p>
        )}
      </div>
    </div>
  );
}
