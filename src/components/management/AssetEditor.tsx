import React, { useState, useRef, useCallback } from 'react';
import {
  Asset, Port, AttachmentPoint, PortType, Layer, AssetCategory,
  LAYER_META, PORT_COLORS, CATEGORY_LABELS, PORT_TYPE_LABELS,
  VENDOR_PROPRIETARY_PORT_TYPES,
} from '../../types';
import { Button, Input, Select, Textarea, Card } from '../ui';
import { ConnectorSymbol } from './ConnectorSymbol';

const ALL_PORT_TYPES: PortType[] = [
  'hdmi', 'hdmi-in', 'hdmi-out',
  'displayport', 'displayport-in', 'displayport-out',
  'usb-a', 'usb-b', 'usb-c', 'usb-c-out', 'usb-micro',
  'rj45', 'rj45-poe',
  'power-c13', 'power-c14', 'power-eu', 'power-eu-out',
  'audio-3.5', 'audio-3.5-in', 'audio-3.5-out',
  'logi-micpod', 'logi-micpod-host', 'logi-micpod-in', 'logi-micpod-out',
];

// Grouped by signal family — compatibility toggles only show same-group options.
// Neutral connector types (hdmi, displayport, audio-3.5, logi-micpod) live in the same group as
// their directional variants so a cable end can mate with either *-in or *-out device port.
const COMPAT_GROUPS: PortType[][] = [
  ['hdmi', 'hdmi-in', 'hdmi-out', 'displayport', 'displayport-in', 'displayport-out'],
  ['usb-a', 'usb-b', 'usb-c', 'usb-c-out', 'usb-micro'],
  ['rj45', 'rj45-poe'],
  ['power-c13', 'power-c14', 'power-eu', 'power-eu-out'],
  ['audio-3.5', 'audio-3.5-in', 'audio-3.5-out'],
  ['logi-micpod', 'logi-micpod-host', 'logi-micpod-in', 'logi-micpod-out'],
];

function compatGroupFor(type: PortType): PortType[] {
  return COMPAT_GROUPS.find(g => g.includes(type)) ?? ALL_PORT_TYPES;
}

const LAYERS: Layer[] = ['hardware', 'video', 'usb', 'power', 'ethernet', 'other'];
const CATEGORIES: AssetCategory[] = [
  'display', 'collaboration-system', 'collab-extension', 'controller',
  'device-content', 'other-devices', 'cable', 'pc', 'mount', 'infrastructure',
];
const EDGES = ['top', 'bottom', 'left', 'right'] as const;

function newPort(forCable = false): Port {
  return forCable
    ? {
        id: crypto.randomUUID(),
        label: '',
        type: 'hdmi',
        direction: 'bidirectional',
        layer: 'video',
        position: { x: 0.5, y: 0.5 },
        compatibleWith: ['hdmi', 'hdmi-in', 'hdmi-out'],
      }
    : {
        id: crypto.randomUUID(),
        label: '',
        type: 'hdmi-in',
        direction: 'in',
        layer: 'video',
        position: { x: 0.5, y: 1.0 },
        compatibleWith: ['hdmi-out'],
      };
}

function newAP(): AttachmentPoint {
  return { id: crypto.randomUUID(), edge: 'bottom', position: 0.5, role: 'host', accepts: [] };
}

// ── Port Positioner ────────────────────────────────────────────────────────────
function PortPositioner({
  image, ports, onUpdatePort,
}: {
  image: string;
  ports: Port[];
  onUpdatePort: (id: string, pos: { x: number; y: number }) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const dragging = useRef<string | null>(null);

  const toRel = useCallback((clientX: number, clientY: number) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }, []);

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}
      onMouseMove={e => {
        if (!dragging.current) return;
        const pos = toRel(e.clientX, e.clientY);
        if (pos) onUpdatePort(dragging.current, pos);
      }}
      onMouseUp={() => { dragging.current = null; }}
      onMouseLeave={() => { dragging.current = null; }}
    >
      <img
        ref={imgRef}
        src={image}
        alt="Asset view"
        draggable={false}
        style={{ width: '100%', display: 'block', borderRadius: 4, background: '#f8fafc' }}
      />
      {ports.map(port => {
        const color = PORT_COLORS[port.type] ?? '#888';
        return (
          <div
            key={port.id}
            title={`${port.label} — drag to reposition`}
            onMouseDown={e => { e.preventDefault(); dragging.current = port.id; }}
            style={{
              position: 'absolute',
              left: `${port.position.x * 100}%`,
              top:  `${port.position.y * 100}%`,
              width: 14, height: 14,
              borderRadius: '50%',
              background: color,
              border: '2px solid white',
              transform: 'translate(-50%, -50%)',
              cursor: 'grab',
              zIndex: 10,
              boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{
              position: 'absolute', bottom: 16, left: '50%',
              transform: 'translateX(-50%)',
              background: '#1f2937', color: 'white',
              fontSize: 9, padding: '2px 5px', borderRadius: 3,
              whiteSpace: 'nowrap', pointerEvents: 'none',
            }}>
              {port.label || port.type}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Image Upload ──────────────────────────────────────────────────────────────
function ImageUpload({
  label, value, onChange, onAspectRatio, onSize,
}: {
  label: string;
  value?: string;
  onChange: (b64: string | undefined) => void;
  onAspectRatio?: (ratio: number) => void;
  onSize?: (naturalW: number, naturalH: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const b64 = ev.target?.result as string;
      onChange(b64);
      if (onAspectRatio || onSize) {
        const img = new Image();
        img.onload = () => {
          if (img.naturalWidth && img.naturalHeight) {
            if (onAspectRatio) onAspectRatio(img.naturalWidth / img.naturalHeight);
            if (onSize) onSize(img.naturalWidth, img.naturalHeight);
          }
        };
        img.src = b64;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div>
      <label className="text-xs text-gray-600 mb-1 block">{label}</label>
      <div className="flex gap-2 items-center">
        {value ? (
          <>
            <img src={value} alt={label} className="h-12 rounded border object-contain bg-gray-100" style={{ maxWidth: 80 }} />
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>Replace</Button>
            <Button size="sm" variant="danger" onClick={() => onChange(undefined)}>×</Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
            Upload image…
          </Button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}

// ── Main Editor ───────────────────────────────────────────────────────────────
interface Props {
  initial?: Asset;
  allAssets: Asset[];
  onSave: (asset: Asset) => void;
  onCancel: () => void;
}

export function AssetEditor({ initial, allAssets, onSave, onCancel }: Props) {
  const [form, setForm] = useState<Asset>(initial ?? {
    id: crypto.randomUUID(),
    name: '',
    manufacturer: '',
    model: '',
    category: 'display',
    width: 160,
    height: 80,
    color: '#1F2937',
    ports: [],
    attachmentPoints: [],
    notes: '',
    createdAt: '',
    updatedAt: '',
  });

  // Which image face is shown in the PortPositioner
  const [positionerFace, setPositionerFace] = useState<'front' | 'rear'>('rear');

  const set = (key: keyof Asset, val: unknown) =>
    setForm(f => ({ ...f, [key]: val }));

  // Vendor-proprietary ports (Logitech Mic Pod) are gated by `supportsMicPodPorts`
  // — only shown for Logitech assets that explicitly opt in. We also auto-recognize
  // model names that always carry a MicPod port so users don't have to flip the toggle
  // for these standard SKUs.
  const isLogitech = form.manufacturer.trim().toLowerCase() === 'logitech';
  const nameLooksLikeMicPodHost = /rally bar|rally mic pod|rally table hub|sight usb/i.test(
    `${form.name} ${form.model}`,
  );
  const showMicPodPorts =
    isLogitech && (form.supportsMicPodPorts === true || nameLooksLikeMicPodHost);

  const visiblePortTypes: PortType[] = ALL_PORT_TYPES.filter(t =>
    !VENDOR_PROPRIETARY_PORT_TYPES.includes(t) || showMicPodPorts,
  );

  // Ports — new port added at TOP (unshift). For cables, default to neutral connector type.
  const addPort = () =>
    setForm(f => ({ ...f, ports: [newPort(f.category === 'cable'), ...f.ports] }));

  const updatePort = (idx: number, patch: Partial<Port>) =>
    setForm(f => ({ ...f, ports: f.ports.map((p, i) => i === idx ? { ...p, ...patch } : p) }));

  const updatePortById = (id: string, pos: { x: number; y: number }) =>
    setForm(f => ({ ...f, ports: f.ports.map(p => p.id === id ? { ...p, position: pos } : p) }));

  const togglePortCompat = (idx: number, type: PortType) => {
    const current = form.ports[idx].compatibleWith;
    updatePort(idx, { compatibleWith: current.includes(type) ? current.filter(t => t !== type) : [...current, type] });
  };

  const updateAP = (idx: number, patch: Partial<AttachmentPoint>) =>
    setForm(f => ({ ...f, attachmentPoints: f.attachmentPoints.map((a, i) => i === idx ? { ...a, ...patch } : a) }));

  const toggleAPAccept = (idx: number, cat: AssetCategory) => {
    const current = form.attachmentPoints[idx].accepts;
    updateAP(idx, { accepts: current.includes(cat) ? current.filter(c => c !== cat) : [...current, cat] });
  };

  const handleSave = () => {
    if (!form.name.trim()) { alert('Name is required.'); return; }
    onSave(form);
  };

  const positionerImage = positionerFace === 'rear'
    ? (form.rearImage ?? form.frontImage)
    : (form.frontImage ?? form.rearImage);
  const hasBothImages = !!(form.frontImage && form.rearImage);
  const isCable = form.category === 'cable';

  // ── Required Assets helpers ────────────────────────────────────────────────
  const addRequires = () =>
    setForm(f => ({ ...f, requires: [...(f.requires ?? []), ''] }));

  const updateRequires = (idx: number, val: string) =>
    setForm(f => ({ ...f, requires: (f.requires ?? []).map((r, i) => i === idx ? val : r) }));

  const removeRequires = (idx: number) =>
    setForm(f => ({ ...f, requires: (f.requires ?? []).filter((_, i) => i !== idx) }));

  const nonCableAssets = allAssets.filter(a => a.category !== 'cable' && a.id !== form.id);

  return (
    <div className="space-y-5">

      {/* General info */}
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold text-xs text-gray-500 uppercase tracking-wide">General</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Name *</label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Rally Bar" />
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Manufacturer</label>
            <Input value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} placeholder="e.g. Logitech" />
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Model</label>
            <Input value={form.model} onChange={e => set('model', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Category</label>
            <Select value={form.category} onChange={e => set('category', e.target.value as AssetCategory)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </Select>
          </div>

          {isCable ? (
            <>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Cable length (m) *</label>
                <Input type="number" step="0.1" min={0} value={form.cableLength ?? ''} placeholder="e.g. 2"
                  onChange={e => set('cableLength', e.target.value ? +e.target.value : undefined)} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Color (cable jacket)</label>
                <div className="flex gap-2">
                  <input type="color" value={form.color} onChange={e => set('color', e.target.value)} className="h-8 w-10 rounded border cursor-pointer flex-shrink-0" />
                  <Input value={form.color} onChange={e => set('color', e.target.value)} className="font-mono" />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Width (px)</label>
                <Input type="number" min={40} max={600} value={form.width} onChange={e => set('width', +e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Height (px)</label>
                <Input type="number" min={20} max={500} value={form.height} onChange={e => set('height', +e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Color (fallback when no image)</label>
                <div className="flex gap-2">
                  <input type="color" value={form.color} onChange={e => set('color', e.target.value)} className="h-8 w-10 rounded border cursor-pointer flex-shrink-0" />
                  <Input value={form.color} onChange={e => set('color', e.target.value)} className="font-mono" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Width (cm)</label>
                <Input type="number" min={1} value={form.physicalWidth ?? ''} placeholder="e.g. 70"
                  onChange={e => set('physicalWidth', e.target.value ? +e.target.value : undefined)} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Height (cm)</label>
                <Input type="number" min={1} value={form.physicalHeight ?? ''} placeholder="e.g. 14"
                  onChange={e => set('physicalHeight', e.target.value ? +e.target.value : undefined)} />
              </div>
            </>
          )}

          <div className="col-span-2">
            <label className="text-xs text-gray-600 mb-1 block">Notes</label>
            <Textarea rows={2} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
          </div>

          {/* Vendor-proprietary port toggle (Logitech Mic Pod) */}
          {isLogitech && !isCable && (
            <div className="col-span-2 border-t pt-3 mt-1">
              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showMicPodPorts}
                  disabled={nameLooksLikeMicPodHost}
                  onChange={e => set('supportsMicPodPorts', e.target.checked || undefined)}
                />
                <span className="font-medium">This device has a Logitech Mic Pod port (12-pin)</span>
                {nameLooksLikeMicPodHost && (
                  <span className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide ml-1">
                    auto-enabled
                  </span>
                )}
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-5">
                Enables the proprietary <code>logi-micpod-*</code> port types. Auto-enabled for Rally Bar / Rally Bar Mini / Rally Table Hub / Rally Mic Pod / Rally Mic Pod Hub / Sight USB Adapter; tick manually for any other Logitech device with a 12-pin Mic Pod port.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Cable preview */}
      {isCable && form.ports.length >= 2 && (
        <Card className="p-4">
          <h3 className="font-semibold text-xs text-gray-500 uppercase tracking-wide mb-3">Cable preview</h3>
          <div
            className="w-full rounded border flex items-center justify-center px-4 py-5 gap-2"
            style={{ background: '#fafafa' }}
          >
            <ConnectorSymbol type={form.ports[0].type} size={56} label={form.ports[0].type} />
            <div className="flex-1 relative h-6 flex items-center mx-2">
              <div className="w-full" style={{ height: 4, background: form.color, borderRadius: 2 }} />
              {form.cableLength !== undefined && (
                <div className="absolute left-1/2 -translate-x-1/2 -top-1.5 bg-white border border-gray-300 rounded px-2 text-xs font-mono font-semibold text-gray-700" style={{ lineHeight: '16px' }}>
                  {form.cableLength} m
                </div>
              )}
            </div>
            <ConnectorSymbol type={form.ports[1].type} size={56} label={form.ports[1].type} mirrored />
          </div>
        </Card>
      )}

      {/* Images */}
      {!isCable && (
        <Card className="p-4 space-y-4">
          <h3 className="font-semibold text-xs text-gray-500 uppercase tracking-wide">Images (transparent PNG recommended)</h3>
          <div className="grid grid-cols-2 gap-4">
            <ImageUpload label="Front view" value={form.frontImage}
              onChange={v => set('frontImage', v)}
              onAspectRatio={ratio => set('imageAspectRatio', ratio)}
              onSize={(nw, nh) => {
                // Asset size = image size (capped at 400px width, scaled proportionally)
                const MAX_W = 400;
                const scale = nw > MAX_W ? MAX_W / nw : 1;
                setForm(f => ({ ...f, width: Math.round(nw * scale), height: Math.round(nh * scale) }));
              }} />
            <ImageUpload label="Rear view (used for port positioning)" value={form.rearImage} onChange={v => set('rearImage', v)} />
          </div>
        </Card>
      )}

      {/* Port Positioner */}
      {positionerImage && form.ports.length > 0 && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-xs text-gray-500 uppercase tracking-wide">
              Place ports on image
              <span className="ml-2 font-normal text-gray-400">(drag the dots onto the device image)</span>
            </h3>
            {hasBothImages && (
              <div className="flex gap-1">
                <button
                  onClick={() => setPositionerFace('front')}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${positionerFace === 'front' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
                >
                  Front
                </button>
                <button
                  onClick={() => setPositionerFace('rear')}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${positionerFace === 'rear' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
                >
                  Rear
                </button>
              </div>
            )}
          </div>
          <PortPositioner
            image={positionerImage}
            ports={form.ports}
            onUpdatePort={updatePortById}
          />
        </Card>
      )}

      {/* Ports */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-xs text-gray-500 uppercase tracking-wide">
            Ports ({form.ports.length})
          </h3>
          <Button size="sm" variant="secondary" onClick={addPort}>+ Port</Button>
        </div>

        {form.ports.map((port, idx) => (
          <div key={port.id} className="border rounded-lg p-3 space-y-2 bg-gray-50">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PORT_COLORS[port.type] }} />
              <span className="text-xs font-medium text-gray-700 flex-1">{port.label || '(no label)'}</span>
              <Button size="sm" variant="danger"
                onClick={() => setForm(f => ({ ...f, ports: f.ports.filter((_, i) => i !== idx) }))}>×</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">Label</label>
                <Input value={port.label} onChange={e => updatePort(idx, { label: e.target.value })} placeholder="HDMI In 1" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Type</label>
                <Select value={port.type} onChange={e => updatePort(idx, { type: e.target.value as PortType })}>
                  {visiblePortTypes.map(t => <option key={t} value={t}>{PORT_TYPE_LABELS[t]}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Direction</label>
                <Select value={port.direction} onChange={e => updatePort(idx, { direction: e.target.value as Port['direction'] })}>
                  <option value="in">Input</option>
                  <option value="out">Output</option>
                  <option value="bidirectional">Bidirectional</option>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Layer</label>
                <Select value={port.layer} onChange={e => updatePort(idx, { layer: e.target.value as Layer })}>
                  {LAYERS.map(l => <option key={l} value={l}>{LAYER_META[l].label}</option>)}
                </Select>
              </div>
              {!positionerImage && (
                <>
                  <div>
                    <label className="text-xs text-gray-500">Position X (0–1)</label>
                    <Input type="number" step="0.05" min="0" max="1" value={port.position.x}
                      onChange={e => updatePort(idx, { position: { ...port.position, x: +e.target.value } })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Position Y (0–1)</label>
                    <Input type="number" step="0.05" min="0" max="1" value={port.position.y}
                      onChange={e => updatePort(idx, { position: { ...port.position, y: +e.target.value } })} />
                  </div>
                </>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Compatible port types</label>
              <div className="flex flex-wrap gap-1">
                {compatGroupFor(port.type).filter(t =>
                  !VENDOR_PROPRIETARY_PORT_TYPES.includes(t) || showMicPodPorts,
                ).map(t => (
                  <button key={t} onClick={() => togglePortCompat(idx, t)}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${port.compatibleWith.includes(t) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </Card>

      {/* Attachment points */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-xs text-gray-500 uppercase tracking-wide">
            Attachment points ({form.attachmentPoints.length})
          </h3>
          <Button size="sm" variant="secondary"
            onClick={() => setForm(f => ({ ...f, attachmentPoints: [...f.attachmentPoints, newAP()] }))}>
            + Point
          </Button>
        </div>
        {form.attachmentPoints.map((ap, idx) => (
          <div key={ap.id} className="border rounded-lg p-3 space-y-2 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{ap.edge} · {ap.role}</span>
              <Button size="sm" variant="danger"
                onClick={() => setForm(f => ({ ...f, attachmentPoints: f.attachmentPoints.filter((_, i) => i !== idx) }))}>×</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">Edge</label>
                <Select value={ap.edge} onChange={e => updateAP(idx, { edge: e.target.value as AttachmentPoint['edge'] })}>
                  {EDGES.map(e => <option key={e} value={e}>{e}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Role</label>
                <Select value={ap.role} onChange={e => updateAP(idx, { role: e.target.value as AttachmentPoint['role'] })}>
                  <option value="host">Host (accepts)</option>
                  <option value="guest">Guest (docks onto host)</option>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Position (0–1)</label>
                <Input type="number" step="0.1" min="0" max="1" value={ap.position}
                  onChange={e => updateAP(idx, { position: +e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Accepts categories</label>
              <div className="flex flex-wrap gap-1">
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => toggleAPAccept(idx, c)}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${ap.accepts.includes(c) ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'}`}>
                    {CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </Card>

      {/* Required Assets (auto-placed alongside when dropped on canvas) */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-xs text-gray-500 uppercase tracking-wide">
            Required assets ({(form.requires ?? []).length})
          </h3>
          <Button size="sm" variant="secondary" onClick={addRequires}>+ Add</Button>
        </div>
        <p className="text-xs text-gray-400">
          Assets listed here are automatically placed alongside this asset when dropped onto the canvas.
        </p>
        {(form.requires ?? []).map((reqId, idx) => {
          const reqAsset = allAssets.find(a => a.id === reqId);
          return (
            <div key={idx} className="flex items-center gap-2">
              <Select
                value={reqId}
                onChange={e => updateRequires(idx, e.target.value)}
                className="flex-1"
              >
                <option value="">— select asset —</option>
                {nonCableAssets.map(a => (
                  <option key={a.id} value={a.id}>
                    {CATEGORY_LABELS[a.category]} · {a.name}
                  </option>
                ))}
              </Select>
              {reqAsset && (
                <span className="text-xs text-gray-500 truncate max-w-[120px]">{reqAsset.name}</span>
              )}
              <Button size="sm" variant="danger" onClick={() => removeRequires(idx)}>×</Button>
            </div>
          );
        })}
      </Card>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={handleSave}>Save</Button>
      </div>
    </div>
  );
}
