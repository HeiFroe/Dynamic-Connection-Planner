/**
 * Types for the Obsidian sync integration.
 */

export interface ObsidianConfig {
  /** Master switch — sync is active only when true */
  syncEnabled: boolean;
  /** REST API endpoint, e.g. http://127.0.0.1:27123 */
  baseUrl: string;
  /** Bearer token from the Local REST API plugin settings */
  bearerToken: string;
  /** Vault-relative subfolder where all DCDC content lives (default "DCDC") */
  vaultSubfolder: string;
  /** Polling interval in seconds (min 5) */
  pollIntervalSec: number;
}

export const DEFAULT_OBSIDIAN_CONFIG: ObsidianConfig = {
  syncEnabled:      false,
  baseUrl:          'http://127.0.0.1:27123',
  bearerToken:      '',
  vaultSubfolder:   'DCDC',
  pollIntervalSec:  30,
};

/** Metadata for a single vault file as returned by /vault/<dir>/ listings */
export interface VaultFileMeta {
  /** Vault-relative path */
  path: string;
  /** Last-modified time as a Unix epoch milliseconds */
  mtime: number;
  /** Size in bytes (optional — not always present) */
  size?: number;
}

export type SyncStatus =
  | 'disabled'    // sync turned off
  | 'idle'        // configured but no active operation
  | 'syncing'     // operation in progress
  | 'ok'          // last operation succeeded
  | 'error'       // last operation failed
  | 'offline';    // ping failed

export interface SyncReport {
  pushed:  string[];   // paths written
  pulled:  string[];   // paths read
  deleted: string[];   // paths removed
  errors:  { path: string; message: string }[];
}
