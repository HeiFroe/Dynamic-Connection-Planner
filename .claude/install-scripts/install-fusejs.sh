#!/bin/zsh
# install-fusejs.sh — Installiert Fuse.js Fuzzy-Search
set -e
PROJECT="$HOME/dynamic-connection-planner"
cd "$PROJECT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Fuse.js — Fuzzy Asset-Suche"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "\n[1/3] Installiere fuse.js..."
npm install fuse.js

echo "\n[2/3] Erstelle src/utils/assetSearch.ts..."
cat > src/utils/assetSearch.ts << 'TS'
import Fuse from 'fuse.js';
import type { Asset } from '../types';

const FUSE_OPTIONS: Fuse.IFuseOptions<Asset> = {
  keys: ['name', 'manufacturer', 'model', 'category'],
  threshold: 0.35,
  minMatchCharLength: 2,
};

export function searchAssets(assets: Asset[], query: string): Asset[] {
  if (!query.trim()) return assets;
  const fuse = new Fuse(assets, FUSE_OPTIONS);
  return fuse.search(query).map(r => r.item);
}
TS

echo "\n[3/3] TypeScript-Check..."
npx tsc --noEmit 2>&1 | head -10 || true

echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Fuse.js installiert!"
echo "  Utility bereit: src/utils/assetSearch.ts"
echo "  Nächster Schritt (in Claude):"
echo "  → 'Füge Suchfeld zum AssetPanel mit Fuse.js hinzu'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
