import React from 'react';
import { SyncStatus } from '../obsidian/types';

interface Props {
  status: SyncStatus;
  lastError: string | null;
  lastSyncAt: Date | null;
  onClick?: () => void;
}

const STATUS_COLOR: Record<SyncStatus, string> = {
  disabled: '#6b7280',  // gray
  idle:     '#94a3b8',  // light gray
  syncing:  '#f59e0b',  // amber (spinner)
  ok:       '#22c55e',  // green
  error:    '#ef4444',  // red
  offline:  '#64748b',  // dashed gray
};

const STATUS_TEXT: Record<SyncStatus, string> = {
  disabled: 'Obsidian sync disabled',
  idle:     'Idle',
  syncing:  'Syncing…',
  ok:       'Synced',
  error:    'Sync error',
  offline:  'Obsidian offline',
};

export function SyncStatusBadge({ status, lastError, lastSyncAt, onClick }: Props) {
  const color = STATUS_COLOR[status];
  const text  = STATUS_TEXT[status];
  const tooltip = lastError
    ? `${text} — ${lastError}`
    : lastSyncAt
      ? `${text} — last sync at ${lastSyncAt.toLocaleTimeString()}`
      : text;

  return (
    <button
      onClick={onClick}
      title={tooltip}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-gray-700/40 text-xs text-gray-300 transition-colors"
    >
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${status === 'syncing' ? 'animate-pulse' : ''}`}
        style={{ background: color, border: status === 'offline' ? '1px dashed #94a3b8' : 'none' }}
      />
      <span className="hidden sm:inline">{text}</span>
    </button>
  );
}
