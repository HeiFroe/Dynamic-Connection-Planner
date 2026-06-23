// ─── Port & Layer types ───────────────────────────────────────────────────────

export type PortType =
  | 'hdmi' | 'hdmi-in' | 'hdmi-out'
  | 'rj45' | 'rj45-poe'
  | 'usb-a' | 'usb-b' | 'usb-c' | 'usb-micro'
  | 'power' | 'power-adapter'
  | 'logi-micpod' | 'logi-micpod-in' | 'logi-micpod-out';

export type Layer = 'hardware' | 'video' | 'usb' | 'power' | 'ethernet' | 'other';

export type AssetCategory =
  | 'display'
  | 'collaboration-system'
  | 'collab-extension'
  | 'controller'
  | 'device-content'
  | 'other-devices'
  | 'cable'
  | 'pc';

// ─── Connection (port definition on an asset) ────────────────────────────────

export interface PortDef {
  id: string;
  name: string;                 // human-readable label, e.g. "HDMI Out 1"
  layer: Layer;
  standard: PortType;           // connector standard
  maleFemale: 'male' | 'female'; // plug (male) vs socket (female)
  restriction?: string;         // optional rule text
  recommended?: string[];       // asset IDs
  optional?: string[];          // asset IDs
  /** Relative position on asset image 0–1 */
  position?: { x: number; y: number };
}

// ─── Asset ───────────────────────────────────────────────────────────────────

export interface Asset {
  id: string;
  dbNumber: number;             // auto-incremented DB number (#1, #2, …)
  vendor: string;
  model: string;
  partNumber?: string;          // optional part/SKU number
  productPage?: string;         // optional URL to product page
  category: AssetCategory;
  notes?: string;
  frontImage?: string;          // base64 data-URL
  imageAspectRatio?: number;    // naturalWidth/naturalHeight, set on upload
  physicalWidth?: number;       // cm
  physicalHeight?: number;      // cm
  ports: PortDef[];
  requires?: string[];          // asset IDs auto-placed with this asset
  createdAt: string;
  updatedAt: string;
}

// ─── Canvas (Builder) types ──────────────────────────────────────────────────

export interface PlacedAsset {
  instanceId: string;
  assetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Connection {
  id: string;
  fromInstanceId: string;
  fromPortId: string;
  toInstanceId: string;
  toPortId: string;
  layer: Layer;
  waypoints: { x: number; y: number }[];
  /** True when plug is physically inserted into socket — no cable needed */
  isDirect?: boolean;
}

export interface Area {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export interface Plan {
  id: string;
  name: string;
  instances: PlacedAsset[];
  connections: Connection[];
  areas: Area[];
  layerVisibility: Record<Layer, boolean>;
  portLabelVisibility?: Partial<Record<Layer, boolean>>;
  cableLabelVisibility?: Partial<Record<Layer, boolean>>;
  createdAt: string;
  updatedAt: string;
}

// ─── App state ───────────────────────────────────────────────────────────────

export interface AppState {
  assets: Asset[];
  plans: Plan[];
  activePlanId: string | null;
  nextDbNumber: number;
}

// ─── Lookup tables ────────────────────────────────────────────────────────────

export const LAYER_META: Record<Layer, { label: string; color: string }> = {
  hardware: { label: 'Hardware', color: '#6B7280' },
  video:    { label: 'Video',    color: '#3B82F6' },
  usb:      { label: 'USB',      color: '#10B981' },
  power:    { label: 'Power',    color: '#EF4444' },
  ethernet: { label: 'Ethernet', color: '#F59E0B' },
  other:    { label: 'Other',    color: '#A855F7' },
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
};

export const PORT_TYPE_LABELS: Record<PortType, string> = {
  'hdmi':           'HDMI',
  'hdmi-in':        'HDMI IN',
  'hdmi-out':       'HDMI OUT',
  'rj45':           'Ethernet',
  'rj45-poe':       'Ethernet POE',
  'usb-a':          'USB-A',
  'usb-b':          'USB-B',
  'usb-c':          'USB-C',
  'usb-micro':      'MicroUSB',
  'power':          'Power',
  'power-adapter':  'Power Adapter',
  'logi-micpod':    'MicPod',
  'logi-micpod-in': 'MicPod IN',
  'logi-micpod-out':'MicPod Out',
};

export const PORT_COLORS: Record<PortType, string> = {
  'hdmi':           '#2563EB',
  'hdmi-in':        '#3B82F6',
  'hdmi-out':       '#1D4ED8',
  'rj45':           '#F59E0B',
  'rj45-poe':       '#D97706',
  'usb-a':          '#10B981',
  'usb-b':          '#059669',
  'usb-c':          '#34D399',
  'usb-micro':      '#047857',
  'power':          '#EF4444',
  'power-adapter':  '#DC2626',
  'logi-micpod':    '#A855F7',
  'logi-micpod-in': '#9333EA',
  'logi-micpod-out':'#C084FC',
};

export const ALL_STANDARDS: PortType[] = [
  'hdmi', 'hdmi-in', 'hdmi-out',
  'rj45', 'rj45-poe',
  'usb-a', 'usb-b', 'usb-c', 'usb-micro',
  'power', 'power-adapter',
  'logi-micpod', 'logi-micpod-in', 'logi-micpod-out',
];

export const ALL_LAYERS: Layer[] = ['hardware', 'video', 'usb', 'power', 'ethernet', 'other'];

export const ALL_CATEGORIES: AssetCategory[] = [
  'display', 'collaboration-system', 'collab-extension', 'controller',
  'device-content', 'other-devices', 'cable', 'pc',
];
