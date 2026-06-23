import { Plan, Asset, LAYER_META, PORT_COLORS } from '../types';

export function generateExportHTML(plan: Plan, assets: Asset[]): string {
  const assetMap = Object.fromEntries(assets.map(a => [a.id, a]));
  const planJson = JSON.stringify({ plan, assetMap });

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(plan.name)} — Connection Plan</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0f172a;color:#f1f5f9;height:100vh;display:flex;flex-direction:column}
header{padding:12px 20px;background:#1e293b;border-bottom:1px solid #334155;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
header h1{font-size:1.1rem;font-weight:600}
.layers{display:flex;gap:8px;flex-wrap:wrap}
.layer-btn{border:none;border-radius:4px;padding:4px 12px;font-size:.75rem;font-weight:600;cursor:pointer;opacity:0.4;transition:opacity .15s}
.layer-btn.active{opacity:1}
#canvas-wrap{flex:1;overflow:hidden;position:relative;cursor:grab}
#canvas-wrap.grabbing{cursor:grabbing}
#canvas{position:absolute;transform-origin:0 0}
.asset{position:absolute;border-radius:6px;display:flex;align-items:center;justify-content:center;user-select:none;box-shadow:0 2px 8px rgba(0,0,0,.4)}
.asset-label{font-size:.65rem;font-weight:600;color:#f1f5f9;text-align:center;padding:2px 4px;pointer-events:none;line-height:1.2}
.asset img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;border-radius:6px;pointer-events:none}
.port-dot{position:absolute;width:10px;height:10px;border-radius:50%;border:2px solid #fff;transform:translate(-50%,-50%);cursor:default;z-index:10}
.port-dot:hover .port-tip{display:block}
.port-tip{display:none;position:absolute;bottom:14px;left:50%;transform:translateX(-50%);background:#1e293b;border:1px solid #475569;color:#e2e8f0;font-size:.7rem;padding:3px 7px;border-radius:4px;white-space:nowrap;pointer-events:none;z-index:100}
svg#connections{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.conn-line{stroke-width:2;fill:none;opacity:0.9}
.conn-label{font-size:10px;font-weight:600;fill:#1f2937;stroke:white;stroke-width:3px;paint-order:stroke}
.zoom-btns{position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column;gap:6px}
.zoom-btn{width:32px;height:32px;border:none;border-radius:6px;background:#334155;color:#f1f5f9;font-size:1rem;cursor:pointer}
.zoom-btn:hover{background:#475569}
</style>
</head>
<body>
<header>
  <h1 id="plan-title"></h1>
  <div class="layers" id="layer-controls"></div>
</header>
<div id="canvas-wrap">
  <div id="canvas">
    <svg id="connections"></svg>
  </div>
</div>
<div class="zoom-btns">
  <button class="zoom-btn" onclick="zoom(1.2)">+</button>
  <button class="zoom-btn" onclick="zoom(0.833)">−</button>
  <button class="zoom-btn" onclick="resetView()" title="Reset">⌂</button>
</div>
<script>
const DATA = ${planJson};
const LAYER_META = ${JSON.stringify(LAYER_META)};
const PORT_COLORS = ${JSON.stringify(PORT_COLORS)};

const plan = DATA.plan;
const assetMap = DATA.assetMap;
let scale = 1, tx = 40, ty = 40;
let activeLayer = Object.fromEntries(Object.entries(plan.layerVisibility));
let dragging = false, lastX = 0, lastY = 0;

const canvasWrap = document.getElementById('canvas-wrap');
const canvas = document.getElementById('canvas');
const svg = document.getElementById('connections');
document.getElementById('plan-title').textContent = plan.name;

function applyTransform() {
  canvas.style.transform = \`translate(\${tx}px,\${ty}px) scale(\${scale})\`;
}
function zoom(factor) {
  scale = Math.min(3, Math.max(0.2, scale * factor));
  applyTransform();
}
function resetView() { scale = 1; tx = 40; ty = 40; applyTransform(); }

canvasWrap.addEventListener('mousedown', e => {
  if (e.target === canvasWrap || e.target === canvas || e.target === svg) {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    canvasWrap.classList.add('grabbing');
  }
});
window.addEventListener('mousemove', e => {
  if (!dragging) return;
  tx += e.clientX - lastX; ty += e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  applyTransform();
});
window.addEventListener('mouseup', () => { dragging = false; canvasWrap.classList.remove('grabbing'); });
canvasWrap.addEventListener('wheel', e => {
  e.preventDefault();
  zoom(e.deltaY < 0 ? 1.1 : 0.91);
}, { passive: false });

// Layer toggles
const layerCtrl = document.getElementById('layer-controls');
Object.entries(LAYER_META).forEach(([id, meta]) => {
  const btn = document.createElement('button');
  btn.className = 'layer-btn' + (activeLayer[id] ? ' active' : '');
  btn.textContent = meta.label;
  btn.style.background = meta.color;
  btn.style.color = '#fff';
  btn.dataset.layer = id;
  btn.onclick = () => {
    activeLayer[id] = !activeLayer[id];
    btn.classList.toggle('active', activeLayer[id]);
    renderConnections();
    renderPortDots();
  };
  layerCtrl.appendChild(btn);
});

// Render assets
plan.instances.forEach(inst => {
  const asset = assetMap[inst.assetId];
  if (!asset) return;
  const el = document.createElement('div');
  el.className = 'asset';
  el.id = 'inst-' + inst.instanceId;
  const hasImg = asset.frontImage || asset.rearImage;
  el.style.cssText = \`left:\${inst.x}px;top:\${inst.y}px;width:\${asset.width}px;height:\${asset.height}px;background:\${hasImg ? 'transparent' : asset.color}\`;
  if (hasImg) {
    const displaySrc = inst.viewMode === 'rear' ? (asset.rearImage || asset.frontImage) : (asset.frontImage || asset.rearImage);
    const img = document.createElement('img');
    img.src = displaySrc;
    img.alt = asset.name;
    el.appendChild(img);
    // subtle color bg for transparent PNGs
    el.style.background = asset.color;
    el.style.opacity = '1';
    img.style.position = 'absolute';
    img.style.inset = '0';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.borderRadius = '6px';
  } else {
    const lbl = document.createElement('div');
    lbl.className = 'asset-label';
    lbl.textContent = asset.manufacturer + ' ' + asset.name;
    el.appendChild(lbl);
  }
  canvas.appendChild(el);
});

function renderPortDots() {
  document.querySelectorAll('.port-dot').forEach(e => e.remove());
  plan.instances.forEach(inst => {
    const asset = assetMap[inst.assetId];
    if (!asset) return;
    const el = document.getElementById('inst-' + inst.instanceId);
    if (!el) return;
    asset.ports.forEach(port => {
      if (!activeLayer[port.layer]) return;
      const dot = document.createElement('div');
      dot.className = 'port-dot';
      dot.style.cssText = \`left:\${port.position.x * 100}%;top:\${port.position.y * 100}%;background:\${PORT_COLORS[port.type] || '#888'}\`;
      const tip = document.createElement('div');
      tip.className = 'port-tip';
      tip.textContent = port.label;
      dot.appendChild(tip);
      el.appendChild(dot);
    });
  });
}

// Orthogonal routing
const STUB = 24, R = 8;
function getExitDir(px, py) {
  if (py <= 0.15) return 'top';
  if (py >= 0.85) return 'bottom';
  if (px <= 0.15) return 'left';
  if (px >= 0.85) return 'right';
  return 'bottom';
}
function getStub(inst, port) {
  const cx = inst.x + port.position.x * assetMap[inst.assetId].width;
  const cy = inst.y + port.position.y * assetMap[inst.assetId].height;
  const dir = getExitDir(port.position.x, port.position.y);
  return {
    cx, cy,
    ex: cx + (dir==='right'?STUB : dir==='left'?-STUB:0),
    ey: cy + (dir==='bottom'?STUB : dir==='top'?-STUB:0),
  };
}
function f(n) { return n.toFixed(1); }
function buildOrtho(center1, exit1, exit2, center2, waypoints) {
  const pts = [exit1, ...(waypoints||[]), exit2];
  let d = \`M\${f(center1.x)},\${f(center1.y)} L\${f(exit1.x)},\${f(exit1.y)}\`;
  for (let i = 0; i < pts.length-1; i++) {
    const a = pts[i], b = pts[i+1];
    const dx = b.x-a.x, dy = b.y-a.y;
    if (Math.abs(dx)<1 || Math.abs(dy)<1) { d+=\` L\${f(b.x)},\${f(b.y)}\`; continue; }
    const r = Math.min(R, Math.abs(dx)/2, Math.abs(dy)/2);
    const sx = dx>0?1:-1, sy = dy>0?1:-1;
    const cx = b.x, cy = a.y;
    d += \` L\${f(cx-sx*r)},\${f(cy)} Q\${f(cx)},\${f(cy)} \${f(cx)},\${f(cy+sy*r)} L\${f(b.x)},\${f(b.y)}\`;
  }
  d += \` L\${f(center2.x)},\${f(center2.y)}\`;
  return d;
}

function renderConnections() {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  plan.connections.forEach(conn => {
    if (!activeLayer[conn.layer]) return;
    const fromInst = plan.instances.find(i => i.instanceId === conn.fromInstanceId);
    const toInst   = plan.instances.find(i => i.instanceId === conn.toInstanceId);
    if (!fromInst || !toInst) return;
    const fromAsset = assetMap[fromInst.assetId];
    const toAsset   = assetMap[toInst.assetId];
    if (!fromAsset || !toAsset) return;
    const fromPort = fromAsset.ports.find(p => p.id === conn.fromPortId);
    const toPort   = toAsset.ports.find(p => p.id === conn.toPortId);
    if (!fromPort || !toPort) return;

    const fs = getStub(fromInst, fromPort);
    const ts = getStub(toInst, toPort);
    const pathD = buildOrtho(
      {x:fs.cx,y:fs.cy},{x:fs.ex,y:fs.ey},
      {x:ts.ex,y:ts.ey},{x:ts.cx,y:ts.cy},
      conn.waypoints||[]
    );

    const isLegacy = !conn.cableAssetId || conn.cableAssetId === '__legacy__';
    const color = LAYER_META[conn.layer]?.color || '#888';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('stroke', isLegacy ? '#6b7280' : color);
    if (isLegacy) path.setAttribute('stroke-dasharray','6 4');
    path.setAttribute('class', 'conn-line');
    svg.appendChild(path);

    if (!isLegacy && assetMap[conn.cableAssetId]) {
      const midX = (fs.ex + ts.ex) / 2;
      const midY = (fs.ey + ts.ey) / 2;
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', midX);
      txt.setAttribute('y', midY);
      txt.setAttribute('text-anchor','middle');
      txt.setAttribute('dominant-baseline','middle');
      txt.setAttribute('class','conn-label');
      txt.textContent = assetMap[conn.cableAssetId].name;
      svg.appendChild(txt);
    }
  });
}

renderPortDots();
renderConnections();
applyTransform();
</script>
</body>
</html>`;
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function downloadHTML(plan: Plan, assets: Asset[]) {
  const html = generateExportHTML(plan, assets);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${plan.name.replace(/[^a-zA-Z0-9_\- ]/g, '_')}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
