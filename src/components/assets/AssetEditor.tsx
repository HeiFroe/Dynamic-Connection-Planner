import React, { useState, useRef } from 'react';
import {
  Asset, PortDef, Layer, AssetCategory, PortType,
  CATEGORY_LABELS, ALL_CATEGORIES, ALL_LAYERS, ALL_STANDARDS,
  LAYER_META, PORT_TYPE_LABELS,
} from '../../types';

interface Props {
  asset: Asset;
  allAssets: Asset[];
  onChange: (asset: Asset) => void;
  onOpenConfig: () => void;
}

export function AssetEditor({ asset, allAssets, onChange, onOpenConfig }: Props) {
  const [selectedPortIdx, setSelectedPortIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<Asset>) =>
    onChange({ ...asset, ...patch, updatedAt: new Date().toISOString() });

  const updatePort = (idx: number, patch: Partial<PortDef>) => {
    const ports = asset.ports.map((p, i) => i === idx ? { ...p, ...patch } : p);
    update({ ports });
  };

  const addPort = () => {
    const port: PortDef = {
      id: crypto.randomUUID(),
      name: '',
      layer: 'video',
      standard: 'hdmi-out',
      maleFemale: 'female',
    };
    update({ ports: [...asset.ports, port] });
    setSelectedPortIdx(asset.ports.length);
  };

  const deletePort = () => {
    if (selectedPortIdx === null) return;
    const ports = asset.ports.filter((_, i) => i !== selectedPortIdx);
    update({ ports });
    setSelectedPortIdx(null);
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        update({
          frontImage: dataUrl,
          imageAspectRatio: img.naturalWidth / img.naturalHeight,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const selectedPort = selectedPortIdx !== null ? asset.ports[selectedPortIdx] : null;

  return (
    <div className="p-4 space-y-4 text-sm">
      {/* Header */}
      <div className="text-xs text-gray-400 font-mono">#{asset.dbNumber}</div>

      {/* Top section: thumbnail + fields */}
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="flex-shrink-0 space-y-1">
          {(() => {
            const ar = asset.imageAspectRatio ?? 1;
            const maxW = 120, maxH = 120;
            let w = maxW, h = maxW / ar;
            if (h > maxH) { h = maxH; w = maxH * ar; }
            w = Math.round(w); h = Math.round(h);
            return (
              <div
                style={{
                  width: w, height: h,
                  // Checkerboard background shows PNG transparency
                  backgroundImage: asset.frontImage
                    ? 'linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)'
                    : undefined,
                  backgroundSize: '8px 8px',
                  backgroundPosition: '0 0,0 4px,4px -4px,-4px 0',
                  backgroundColor: '#f9fafb',
                }}
                className="rounded border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400"
                onClick={() => fileRef.current?.click()}
              >
                {asset.frontImage ? (
                  <img
                    src={asset.frontImage}
                    alt="thumb"
                    style={{ width: w, height: h, objectFit: 'contain', display: 'block' }}
                    draggable={false}
                  />
                ) : (
                  <div className="text-center text-gray-400 text-xs p-1">
                    <div className="text-lg mb-0.5">📷</div>
                    <div>{asset.vendor || 'Vendor'}</div>
                    <div>{asset.model || 'Model'}</div>
                  </div>
                )}
              </div>
            );
          })()}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
          <div className="flex gap-1">
            <button onClick={() => fileRef.current?.click()} className="flex-1 text-xs bg-pink-100 hover:bg-pink-200 text-pink-800 rounded px-2 py-0.5">
              Set
            </button>
            <button onClick={onOpenConfig} className="flex-1 text-xs bg-pink-100 hover:bg-pink-200 text-pink-800 rounded px-2 py-0.5">
              Config
            </button>
          </div>
        </div>

        {/* Metadata fields */}
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div className="col-span-2 grid grid-cols-2 gap-2">
            <input
              value={asset.vendor}
              onChange={e => update({ vendor: e.target.value })}
              placeholder="Vendor *"
              className="border rounded px-2 py-1 text-sm focus:ring-1 ring-blue-400 outline-none"
            />
            <input
              value={asset.model}
              onChange={e => update({ model: e.target.value })}
              placeholder="Model *"
              className="border rounded px-2 py-1 text-sm focus:ring-1 ring-blue-400 outline-none"
            />
          </div>

          <input
            value={asset.partNumber ?? ''}
            onChange={e => update({ partNumber: e.target.value || undefined })}
            placeholder="Part Number (optional)"
            className="border rounded px-2 py-1 text-sm focus:ring-1 ring-blue-400 outline-none"
          />

          <div className="relative flex items-center">
            <input
              value={asset.productPage ?? ''}
              onChange={e => update({ productPage: e.target.value || undefined })}
              placeholder="Product Page URL (optional)"
              className="border rounded px-2 py-1 text-sm focus:ring-1 ring-blue-400 outline-none w-full pr-7"
            />
            {asset.productPage && (
              <a
                href={asset.productPage}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute right-2 text-blue-500 hover:text-blue-700 text-xs"
                title="Open product page"
              >
                ↗
              </a>
            )}
          </div>

          <select
            value={asset.category}
            onChange={e => update({ category: e.target.value as AssetCategory })}
            className="border rounded px-2 py-1 text-sm bg-green-50 focus:ring-1 ring-green-400 outline-none"
          >
            {ALL_CATEGORIES.map(c => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>

          <input
            value={asset.requires?.join(', ') ?? ''}
            onChange={e => update({ requires: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            placeholder="Required asset IDs (comma-sep)"
            className="border rounded px-2 py-1 text-sm bg-green-50 focus:ring-1 ring-green-400 outline-none"
          />

          <textarea
            value={asset.notes ?? ''}
            onChange={e => update({ notes: e.target.value })}
            placeholder="Notes / comments (optional)"
            rows={2}
            className="col-span-2 border rounded px-2 py-1 text-sm focus:ring-1 ring-blue-400 outline-none resize-none"
          />
        </div>
      </div>

      {/* Connections */}
      <div className="border rounded overflow-hidden">
        <div className="flex items-center justify-between bg-gray-100 px-3 py-1.5 border-b">
          <span className="font-semibold text-gray-700">Connections ({asset.ports.length})</span>
          <div className="flex gap-1">
            <button
              onClick={addPort}
              className="text-xs bg-pink-200 hover:bg-pink-300 text-pink-900 px-2 py-0.5 rounded"
            >
              + Add
            </button>
            <button
              onClick={deletePort}
              disabled={selectedPortIdx === null}
              className="text-xs bg-pink-200 hover:bg-pink-300 text-pink-900 px-2 py-0.5 rounded disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Port list */}
        <div className="max-h-40 overflow-y-auto divide-y">
          {asset.ports.length === 0 ? (
            <div className="text-gray-400 text-xs px-3 py-4 text-center">No connections yet</div>
          ) : asset.ports.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setSelectedPortIdx(i === selectedPortIdx ? null : i)}
              className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 ${
                selectedPortIdx === i ? 'bg-blue-50' : ''
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: LAYER_META[p.layer].color }}
              />
              <span className="font-medium text-gray-800 truncate flex-1">{p.name || <em className="text-gray-400">unnamed</em>}</span>
              <span className="text-xs text-gray-400">{PORT_TYPE_LABELS[p.standard] ?? p.standard}</span>
              <span className="text-xs text-gray-400">{p.maleFemale === 'male' ? '♂' : '♀'}</span>
            </button>
          ))}
        </div>

        {/* Port detail editor */}
        {selectedPort && selectedPortIdx !== null && (
          <div className="border-t bg-gray-50 p-3 grid grid-cols-2 gap-2">
            <input
              value={selectedPort.name}
              onChange={e => updatePort(selectedPortIdx, { name: e.target.value })}
              placeholder="Connection name *"
              className="col-span-2 border rounded px-2 py-1 text-sm focus:ring-1 ring-blue-400 outline-none bg-green-50"
            />

            <select
              value={selectedPort.layer}
              onChange={e => updatePort(selectedPortIdx, { layer: e.target.value as Layer })}
              className="border rounded px-2 py-1 text-sm bg-green-50 focus:ring-1 ring-green-400 outline-none"
            >
              {ALL_LAYERS.map(l => (
                <option key={l} value={l}>{LAYER_META[l].label}</option>
              ))}
            </select>

            <select
              value={selectedPort.standard}
              onChange={e => updatePort(selectedPortIdx, { standard: e.target.value as PortType })}
              className="border rounded px-2 py-1 text-sm bg-green-50 focus:ring-1 ring-green-400 outline-none"
            >
              {ALL_STANDARDS.map(s => (
                <option key={s} value={s}>{PORT_TYPE_LABELS[s] ?? s}</option>
              ))}
            </select>

            <select
              value={selectedPort.maleFemale}
              onChange={e => updatePort(selectedPortIdx, { maleFemale: e.target.value as 'male' | 'female' })}
              className="border rounded px-2 py-1 text-sm bg-green-50 focus:ring-1 ring-green-400 outline-none"
            >
              <option value="female">Female (Socket)</option>
              <option value="male">Male (Plug)</option>
            </select>

            <input
              value={selectedPort.restriction ?? ''}
              onChange={e => updatePort(selectedPortIdx, { restriction: e.target.value || undefined })}
              placeholder="Restriction (optional)"
              className="border rounded px-2 py-1 text-sm focus:ring-1 ring-blue-400 outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}
