import React, { useState, useMemo } from 'react';
import { Asset, AssetCategory, CATEGORY_LABELS, ALL_CATEGORIES } from '../../types';

interface Props {
  assets: Asset[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
}

export function AssetTree({ assets, selectedId, onSelect, search }: Props) {
  const [collapsed, setCollapsed] = useState<Set<AssetCategory>>(
    new Set(ALL_CATEGORIES)
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return assets;
    const q = search.toLowerCase();
    return assets.filter(a =>
      a.vendor.toLowerCase().includes(q) ||
      a.model.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q)
    );
  }, [assets, search]);

  const byCategory = useMemo(() => {
    const map = new Map<AssetCategory, Asset[]>();
    for (const cat of ALL_CATEGORIES) map.set(cat, []);
    for (const a of filtered) {
      const list = map.get(a.category);
      if (list) list.push(a);
    }
    return map;
  }, [filtered]);

  const toggle = (cat: AssetCategory) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  // Auto-expand categories that have search hits
  const effectiveCollapsed = useMemo(() => {
    if (!search.trim()) return collapsed;
    const set = new Set(collapsed);
    Array.from(byCategory.entries()).forEach(([cat, items]) => {
      if (items.length > 0) set.delete(cat);
    });
    return set;
  }, [search, collapsed, byCategory]);

  return (
    <div className="h-full overflow-y-auto select-none">
      {ALL_CATEGORIES.map(cat => {
        const items = byCategory.get(cat) ?? [];
        if (items.length === 0 && search.trim()) return null;
        const open = !effectiveCollapsed.has(cat);
        return (
          <div key={cat}>
            <button
              onClick={() => toggle(cat)}
              className="w-full flex items-center gap-1 px-3 py-1.5 hover:bg-gray-100 text-left"
            >
              <span className="text-xs text-gray-400 w-3">{open ? '▾' : '▸'}</span>
              <span className="font-bold text-sm text-gray-800">{CATEGORY_LABELS[cat]}</span>
              <span className="ml-auto text-xs text-gray-400">{items.length}</span>
            </button>
            {open && items.map(asset => (
              <button
                key={asset.id}
                onClick={() => onSelect(asset.id)}
                className={`w-full text-left px-6 py-1 text-sm truncate hover:bg-blue-50 ${
                  selectedId === asset.id
                    ? 'bg-blue-100 text-blue-800 font-medium'
                    : 'text-gray-700'
                }`}
              >
                #{asset.dbNumber} {asset.vendor} {asset.model}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
