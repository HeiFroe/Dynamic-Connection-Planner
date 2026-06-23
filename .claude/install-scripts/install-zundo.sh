#!/bin/zsh
# install-zundo.sh — Installiert zundo (Undo/Redo für Zustand)
set -e
PROJECT="$HOME/dynamic-connection-planner"
cd "$PROJECT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Zundo (Undo/Redo) — Installation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Zustand ist Voraussetzung
if ! grep -q '"zustand"' package.json; then
  echo "⚠️  Zustand ist nicht installiert — wird zuerst installiert..."
  npm install zustand
fi

echo "\n[1/2] Installiere zundo..."
npm install zundo

echo "\n[2/2] TypeScript-Check..."
npx tsc --noEmit 2>&1 | head -10 || true

echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Zundo installiert!"
echo "  Nächster Schritt (in Claude):"
echo "  → 'Füge Zundo temporal middleware zum AppStore hinzu und verdrahte Ctrl+Z / Ctrl+Y'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
