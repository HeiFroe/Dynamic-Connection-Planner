/**
 * Thin client for the obsidian-local-rest-api plugin.
 *
 * Plugin docs: https://coddingtonbear.github.io/obsidian-local-rest-api/
 *
 * All paths are vault-relative. The plugin's endpoint is:
 *   GET/PUT/POST/PATCH/DELETE /vault/<encoded-path>
 *
 * A trailing slash on a directory returns a listing.
 *
 * Auth: `Authorization: Bearer <token>` header on every request.
 *
 * We only use HTTP (port 27123). HTTPS (27124) requires installing a
 * self-signed certificate — too painful for users.
 */

import { ObsidianConfig, VaultFileMeta } from './types';

export class RestApiError extends Error {
  constructor(public status: number, public body: string, public path: string) {
    super(`Obsidian REST API ${status} on ${path}: ${body}`);
  }
}

const REQUEST_TIMEOUT_MS = 5000;

export class RestApiClient {
  constructor(private cfg: ObsidianConfig) {}

  // ── Health ──────────────────────────────────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      const r = await this.request('GET', '/', { timeoutMs: 2000 });
      return r.ok;
    } catch {
      return false;
    }
  }

  // ── File operations ─────────────────────────────────────────────────────

  /** List a directory. Path must end with `/`. Returns empty list on 404. */
  async list(dir: string): Promise<VaultFileMeta[]> {
    const path = ensureTrailingSlash(dir);
    const r = await this.request('GET', encodeVaultPath(path));
    if (r.status === 404) return [];
    if (!r.ok) throw await this.toError(r, path);
    const data = await r.json();
    // Plugin returns { files: ["a.md", "subdir/", ...] }
    // It does NOT include mtimes in the listing — we'd need a HEAD per file.
    // For our purposes we use the listing for discovery and HEAD lazily for mtimes.
    const files: string[] = Array.isArray(data?.files) ? data.files : [];
    return files.map(name => ({
      path: joinPath(dir, name),
      mtime: 0,  // filled in by getText/getBinary when fetched
    }));
  }

  /** List recursively under a directory. Walks subdirectories breadth-first. */
  async listRecursive(dir: string): Promise<VaultFileMeta[]> {
    const out: VaultFileMeta[] = [];
    const queue: string[] = [dir];
    while (queue.length > 0) {
      const d = queue.shift()!;
      const items = await this.list(d);
      for (const item of items) {
        if (item.path.endsWith('/')) {
          queue.push(item.path);
        } else {
          out.push(item);
        }
      }
    }
    return out;
  }

  /** Fetch a text file. Returns null on 404. */
  async getText(path: string): Promise<{ content: string; mtime: number } | null> {
    const r = await this.request('GET', encodeVaultPath(path));
    if (r.status === 404) return null;
    if (!r.ok) throw await this.toError(r, path);
    const content = await r.text();
    const mtime   = parseLastModified(r.headers.get('Last-Modified'));
    return { content, mtime };
  }

  /** Fetch a binary file as a Blob. Returns null on 404. */
  async getBinary(path: string): Promise<{ blob: Blob; mtime: number } | null> {
    const r = await this.request('GET', encodeVaultPath(path));
    if (r.status === 404) return null;
    if (!r.ok) throw await this.toError(r, path);
    const blob  = await r.blob();
    const mtime = parseLastModified(r.headers.get('Last-Modified'));
    return { blob, mtime };
  }

  /** Write a text file. Creates parent directories as needed. */
  async putText(path: string, content: string, contentType = 'text/markdown'): Promise<void> {
    const r = await this.request('PUT', encodeVaultPath(path), {
      body: content,
      headers: { 'Content-Type': contentType },
    });
    if (!r.ok) throw await this.toError(r, path);
  }

  /** Write a binary file (image attachment). */
  async putBinary(path: string, blob: Blob, mime: string): Promise<void> {
    const r = await this.request('PUT', encodeVaultPath(path), {
      body: blob,
      headers: { 'Content-Type': mime },
    });
    if (!r.ok) throw await this.toError(r, path);
  }

  /** Delete a file. Returns true if deleted, false if not found. */
  async delete(path: string): Promise<boolean> {
    const r = await this.request('DELETE', encodeVaultPath(path));
    if (r.status === 404) return false;
    if (!r.ok) throw await this.toError(r, path);
    return true;
  }

  /** True if file exists. Cheaper than fetching the body. */
  async exists(path: string): Promise<boolean> {
    const r = await this.request('HEAD', encodeVaultPath(path));
    return r.ok;
  }

  // ── Search ──────────────────────────────────────────────────────────────

  /** Simple full-text query. Returns array of file paths. */
  async searchByTag(tag: string): Promise<string[]> {
    // The plugin's POST /search/simple/ accepts a query parameter
    const r = await this.request('POST', `/search/simple/?query=${encodeURIComponent('#' + tag)}`);
    if (!r.ok) throw await this.toError(r, '/search/simple/');
    const data = await r.json();
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => item.filename || item.path).filter(Boolean);
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private async request(
    method: string,
    pathSuffix: string,
    opts: { body?: BodyInit; headers?: Record<string, string>; timeoutMs?: number } = {},
  ): Promise<Response> {
    const url = `${this.cfg.baseUrl.replace(/\/+$/, '')}${pathSuffix}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.cfg.bearerToken}`,
          ...(opts.headers ?? {}),
        },
        body:   opts.body,
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async toError(r: Response, path: string): Promise<RestApiError> {
    let body = '';
    try { body = await r.text(); } catch {}
    return new RestApiError(r.status, body, path);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function encodeVaultPath(vaultPath: string): string {
  // Encode per segment so `/` remains as the separator
  return '/vault/' + vaultPath
    .split('/')
    .map(seg => encodeURIComponent(seg))
    .join('/');
}

function ensureTrailingSlash(p: string): string {
  return p.endsWith('/') ? p : p + '/';
}

function joinPath(dir: string, name: string): string {
  const d = dir.endsWith('/') ? dir.slice(0, -1) : dir;
  return d.length === 0 ? name : `${d}/${name}`;
}

function parseLastModified(h: string | null): number {
  if (!h) return Date.now();
  const ts = Date.parse(h);
  return isNaN(ts) ? Date.now() : ts;
}
