import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Asset, Plan, Layer, ALL_LAYERS } from '../types';
import DEFAULT_ASSETS from '../data/defaultAssets.json';

const STORAGE_KEY = 'dcdc-v1';

const DEFAULT_LAYER_VIS: Record<Layer, boolean> = Object.fromEntries(
  ALL_LAYERS.map(l => [l, true])
) as Record<Layer, boolean>;

const DEFAULT_LABEL_VIS: Partial<Record<Layer, boolean>> = Object.fromEntries(
  ALL_LAYERS.map(l => [l, true])
);

function createEmptyPlan(name: string): Plan {
  return {
    id: crypto.randomUUID(),
    name,
    instances: [],
    connections: [],
    areas: [],
    layerVisibility: { ...DEFAULT_LAYER_VIS },
    portLabelVisibility: { ...DEFAULT_LABEL_VIS },
    cableLabelVisibility: { ...DEFAULT_LABEL_VIS },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      // Always recompute nextDbNumber from actual assets to prevent duplicates
      const maxDb = parsed.assets.length > 0
        ? Math.max(...parsed.assets.map(a => a.dbNumber ?? 0))
        : 0;
      return { ...parsed, nextDbNumber: maxDb + 1 };
    }
  } catch {}
  const plan   = createEmptyPlan('Plan 1');
  const assets = DEFAULT_ASSETS as Asset[];
  const maxDb  = Math.max(0, ...assets.map(a => a.dbNumber ?? 0));
  return { assets, plans: [plan], activePlanId: plan.id, nextDbNumber: maxDb + 1 };
}

function saveState(state: AppState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

export function useAppStore() {
  const [state, setState] = useState<AppState>(loadState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => { saveState(state); }, [state]);

  // ── Assets ───────────────────────────────────────────────────────────────

  const saveAsset = useCallback((asset: Asset) => {
    setState(s => {
      const exists = s.assets.some(a => a.id === asset.id);
      if (exists) {
        return {
          ...s,
          assets: s.assets.map(a =>
            a.id === asset.id ? { ...asset, updatedAt: new Date().toISOString() } : a
          ),
        };
      }
      const dbNumber = s.nextDbNumber;
      return {
        ...s,
        nextDbNumber: s.nextDbNumber + 1,
        assets: [
          ...s.assets,
          {
            ...asset,
            dbNumber,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };
    });
  }, []);

  const deleteAsset = useCallback((id: string) => {
    setState(s => ({ ...s, assets: s.assets.filter(a => a.id !== id) }));
  }, []);

  const newAsset = useCallback((): Asset => ({
    id: crypto.randomUUID(),
    dbNumber: stateRef.current.nextDbNumber,
    vendor: '',
    model: '',
    category: 'collaboration-system',
    ports: [],
    requires: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }), []);

  const exportAssetsJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(stateRef.current.assets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'dcdc-assets.json'; a.click();
    URL.revokeObjectURL(url);
  }, []);

  const importAssetsJSON = useCallback((json: string) => {
    let imported: Asset[];
    try { imported = JSON.parse(json) as Asset[]; }
    catch { alert('Invalid JSON'); return; }
    if (!Array.isArray(imported)) { alert('Expected JSON array'); return; }
    const current = stateRef.current;
    const existingIds = new Set(current.assets.map(a => a.id));
    const conflicts = imported.filter(a => existingIds.has(a.id));
    const fresh = imported.filter(a => !existingIds.has(a.id));
    let toReplace: Asset[] = [];
    if (conflicts.length > 0) {
      const overwrite = window.confirm(
        `${conflicts.length} asset(s) already exist.\nOK = overwrite · Cancel = keep existing`
      );
      if (overwrite) toReplace = conflicts;
    }
    const replaceIds = new Set(toReplace.map(a => a.id));
    const now = new Date().toISOString();
    const maxDb = Math.max(0, ...current.assets.map(a => a.dbNumber ?? 0));
    let nextDb = maxDb + 1;
    const stamped = [...fresh, ...toReplace].map(a => ({
      ...a,
      dbNumber: a.dbNumber ?? nextDb++,
      createdAt: a.createdAt ?? now,
      updatedAt: now,
    }));
    setState(s => ({
      ...s,
      assets: [...s.assets.filter(a => !replaceIds.has(a.id)), ...stamped],
      nextDbNumber: Math.max(s.nextDbNumber, nextDb),
    }));
    alert(`Import: ${fresh.length} new, ${toReplace.length} overwritten, ${conflicts.length - toReplace.length} skipped.`);
  }, []);

  // ── Plans ────────────────────────────────────────────────────────────────

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
      plans: s.plans.map(p =>
        p.id === plan.id ? { ...plan, updatedAt: new Date().toISOString() } : p
      ),
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
      plans: s.plans.map(p =>
        p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p
      ),
    }));
  }, []);

  const activePlan = state.plans.find(p => p.id === state.activePlanId) ?? null;

  /** Bulk replace — used by ObsidianSync to overwrite state with vault contents. */
  const setAppState = useCallback((s: AppState) => {
    setState(s);
  }, []);

  /** Read latest state synchronously — used by ObsidianSync to diff against. */
  const getAppState = useCallback((): AppState => stateRef.current, []);

  return {
    state, activePlan,
    saveAsset, deleteAsset, newAsset,
    exportAssetsJSON, importAssetsJSON,
    createPlan, setActivePlan, updatePlan, deletePlan, renamePlan,
    setAppState, getAppState,
  };
}
