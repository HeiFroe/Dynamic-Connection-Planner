import React from 'react';
import { Asset, AssetCategory, CATEGORY_LABELS } from '../../types';
import { useDraggable } from '@dnd-kit/core';

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
    >
      <div
        className="rounded w-8 h-5 flex-shrink-0 border border-gray-300"
        style={{ background: asset.color }}
      />
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
  const groups = assets.reduce<Record<string, Asset[]>>((acc, a) => {
    if (!acc[a.category]) acc[a.category] = [];
    acc[a.category].push(a);
    return acc;
  }, {});

  // Known ordered categories first, then any unknown categories (e.g. not-yet-migrated), excluding cable
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
        {assets.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-8">
            No assets available.<br />Create some in Asset Manager first.
          </p>
        )}
      </div>
    </div>
  );
}
