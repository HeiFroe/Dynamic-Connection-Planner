import { useRef } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppState, Asset, Plan, Layer, RoutingConfig, DEFAULT_ROUTING_CONFIG } from '../types';
import { SAMPLE_ASSETS } from '../data/sampleAssets';

const STORAGE_KEY = 'dynamic-connection-planner-v1';

const DEFAULT_LAYER_VISIBILITY: Record<Layer, boolean> = {
  hardware: true, video: true, usb: true,
  power: true, ethernet: true, other: true,
};

function createEmptyPlan(name: string): Plan {
  return {
    id: crypto.randomUUID(),
    name,
    instances: [],
    connections: [],
    layerVisibility: { ...DEFAULT_LAYER_VISIBILITY },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const CATEGORY_MIGRATION: Record<string, string> = {
  'video-bar': 'collaboration-system', 'collaboration': 'collaboration-system',
  'hub': 'collab-extension', 'camera': 'collab-extension', 'switcher': 'collab-extension',
  'adapter': 'device-content', 'power': 'device-content', 'bundle': 'device-content',
};

function migrateState(raw: AppState): AppState {
  return {
    ...raw,
    // Assets are NOT persisted (see partialize). After rehydration the assets
    // array is empty/undefined — restore from SAMPLE_ASSETS so the app boots
    // with the full library on every reload.
    assets: (raw.assets && raw.assets.length > 0
      ? raw.assets
      : SAMPLE_ASSETS
    ).map(a => ({
      ...a,
      attachmentPoints: a.attachmentPoints ?? [],
      category: (CATEGORY_MIGRATION[(a as any).category] ?? (a as any).category) as any,
    })),
    plans: raw.plans.map(plan => ({
      ...plan,
      layerVisibility: { ...DEFAULT_LAYER_VISIBILITY, ...plan.layerVisibility },
      connections: plan.connections.map(conn => ({
        ...conn,
        cableAssetId: (conn as any).cableAssetId ?? '__legacy__',
        waypoints: (conn as any).waypoints ?? [],
      })),
    })),
  };
}

function initialState(): AppState {
  const defaultPlan = createEmptyPlan('Conference Room Plan 1');
  return {
    assets: SAMPLE_ASSETS,
    plans: [defaultPlan],
    activePlanId: defaultPlan.id,
  };
}

// ── Zustand store ─────────────────────────────────────────────────────────────

interface StoreActions {
  saveAsset: (asset: Asset) => void;
  deleteAsset: (id: string) => void;
  replaceAllAssets: (assets: Asset[]) => void;
  exportAssetsJSON: () => void;
  importAssetsJSON: (json: string, currentAssets?: Asset[]) => void;
  createPlan: (name: string) => string;
  setActivePlan: (id: string) => void;
  updatePlan: (plan: Plan) => void;
  deletePlan: (id: string) => void;
  renamePlan: (id: string, name: string) => void;
  updateRoutingConfig: (config: Partial<RoutingConfig>) => void;
}

type Store = AppState & StoreActions;

const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...initialState(),

      saveAsset: (asset) => set(s => {
        const exists = s.assets.some(a => a.id === asset.id);
        const now = new Date().toISOString();
        return {
          assets: exists
            ? s.assets.map(a => a.id === asset.id ? { ...asset, updatedAt: now } : a)
            : [...s.assets, { ...asset, createdAt: now, updatedAt: now }],
        };
      }),

      deleteAsset: (id) => set(s => ({ assets: s.assets.filter(a => a.id !== id) })),

      replaceAllAssets: (assets) => set({ assets }),

      exportAssetsJSON: () => {
        const assets = get().assets;
        const blob = new Blob([JSON.stringify(assets, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'assets.json'; a.click();
        URL.revokeObjectURL(url);
      },

      importAssetsJSON: (json, currentAssets) => {
        let imported: Asset[];
        try { imported = JSON.parse(json) as Asset[]; }
        catch { alert('Invalid JSON file.'); return; }
        if (!Array.isArray(imported)) { alert('Invalid JSON file: array expected.'); return; }

        const normalized = imported.map(a => ({ ...a, attachmentPoints: a.attachmentPoints ?? [] }));
        const existing = currentAssets ?? get().assets;
        const existingIds = new Set(existing.map(a => a.id));
        const conflicts = normalized.filter(a => existingIds.has(a.id));
        const fresh = normalized.filter(a => !existingIds.has(a.id));

        let toReplace: Asset[] = [];
        if (conflicts.length > 0) {
          const overwrite = window.confirm(
            `${conflicts.length} asset(s) already exist with the same ID.\n\n` +
            `OK = overwrite\nCancel = keep existing, import only ${fresh.length} new`,
          );
          if (overwrite) toReplace = conflicts;
        }
        const replaceIds = new Set(toReplace.map(a => a.id));
        const now = new Date().toISOString();
        const stamped = [...fresh, ...toReplace].map(a => ({
          ...a, createdAt: a.createdAt ?? now, updatedAt: now,
        }));
        set(s => ({
          assets: [...s.assets.filter(a => !replaceIds.has(a.id)), ...stamped],
        }));
        alert(`Import complete: ${fresh.length} new, ${toReplace.length} overwritten, ${conflicts.length - toReplace.length} skipped.`);
      },

      createPlan: (name) => {
        const plan = createEmptyPlan(name);
        set(s => ({ plans: [...s.plans, plan], activePlanId: plan.id }));
        return plan.id;
      },

      setActivePlan: (id) => set({ activePlanId: id }),

      updatePlan: (plan) => set(s => ({
        plans: s.plans.map(p => p.id === plan.id
          ? { ...plan, updatedAt: new Date().toISOString() } : p),
      })),

      deletePlan: (id) => set(s => {
        const plans = s.plans.filter(p => p.id !== id);
        return {
          plans,
          activePlanId: s.activePlanId === id ? (plans[0]?.id ?? null) : s.activePlanId,
        };
      }),

      renamePlan: (id, name) => set(s => ({
        plans: s.plans.map(p => p.id === id
          ? { ...p, name, updatedAt: new Date().toISOString() } : p),
      })),

      updateRoutingConfig: (config) => set(s => ({
        plans: s.plans.map(p => p.id !== s.activePlanId ? p : {
          ...p,
          routingConfig: { ...DEFAULT_ROUTING_CONFIG, ...p.routingConfig, ...config },
          updatedAt: new Date().toISOString(),
        }),
      })),
    }),
    {
      name: STORAGE_KEY,
      // Persist only plans + activePlanId — assets stay in memory (sourced from
      // sampleAssets.ts on every load). Storing 30+ base64-encoded asset images
      // (~13MB) would blow the 5MB localStorage quota on first plan update.
      partialize: (state) => ({
        plans: state.plans,
        activePlanId: state.activePlanId,
      }) as any,
      // On rehydration, run migration to handle legacy data shapes
      onRehydrateStorage: () => (state) => {
        if (state) {
          const migrated = migrateState(state as AppState);
          Object.assign(state, migrated);
        }
      },
    },
  ),
);

// ── Public hook — same API as before ─────────────────────────────────────────

export function useAppStore() {
  const state = useStore();
  // stateRef kept for importAssetsJSON which needs snapshot outside setState
  const stateRef = useRef(state);
  stateRef.current = state;

  const activePlan = state.plans.find(p => p.id === state.activePlanId) ?? null;

  return {
    state: { assets: state.assets, plans: state.plans, activePlanId: state.activePlanId },
    activePlan,
    saveAsset:           state.saveAsset,
    deleteAsset:         state.deleteAsset,
    exportAssetsJSON:    state.exportAssetsJSON,
    importAssetsJSON:    (json: string) => state.importAssetsJSON(json, stateRef.current.assets),
    replaceAllAssets:    state.replaceAllAssets,
    createPlan:          state.createPlan,
    setActivePlan:       state.setActivePlan,
    updatePlan:          state.updatePlan,
    deletePlan:          state.deletePlan,
    renamePlan:          state.renamePlan,
    updateRoutingConfig: state.updateRoutingConfig,
  };
}
