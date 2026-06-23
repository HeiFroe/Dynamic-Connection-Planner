export type PortType =
  // Device port types — direction matters
  | 'hdmi-in' | 'hdmi-out'
  | 'displayport-in' | 'displayport-out'
  | 'usb-a' | 'usb-b' | 'usb-c' | 'usb-c-out' | 'usb-micro'
  | 'rj45' | 'rj45-poe'
  | 'power-c13' | 'power-c14' | 'power-eu' | 'power-eu-out'
  | 'audio-3.5-in' | 'audio-3.5-out'
  // Vendor-proprietary (Logitech Mic Pod, 12-pin)
  | 'logi-micpod-host' | 'logi-micpod-in' | 'logi-micpod-out' | 'logi-micpod'
  // Neutral connector types — for cable endpoints (signal-bidirectional)
  | 'hdmi' | 'displayport' | 'audio-3.5';

export type Layer = 'hardware' | 'video' | 'usb' | 'power' | 'ethernet' | 'other';

export type AssetCategory =
  | 'display'               // LG screens and standalone monitors
  | 'collaboration-system'  // Video bars + AIO devices (Rally Bar, MeetUp, Rally Board, NEAT Bar Pro)
  | 'collab-extension'      // Sight, Extend, Cat5e extenders, MicPod, MicPod Hub, Hubs, Rally Cam
  | 'controller'            // TAP devices, NEAT Pad, Rally Speaker
  | 'device-content'        // Power supplies, sight/cam adapters, dongle accessories
  | 'other-devices'         // PoE injector (standalone), power outlets, ethernet wall port
  | 'cable'                 // All cable assets (hidden from canvas drag panel)
  | 'pc'                    // MTR clients, compute units
  | 'mount'                 // Wall mounts, stands
  | 'infrastructure';       // Legacy: kept for backward-compat with sampleAssets

export interface Port {
  id: string;
  label: string;
  type: PortType;
  direction: 'in' | 'out' | 'bidirectional';
  layer: Layer;
  position: { x: number; y: number }; // 0–1 relative to asset bounds
  compatibleWith: PortType[];
  /** 'plug' = male connector that plugs directly into a 'socket' (direct connection, no cable). Default: 'socket'. */
  connector?: 'socket' | 'plug';
  /** Restrict cable connections to these specific asset/port peers. If unset, any type-compatible peer is allowed. */
  cablePeers?: { assetId: string; portIds?: string[] }[];
}

export interface AttachmentPoint {
  id: string;
  edge: 'top' | 'bottom' | 'left' | 'right';
  position: number; // 0–1 along the edge
  role: 'host' | 'guest';
  accepts: AssetCategory[];
}

export interface Asset {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  category: AssetCategory;
  width: number;
  height: number;
  color: string;
  frontImage?: string;  // base64 data-URL
  rearImage?: string;   // base64 data-URL, used for port positioning
  imageAspectRatio?: number; // naturalWidth/naturalHeight — auto-set on image upload
  physicalWidth?: number;    // cm (documentation only)
  physicalHeight?: number;   // cm
  ports: Port[];
  attachmentPoints: AttachmentPoint[];
  /** For cable assets: physical cable length in meters. */
  cableLength?: number;
  /** Combined-cable-length constraint (e.g. Logitech PoE: ports 'rj45-lan'+'rj45-poe-out' must sum ≤ 30m). */
  cableLengthLimit?: {
    portIds: string[];
    maxMeters: number;
    description?: string;
  };
  notes?: string;
  /** Asset IDs that are automatically placed alongside this asset when dropped on the canvas. */
  requires?: string[];
  /** Set on Logitech devices that have a Logitech-proprietary 12-pin Mic Pod port. Gates the MicPod port-type options in the AssetEditor. */
  supportsMicPodPorts?: boolean;
  /** For Mic Pod hosts (Rally Bar, Bar Mini, Rally Plus Table Hub, MicPod Hub): chain limits enforced by the validator. */
  micPodChainLimits?: {
    maxPods: number;
    maxHubs: number;
    description?: string;
  };
  createdAt: string;
  updatedAt: string;
}


export interface PlacedAsset {
  instanceId: string;
  assetId: string;
  x: number;
  y: number;
  viewMode?: 'front' | 'rear'; // default: 'front'
  instanceWidth?: number;      // canvas px override (when resized)
  instanceHeight?: number;
  resizeHandlesEnabled?: boolean;
  attachedTo?: { instanceId: string; attachmentPointId: string };
}

export interface Connection {
  id: string;
  fromInstanceId: string;
  fromPortId: string;
  toInstanceId: string;
  toPortId: string;
  cableAssetId: string;           // '__legacy__' for old connections without cable
  layer: Layer;
  waypoints: { x: number; y: number }[];
}

export interface Area {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  locked: boolean;
  color?: string; // optional, default '#6366F1'
}

export type LineStyle = 'solid' | 'dashed' | 'dotted';

export interface RoutingConfig {
  stubLen: number;
  boxPad: number;
  cornerR: number;
  parallelGap: number;
  crossR: number;
  defaultLineStyle: LineStyle;
  layerLineStyle: Partial<Record<Layer, LineStyle>>;
}

export const DEFAULT_ROUTING_CONFIG: RoutingConfig = {
  stubLen: 24,
  boxPad: 18,
  cornerR: 8,
  parallelGap: 6,
  crossR: 5,
  defaultLineStyle: 'solid',
  layerLineStyle: {},
};

export interface Plan {
  id: string;
  name: string;
  description?: string;
  instances: PlacedAsset[];
  connections: Connection[];
  areas?: Area[];
  layerVisibility: Record<Layer, boolean>;
  /** Per-layer cable-name label visibility (the pill badge on the line) */
  cableLabelVisibility?: Partial<Record<Layer, boolean>>;
  /** Per-layer port-name label visibility (the small badge at the port dot) */
  portLabelVisibility?: Partial<Record<Layer, boolean>>;
  /** @deprecated use cableLabelVisibility + portLabelVisibility */
  labelVisibility?: Partial<Record<Layer, boolean>>;
  routingConfig?: RoutingConfig;
  createdAt: string;
  updatedAt: string;
}

export interface AppState {
  assets: Asset[];
  plans: Plan[];
  activePlanId: string | null;
}

export const LAYER_META: Record<Layer, { label: string; color: string }> = {
  hardware: { label: 'Hardware',     color: '#6B7280' },
  video:    { label: 'Video',   color: '#3B82F6' },
  usb:      { label: 'USB',          color: '#10B981' },
  power:    { label: 'Power',        color: '#EF4444' },
  ethernet: { label: 'Ethernet',     color: '#F59E0B' },
  other:    { label: 'Other',        color: '#A855F7' },
};

export const PORT_COLORS: Record<PortType, string> = {
  'hdmi-in':           '#3B82F6',
  'hdmi-out':          '#1D4ED8',
  'hdmi':              '#2563EB',
  'displayport-in':    '#6366F1',
  'displayport-out':   '#4338CA',
  'displayport':       '#4F46E5',
  'usb-a':             '#10B981',
  'usb-b':             '#059669',
  'usb-c':             '#34D399',
  'usb-c-out':         '#6EE7B7',
  'usb-micro':         '#047857',
  'rj45':              '#F59E0B',
  'rj45-poe':          '#D97706',
  'power-c13':         '#EF4444',
  'power-c14':         '#DC2626',
  'power-eu':          '#F97316',
  'power-eu-out':      '#FB923C',
  'audio-3.5-in':      '#8B5CF6',
  'audio-3.5-out':     '#7C3AED',
  'audio-3.5':         '#8B5CF6',
  'logi-micpod-host':  '#A855F7',
  'logi-micpod-in':    '#9333EA',
  'logi-micpod-out':   '#C084FC',
  'logi-micpod':       '#A855F7',
};

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  display:                'Display',
  'collaboration-system': 'Collaboration System',
  'collab-extension':     'Collab Extension',
  controller:             'Controller',
  'device-content':       'Device Content',
  'other-devices':        'Other Devices',
  cable:                  'Cable',
  pc:                     'PC / Compute',
  mount:                  'Mount',
  infrastructure:         'Infrastructure',
};

export const PORT_TYPE_LABELS: Record<PortType, string> = {
  'hdmi-in':           'HDMI In',
  'hdmi-out':          'HDMI Out',
  'hdmi':              'HDMI (cable end)',
  'displayport-in':    'DisplayPort In',
  'displayport-out':   'DisplayPort Out',
  'displayport':       'DisplayPort (cable end)',
  'usb-a':             'USB Type-A',
  'usb-b':             'USB Type-B',
  'usb-c':             'USB Type-C',
  'usb-c-out':         'USB Type-C (output)',
  'usb-micro':         'USB Micro',
  'rj45':              'Ethernet (RJ45)',
  'rj45-poe':          'Ethernet PoE',
  'power-c13':         'Power IEC C13',
  'power-c14':         'Power IEC C14',
  'power-eu':          'Power Schuko (CEE 7/3)',
  'power-eu-out':      'Power Schuko outlet',
  'audio-3.5-in':      'Audio 3.5 mm In',
  'audio-3.5-out':     'Audio 3.5 mm Out',
  'audio-3.5':         'Audio 3.5 mm (cable end)',
  'logi-micpod-host':  'Logitech Mic Pod Host',
  'logi-micpod-in':    'Logitech Mic Pod In',
  'logi-micpod-out':   'Logitech Mic Pod Out',
  'logi-micpod':       'Logitech Mic Pod (cable end)',
};

/** Vendor-proprietary port types — only available on assets that explicitly enable them. */
export const VENDOR_PROPRIETARY_PORT_TYPES: PortType[] = [
  'logi-micpod-host', 'logi-micpod-in', 'logi-micpod-out', 'logi-micpod',
];
