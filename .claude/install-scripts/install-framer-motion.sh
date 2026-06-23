#!/bin/zsh
# install-framer-motion.sh — Installiert framer-motion Animationen
set -e
PROJECT="$HOME/dynamic-connection-planner"
cd "$PROJECT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  framer-motion — Animationen"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "\n[1/2] Installiere framer-motion..."
npm install framer-motion

echo "\n[2/2] TypeScript-Check..."
npx tsc --noEmit 2>&1 | head -10 || true

echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ framer-motion installiert!"
echo "  Nächster Schritt (in Claude):"
echo "  → 'Füge framer-motion Einblend-Animationen zu CanvasAsset und Dialogen hinzu'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
