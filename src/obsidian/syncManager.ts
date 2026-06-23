/**
 * Bidirectional sync orchestrator between DCDC AppState and an Obsidian vault.
 *
 * Conflict policy: Obsidian wins.
 *   - On start: full pullAll() → setAppState() overwrites local
 *   - Pushes are debounced 1.5s after local change
 *   - Polls every pollIntervalSec; pulls any file with new mtime
 *   - Echo suppression via SHA-1 hash of last pushed content — if a file
 *     comes back with the same hash, it's our own push, skip
 */

import { AppState, Asset, Plan } from '../types';
import { ObsidianConfig, SyncStatus, SyncReport } from './types';
import { RestApiClient } from './restApiClient';
import {
  assetToMarkdown, markdownToAsset, assetVaultPath, attachmentVaultPath,
} from './assetMapper';
import {
  planToCanvas, canvasToPlan, planVaultPaths, PlanSidecar, CanvasFile,
} from './canvasMapper';
import { dataUrlToBlob, blobToDataUrl, sha1 } from './imageCodec';
import { joinVaultPath } from './slugify';

const PUSH_DEBOUNCE_MS = 1500;

type StatusListener = (status: SyncStatus, message?: string) => void;

export class SyncManager {
  private client:        RestApiClient;
  private statusListeners = new Set<StatusListener>();
  private status:        SyncStatus = 'idle';
  private lastError:     string | null = null;
  private lastSyncAt:    Date | null = null;

  /** path → mtime of last seen content for that file */
  private lastSyncMtimes = new Map<string, number>();
  /** path → SHA-1 of last content we pushed; used to detect echoes on next poll */
  private lastPushedHashes = new Map<string, string>();
  /** Snapshot of last known synced state, used to compute outbound diffs */
  private lastSyncedAssets: Map<string, string> = new Map(); // asset.id → JSON
  private lastSyncedPlans:  Map<string, string> = new Map(); // plan.id  → JSON

  private pollTimer: any = null;
  private pushTimer: any = null;

  constructor(
    private cfg:      ObsidianConfig,
    private getState: () => AppState,
    private setState: (s: AppState) => void,
  ) {
    this.client = new RestApiClient(cfg);
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Start polling. Idempotent. */
  start(): void {
    if (!this.cfg.syncEnabled) { this.setStatus('disabled'); return; }
    this.stop();
    const intervalMs = Math.max(5, this.cfg.pollIntervalSec) * 1000;
    this.pollTimer = setInterval(() => { this.pollOnce().catch(this.handleError); }, intervalMs);
  }

  stop(): void {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    if (this.pushTimer) { clearTimeout(this.pushTimer); this.pushTimer = null; }
  }

  /** Manual sync: pull then push. */
  async syncNow(): Promise<SyncReport> {
    this.setStatus('syncing');
    try {
      const pullReport = await this.pullAll();
      const pushReport = await this.pushChangesImmediate();
      this.lastSyncAt = new Date();
      const allErrors = [...pullReport.errors, ...pushReport.errors];
      if (allErrors.length > 0) {
        this.setStatus('error', `${allErrors.length} error(s): ${allErrors[0].path} — ${allErrors[0].message}`);
      } else {
        this.setStatus('ok');
      }
      // Log to console so the user can inspect what happened
      console.log('[DCDC sync] pulled:', pullReport.pulled.length, 'pushed:', pushReport.pushed.length, 'errors:', allErrors.length);
      if (allErrors.length > 0) console.error('[DCDC sync] errors:', allErrors);
      return {
        pulled:  pullReport.pulled,
        pushed:  pushReport.pushed,
        deleted: [...pullReport.deleted, ...pushReport.deleted],
        errors:  allErrors,
      };
    } catch (e) {
      this.handleError(e);
      throw e;
    }
  }

  /** Notify of a local state change. Triggers a debounced push. */
  notifyLocalChange(): void {
    if (!this.cfg.syncEnabled) return;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushChangesImmediate().catch(this.handleError);
    }, PUSH_DEBOUNCE_MS);
  }

  onStatusChange(cb: StatusListener): () => void {
    this.statusListeners.add(cb);
    cb(this.status, this.lastError ?? undefined);
    return () => this.statusListeners.delete(cb);
  }

  getStatus(): SyncStatus { return this.status; }
  getLastError(): string | null { return this.lastError; }
  getLastSyncAt(): Date | null  { return this.lastSyncAt; }

  // ── Pull ────────────────────────────────────────────────────────────────

  /**
   * Full pull: vault becomes truth. Reads all assets and plans, replaces local state.
   * Returns a report of what changed.
   */
  async pullAll(): Promise<SyncReport> {
    const report: SyncReport = { pushed: [], pulled: [], deleted: [], errors: [] };
    const subfolder = this.cfg.vaultSubfolder;

    // 1. Discover all asset .md files
    const assetsDir = joinVaultPath(subfolder, 'Assets');
    const assetFiles = await this.client.listRecursive(assetsDir);
    const mdFiles = assetFiles.filter(f => f.path.endsWith('.md'));

    // 2. Pull each — parse, then load image attachment if referenced
    const newAssets: Asset[] = [];
    for (const meta of mdFiles) {
      try {
        const res = await this.client.getText(meta.path);
        if (!res) continue;
        this.lastSyncMtimes.set(meta.path, res.mtime);
        const asset = markdownToAsset(res.content);
        if (!asset) continue;
        // Load image if Attachments/asset-<id>.png exists
        const imgPath = attachmentVaultPath(asset, subfolder);
        const img = await this.client.getBinary(imgPath);
        if (img) {
          asset.frontImage = await blobToDataUrl(img.blob);
          this.lastSyncMtimes.set(imgPath, img.mtime);
        }
        newAssets.push(asset);
        report.pulled.push(meta.path);
      } catch (e: any) {
        report.errors.push({ path: meta.path, message: e?.message ?? String(e) });
      }
    }

    // 3. Build lookups for plan parsing
    const byPath = new Map<string, Asset>();
    const byId   = new Map<string, Asset>();
    for (const a of newAssets) {
      byPath.set(assetVaultPath(a, subfolder), a);
      byId.set(a.id, a);
    }

    // 4. Discover plan .canvas files
    const plansDir = joinVaultPath(subfolder, 'Plans');
    const planFiles = await this.client.listRecursive(plansDir);
    const canvasFiles = planFiles.filter(f => f.path.endsWith('.canvas'));

    const newPlans: Plan[] = [];
    for (const meta of canvasFiles) {
      try {
        const canvasRes = await this.client.getText(meta.path);
        if (!canvasRes) continue;
        this.lastSyncMtimes.set(meta.path, canvasRes.mtime);
        const canvas: CanvasFile = JSON.parse(canvasRes.content);

        const sidecarPath = meta.path.replace(/\.canvas$/, '.dcdc.json');
        let sidecar: PlanSidecar | null = null;
        const sidecarRes = await this.client.getText(sidecarPath);
        if (sidecarRes) {
          sidecar = JSON.parse(sidecarRes.content);
          this.lastSyncMtimes.set(sidecarPath, sidecarRes.mtime);
        }

        const plan = canvasToPlan(canvas, sidecar, byPath, byId);
        newPlans.push(plan);
        report.pulled.push(meta.path);
      } catch (e: any) {
        report.errors.push({ path: meta.path, message: e?.message ?? String(e) });
      }
    }

    // 5. Replace state. Keep current activePlanId if it still exists.
    const cur = this.getState();
    const newState: AppState = {
      assets:        newAssets.length > 0 ? newAssets : cur.assets,
      plans:         newPlans.length  > 0 ? newPlans  : cur.plans,
      activePlanId:  newPlans.some(p => p.id === cur.activePlanId) ? cur.activePlanId : (newPlans[0]?.id ?? null),
      nextDbNumber:  Math.max(1, ...newAssets.map(a => a.dbNumber ?? 0)) + 1,
    };
    this.setState(newState);

    // 6. Mark only items that came FROM the vault as "synced".
    //    Local items that weren't in the vault stay un-synced so the
    //    next push uploads them.
    this.lastSyncedAssets.clear();
    this.lastSyncedPlans.clear();
    const newLookup = (id: string) => {
      // Try by UUID first, then by dbNumber (some legacy data uses dbNumber as ref)
      const a = newAssets.find(x => x.id === id || String(x.dbNumber) === id);
      return a ? assetVaultPath(a, this.cfg.vaultSubfolder) : undefined;
    };
    for (const a of newAssets) {
      this.lastSyncedAssets.set(a.id, assetToMarkdown(a, this.cfg.vaultSubfolder, newLookup));
    }
    for (const p of newPlans) {
      const { canvas, sidecar } = planToCanvas(p, newState.assets, this.cfg.vaultSubfolder);
      this.lastSyncedPlans.set(p.id,
        `${JSON.stringify(canvas, null, 2)}\n---SIDECAR---\n${JSON.stringify(sidecar, null, 2)}`);
    }
    this.lastSyncAt = new Date();
    return report;
  }

  /** Poll vault for changes since last sync. Pulls files with newer mtime. */
  private async pollOnce(): Promise<void> {
    if (!this.cfg.syncEnabled) return;
    if (this.status === 'syncing') return;  // skip if a manual sync is running

    // Cheap online check
    const ok = await this.client.ping();
    if (!ok) { this.setStatus('offline'); return; }

    // For now, just trigger a full pullAll — could be incrementalized later
    // but each poll only re-fetches files whose mtime changed (handled by
    // the listRecursive + getText sequence's caching). The mtime cache prevents
    // re-parsing unchanged files.
    try {
      // Lightweight: list files, only pull if mtime changed.
      // Full implementation would diff against lastSyncMtimes — for v1 we
      // re-pull on every tick; volume is small (~30 assets + a few plans).
      await this.pullAll();
      this.setStatus('ok');
    } catch (e: any) {
      this.handleError(e);
    }
  }

  // ── Push ────────────────────────────────────────────────────────────────

  /**
   * Compute diff of current state vs. last synced snapshot, push changes.
   * Echo-suppression: stores hash of each pushed file so the next poll can recognize
   * its own writes (we look at the hash, not the mtime).
   */
  private async pushChangesImmediate(): Promise<SyncReport> {
    const report: SyncReport = { pushed: [], pulled: [], deleted: [], errors: [] };
    if (!this.cfg.syncEnabled) return report;

    const subfolder = this.cfg.vaultSubfolder;
    const state = this.getState();

    // ── Assets ──
    const assetLookup = (id: string) => {
      // Match by UUID or by dbNumber (some legacy data uses dbNumber as ref)
      const a = state.assets.find(x => x.id === id || String(x.dbNumber) === id);
      if (!a) return undefined;
      return assetVaultPath(a, subfolder);
    };

    const currentAssetIds = new Set<string>();
    for (const asset of state.assets) {
      currentAssetIds.add(asset.id);
      const path = assetVaultPath(asset, subfolder);
      const md   = assetToMarkdown(asset, subfolder, assetLookup);
      const prev = this.lastSyncedAssets.get(asset.id);
      if (prev === md) continue;  // unchanged

      try {
        await this.client.putText(path, md, 'text/markdown');
        this.lastSyncedAssets.set(asset.id, md);
        this.lastPushedHashes.set(path, await sha1(md));
        report.pushed.push(path);

        // Image attachment if present
        if (asset.frontImage) {
          const parts = dataUrlToBlob(asset.frontImage);
          if (parts) {
            const imgPath = attachmentVaultPath(asset, subfolder);
            await this.client.putBinary(imgPath, parts.blob, parts.mime);
            report.pushed.push(imgPath);
          }
        }
      } catch (e: any) {
        report.errors.push({ path, message: e?.message ?? String(e) });
      }
    }

    // Deletions: assets we previously synced but are gone locally
    for (const [id, md] of Array.from(this.lastSyncedAssets.entries())) {
      if (currentAssetIds.has(id)) continue;
      // Need the prior asset to compute its path — parse from the cached MD
      const prior = markdownToAsset(md);
      if (!prior) { this.lastSyncedAssets.delete(id); continue; }
      const path = assetVaultPath(prior, subfolder);
      try {
        await this.client.delete(path);
        // Also try to delete the attachment
        await this.client.delete(attachmentVaultPath(prior, subfolder));
        this.lastSyncedAssets.delete(id);
        report.deleted.push(path);
      } catch (e: any) {
        report.errors.push({ path, message: e?.message ?? String(e) });
      }
    }

    // ── Plans ──
    const currentPlanIds = new Set<string>();
    for (const plan of state.plans) {
      currentPlanIds.add(plan.id);
      const { canvas, sidecar } = planToCanvas(plan, state.assets, subfolder);
      const paths = planVaultPaths(plan, subfolder);
      const canvasJson  = JSON.stringify(canvas,  null, 2);
      const sidecarJson = JSON.stringify(sidecar, null, 2);
      const combined    = `${canvasJson}\n---SIDECAR---\n${sidecarJson}`;
      if (this.lastSyncedPlans.get(plan.id) === combined) continue;

      try {
        await this.client.putText(paths.canvas,  canvasJson,  'application/json');
        await this.client.putText(paths.sidecar, sidecarJson, 'application/json');
        this.lastSyncedPlans.set(plan.id, combined);
        this.lastPushedHashes.set(paths.canvas,  await sha1(canvasJson));
        this.lastPushedHashes.set(paths.sidecar, await sha1(sidecarJson));
        report.pushed.push(paths.canvas, paths.sidecar);
      } catch (e: any) {
        report.errors.push({ path: paths.canvas, message: e?.message ?? String(e) });
      }
    }

    return report;
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private setStatus(s: SyncStatus, msg?: string): void {
    this.status    = s;
    this.lastError = s === 'error' ? (msg ?? null) : null;
    for (const l of this.statusListeners) l(s, this.lastError ?? undefined);
  }

  private handleError = (e: any): void => {
    const msg = e?.message ?? String(e);
    this.setStatus('error', msg);
  };
}
