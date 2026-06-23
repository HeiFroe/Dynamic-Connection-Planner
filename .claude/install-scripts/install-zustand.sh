#!/bin/zsh
# install-zustand.sh — Installiert zustand + persist middleware
set -e
PROJECT="$HOME/dynamic-connection-planner"
cd "$PROJECT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Zustand — Installation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "\n[1/2] Installiere zustand..."
npm install zustand

echo "\n[2/2] TypeScript-Check..."
npx tsc --noEmit 2>&1 | head -10 || true

echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Zustand installiert!"
echo "  Nächster Schritt (in Claude):"
echo "  → 'Migriere useAppStore.ts auf Zustand mit persist middleware'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
