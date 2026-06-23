#!/usr/bin/env node
// Transformiert dcdc-assets Export-JSON → App-Schema und schreibt in localStorage-Snapshot

const fs = require('fs');
const path = require('path');

const INPUT = process.argv[2] || '/Users/c5263507/Downloads/dcdc-assets (8).json';
const STORAGE_KEY = 'dynamic-connection-planner-v1';
const LS_FILE = path.join(__dirname, '../.ls-inject.json');

const MALE_FEMALE_MAP = {
  male:   'out',
  female: 'in',
  both:   'bidirectional',
  none:   'bidirectional',
};

const CATEGORY_MIGRATION = {
  'video-bar': 'collaboration-system', 'collaboration': 'collaboration-system',
  'hub': 'collab-extension', 'camera': 'collab-extension', 'switcher': 'collab-extension',
  'adapter': 'device-content', 'power': 'device-content', 'bundle': 'device-content',
};

function transformAsset(e) {
  const category = CATEGORY_MIGRATION[e.category] ?? e.category;

  // Derive canvas width/height from imageAspectRatio or default
  const BASE_HEIGHT = 80;
  const ratio = e.imageAspectRatio ?? 2.0;
  const width  = Math.round(BASE_HEIGHT * ratio);
  const height = BASE_HEIGHT;

  const ports = (e.ports ?? []).map(p => ({
    id:            p.id ?? crypto.randomUUID(),
    label:         p.name ?? 'Port',
    type:          p.standard,
    direction:     MALE_FEMALE_MAP[p.maleFemale] ?? 'bidirectional',
    layer:         p.layer ?? 'other',
    position:      p.position ?? { x: 0, y: 0.5 },
    compatibleWith: [],
  }));

  return {
    id:               e.id,
    name:             `${e.vendor ?? ''} ${e.model ?? ''}`.trim(),
    manufacturer:     e.vendor ?? '',
    model:            e.model ?? '',
    category,
    width,
    height,
    color:            '#1F2937',
    frontImage:       e.frontImage  ?? '',
    rearImage:        e.rearImage   ?? '',
    imageAspectRatio: e.imageAspectRatio,
    ports,
    attachmentPoints: [],
    requires:         e.requires ?? [],
    notes:            e.notes ?? '',
    createdAt:        e.createdAt ?? new Date().toISOString(),
    updatedAt:        e.updatedAt ?? new Date().toISOString(),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const raw = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
const exported = Array.isArray(raw) ? raw : raw.assets ?? [];
const transformed = exported.map(transformAsset);

console.log(`Transformed ${transformed.length} assets`);
console.log('Categories:', [...new Set(transformed.map(a => a.category))].join(', '));
console.log('With frontImage:', transformed.filter(a => a.frontImage).length);
console.log('Without image:  ', transformed.filter(a => !a.frontImage).length);

// Write as a localStorage-compatible JSON patch
// The app will pick this up via window.__INJECT_ASSETS in index.html (see below)
fs.writeFileSync(LS_FILE, JSON.stringify(transformed, null, 2));
console.log(`\nWritten to ${LS_FILE}`);
console.log('\nNext: open browser console and run:');
console.log(`  const s = JSON.parse(localStorage.getItem('${STORAGE_KEY}')); s.state.assets = __INJECT; localStorage.setItem('${STORAGE_KEY}', JSON.stringify(s)); location.reload();`);
