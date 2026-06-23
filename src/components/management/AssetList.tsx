import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Asset, AssetCategory, CATEGORY_LABELS } from '../../types';
import { Button, Card, Modal } from '../ui';
import { AssetEditor } from './AssetEditor';
import { ConnectorSymbol } from './ConnectorSymbol';

interface Props {
  assets: Asset[];
  onSave: (asset: Asset) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onImport: (json: string) => void;
  initialEditId?: string | null;
  onClearEditId?: () => void;
}

const CATEGORY_ORDER: AssetCategory[] = [
  'display', 'collaboration-system', 'collab-extension', 'controller', 'pc',
  'device-content', 'other-devices', 'mount', 'cable', 'infrastructure',
];

export function AssetList({
  assets, onSave, onDelete, onExport, onImport, initialEditId, onClearEditId,
}: Props) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Asset | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Asset | null>(null);
  const [collapsed, setCollapsed] = useState<Record<AssetCategory, boolean>>({} as Record<AssetCategory, boolean>);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initialEditId) return;
    const asset = assets.find(a => a.id === initialEditId);
    if (asset) setEditing(asset);
    onClearEditId?.();
  }, [initialEditId]); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = assets.filter(a =>
      `${a.name} ${a.manufacturer} ${a.model}`.toLowerCase().includes(q)
    );
    const map: Partial<Record<AssetCategory, Asset[]>> = {};
    for (const a of filtered) {
      (map[a.category] ??= []).push(a);
    }
    for (const cat in map) {
      map[cat as AssetCategory]!.sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [assets, search]);

  const totalFiltered = Object.values(grouped).reduce((s, arr) => s + (arr?.length ?? 0), 0);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { onImport(ev.target?.result as string); };
    reader.readAsText(file);
    e.target.value = '';
  };

  const toggleCategory = (cat: AssetCategory) =>
    setCollapsed(c => ({ ...c, [cat]: !c[cat] }));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-3 flex-wrap items-center">
        <input
          className="border rounded px-3 py-1.5 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Search assets…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Button size="sm" variant="primary" onClick={() => setEditing('new')}>+ New asset</Button>
        <Button size="sm" variant="secondary" onClick={onExport}>Export (JSON)</Button>
        <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>Import (JSON)</Button>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
      </div>

      <p className="text-sm text-gray-500">{totalFiltered} of {assets.length} assets</p>

      {/* Category sections */}
      <div className="space-y-4">
        {CATEGORY_ORDER.map(cat => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;
          const isCollapsed = collapsed[cat];
          return (
            <section key={cat}>
              <button
                onClick={() => toggleCategory(cat)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2 hover:text-blue-600 transition-colors"
              >
                <span className={`inline-block transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>▶</span>
                <span>{CATEGORY_LABELS[cat]}</span>
                <span className="text-xs font-normal text-gray-400">({items.length})</span>
              </button>
              {!isCollapsed && (
                <div
                  className="grid gap-3"
                  style={{
                    gridTemplateColumns: cat === 'cable'
                      ? 'repeat(auto-fill, minmax(280px, 1fr))'
                      : 'repeat(auto-fill, minmax(220px, 1fr))',
                  }}
                >
                  {items.map(asset => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      onEdit={() => setEditing(asset)}
                      onDelete={() => setConfirmDelete(asset)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
        {/* Catch-all: show assets with unknown/legacy categories that aren't in CATEGORY_ORDER */}
        {Object.entries(grouped)
          .filter(([cat]) => !CATEGORY_ORDER.includes(cat as AssetCategory))
          .map(([cat, items]) => {
            if (!items || items.length === 0) return null;
            const isCollapsed = collapsed[cat as AssetCategory];
            return (
              <section key={cat}>
                <button
                  onClick={() => toggleCategory(cat as AssetCategory)}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2 hover:text-blue-600 transition-colors"
                >
                  <span className={`inline-block transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>▶</span>
                  <span>{CATEGORY_LABELS[cat as AssetCategory] ?? cat}</span>
                  <span className="text-xs font-normal text-gray-400">({items.length})</span>
                </button>
                {!isCollapsed && (
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                    {items.map(asset => (
                      <AssetCard key={asset.id} asset={asset} onEdit={() => setEditing(asset)} onDelete={() => setConfirmDelete(asset)} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        {totalFiltered === 0 && (
          <Card className="px-4 py-8 text-center text-gray-400">
            {search ? 'No assets found.' : 'No assets yet. Click "+ New asset".'}
          </Card>
        )}
      </div>

      {/* Editor Modal */}
      {editing !== null && (
        <Modal
          title={editing === 'new' ? 'Create new asset' : `Edit asset: ${(editing as Asset).name}`}
          onClose={() => setEditing(null)}
        >
          <AssetEditor
            initial={editing === 'new' ? undefined : editing as Asset}
            allAssets={assets}
            onSave={asset => { onSave(asset); setEditing(null); }}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold mb-2">Delete asset?</h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{confirmDelete.name}</strong> will be permanently deleted.
              Plan connections that reference it will remain but lose their asset link.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { onDelete(confirmDelete.id); setConfirmDelete(null); }}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card variants ─────────────────────────────────────────────────────────────

function AssetCard({ asset, onEdit, onDelete }: { asset: Asset; onEdit: () => void; onDelete: () => void }) {
  if (asset.category === 'cable') return <CableCard asset={asset} onEdit={onEdit} onDelete={onDelete} />;
  return <DefaultCard asset={asset} onEdit={onEdit} onDelete={onDelete} />;
}

function DefaultCard({ asset, onEdit, onDelete }: { asset: Asset; onEdit: () => void; onDelete: () => void }) {
  const previewImage = asset.frontImage ?? asset.rearImage;
  return (
    <Card className="p-3 flex flex-col gap-2 hover:shadow-md transition-shadow">
      <div
        className="w-full rounded border bg-gray-50 flex items-center justify-center overflow-hidden"
        style={{ aspectRatio: '4 / 3', minHeight: 100 }}
      >
        {previewImage ? (
          <img
            src={previewImage}
            alt={asset.name}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        ) : (
          <div
            className="rounded"
            style={{ background: asset.color, width: '60%', height: '50%' }}
          />
        )}
      </div>
      <div>
        <div className="font-medium text-sm text-gray-900 truncate" title={asset.name}>{asset.name}</div>
        <div className="text-xs text-gray-500 truncate">{asset.manufacturer} · {asset.model}</div>
      </div>
      <div className="flex flex-wrap gap-1 text-[10px] text-gray-500">
        {(asset.physicalWidth || asset.physicalHeight) && (
          <span className="bg-gray-100 px-1.5 py-0.5 rounded">
            {asset.physicalWidth ?? '?'} × {asset.physicalHeight ?? '?'} cm
          </span>
        )}
        <span className="bg-gray-100 px-1.5 py-0.5 rounded">
          {asset.ports.length} Port{asset.ports.length === 1 ? '' : 's'}
        </span>
        {asset.attachmentPoints.length > 0 && (
          <span className="bg-gray-100 px-1.5 py-0.5 rounded">
            {asset.attachmentPoints.length} attach.
          </span>
        )}
      </div>
      <div className="flex gap-1 mt-auto pt-1">
        <Button size="sm" variant="secondary" className="flex-1" onClick={onEdit}>Edit</Button>
        <Button size="sm" variant="danger" onClick={onDelete}>×</Button>
      </div>
    </Card>
  );
}

function CableCard({ asset, onEdit, onDelete }: { asset: Asset; onEdit: () => void; onDelete: () => void }) {
  const [endA, endB] = asset.ports;
  return (
    <Card className="p-3 flex flex-col gap-2 hover:shadow-md transition-shadow">
      <div
        className="w-full rounded border flex items-center justify-center px-3 py-4 gap-1"
        style={{ background: '#fafafa', minHeight: 100 }}
      >
        {endA && (
          <ConnectorSymbol type={endA.type} size={44} label={endA.type} />
        )}
        <div className="flex-1 flex items-center justify-center px-2">
          <CableLine length={asset.cableLength} color={asset.color} />
        </div>
        {endB && (
          <ConnectorSymbol type={endB.type} size={44} label={endB.type} mirrored />
        )}
      </div>
      <div>
        <div className="font-medium text-sm text-gray-900 truncate" title={asset.name}>{asset.name}</div>
        <div className="text-xs text-gray-500 truncate">{asset.manufacturer} · {asset.model}</div>
      </div>
      <div className="flex flex-wrap gap-1 text-[10px] text-gray-500">
        {asset.cableLength !== undefined && (
          <span className="bg-blue-50 text-blue-700 font-semibold px-1.5 py-0.5 rounded">
            {asset.cableLength} m
          </span>
        )}
      </div>
      <div className="flex gap-1 mt-auto pt-1">
        <Button size="sm" variant="secondary" className="flex-1" onClick={onEdit}>Edit</Button>
        <Button size="sm" variant="danger" onClick={onDelete}>×</Button>
      </div>
    </Card>
  );
}

function CableLine({ length, color }: { length?: number; color: string }) {
  return (
    <div className="relative flex-1 h-6 flex items-center">
      <div
        className="w-full"
        style={{ height: 3, background: color, borderRadius: 2 }}
      />
      {length !== undefined && (
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-1 bg-white border border-gray-300 rounded px-1.5 text-[10px] font-mono font-semibold text-gray-700"
          style={{ lineHeight: '14px' }}
        >
          {length} m
        </div>
      )}
    </div>
  );
}
