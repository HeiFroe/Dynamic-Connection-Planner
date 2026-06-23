import React, { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
} from '@dnd-kit/core';
import { Plan, Asset, Layer, PlacedAsset, RoutingConfig, DEFAULT_ROUTING_CONFIG } from '../../types';
import { AssetPanel } from './AssetPanel';
import { Canvas, CanvasHandle } from './Canvas';
import { LayerControls } from './LayerControls';
import { RoutingConfigPanel } from './RoutingConfigPanel';
import { Button } from '../ui';
import { downloadHTML, exportToPDF } from '../../utils/htmlExport';

interface Props {
  plan: Plan;
  allPlans: Plan[];
  assets: Asset[];
  onUpdatePlan: (plan: Plan) => void;
  onCreatePlan: (name: string) => void;
  onSetActivePlan: (id: string) => void;
  onDeletePlan: (id: string) => void;
  onRenamePlan: (id: string, name: string) => void;
  onEditAsset: (assetId: string) => void;
  onUpdateRoutingConfig: (config: Partial<RoutingConfig>) => void;
}

export function Creator({
  plan, allPlans, assets, onUpdatePlan, onCreatePlan,
  onSetActivePlan, onDeletePlan, onRenamePlan, onEditAsset,
  onUpdateRoutingConfig,
}: Props) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(plan.name);
  const [showPlanMenu, setShowPlanMenu] = useState(false);
  const [showRoutingPanel, setShowRoutingPanel] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [renamingPlanId, setRenamingPlanId] = useState<string | null>(null);
  const [renamingVal, setRenamingVal] = useState('');
  const [draggedAssetId, setDraggedAssetId] = useState<string | null>(null);
  const [obsidianSynced, setObsidianSynced] = useState<'checking' | 'ok' | 'error'>('checking');

  // Obsidian REST API connectivity check
  useEffect(() => {
    const check = () => {
      fetch('http://localhost:27123/', { method: 'GET', signal: AbortSignal.timeout(2000) })
        .then(r => setObsidianSynced(r.ok || r.status === 401 ? 'ok' : 'error'))
        .catch(() => setObsidianSynced('error'));
    };
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, []);

  // Ref to canvas so we can read viewport transform when computing drop coords
  const canvasHandle = useRef<CanvasHandle>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = (event: DragStartEvent) => {
    const assetId = event.active.data.current?.assetId as string | undefined;
    setDraggedAssetId(assetId ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedAssetId(null);
    const { active, over } = event;
    if (!over || over.id !== 'canvas-drop') return;

    const assetId = active.data.current?.assetId as string | undefined;
    if (!assetId) return;

    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;

    const activatorEvent = event.activatorEvent as MouseEvent;
    const vp = canvasHandle.current?.getViewport() ?? { offset: { x: 0, y: 0 }, scale: 1 };
    const canvasRect = canvasWrapRef.current?.getBoundingClientRect();

    let x = 100, y = 100;
    if (canvasRect) {
      // Final client position = where the drag started + how far it moved
      const finalClientX = activatorEvent.clientX + event.delta.x;
      const finalClientY = activatorEvent.clientY + event.delta.y;
      // Convert to canvas-space coordinates
      x = (finalClientX - canvasRect.left - vp.offset.x) / vp.scale - asset.width / 2;
      y = (finalClientY - canvasRect.top  - vp.offset.y) / vp.scale - asset.height / 2;
      x = Math.max(0, x);
      y = Math.max(0, y);
    }

    // Spawn requires-assets alongside the main asset
    const mainInstances: PlacedAsset[] = [{ instanceId: crypto.randomUUID(), assetId, x, y }];
    let reqOffsetX = asset.width + 40;
    for (const reqId of (asset.requires ?? [])) {
      const reqAsset = assets.find(a => a.id === reqId);
      if (!reqAsset) continue;
      mainInstances.push({ instanceId: crypto.randomUUID(), assetId: reqId, x: x + reqOffsetX, y });
      reqOffsetX += reqAsset.width + 20;
    }
    onUpdatePlan({ ...plan, instances: [...plan.instances, ...mainInstances] });
  };

  const handleLayerChange = (layer: Layer, visible: boolean) => {
    onUpdatePlan({ ...plan, layerVisibility: { ...plan.layerVisibility, [layer]: visible } });
  };

  const handleCableLabelChange = (layer: Layer, show: boolean) => {
    onUpdatePlan({ ...plan, cableLabelVisibility: { ...(plan.cableLabelVisibility ?? {}), [layer]: show } });
  };

  const handlePortLabelChange = (layer: Layer, show: boolean) => {
    onUpdatePlan({ ...plan, portLabelVisibility: { ...(plan.portLabelVisibility ?? {}), [layer]: show } });
  };

  const submitRename = () => {
    if (nameVal.trim()) onRenamePlan(plan.id, nameVal.trim());
    else setNameVal(plan.name);
    setEditingName(false);
  };

  const draggedAsset = draggedAssetId ? assets.find(a => a.id === draggedAssetId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* Toolbar */}
        <div style={{
          background: '#111827', borderBottom: '1px solid #374151',
          padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12,
          flexWrap: 'wrap', flexShrink: 0,
        }}>
          {/* Plan name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {editingName ? (
              <form onSubmit={e => { e.preventDefault(); submitRename(); }}>
                <input
                  autoFocus
                  value={nameVal}
                  onChange={e => setNameVal(e.target.value)}
                  onBlur={submitRename}
                  style={{
                    background: '#1f2937', color: 'white',
                    border: '1px solid #4b5563', borderRadius: 4,
                    padding: '4px 8px', fontSize: 13, width: 200,
                  }}
                />
              </form>
            ) : (
              <button
                onClick={() => { setEditingName(true); setNameVal(plan.name); }}
                style={{ color: 'white', fontWeight: 600, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}
                title="Rename plan"
              >{plan.name}</button>
            )}
            <span style={{ color: '#6b7280', fontSize: 11 }}>
              {plan.instances.length} assets · {plan.connections.length} connections
            </span>
          </div>

          {/* Plan switcher */}
          <div style={{ position: 'relative' }}>
            <Button size="sm" variant="ghost"
              className="text-gray-300 hover:text-white hover:bg-gray-700"
              onClick={() => { setShowPlanMenu(!showPlanMenu); setRenamingPlanId(null); }}>
              ▾ Plans ({allPlans.length})
            </Button>
            {showPlanMenu && (
              <div style={{
                position: 'absolute', top: 32, left: 0,
                background: '#1f2937', border: '1px solid #374151',
                borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                zIndex: 100, minWidth: 240, padding: '4px 0',
              }}>
                {allPlans.map(p => {
                  const isActive = p.id === plan.id;
                  const isRenaming = renamingPlanId === p.id;
                  return (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 8px 4px 12px',
                      background: isActive ? 'rgba(96,165,250,0.08)' : 'none',
                    }}>
                      {isRenaming ? (
                        <form style={{ flex: 1, display: 'flex', gap: 4 }}
                          onSubmit={e => {
                            e.preventDefault();
                            if (renamingVal.trim()) onRenamePlan(p.id, renamingVal.trim());
                            setRenamingPlanId(null);
                          }}>
                          <input
                            autoFocus
                            value={renamingVal}
                            onChange={e => setRenamingVal(e.target.value)}
                            onBlur={() => {
                              if (renamingVal.trim()) onRenamePlan(p.id, renamingVal.trim());
                              setRenamingPlanId(null);
                            }}
                            onKeyDown={e => { if (e.key === 'Escape') setRenamingPlanId(null); }}
                            style={{
                              flex: 1, background: '#374151', color: 'white',
                              border: '1px solid #60a5fa', borderRadius: 4,
                              padding: '3px 6px', fontSize: 12,
                            }}
                          />
                        </form>
                      ) : (
                        <button
                          style={{
                            flex: 1, textAlign: 'left', background: 'none', border: 'none',
                            cursor: 'pointer', color: isActive ? '#60a5fa' : '#e5e7eb',
                            fontWeight: isActive ? 600 : 400, fontSize: 13,
                            padding: '4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}
                          onClick={() => { onSetActivePlan(p.id); setShowPlanMenu(false); }}
                          title={p.name}
                        >{p.name}</button>
                      )}
                      {/* Rename button */}
                      {!isRenaming && (
                        <button
                          title="Rename"
                          onClick={e => { e.stopPropagation(); setRenamingPlanId(p.id); setRenamingVal(p.name); }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#9ca3af', fontSize: 12, padding: '2px 4px', lineHeight: 1,
                            flexShrink: 0,
                          }}
                        >✎</button>
                      )}
                      {/* Delete button — only if more than one plan exists */}
                      {allPlans.length > 1 && (
                        <button
                          title="Delete plan"
                          onClick={e => {
                            e.stopPropagation();
                            if (window.confirm(`Delete plan "${p.name}"? This cannot be undone.`)) {
                              onDeletePlan(p.id);
                              setShowPlanMenu(false);
                            }
                          }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#f87171', fontSize: 12, padding: '2px 4px', lineHeight: 1,
                            flexShrink: 0,
                          }}
                        >✕</button>
                      )}
                    </div>
                  );
                })}
                {/* New plan */}
                <div style={{ borderTop: '1px solid #374151', margin: '4px 0', padding: '4px 8px', display: 'flex', gap: 4 }}>
                  <input
                    placeholder="New plan…"
                    value={newPlanName}
                    onChange={e => setNewPlanName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newPlanName.trim()) {
                        onCreatePlan(newPlanName.trim()); setNewPlanName(''); setShowPlanMenu(false);
                      }
                    }}
                    style={{
                      flex: 1, background: '#374151', color: 'white',
                      border: '1px solid #4b5563', borderRadius: 4,
                      padding: '4px 8px', fontSize: 12,
                    }}
                  />
                  <button
                    disabled={!newPlanName.trim()}
                    onClick={() => { onCreatePlan(newPlanName.trim()); setNewPlanName(''); setShowPlanMenu(false); }}
                    style={{
                      background: '#2563eb', color: 'white', border: 'none',
                      borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                    }}
                  >+</button>
                </div>
              </div>
            )}
          </div>

          <div style={{ flex: 1 }} />

          <LayerControls
            visibility={plan.layerVisibility}
            cableLabelVisibility={plan.cableLabelVisibility}
            portLabelVisibility={plan.portLabelVisibility}
            onChange={handleLayerChange}
            onCableLabelChange={handleCableLabelChange}
            onPortLabelChange={handlePortLabelChange}
          />

          {/* Routing config button */}
          <div style={{ position: 'relative' }}>
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-300 hover:text-white hover:bg-gray-700"
              onClick={() => { setShowRoutingPanel(v => !v); setShowPlanMenu(false); }}
            >
              ⚙ Config
            </Button>
            {showRoutingPanel && (
              <RoutingConfigPanel
                config={plan.routingConfig ?? DEFAULT_ROUTING_CONFIG}
                onChange={onUpdateRoutingConfig}
                onClose={() => setShowRoutingPanel(false)}
              />
            )}
          </div>

          <Button size="sm" variant="primary" onClick={() => downloadHTML(plan, assets)}>
            Export as HTML
          </Button>
          <span
            title={obsidianSynced === 'ok' ? 'Obsidian Vault verbunden' : 'Obsidian nicht erreichbar'}
            style={{
              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em',
              padding: '2px 8px', borderRadius: '4px', cursor: 'default', userSelect: 'none',
              background: obsidianSynced === 'ok' ? '#16a34a' : obsidianSynced === 'error' ? '#dc2626' : '#6b7280',
              color: '#fff', opacity: obsidianSynced === 'checking' ? 0.6 : 1,
            }}
          >
            {obsidianSynced === 'ok' ? '⬤ SYNCED' : obsidianSynced === 'error' ? '⬤ VAULT OFFLINE' : '○ …'}
          </span>
          <Button size="sm" variant="ghost"
            className="text-gray-500 hover:text-gray-300 hover:bg-gray-700"
            title="Export as PDF"
            onClick={() => { if (canvasWrapRef.current) exportToPDF(canvasWrapRef.current, plan.name); }}>
            PDF
          </Button>
        </div>

        {/* Main layout: AssetPanel + Canvas */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <AssetPanel assets={assets} />

          {/* Canvas wrapper — explicit h-full */}
          <div
            ref={canvasWrapRef}
            style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}
          >
            <Canvas
              ref={canvasHandle}
              plan={plan}
              assets={assets}
              onUpdatePlan={onUpdatePlan}
              onEditAsset={onEditAsset}
              routingConfig={plan.routingConfig ?? DEFAULT_ROUTING_CONFIG}
            />
          </div>
        </div>
      </div>

      {/* Drag overlay — ghost element while dragging from panel */}
      <DragOverlay dropAnimation={null}>
        {draggedAsset && (
          <div style={{
            width: draggedAsset.width,
            height: draggedAsset.height,
            background: draggedAsset.color,
            borderRadius: 6,
            opacity: 0.85,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'grabbing',
            pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9', textAlign: 'center', padding: 4 }}>
              {draggedAsset.name}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
