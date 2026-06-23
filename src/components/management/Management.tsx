import React from 'react';
import { Asset } from '../../types';
import { AssetList } from './AssetList';

interface Props {
  assets: Asset[];
  onSave: (asset: Asset) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onImport: (json: string) => void;
  initialEditId?: string | null;
  onClearEditId?: () => void;
}

export function Management({ assets, onSave, onDelete, onExport, onImport, initialEditId, onClearEditId }: Props) {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-2">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">Asset Manager</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage the devices, cables and mounts available in the Plan Creator.
        </p>
      </div>
      <AssetList
        assets={assets}
        onSave={onSave}
        onDelete={onDelete}
        onExport={onExport}
        onImport={onImport}
        initialEditId={initialEditId}
        onClearEditId={onClearEditId}
      />
    </div>
  );
}
