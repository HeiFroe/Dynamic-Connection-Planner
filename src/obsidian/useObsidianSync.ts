import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from '../types';
import { ObsidianConfig, DEFAULT_OBSIDIAN_CONFIG, SyncStatus, SyncReport } from './types';
import { SyncManager } from './syncManager';

const CONFIG_STORAGE_KEY = 'dcdc-obsidian-config';

function loadConfig(): ObsidianConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) return { ...DEFAULT_OBSIDIAN_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_OBSIDIAN_CONFIG;
}

function saveConfig(cfg: ObsidianConfig): void {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg));
}

export interface UseObsidianSync {
  config: ObsidianConfig;
  setConfig: (cfg: ObsidianConfig) => void;
  status: SyncStatus;
  lastError: string | null;
  lastSyncAt: Date | null;
  syncNow: () => Promise<SyncReport | undefined>;
  notifyLocalChange: () => void;
}

/**
 * Owns the SyncManager singleton's lifecycle.
 *
 * - Loads config from localStorage on mount
 * - Starts/stops polling on config changes
 * - Calls `setState` (from the app store) on pulls
 * - Surfaces `status` for UI
 */
export function useObsidianSync(
  getState: () => AppState,
  setState: (s: AppState) => void,
): UseObsidianSync {
  const [config, setConfigState] = useState<ObsidianConfig>(() => loadConfig());
  const [status, setStatus]      = useState<SyncStatus>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const managerRef = useRef<SyncManager | null>(null);

  // Wire up SyncManager on config change
  useEffect(() => {
    // Tear down old manager
    if (managerRef.current) { managerRef.current.stop(); managerRef.current = null; }

    if (!config.syncEnabled || !config.bearerToken) {
      setStatus('disabled');
      return;
    }

    const mgr = new SyncManager(config, getState, setState);
    managerRef.current = mgr;
    const off = mgr.onStatusChange((s, msg) => {
      setStatus(s);
      setLastError(msg ?? null);
      const at = mgr.getLastSyncAt();
      if (at) setLastSyncAt(at);
    });

    // On enable: do an initial pull
    mgr.syncNow().catch(() => {/* error handled via status listener */});

    // Begin polling
    mgr.start();

    return () => { off(); mgr.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.syncEnabled, config.bearerToken, config.baseUrl, config.vaultSubfolder, config.pollIntervalSec]);

  const setConfig = useCallback((cfg: ObsidianConfig) => {
    saveConfig(cfg);
    setConfigState(cfg);
  }, []);

  const syncNow = useCallback(async (): Promise<SyncReport | undefined> => {
    if (!managerRef.current) return;
    try {
      return await managerRef.current.syncNow();
    } catch {
      return;
    }
  }, []);

  const notifyLocalChange = useCallback(() => {
    managerRef.current?.notifyLocalChange();
  }, []);

  return { config, setConfig, status, lastError, lastSyncAt, syncNow, notifyLocalChange };
}
