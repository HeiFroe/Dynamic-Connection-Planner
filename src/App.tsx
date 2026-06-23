import React, { useEffect, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { AssetModule } from './components/assets/AssetModule';
import { BuilderModule } from './components/builder/BuilderModule';
import { SyncStatusBadge } from './components/SyncStatusBadge';
import { ObsidianSettings } from './components/settings/ObsidianSettings';
import { useObsidianSync } from './obsidian/useObsidianSync';
import './index.css';

type Tab = 'builder' | 'assets';

export default function App() {
  const [tab, setTab] = useState<Tab>('builder');
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const {
    state, activePlan,
    saveAsset, deleteAsset, newAsset,
    exportAssetsJSON, importAssetsJSON,
    createPlan, setActivePlan, updatePlan,
    setAppState, getAppState,
  } = useAppStore();

  // Obsidian sync — bidirectional with the vault via Local REST API plugin
  const sync = useObsidianSync(getAppState, setAppState);

  // Notify sync manager on every state change (debounced push)
  useEffect(() => {
    sync.notifyLocalChange();
  }, [state, sync]);

  const handleEditAsset = (assetId: string) => {
    setEditingAssetId(assetId);
    setTab('assets');
  };

  const handleExportHtml = () => {
    if (!activePlan) return;

    // ── Compute bounding box of used canvas area ──────────────────────────
    const PAD = 60; // padding around content
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const inst of activePlan.instances) {
      minX = Math.min(minX, inst.x);
      minY = Math.min(minY, inst.y);
      maxX = Math.max(maxX, inst.x + inst.width);
      maxY = Math.max(maxY, inst.y + inst.height);
    }
    for (const area of activePlan.areas) {
      minX = Math.min(minX, area.x);
      minY = Math.min(minY, area.y);
      maxX = Math.max(maxX, area.x + area.width);
      maxY = Math.max(maxY, area.y + area.height);
    }
    // Fallback if canvas is empty
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 600; }

    const canvasX = Math.max(0, minX - PAD);
    const canvasY = Math.max(0, minY - PAD);
    const canvasW = maxX - minX + PAD * 2;
    const canvasH = maxY - minY + PAD * 2;

    // Embed plan + assets as JSON data — images included as base64
    const data = JSON.stringify({ plan: activePlan, assets: state.assets });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DCDC – ${activePlan.name.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#1e293b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f1f5f9;display:flex;flex-direction:column;height:100vh;overflow:hidden}
header{background:#0f172a;border-bottom:1px solid #334155;padding:8px 16px;display:flex;align-items:center;gap:12px;flex-shrink:0;flex-wrap:wrap}
header h1{font-size:14px;font-weight:700;color:#f1f5f9}
header span{font-size:12px;color:#64748b}
.layer-bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.layer-btn{display:flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;border:1.5px solid;cursor:pointer;font-size:11px;font-weight:600;transition:opacity .15s;user-select:none}
.layer-btn.off{opacity:.35}
.layer-btn .dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.canvas-wrap{flex:1;overflow:hidden;position:relative;cursor:grab}
.canvas-wrap.grabbing{cursor:grabbing}
svg{display:block;width:100%;height:100%}
/* popup */
.popup-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100;display:flex;align-items:center;justify-content:center}
.popup{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px 24px;min-width:300px;max-width:480px;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.5);position:relative}
.popup h2{font-size:15px;font-weight:700;margin-bottom:4px;color:#f1f5f9}
.popup .sub{font-size:12px;color:#94a3b8;margin-bottom:12px}
.popup-close{position:absolute;top:12px;right:14px;background:none;border:none;color:#94a3b8;font-size:20px;cursor:pointer;line-height:1}
.popup-close:hover{color:#f1f5f9}
.popup table{width:100%;border-collapse:collapse;font-size:12px}
.popup table td{padding:4px 6px;border-bottom:1px solid #334155;vertical-align:top}
.popup table td:first-child{color:#94a3b8;white-space:nowrap;padding-right:12px}
.popup table td:last-child{color:#e2e8f0}
.pill{display:inline-block;padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700;color:#fff;margin:1px}
.port-row{display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #1e293b}
.port-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.port-name{font-size:11px;color:#e2e8f0}
.port-meta{font-size:10px;color:#64748b;margin-left:auto}
</style>
</head>
<body>
<header>
  <h1 id="plan-title"></h1>
  <span id="plan-meta"></span>
  <div class="layer-bar" id="layer-bar"></div>
</header>
<div class="canvas-wrap" id="canvas-wrap">
  <svg id="canvas-svg" viewBox="${canvasX} ${canvasY} ${canvasW} ${canvasH}"></svg>
</div>
<div class="popup-overlay" id="popup-overlay" style="display:none" onclick="closePopup()">
  <div class="popup" id="popup" onclick="event.stopPropagation()">
    <button class="popup-close" onclick="closePopup()">✕</button>
    <h2 id="popup-title"></h2>
    <div class="sub" id="popup-sub"></div>
    <div id="popup-body"></div>
  </div>
</div>

<script>
// ── Data ────────────────────────────────────────────────────────────────────
const RAW = ${data};
const plan   = RAW.plan;
const assets = RAW.assets;
const assetMap = new Map(assets.map(a => [a.id, a]));

const LAYER_META = {
  hardware:{ label:'Hardware', color:'#6B7280' },
  video:   { label:'Video',    color:'#3B82F6' },
  usb:     { label:'USB',      color:'#10B981' },
  power:   { label:'Power',    color:'#EF4444' },
  ethernet:{ label:'Ethernet', color:'#F59E0B' },
  other:   { label:'Other',    color:'#A855F7' },
};
const PORT_COLORS = {
  'hdmi':'#2563EB','hdmi-in':'#3B82F6','hdmi-out':'#1D4ED8',
  'rj45':'#F59E0B','rj45-poe':'#D97706',
  'usb-a':'#10B981','usb-b':'#059669','usb-c':'#34D399','usb-micro':'#047857',
  'power':'#EF4444','power-adapter':'#DC2626',
  'logi-micpod':'#A855F7','logi-micpod-in':'#9333EA','logi-micpod-out':'#C084FC',
};
const PORT_TYPE_LABELS = {
  'hdmi':'HDMI','hdmi-in':'HDMI IN','hdmi-out':'HDMI OUT',
  'rj45':'Ethernet','rj45-poe':'Ethernet POE',
  'usb-a':'USB-A','usb-b':'USB-B','usb-c':'USB-C','usb-micro':'MicroUSB',
  'power':'Power','power-adapter':'Power Adapter',
  'logi-micpod':'MicPod','logi-micpod-in':'MicPod IN','logi-micpod-out':'MicPod OUT',
};
const GRID = 20;
const STUB = 28;
const MARGIN = 20;

// ── Layer visibility ─────────────────────────────────────────────────────────
const layerVis = { ...plan.layerVisibility };
const portLabelVis  = { ...(plan.portLabelVisibility  ?? {}) };
const cableLabelVis = { ...(plan.cableLabelVisibility ?? {}) };

// ── Routing helpers ──────────────────────────────────────────────────────────
function portSide(px, py) {
  const d = [px, 1-px, py, 1-py];
  const min = Math.min(...d);
  return ['left','right','top','bottom'][d.indexOf(min)];
}
function stubEnd(pt, side) {
  if (side==='left')   return {x:pt.x-STUB,y:pt.y};
  if (side==='right')  return {x:pt.x+STUB,y:pt.y};
  if (side==='top')    return {x:pt.x,y:pt.y-STUB};
  return {x:pt.x,y:pt.y+STUB};
}
function segHits(ax,ay,bx,by,obs){
  if(Math.abs(ay-by)<0.5){
    const y=ay,x0=Math.min(ax,bx),x1=Math.max(ax,bx);
    return y>obs.y0&&y<obs.y1&&x0<obs.x1&&x1>obs.x0;
  }
  const x=ax,y0=Math.min(ay,by),y1=Math.max(ay,by);
  return x>obs.x0&&x<obs.x1&&y0<obs.y1&&y1>obs.y0;
}
function pathHitsAny(pts,obsList){
  for(let i=0;i<pts.length-1;i++)
    for(const o of obsList)
      if(segHits(pts[i].x,pts[i].y,pts[i+1].x,pts[i+1].y,o)) return true;
  return false;
}
function snapR(v){return Math.round(v/10)*10;}

function routePath(from, to, fromPos, toPos, obstacles){
  const fSide = fromPos ? portSide(fromPos.x,fromPos.y) : 'right';
  const tSide = toPos   ? portSide(toPos.x,toPos.y)    : 'left';
  const A = stubEnd(from,fSide), B = stubEnd(to,tSide);

  // Try simple candidates
  const midX = snapR((A.x+B.x)/2), midY = snapR((A.y+B.y)/2);
  const isFromH = fSide==='left'||fSide==='right';
  const isToH   = tSide==='left'||tSide==='right';
  const topY = Math.min(A.y,B.y)-60, botY = Math.max(A.y,B.y)+60;
  const lftX = Math.min(A.x,B.x)-60, rgtX = Math.max(A.x,B.x)+60;

  const cands = [];
  if(isFromH&&isToH){
    cands.push([A,{x:midX,y:A.y},{x:midX,y:B.y},B]);
    cands.push([A,{x:rgtX,y:A.y},{x:rgtX,y:B.y},B]);
    cands.push([A,{x:A.x,y:topY},{x:B.x,y:topY},B]);
    cands.push([A,{x:A.x,y:botY},{x:B.x,y:botY},B]);
  }else if(!isFromH&&!isToH){
    cands.push([A,{x:A.x,y:midY},{x:B.x,y:midY},B]);
    cands.push([A,{x:lftX,y:A.y},{x:lftX,y:B.y},B]);
    cands.push([A,{x:rgtX,y:A.y},{x:rgtX,y:B.y},B]);
    cands.push([A,{x:A.x,y:topY},{x:B.x,y:topY},B]);
  }else if(isFromH){
    cands.push([A,{x:B.x,y:A.y},B]);
    cands.push([A,{x:A.x,y:midY},{x:B.x,y:midY},B]);
    cands.push([A,{x:A.x,y:topY},{x:B.x,y:topY},B]);
    cands.push([A,{x:A.x,y:botY},{x:B.x,y:botY},B]);
  }else{
    cands.push([A,{x:A.x,y:B.y},B]);
    cands.push([A,{x:midX,y:A.y},{x:midX,y:B.y},B]);
    cands.push([A,{x:lftX,y:A.y},{x:lftX,y:B.y},B]);
    cands.push([A,{x:rgtX,y:A.y},{x:rgtX,y:B.y},B]);
  }

  let best = null, bestLen = Infinity;
  for(const pts of cands){
    const full = [from,...pts,to];
    if(!pathHitsAny(full,obstacles)){
      const len = pathLen(full);
      if(len<bestLen){bestLen=len;best=full;}
    }
  }
  if(best) return simplify(best);

  // BFS fallback
  const xs = new Set([snapR(A.x),snapR(B.x)]);
  const ys = new Set([snapR(A.y),snapR(B.y)]);
  for(const o of obstacles){
    xs.add(snapR(o.x0));xs.add(snapR(o.x1));
    ys.add(snapR(o.y0));ys.add(snapR(o.y1));
  }
  const xA=[...xs].sort((a,b)=>a-b), yA=[...ys].sort((a,b)=>a-b);
  const gx=snapR(A.x),gy=snapR(A.y),ex=snapR(B.x),ey=snapR(B.y);
  const visited=new Map(), queue=[];
  queue.push({x:gx,y:gy,g:0,parent:null});
  visited.set(gx+','+gy,0);
  let found=null;
  let iters=0;
  while(queue.length&&iters++<6000){
    queue.sort((a,b)=>(a.g+Math.abs(a.x-ex)+Math.abs(a.y-ey))-(b.g+Math.abs(b.x-ex)+Math.abs(b.y-ey)));
    const cur=queue.shift();
    if(cur.x===ex&&cur.y===ey){found=cur;break;}
    for(const nx of xA){
      if(nx===cur.x) continue;
      if(!obstacles.some(o=>segHits(cur.x,cur.y,nx,cur.y,o)))
        push(cur,nx,cur.y);
    }
    for(const ny of yA){
      if(ny===cur.y) continue;
      if(!obstacles.some(o=>segHits(cur.x,cur.y,cur.x,ny,o)))
        push(cur,cur.x,ny);
    }
    function push(par,x,y){
      const k=x+','+y, ng=par.g+Math.abs(x-par.x)+Math.abs(y-par.y);
      if((visited.get(k)??Infinity)<=ng) return;
      visited.set(k,ng);
      queue.push({x,y,g:ng,parent:par});
    }
  }
  if(found){
    const pts=[];let n=found;
    while(n){pts.unshift({x:n.x,y:n.y});n=n.parent;}
    return simplify([from,...pts,to]);
  }
  // Last resort
  return simplify([from,A,{x:A.x,y:topY},{x:B.x,y:topY},B,to]);
}

function simplify(pts){
  if(pts.length<=2) return pts;
  const out=[pts[0]];
  for(let i=1;i<pts.length-1;i++){
    const p=out[out.length-1],c=pts[i],n=pts[i+1];
    const col=(Math.abs(p.x-c.x)<0.5&&Math.abs(c.x-n.x)<0.5)||(Math.abs(p.y-c.y)<0.5&&Math.abs(c.y-n.y)<0.5);
    if(!col) out.push(c);
  }
  out.push(pts[pts.length-1]);
  return out;
}

function pathLen(pts){
  let l=0;
  for(let i=0;i<pts.length-1;i++) l+=Math.hypot(pts[i+1].x-pts[i].x,pts[i+1].y-pts[i].y);
  return l;
}

function buildSvgD(pts){
  if(pts.length<2) return '';
  let d=\`M \${r(pts[0].x)} \${r(pts[0].y)}\`;
  for(let i=0;i<pts.length-1;i++){
    const a=pts[i],b=pts[i+1];
    if(Math.abs(a.y-b.y)<0.5) d+=\` H \${r(b.x)}\`;
    else d+=\` V \${r(b.y)}\`;
  }
  return d;
}
function r(v){return Math.round(v*10)/10;}

function pathMid(pts){
  // Place label on the midpoint of the longest straight segment
  if(pts.length<2) return pts[0]??{x:0,y:0};
  let bestSeg=0,bestLen=-1;
  for(let i=0;i<pts.length-1;i++){
    const l=Math.hypot(pts[i+1].x-pts[i].x,pts[i+1].y-pts[i].y);
    if(l>bestLen){bestLen=l;bestSeg=i;}
  }
  return{x:(pts[bestSeg].x+pts[bestSeg+1].x)/2,y:(pts[bestSeg].y+pts[bestSeg+1].y)/2};
}

function getPortPos(inst, portId){
  const asset=assetMap.get(inst.assetId);
  const port=asset?.ports.find(p=>p.id===portId);
  if(port?.position) return{x:inst.x+port.position.x*inst.width,y:inst.y+port.position.y*inst.height};
  const idx=asset?.ports.findIndex(p=>p.id===portId)??0;
  const total=asset?.ports.length??1;
  return{x:inst.x+inst.width,y:inst.y+((idx+1)/(total+1))*inst.height};
}

// ── SVG namespace helper ─────────────────────────────────────────────────────
const NS='http://www.w3.org/2000/svg';
function el(tag,attrs,children){
  const e=document.createElementNS(NS,tag);
  for(const[k,v] of Object.entries(attrs??{})) e.setAttribute(k,v);
  for(const c of children??[]) if(c) e.appendChild(c);
  return e;
}
function txt(tag,attrs,text){
  const e=el(tag,attrs);
  e.textContent=text;
  return e;
}

// ── Render ───────────────────────────────────────────────────────────────────
const svg=document.getElementById('canvas-svg');
const CANVAS_X=${canvasX},CANVAS_Y=${canvasY},CANVAS_W=${canvasW},CANVAS_H=${canvasH};

function render(){
  while(svg.firstChild) svg.removeChild(svg.firstChild);

  // Background
  svg.appendChild(el('rect',{x:CANVAS_X,y:CANVAS_Y,width:CANVAS_W,height:CANVAS_H,fill:'#1e293b'}));
  const defs=el('defs');
  const pat=el('pattern',{id:'grid',width:20,height:20,patternUnits:'userSpaceOnUse'});
  pat.appendChild(el('path',{d:'M 20 0 L 0 0 0 20',fill:'none',stroke:'#334155','stroke-width':'0.5'}));
  defs.appendChild(pat);
  svg.appendChild(defs);
  svg.appendChild(el('rect',{x:CANVAS_X,y:CANVAS_Y,width:CANVAS_W,height:CANVAS_H,fill:'url(#grid)'}));

  // Areas
  for(const area of plan.areas){
    const col=area.color??'#ffffff';
    svg.appendChild(el('rect',{x:area.x,y:area.y,width:area.width,height:area.height,fill:col+'18',stroke:col,'stroke-width':2,'stroke-dasharray':'8 4',rx:4}));
    svg.appendChild(txt('text',{x:area.x+8,y:area.y+18,fill:col,'font-size':12,opacity:0.9},area.name));
  }

  // Build obstacle list (for routing)
  const obstacles=plan.instances.map(i=>({
    x0:i.x-MARGIN,y0:i.y-MARGIN,x1:i.x+i.width+MARGIN,y1:i.y+i.height+MARGIN
  }));
  const instObsIdx=new Map(plan.instances.map((inst,idx)=>[inst.instanceId,idx]));

  // Connections
  for(let ci=0;ci<plan.connections.length;ci++){
    const conn=plan.connections[ci];
    if(layerVis[conn.layer]===false) continue;
    const fromInst=plan.instances.find(i=>i.instanceId===conn.fromInstanceId);
    const toInst  =plan.instances.find(i=>i.instanceId===conn.toInstanceId);
    if(!fromInst||!toInst) continue;

    const fromAsset=assetMap.get(fromInst.assetId);
    const toAsset  =assetMap.get(toInst.assetId);
    const fromPort =fromAsset?.ports.find(p=>p.id===conn.fromPortId);
    const toPort   =toAsset?.ports.find(p=>p.id===conn.toPortId);

    const from=getPortPos(fromInst,conn.fromPortId);
    const to  =getPortPos(toInst,  conn.toPortId);

    // Exclude own assets from obstacle list
    const fi=instObsIdx.get(conn.fromInstanceId);
    const ti=instObsIdx.get(conn.toInstanceId);
    const obsForRoute=obstacles.filter((_,i)=>i!==fi&&i!==ti);

    let pts;
    if(conn.waypoints&&conn.waypoints.length>0){
      pts=simplify([from,...conn.waypoints,to]);
    }else{
      pts=routePath(from,to,fromPort?.position,toPort?.position,obsForRoute);
    }

    const color=(LAYER_META[conn.layer]?.color)??'#6B7280';
    const pathD=buildSvgD(pts);
    const mid=pathMid(pts);
    const cableLabel=conn.isDirect?'DIRECT':(fromPort?(PORT_TYPE_LABELS[fromPort.standard]??fromPort.standard):'');

    // Visible line
    const line=el('path',{d:pathD,fill:'none',stroke:color,'stroke-width':'1.5',opacity:'0.95','pointer-events':'none'});
    svg.appendChild(line);

    // Hit area (clickable)
    const hit=el('path',{d:pathD,fill:'none',stroke:'transparent','stroke-width':'14',cursor:'pointer'});
    hit.addEventListener('click',e=>{e.stopPropagation();showConnPopup(conn,fromPort,toPort,fromAsset,toAsset,color,cableLabel);});
    hit.addEventListener('mouseenter',()=>line.setAttribute('stroke-width','2.5'));
    hit.addEventListener('mouseleave',()=>line.setAttribute('stroke-width','1.5'));
    svg.appendChild(hit);

    // Cable label
    if(cableLabelVis[conn.layer]!==false&&cableLabel){
      const lw=Math.max(44,cableLabel.length*6+16);
      svg.appendChild(el('rect',{x:mid.x-lw/2,y:mid.y-9,width:lw,height:14,rx:3,fill:color,opacity:'0.95','pointer-events':'none'}));
      svg.appendChild(txt('text',{x:mid.x,y:mid.y+1,'text-anchor':'middle',fill:'white','font-size':'8','font-weight':'600','pointer-events':'none'},cableLabel));
    }
  }

  // Assets
  for(const inst of plan.instances){
    const asset=assetMap.get(inst.assetId);
    if(!asset) continue;
    const cx=inst.x+inst.width/2,cy=inst.y+inst.height/2;
    const showImage=layerVis['hardware']!==false;
    const showName =portLabelVis['hardware']!==false;

    const g=el('g',{cursor:'pointer'});
    g.addEventListener('click',e=>{e.stopPropagation();showAssetPopup(inst,asset);});

    if(asset.frontImage&&showImage){
      g.appendChild(el('image',{href:asset.frontImage,x:inst.x,y:inst.y,width:inst.width,height:inst.height,preserveAspectRatio:'xMidYMid meet'}));
    }else{
      g.appendChild(el('rect',{x:inst.x,y:inst.y,width:inst.width,height:inst.height,fill:showImage?'#F59E0B':'#334155',stroke:showImage?'#D97706':'#475569','stroke-width':1,rx:4}));
      const vLabel=asset.vendor+' '+asset.model;
      const e1=txt('text',{x:cx,y:cy-6,'text-anchor':'middle',fill:showImage?'#1F2937':'#94a3b8','font-size':'11','font-weight':'600','pointer-events':'none'},asset.vendor);
      const e2=txt('text',{x:cx,y:cy+8,'text-anchor':'middle',fill:showImage?'#1F2937':'#94a3b8','font-size':'10','pointer-events':'none'},asset.model);
      g.appendChild(e1);g.appendChild(e2);
    }

    // Asset name below image
    if(asset.frontImage&&showImage&&showName){
      g.appendChild(txt('text',{x:cx,y:inst.y+inst.height+12,'text-anchor':'middle',fill:'white','font-size':'10',opacity:'0.8','pointer-events':'none'},asset.vendor+' '+asset.model));
    }

    // Port dots
    for(const port of asset.ports){
      if(layerVis[port.layer]===false) continue;
      const pos=getPortPos(inst,port.id);
      const color=PORT_COLORS[port.standard]??'#9CA3AF';
      const pg=el('g',{cursor:'crosshair','pointer-events':'none'});
      pg.appendChild(el('circle',{cx:pos.x,cy:pos.y,r:6,fill:color,stroke:'rgba(0,0,0,0.3)','stroke-width':1}));
      if(portLabelVis[port.layer]!==false){
        pg.appendChild(txt('text',{x:pos.x+9,y:pos.y+4,fill:'white','font-size':'9',opacity:'0.75','pointer-events':'none'},port.name));
      }
      const title=document.createElementNS(NS,'title');
      title.textContent=port.name+' ('+port.maleFemale+')';
      pg.appendChild(title);
      g.appendChild(pg);
    }

    svg.appendChild(g);
  }
}

// ── Popups ───────────────────────────────────────────────────────────────────
function showAssetPopup(inst,asset){
  document.getElementById('popup-title').textContent=asset.vendor+' '+asset.model;
  document.getElementById('popup-sub').textContent='#'+asset.dbNumber;

  let body='';

  // Product page link
  if(asset.productPage) body+=\`<div style="margin-bottom:8px"><a href="\${esc(asset.productPage)}" target="_blank" style="color:#60a5fa;font-size:12px;text-decoration:underline">🔗 Product page</a></div>\`;

  // Part number + notes
  if(asset.partNumber||asset.notes){
    body+='<table style="margin-bottom:8px">';
    if(asset.partNumber) body+=row('Part #',esc(asset.partNumber));
    body+='</table>';
  }
  if(asset.notes) body+=\`<div style="font-size:12px;color:#94a3b8;margin-bottom:10px;padding:8px;background:#0f172a;border-radius:6px">\${esc(asset.notes)}</div>\`;

  // Ports — with connected/not connected status
  if(asset.ports.length>0){
    body+='<div style="font-size:11px;color:#64748b;margin:10px 0 4px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Ports</div>';
    for(const p of asset.ports){
      const col=PORT_COLORS[p.standard]??'#9CA3AF';
      // Check if this port is connected in the current plan
      const isConnected=plan.instances.some(i=>i.instanceId===inst.instanceId&&
        plan.connections.some(c=>(c.fromInstanceId===inst.instanceId&&c.fromPortId===p.id)||(c.toInstanceId===inst.instanceId&&c.toPortId===p.id)));
      const connStatus=isConnected
        ? \`<span style="font-size:9px;background:#16a34a;color:white;padding:1px 5px;border-radius:8px;flex-shrink:0">Connected</span>\`
        : \`<span style="font-size:9px;background:#334155;color:#94a3b8;padding:1px 5px;border-radius:8px;flex-shrink:0">Free</span>\`;
      body+=\`<div class="port-row">
        <span class="port-dot" style="background:\${col}"></span>
        <span class="port-name">\${esc(p.name)}</span>
        <span class="port-meta">\${PORT_TYPE_LABELS[p.standard]??p.standard} · \${p.maleFemale}</span>
        \${connStatus}
      </div>\`;
    }
  }

  document.getElementById('popup-body').innerHTML=body;
  document.getElementById('popup-overlay').style.display='flex';
}

function showConnPopup(conn,fromPort,toPort,fromAsset,toAsset,color,cableLabel){
  document.getElementById('popup-title').textContent=conn.isDirect?'Direct Connect':'Connection';
  document.getElementById('popup-sub').textContent=(fromAsset?.vendor??'')+' '+(fromAsset?.model??'')+' → '+(toAsset?.vendor??'')+' '+(toAsset?.model??'');

  let body='';

  if(conn.isDirect){
    body+=\`<div style="display:flex;align-items:center;gap:10px;padding:10px;background:#052e16;border:1px solid #16a34a;border-radius:8px;margin-bottom:10px">
      <span style="font-size:20px">🔗</span>
      <div><div style="font-size:13px;font-weight:700;color:#4ade80">Direct Connect</div>
      <div style="font-size:11px;color:#86efac">Plug directly into socket — no cable needed</div></div>
    </div>\`;
  } else {
    // Find cable asset(s) that match this connection
    const cableAssets=assets.filter(a=>a.category==='cable'&&a.ports.some(p=>
      p.standard===fromPort?.standard||p.standard===(PORT_TYPE_LABELS[fromPort?.standard]??'').toLowerCase()
    ));
    if(cableAssets.length>0){
      for(const ca of cableAssets.slice(0,3)){
        const img=ca.frontImage?\`<img src="\${ca.frontImage}" style="width:48px;height:48px;object-fit:contain;border-radius:4px;background:#1e293b;flex-shrink:0">\`:\`<div style="width:48px;height:48px;background:#334155;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">🔌</div>\`;
        const link=ca.productPage?\`<a href="\${esc(ca.productPage)}" target="_blank" style="color:#60a5fa;font-size:11px;text-decoration:underline">Product page</a>\`:'';
        const part=ca.partNumber?\`<div style="font-size:10px;color:#64748b">Part: \${esc(ca.partNumber)}</div>\`:'';
        body+=\`<div style="display:flex;align-items:center;gap:10px;padding:8px;background:#1e293b;border-radius:8px;margin-bottom:6px">
          \${img}
          <div>
            <div style="font-size:13px;font-weight:600;color:#f1f5f9">\${esc(ca.vendor)} \${esc(ca.model)}</div>
            \${part}
            \${ca.notes?'<div style="font-size:10px;color:#94a3b8;margin-top:2px">'+esc(ca.notes)+'</div>':''}
            \${link}
          </div>
        </div>\`;
      }
    } else {
      body+=\`<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:\${color}22;border:1px solid \${color}66;border-radius:8px;margin-bottom:10px">
        <span class="pill" style="background:\${color}">\${esc(cableLabel)}</span>
        <span style="font-size:12px;color:#e2e8f0">Cable</span>
      </div>\`;
    }
  }

  document.getElementById('popup-body').innerHTML=body;
  document.getElementById('popup-overlay').style.display='flex';
}

function row(label,val){return\`<tr><td>\${label}</td><td>\${val}</td></tr>\`;}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function closePopup(){document.getElementById('popup-overlay').style.display='none';}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePopup();});

// ── Layer bar ────────────────────────────────────────────────────────────────
const ALL_LAYERS=['hardware','video','usb','power','ethernet','other'];
const layerBar=document.getElementById('layer-bar');

for(const layer of ALL_LAYERS){
  const meta=LAYER_META[layer];
  const btn=document.createElement('div');
  btn.className='layer-btn'+(layerVis[layer]===false?' off':'');
  btn.innerHTML=\`<span class="dot" style="background:\${meta.color}"></span>\${meta.label}\`;
  btn.style.borderColor=meta.color;
  btn.style.color=meta.color;
  btn.addEventListener('click',()=>{
    layerVis[layer]=layerVis[layer]===false?true:false;
    btn.classList.toggle('off',layerVis[layer]===false);
    render();
  });
  layerBar.appendChild(btn);
}

// ── Header ───────────────────────────────────────────────────────────────────
document.getElementById('plan-title').textContent=plan.name;
document.getElementById('plan-meta').textContent=
  plan.instances.length+' Assets · '+plan.connections.length+' Connections · '+plan.areas.length+' Areas';

// ── Pan & Zoom ───────────────────────────────────────────────────────────────
let vb={x:CANVAS_X,y:CANVAS_Y,w:CANVAS_W,h:CANVAS_H};
let panning=false,panStart={mx:0,my:0,vx:0,vy:0};
const wrap=document.getElementById('canvas-wrap');

function applyVB(){svg.setAttribute('viewBox',\`\${vb.x} \${vb.y} \${vb.w} \${vb.h}\`);}

wrap.addEventListener('mousedown',e=>{
  if(e.target.closest('[cursor="pointer"]')) return;
  panning=true;wrap.classList.add('grabbing');
  panStart={mx:e.clientX,my:e.clientY,vx:vb.x,vy:vb.y};
});
window.addEventListener('mousemove',e=>{
  if(!panning) return;
  const rect=wrap.getBoundingClientRect();
  vb.x=panStart.vx-(e.clientX-panStart.mx)*(vb.w/rect.width);
  vb.y=panStart.vy-(e.clientY-panStart.my)*(vb.h/rect.height);
  applyVB();
});
window.addEventListener('mouseup',()=>{panning=false;wrap.classList.remove('grabbing');});

wrap.addEventListener('wheel',e=>{
  e.preventDefault();
  const rect=wrap.getBoundingClientRect();
  const px=vb.x+(e.clientX-rect.left)*(vb.w/rect.width);
  const py=vb.y+(e.clientY-rect.top)*(vb.h/rect.height);
  const f=e.deltaY>0?1.1:0.9;
  const nw=Math.max(200,Math.min(CANVAS_W*2,vb.w*f));
  const nh=Math.max(150,Math.min(CANVAS_H*2,vb.h*f));
  vb={x:px-(px-vb.x)*(nw/vb.w),y:py-(py-vb.y)*(nh/vb.h),w:nw,h:nh};
  applyVB();
},{passive:false});

// Touch support
let lastTouchDist=0;
wrap.addEventListener('touchstart',e=>{
  if(e.touches.length===2) lastTouchDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
  else if(e.touches.length===1){panning=true;panStart={mx:e.touches[0].clientX,my:e.touches[0].clientY,vx:vb.x,vy:vb.y};}
},{passive:true});
wrap.addEventListener('touchmove',e=>{
  if(e.touches.length===2){
    const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    const f=lastTouchDist/d;
    vb.w=Math.max(400,Math.min(CANVAS_W,vb.w*f));
    vb.h=Math.max(300,Math.min(CANVAS_H,vb.h*f));
    lastTouchDist=d; applyVB();
  }else if(e.touches.length===1&&panning){
    const rect=wrap.getBoundingClientRect();
    vb.x=panStart.vx-(e.touches[0].clientX-panStart.mx)*(vb.w/rect.width);
    vb.y=panStart.vy-(e.touches[0].clientY-panStart.my)*(vb.h/rect.height);
    applyVB();
  }
},{passive:true});
wrap.addEventListener('touchend',()=>{panning=false;});

// Initial viewBox already fitted to content (computed server-side)
function fitToContent(){
  vb={x:CANVAS_X,y:CANVAS_Y,w:CANVAS_W,h:CANVAS_H};
  applyVB();
}

// ── Init ─────────────────────────────────────────────────────────────────────
render();
fitToContent();
</script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `${activePlan.name.replace(/\s+/g, '_')}.html`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f1f5f9' }}>
      <header className="bg-gray-900 text-white px-6 py-2 flex items-center gap-4 border-b border-gray-700 flex-shrink-0">
        <span className="font-bold text-sm tracking-tight whitespace-nowrap">DCDC</span>
        <span className="text-gray-500 text-xs hidden sm:block">Dynamic Connection Diagram Creator</span>

        <nav className="flex gap-1">
          {(['builder', 'assets'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1 rounded text-sm font-medium transition-colors ${
                tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {t === 'builder' ? 'Builder' : 'Assets'}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        {tab === 'builder' && (
          <div className="flex items-center gap-2">
            <select
              value={activePlan?.id ?? ''}
              onChange={e => setActivePlan(e.target.value)}
              className="border border-gray-600 rounded bg-gray-800 text-white text-sm px-2 py-0.5 focus:ring-1 ring-blue-400 outline-none"
            >
              {state.plans.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={() => { const n = window.prompt('Plan name:', 'New Plan'); if (n) createPlan(n); }}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-2 py-1 rounded"
            >
              + Plan
            </button>
          </div>
        )}

        <span className="text-xs text-gray-500">{state.assets.length} assets · {state.plans.length} plans</span>

        <SyncStatusBadge
          status={sync.status}
          lastError={sync.lastError}
          lastSyncAt={sync.lastSyncAt}
          onClick={() => setShowSettings(true)}
        />

        <button
          onClick={() => setShowSettings(true)}
          className="text-gray-400 hover:text-white text-base leading-none px-1.5"
          title="Obsidian sync settings"
        >⚙</button>
      </header>

      <main style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tab === 'assets' ? (
          <AssetModule
            assets={state.assets}
            onSave={saveAsset}
            onDelete={deleteAsset}
            onExport={exportAssetsJSON}
            onImport={importAssetsJSON}
            onNew={newAsset}
            initialEditId={editingAssetId}
          />
        ) : activePlan ? (
          <BuilderModule
            plan={activePlan}
            assets={state.assets}
            onUpdate={updatePlan}
            onUpdateAsset={(assetId, patch) => {
              const asset = state.assets.find(a => a.id === assetId);
              if (asset) saveAsset({ ...asset, ...patch });
            }}
            onExport={handleExportHtml}
            onEditAsset={handleEditAsset}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 flex-col gap-4">
            <p>No plan available.</p>
            <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700" onClick={() => createPlan('Plan 1')}>
              Create new plan
            </button>
          </div>
        )}
      </main>

      {showSettings && (
        <ObsidianSettings
          config={sync.config}
          onConfigChange={sync.setConfig}
          status={sync.status}
          lastError={sync.lastError}
          lastSyncAt={sync.lastSyncAt}
          onSyncNow={async () => { await sync.syncNow(); }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
