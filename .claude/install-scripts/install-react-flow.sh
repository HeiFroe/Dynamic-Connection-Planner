#!/bin/zsh
# install-react-flow.sh — Installiert und konfiguriert @xyflow/react in DCDC
set -e
PROJECT="$HOME/dynamic-connection-planner"
cd "$PROJECT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  React Flow v12 — Installation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "\n[1/4] Installiere @xyflow/react..."
npm install @xyflow/react

echo "\n[2/4] Erstelle Adapter-Datei src/utils/reactFlowAdapter.ts..."
cat > src/utils/reactFlowAdapter.ts << 'TS'
import type { Node, Edge } from '@xyflow/react';
import type { PlacedAsset, Connection } from '../types';
import { LAYER_META } from '../types';

export function assetToNode(placed: PlacedAsset): Node {
  return {
    id: placed.instanceId,
    type: 'dcdc-asset',
    position: { x: placed.x, y: placed.y },
    data: {
      assetId: placed.assetId,
      viewMode: placed.viewMode ?? 'front',
      instanceWidth: placed.instanceWidth,
      instanceHeight: placed.instanceHeight,
    },
  };
}

export function connectionToEdge(conn: Connection): Edge {
  return {
    id: conn.id,
    source: conn.fromInstanceId,
    sourceHandle: conn.fromPortId,
    target: conn.toInstanceId,
    targetHandle: conn.toPortId,
    type: 'smoothstep',
    style: {
      stroke: LAYER_META[conn.layer]?.color ?? '#6B7280',
      strokeWidth: 2,
    },
    data: {
      layer: conn.layer,
      cableAssetId: conn.cableAssetId,
      waypoints: conn.waypoints,
    },
  };
}
TS

echo "\n[3/4] CSS-Import zu src/index.css hinzufügen..."
if ! grep -q "@xyflow/react" src/index.css; then
  echo "@import '@xyflow/react/dist/style.css';" | cat - src/index.css > /tmp/index_tmp.css
  mv /tmp/index_tmp.css src/index.css
  echo "  ✅ CSS-Import hinzugefügt"
else
  echo "  ℹ️  CSS-Import bereits vorhanden"
fi

echo "\n[4/4] TypeScript-Check..."
npx tsc --noEmit 2>&1 | head -20 || true

echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ React Flow installiert!"
echo "  Nächste Schritte (manuell in Claude):"
echo "  → 'Implementiere React Flow Custom Node für DCDC Assets'"
echo "  → Datei: src/utils/reactFlowAdapter.ts ist bereit"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
