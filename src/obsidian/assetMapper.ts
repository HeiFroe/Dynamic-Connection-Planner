/**
 * Asset ↔ Markdown round-trip mapper.
 *
 * Output format (vault file `Assets/<category>/<vendor-slug>/<model-slug>--<dbNumber>.md`):
 *
 *   ---
 *   dcdc-id: <uuid>
 *   dcdc-type: asset
 *   dbNumber: 42
 *   vendor: "Logitech"
 *   model: "Rally Bar"
 *   ... (see Asset type for full schema)
 *   tags: [dcdc/asset, dcdc/category/<category>]
 *   ---
 *
 *   ![[Attachments/asset-<uuid>.png]]
 *
 *   ## Notes
 *
 *   <freely editable user notes — only this section survives round-trips>
 *
 *   ## Required Companions
 *
 *   - [[Assets/.../slug--N]]
 *
 *   ## Recommended For Ports
 *
 *   ...
 */

import { Asset, PortDef, AssetCategory } from '../types';
import { parseFrontmatter, stringifyFrontmatter } from './yamlFrontmatter';
import { slugify, joinVaultPath } from './slugify';

/** Lookup: UUID → vault path. Used to render wiki-links to OTHER assets. */
export type AssetLookup = (assetId: string) => string | undefined;

const NOTES_HEADING       = '## Notes';
const REQUIRED_HEADING    = '## Required Companions';
const RECOMMENDED_HEADING = '## Recommended For Ports';

// ── Path generation ──────────────────────────────────────────────────────────

export function assetVaultPath(asset: Asset, subfolder: string): string {
  const category = slugify(asset.category) || 'uncategorized';
  const vendor   = slugify(asset.vendor)   || 'unknown';
  const model    = slugify(asset.model)    || 'unnamed';
  const file     = `${model}--${asset.dbNumber}.md`;
  return joinVaultPath(subfolder, 'Assets', category, vendor, file);
}

export function attachmentVaultPath(asset: Asset, subfolder: string): string {
  return joinVaultPath(subfolder, 'Attachments', `asset-${asset.id}.png`);
}

// ── Markdown → Asset ─────────────────────────────────────────────────────────

export function markdownToAsset(md: string): Asset | null {
  const { data, body } = parseFrontmatter(md);
  if (!data || data['dcdc-type'] !== 'asset') return null;
  if (!data['dcdc-id']) return null;

  const notes = extractNotesSection(body);

  const ports: PortDef[] = Array.isArray(data.ports) ? data.ports.map(rawToPort) : [];

  const asset: Asset = {
    id:               String(data['dcdc-id']),
    dbNumber:         Number(data.dbNumber) || 0,
    vendor:           String(data.vendor   || ''),
    model:            String(data.model    || ''),
    partNumber:       data.partNumber       ? String(data.partNumber) : undefined,
    productPage:      data.productPage      ? String(data.productPage) : undefined,
    category:         (data.category as AssetCategory) || 'other-devices',
    notes:            notes || undefined,
    // frontImage is loaded separately as binary from the Attachments/ path
    frontImage:       undefined,
    imageAspectRatio: data.imageAspectRatio !== undefined ? Number(data.imageAspectRatio) : undefined,
    physicalWidth:    data.physicalWidth    !== undefined ? Number(data.physicalWidth)    : undefined,
    physicalHeight:   data.physicalHeight   !== undefined ? Number(data.physicalHeight)   : undefined,
    ports,
    requires:         Array.isArray(data.requires) ? data.requires.map(String) : undefined,
    createdAt:        String(data.createdAt || new Date().toISOString()),
    updatedAt:        String(data.updatedAt || new Date().toISOString()),
  };
  return asset;
}

function rawToPort(raw: any): PortDef {
  return {
    id:          String(raw.id || ''),
    name:        String(raw.name || ''),
    layer:       raw.layer || 'other',
    standard:    raw.standard || 'power',
    maleFemale:  raw.maleFemale === 'male' ? 'male' : 'female',
    restriction: raw.restriction ? String(raw.restriction) : undefined,
    recommended: Array.isArray(raw.recommended) ? raw.recommended.map(String) : undefined,
    optional:    Array.isArray(raw.optional)    ? raw.optional.map(String)    : undefined,
    position:    raw.position && typeof raw.position === 'object'
      ? { x: Number(raw.position.x) || 0, y: Number(raw.position.y) || 0 }
      : undefined,
  };
}

/** Extract content between `## Notes` and the next `## ` heading. */
export function extractNotesSection(body: string): string {
  const idx = body.indexOf(NOTES_HEADING);
  if (idx === -1) return '';
  const after = body.slice(idx + NOTES_HEADING.length);
  const next  = after.search(/\n## /);
  const raw   = next >= 0 ? after.slice(0, next) : after;
  return raw.trim();
}

// ── Asset → Markdown ─────────────────────────────────────────────────────────

export function assetToMarkdown(
  asset: Asset,
  subfolder: string,
  lookup?: AssetLookup,
): string {
  const data: Record<string, any> = {
    'dcdc-id':         asset.id,
    'dcdc-type':       'asset',
    dbNumber:          asset.dbNumber,
    vendor:            asset.vendor,
    model:             asset.model,
    ...(asset.partNumber       !== undefined && { partNumber: asset.partNumber }),
    ...(asset.productPage      !== undefined && { productPage: asset.productPage }),
    category:          asset.category,
    ...(asset.physicalWidth    !== undefined && { physicalWidth: asset.physicalWidth }),
    ...(asset.physicalHeight   !== undefined && { physicalHeight: asset.physicalHeight }),
    ...(asset.imageAspectRatio !== undefined && { imageAspectRatio: asset.imageAspectRatio }),
    ...(asset.frontImage       !== undefined && { image: relativeAttachmentPath(asset, subfolder) }),
    ports:             asset.ports.map(portToRaw),
    ...(asset.requires && asset.requires.length > 0 && { requires: asset.requires }),
    createdAt:         asset.createdAt,
    updatedAt:         asset.updatedAt,
    tags: [
      'dcdc/asset',
      `dcdc/category/${asset.category}`,
    ],
  };

  const body = buildAssetBody(asset, lookup);
  return stringifyFrontmatter(data, body);
}

function portToRaw(p: PortDef): Record<string, any> {
  return {
    id:          p.id,
    name:        p.name,
    layer:       p.layer,
    standard:    p.standard,
    maleFemale:  p.maleFemale,
    ...(p.restriction !== undefined && { restriction: p.restriction }),
    ...(p.recommended && p.recommended.length > 0 && { recommended: p.recommended }),
    ...(p.optional    && p.optional.length > 0    && { optional:    p.optional }),
    ...(p.position    !== undefined && { position: { x: p.position.x, y: p.position.y } }),
  };
}

function buildAssetBody(asset: Asset, lookup?: AssetLookup): string {
  let body = '';

  // Header
  body += `# ${asset.vendor} ${asset.model}\n\n`;

  // Image embed
  if (asset.frontImage || asset.imageAspectRatio) {
    body += `![[Attachments/asset-${asset.id}.png]]\n\n`;
  }

  // Notes — always present so the heading exists for users to fill in
  body += `${NOTES_HEADING}\n\n${asset.notes ?? ''}\n\n`;

  // Required Companions
  if (asset.requires && asset.requires.length > 0) {
    body += `${REQUIRED_HEADING}\n\n`;
    for (const id of asset.requires) {
      body += `- ${renderAssetLink(id, lookup)}\n`;
    }
    body += '\n';
  }

  // Recommended for ports
  const portsWithRec = asset.ports.filter(p => p.recommended && p.recommended.length > 0);
  if (portsWithRec.length > 0) {
    body += `${RECOMMENDED_HEADING}\n\n`;
    for (const p of portsWithRec) {
      body += `- **${p.name}**: ${(p.recommended ?? []).map(id => renderAssetLink(id, lookup)).join(', ')}\n`;
    }
    body += '\n';
  }

  return body;
}

function renderAssetLink(id: string, lookup?: AssetLookup): string {
  const path = lookup?.(id);
  if (!path) return `[[${id}]]`;
  // Obsidian wiki-links resolve on basename; pass the full vault-relative path
  // minus the .md extension for cleanest display
  const noExt = path.replace(/\.md$/i, '');
  return `[[${noExt}]]`;
}

function relativeAttachmentPath(asset: Asset, subfolder: string): string {
  // Stored as vault-relative path, e.g. "DCDC/Attachments/asset-uuid.png"
  return joinVaultPath(subfolder, 'Attachments', `asset-${asset.id}.png`);
}
