import React, { useState, useEffect } from 'react';
import { Asset } from '../../types';
import { AssetTree } from './AssetTree';
import { AssetEditor } from './AssetEditor';
import { PortPositionEditor } from './PortPositionEditor';

interface Props {
  assets: Asset[];
  onSave: (asset: Asset) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onImport: (json: string) => void;
  onNew: () => Asset;
  initialEditId?: string | null;
}

export function AssetModule({ assets, onSave, onDelete, onExport, onImport, onNew, initialEditId }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(initialEditId ?? null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Asset | null>(null);
  const [configMode, setConfigMode] = useState(false);
  useEffect(() => {
    if (initialEditId) {
      setSelectedId(initialEditId);
      setDraft(null);
      setConfigMode(false);
    }
  }, [initialEditId]);

  const selectedAsset = assets.find(a => a.id === selectedId) ?? null;
  // When user clicks an asset, show live version; when editing, use draft
  const editing = draft ?? selectedAsset;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setDraft(null);
    setConfigMode(false);
  };

  const handleChange = (asset: Asset) => {
    setDraft(asset);
    onSave(asset); // autosave
  };

  const handleNew = () => {
    const asset = onNew();
    onSave(asset);
    setSelectedId(asset.id);
    setDraft(null);
  };

  const handleDelete = () => {
    if (!selectedId) return;
    if (!window.confirm('Delete this asset?')) return;
    onDelete(selectedId);
    setSelectedId(null);
    setDraft(null);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onImport(ev.target?.result as string);
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="h-full flex flex-col">
      {/* Module TOP bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-gray-50 flex-shrink-0">
        <button onClick={handleNew} className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
          + New Asset
        </button>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search assets…"
          className="flex-1 max-w-xs border rounded px-3 py-1 text-sm focus:ring-1 ring-blue-400 outline-none"
        />
        <div className="flex-1" />
        {selectedId && (
          <button onClick={handleDelete} className="text-sm text-red-600 hover:text-red-800 px-2 py-1">
            Delete
          </button>
        )}
        <button onClick={onExport} className="text-sm bg-pink-100 hover:bg-pink-200 text-pink-900 px-3 py-1 rounded">
          Export
        </button>
        <label className="text-sm bg-pink-100 hover:bg-pink-200 text-pink-900 px-3 py-1 rounded cursor-pointer" style={{ position: 'relative' }}>
          Import
          <input type="file" accept=".json" onChange={handleImport} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
        </label>
      </div>

      {/* Body: tree + detail */}
      <div className="flex flex-1 min-h-0">
        {/* Tree */}
        <div className="w-56 flex-shrink-0 border-r bg-white overflow-hidden">
          <AssetTree
            assets={assets}
            selectedId={selectedId}
            onSelect={handleSelect}
            search={search}
          />
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-y-auto bg-white">
          {editing && configMode ? (
            <PortPositionEditor
              asset={editing}
              onChange={handleChange}
              onClose={() => setConfigMode(false)}
            />
          ) : editing ? (
            <AssetEditor
              asset={editing}
              allAssets={assets}
              onChange={handleChange}
              onOpenConfig={() => setConfigMode(true)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Select an asset or create a new one
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
