import React, { useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { Management } from './components/management/Management';
import { Creator } from './components/creator/Creator';
import './index.css';

type Tab = 'management' | 'creator';

export default function App() {
  const [tab, setTab] = useState<Tab>('creator');
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const {
    state, activePlan,
    saveAsset, deleteAsset, exportAssetsJSON, importAssetsJSON,
    createPlan, setActivePlan, updatePlan, deletePlan, renamePlan, updateRoutingConfig,
  } = useAppStore();

  const handleEditAsset = (assetId: string) => {
    setEditingAssetId(assetId);
    setTab('management');
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f1f5f9' }}>
      {/* App header */}
      <header className="bg-gray-900 text-white px-6 py-3 flex items-center gap-6 border-b border-gray-700 flex-shrink-0">
        <div>
          <span className="font-bold text-sm tracking-tight">Dynamic Connection Plan Creator</span>
        </div>
        <nav className="flex gap-1">
          {(['creator', 'management'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {t === 'creator' ? 'Plan Creator' : 'Asset Manager'}
            </button>
          ))}
        </nav>
        <div className="flex-1" />
        <span className="text-xs text-gray-500">{state.assets.length} assets · {state.plans.length} plans</span>
      </header>

      {/* Content */}
      <main style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tab === 'management' ? (
          <div className="h-full overflow-y-auto">
            <Management
              assets={state.assets}
              onSave={saveAsset}
              onDelete={deleteAsset}
              onExport={exportAssetsJSON}
              onImport={importAssetsJSON}
              initialEditId={editingAssetId}
              onClearEditId={() => setEditingAssetId(null)}
            />
          </div>
        ) : activePlan ? (
          <Creator
            plan={activePlan}
            allPlans={state.plans}
            assets={state.assets}
            onUpdatePlan={updatePlan}
            onCreatePlan={createPlan}
            onSetActivePlan={setActivePlan}
            onDeletePlan={deletePlan}
            onRenamePlan={renamePlan}
            onEditAsset={handleEditAsset}
            onUpdateRoutingConfig={updateRoutingConfig}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="mb-4">No plan available.</p>
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                onClick={() => createPlan('My first plan')}
              >
                Create new plan
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
