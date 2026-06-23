import React, { useState } from 'react';
import { ObsidianConfig, SyncStatus } from '../../obsidian/types';
import { RestApiClient } from '../../obsidian/restApiClient';

interface Props {
  config: ObsidianConfig;
  onConfigChange: (cfg: ObsidianConfig) => void;
  status: SyncStatus;
  lastError: string | null;
  lastSyncAt: Date | null;
  onSyncNow: () => Promise<void>;
  onClose: () => void;
}

export function ObsidianSettings({
  config, onConfigChange, status, lastError, lastSyncAt, onSyncNow, onClose,
}: Props) {
  const [local, setLocal]               = useState<ObsidianConfig>(config);
  const [testing, setTesting]           = useState(false);
  const [testResult, setTestResult]     = useState<'ok' | 'fail' | null>(null);
  const [confirmPullAll, setConfirmPullAll] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const client = new RestApiClient(local);
      const ok = await client.ping();
      setTestResult(ok ? 'ok' : 'fail');
    } catch {
      setTestResult('fail');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onConfigChange(local);
    onClose();
  };

  const handlePullAll = async () => {
    setConfirmPullAll(false);
    await onSyncNow();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-[480px] max-w-[95vw] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-sm font-semibold text-gray-800">Obsidian Sync Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
          >×</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Sync enabled */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={local.syncEnabled}
              onChange={e => setLocal({ ...local, syncEnabled: e.target.checked })}
              className="w-4 h-4"
            />
            <div>
              <div className="text-sm font-medium text-gray-800">Enable Obsidian sync</div>
              <div className="text-xs text-gray-500">Bidirectional sync with the Local REST API plugin</div>
            </div>
          </label>

          {/* Base URL */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">API Base URL</label>
            <input
              type="text"
              value={local.baseUrl}
              onChange={e => setLocal({ ...local, baseUrl: e.target.value })}
              placeholder="http://127.0.0.1:27123"
              className="w-full text-sm border rounded px-3 py-1.5 focus:ring-1 ring-blue-400 outline-none"
            />
            <div className="text-xs text-gray-400 mt-1">
              Default port: 27123 (HTTP). Avoid 27124 (HTTPS) — requires installing a self-signed cert.
            </div>
          </div>

          {/* Bearer token */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Bearer Token</label>
            <input
              type="password"
              value={local.bearerToken}
              onChange={e => setLocal({ ...local, bearerToken: e.target.value })}
              placeholder="paste from Obsidian → Settings → Local REST API"
              className="w-full text-sm border rounded px-3 py-1.5 focus:ring-1 ring-blue-400 outline-none font-mono"
            />
          </div>

          {/* Vault subfolder */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Vault Subfolder</label>
            <input
              type="text"
              value={local.vaultSubfolder}
              onChange={e => setLocal({ ...local, vaultSubfolder: e.target.value })}
              placeholder="DCDC"
              className="w-full text-sm border rounded px-3 py-1.5 focus:ring-1 ring-blue-400 outline-none"
            />
            <div className="text-xs text-gray-400 mt-1">
              All DCDC files will live under this path inside your vault.
            </div>
          </div>

          {/* Poll interval */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Poll interval: {local.pollIntervalSec}s
            </label>
            <input
              type="range"
              min={5}
              max={300}
              step={5}
              value={local.pollIntervalSec}
              onChange={e => setLocal({ ...local, pollIntervalSec: parseInt(e.target.value, 10) })}
              className="w-full"
            />
          </div>

          {/* CORS hint */}
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
            ⚠ In the Obsidian Local REST API plugin settings, add{' '}
            <code className="bg-white px-1 rounded">http://localhost:3000</code> to{' '}
            <strong>Allowed Origins</strong>. Otherwise the browser will block requests.
          </div>

          {/* Test connection */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleTest}
              disabled={testing || !local.baseUrl || !local.bearerToken}
              className="text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-40 px-3 py-1 rounded border"
            >
              {testing ? 'Testing…' : 'Test connection'}
            </button>
            {testResult === 'ok' && <span className="text-xs text-green-600">✓ Connected</span>}
            {testResult === 'fail' && <span className="text-xs text-red-600">✗ Failed — check URL/token/CORS</span>}
          </div>

          {/* Status */}
          <div className="border-t pt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Status:</span>
              <span className={
                status === 'ok'      ? 'text-green-600 font-medium' :
                status === 'error'   ? 'text-red-600 font-medium' :
                status === 'syncing' ? 'text-amber-600 font-medium' :
                status === 'offline' ? 'text-gray-500 font-medium' :
                'text-gray-400 font-medium'
              }>
                {status}
              </span>
            </div>
            {lastSyncAt && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Last sync:</span>
                <span className="text-gray-700">{lastSyncAt.toLocaleTimeString()}</span>
              </div>
            )}
            {lastError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                {lastError}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <button
              onClick={onSyncNow}
              disabled={!local.syncEnabled || !local.bearerToken}
              className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-3 py-1.5 rounded font-medium"
            >
              Sync now
            </button>
            <button
              onClick={() => setConfirmPullAll(true)}
              disabled={!local.syncEnabled || !local.bearerToken}
              className="text-xs bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white px-3 py-1.5 rounded font-medium"
            >
              Pull all (overwrite local)
            </button>
          </div>

          {confirmPullAll && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-xs">
              <div className="text-red-800 font-medium mb-2">⚠ This will overwrite your local data with the vault contents.</div>
              <div className="flex gap-2">
                <button
                  onClick={handlePullAll}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded font-medium"
                >Yes, overwrite</button>
                <button
                  onClick={() => setConfirmPullAll(false)}
                  className="bg-white hover:bg-gray-50 border px-3 py-1 rounded"
                >Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="text-sm text-gray-600 border border-gray-300 rounded px-4 py-1.5 hover:bg-gray-100"
          >Cancel</button>
          <button
            onClick={handleSave}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-1.5 font-medium"
          >Save</button>
        </div>
      </div>
    </div>
  );
}
