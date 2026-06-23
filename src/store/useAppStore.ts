import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Asset, Plan, Layer, RoutingConfig, DEFAULT_ROUTING_CONFIG } from '../types';
import { SAMPLE_ASSETS } from '../data/sampleAssets';

const STORAGE_KEY = 'dynamic-connection-planner-v1';

const DEFAULT_LAYER_VISIBILITY: Record<Layer, boolean> = {
  hardware: true,
  video: true,
  usb: true,
  power: true,
  ethernet: true,
  other: true,
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
  'video-bar':      'collaboration-system',
  'collaboration':  'collaboration-system',
  'hub':            'collab-extension',
  'camera':         'collab-extension',
  'switcher':       'collab-extension',
  'adapter':        'device-content',
  'power':          'device-content',
  'bundle':         'device-content',  // bundles become device-content (closest semantic match)
};

function migrateState(raw: AppState): AppState {
  return {
    ...raw,
    assets: raw.assets.map(a => ({
      ...a,
      attachmentPoints: a.attachmentPoints ?? [],
      // Migrate old category names to new taxonomy
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

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      // Existing state: trust user's asset DB completely. Never auto-inject samples,
      // even if new ones exist in SAMPLE_ASSETS — the user manages assets manually.
      return migrateState(JSON.parse(raw) as AppState);
    }
  } catch {}
  // First run only: seed from SAMPLE_ASSETS.
  const defaultPlan = createEmptyPlan('Conference Room Plan 1');
  return {
    assets: SAMPLE_ASSETS,
    plans: [defaultPlan],
    activePlanId: defaultPlan.id,
  };
}

function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function useAppStore() {
  const [state, setState] = useState<AppState>(loadState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    saveState(state);
  }, [state]);

  // ── Assets ──────────────────────────────────────────────────────────

  const saveAsset = useCallback((asset: Asset) => {
    setState(s => {
      const exists = s.assets.some(a => a.id === asset.id);
      return {
        ...s,
        assets: exists
          ? s.assets.map(a => a.id === asset.id ? { ...asset, updatedAt: new Date().toISOString() } : a)
          : [...s.assets, { ...asset, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      };
    });
  }, []);

  const deleteAsset = useCallback((id: string) => {
    setState(s => ({ ...s, assets: s.assets.filter(a => a.id !== id) }));
  }, []);

  const exportAssetsJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(state.assets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'assets.json'; a.click();
    URL.revokeObjectURL(url);
  }, [state.assets]);

  const importAssetsJSON = useCallback((json: string) => {
    let imported: Asset[];
    try {
      imported = JSON.parse(json) as Asset[];
    } catch { alert('Invalid JSON file.'); return; }
    if (!Array.isArray(imported)) { alert('Invalid JSON file: array expected.'); return; }
    // Normalize: attachmentPoints is required by the type but may be missing
    // for cable/adapter assets in external imports. Default to [].
    const normalized: Asset[] = imported.map(a => ({
      ...a,
      attachmentPoints: a.attachmentPoints ?? [],
    }));
    // Compute conflicts and prompt OUTSIDE setState — React 19 StrictMode runs
    // the updater twice in dev, which would prompt twice if confirm() were inside.
    const currentAssets = stateRef.current.assets;
    const existingIds = new Set(currentAssets.map(a => a.id));
    const conflicts = normalized.filter(a => existingIds.has(a.id));
    const fresh = normalized.filter(a => !existingIds.has(a.id));
    let toReplace: Asset[] = [];
    if (conflicts.length > 0) {
      const overwrite = window.confirm(
        `${conflicts.length} asset(s) already exist with the same ID.\n\n` +
        `OK = overwrite (your local edits will be lost)\n` +
        `Cancel = keep existing, import only ${fresh.length} new`,
      );
      if (overwrite) toReplace = conflicts;
    }
    const replaceIds = new Set(toReplace.map(a => a.id));
    const now = new Date().toISOString();
    const stamped = [...fresh, ...toReplace].map(a => ({
      ...a,
      createdAt: a.createdAt ?? now,
      updatedAt: now,
    }));
    setState(s => {
      const kept = s.assets.filter(a => !replaceIds.has(a.id));
      return { ...s, assets: [...kept, ...stamped] };
    });
    alert(`Import complete: ${fresh.length} new, ${toReplace.length} overwritten, ${conflicts.length - toReplace.length} skipped.`);
  }, []);

  // ── Plans ────────────────────────────────────────────────────────────

  const createPlan = useCallback((name: string) => {
    const plan = createEmptyPlan(name);
    setState(s => ({ ...s, plans: [...s.plans, plan], activePlanId: plan.id }));
    return plan.id;
  }, []);

  const setActivePlan = useCallback((id: string) => {
    setState(s => ({ ...s, activePlanId: id }));
  }, []);

  const updatePlan = useCallback((plan: Plan) => {
    setState(s => ({
      ...s,
      plans: s.plans.map(p => p.id === plan.id ? { ...plan, updatedAt: new Date().toISOString() } : p),
    }));
  }, []);

  const deletePlan = useCallback((id: string) => {
    setState(s => {
      const plans = s.plans.filter(p => p.id !== id);
      return {
        ...s,
        plans,
        activePlanId: s.activePlanId === id ? (plans[0]?.id ?? null) : s.activePlanId,
      };
    });
  }, []);

  const renamePlan = useCallback((id: string, name: string) => {
    setState(s => ({
      ...s,
      plans: s.plans.map(p => p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p),
    }));
  }, []);

  const updateRoutingConfig = useCallback((config: Partial<RoutingConfig>) => {
    setState(s => ({
      ...s,
      plans: s.plans.map(p => p.id !== s.activePlanId ? p : {
        ...p,
        routingConfig: { ...DEFAULT_ROUTING_CONFIG, ...p.routingConfig, ...config },
        updatedAt: new Date().toISOString(),
      }),
    }));
  }, []);

  const activePlan = state.plans.find(p => p.id === state.activePlanId) ?? null;

  return {
    state,
    activePlan,
    saveAsset,
    deleteAsset,
    exportAssetsJSON,
    importAssetsJSON,
    createPlan,
    setActivePlan,
    updatePlan,
    deletePlan,
    renamePlan,
    updateRoutingConfig,
  };
}
