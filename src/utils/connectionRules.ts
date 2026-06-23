import { PortDef, PortType, Asset } from '../types';

// ── Layer compatibility ───────────────────────────────────────────────────────

export function layersCompatible(a: PortDef, b: PortDef): boolean {
  if (a.layer === b.layer) return true;
  if (a.layer === 'hardware' || b.layer === 'hardware') return true;
  return false;
}

// ── Standard pairing rules ────────────────────────────────────────────────────
// Each entry: [standardA, standardB] can be connected, optionally via an adapter

export type PairingKind =
  | 'direct-connect' // male plug → female port, same standard — no cable needed
  | 'direct'         // cable between two ports (both female sockets)
  | 'adapter-cable'  // one cable with two different connectors
  | 'intermediate'   // requires an intermediate device
  | 'incompatible';  // cannot be connected

export interface PairingRule {
  kind: PairingKind;
  /** Cable label shown to user, e.g. "HDMI Cable" */
  cableLabel?: string;
  /**
   * For 'intermediate': the category or model hint of the required in-between device.
   * Matched against assets in the DB.
   */
  intermediateHint?: string;
  /** Warning text shown in yellow */
  warning?: string;
}

type PairingKey = `${PortType}:${PortType}`;

function key(a: PortType, b: PortType): PairingKey {
  // Canonical order: alphabetical so we only need one entry per pair
  return (a <= b ? `${a}:${b}` : `${b}:${a}`) as PairingKey;
}

const PAIRINGS: Map<PairingKey, PairingRule> = new Map([
  // ── HDMI ──────────────────────────────────────────────────────────────────
  [key('hdmi-out', 'hdmi-in'),  { kind: 'direct',        cableLabel: 'HDMI Cable' }],
  [key('hdmi-out', 'hdmi'),     { kind: 'direct',        cableLabel: 'HDMI Cable' }],
  [key('hdmi-in',  'hdmi'),     { kind: 'direct',        cableLabel: 'HDMI Cable' }],
  [key('hdmi',     'hdmi'),     { kind: 'direct',        cableLabel: 'HDMI Cable' }],

  // ── Ethernet ──────────────────────────────────────────────────────────────
  [key('rj45',     'rj45'),     { kind: 'direct',        cableLabel: 'Cat6A Ethernet Cable' }],
  [key('rj45',     'rj45-poe'), { kind: 'direct',        cableLabel: 'Cat6A PoE Ethernet Cable' }],
  [key('rj45-poe', 'rj45-poe'), { kind: 'direct',        cableLabel: 'Cat6A PoE Ethernet Cable' }],

  // ── USB ───────────────────────────────────────────────────────────────────
  [key('usb-a',    'usb-b'),    { kind: 'direct',        cableLabel: 'USB-A to USB-B Cable' }],
  [key('usb-a',    'usb-c'),    { kind: 'direct',        cableLabel: 'USB-A to USB-C Cable' }],
  [key('usb-a',    'usb-micro'),{ kind: 'adapter-cable', cableLabel: 'MicroUSB / USB-A Cable' }],
  [key('usb-a',    'usb-a'),    { kind: 'adapter-cable', cableLabel: 'USB-A Extension Cable', warning: 'Both ports are USB-A — an adapter cable is required' }],
  [key('usb-c',    'usb-c'),    { kind: 'direct',        cableLabel: 'USB-C Cable' }],
  [key('usb-b',    'usb-b'),    { kind: 'incompatible' }],
  [key('usb-micro','usb-micro'),{ kind: 'incompatible' }],

  // ── Power ─────────────────────────────────────────────────────────────────
  // power-adapter (the socket on a device that accepts a DC barrel plug)
  // power (standard AC mains socket)
  [key('power-adapter', 'power-adapter'), { kind: 'direct', cableLabel: 'DC Power Cable' }],
  [key('power',         'power'),         { kind: 'direct', cableLabel: 'Power Cable' }],
  // power-adapter port → AC power port: needs an intermediate power adapter (AC→DC)
  [key('power-adapter', 'power'), {
    kind: 'intermediate',
    intermediateHint: 'power-adapter',
    warning: 'Direct connection not possible — a power adapter is required.',
  }],

  // ── MicPod ────────────────────────────────────────────────────────────────
  [key('logi-micpod-out', 'logi-micpod-in'),  { kind: 'direct', cableLabel: 'MicPod Cable' }],
  [key('logi-micpod-out', 'logi-micpod'),     { kind: 'direct', cableLabel: 'MicPod Cable' }],
  [key('logi-micpod-in',  'logi-micpod'),     { kind: 'direct', cableLabel: 'MicPod Cable' }],
  [key('logi-micpod',     'logi-micpod'),     { kind: 'direct', cableLabel: 'MicPod Cable' }],
]);

// ── Find matching cable assets from DB ────────────────────────────────────────

export interface CableOption {
  /** DB asset id — null means generic (not in DB) */
  assetId: string | null;
  label: string;
  vendor?: string;
  model?: string;
}

/**
 * Find cable assets in the DB that match the required cable standard.
 * Falls back to a generic option if none found.
 */
function findCableAssets(
  cableLabel: string,
  standard: PortType,
  allAssets: Asset[],
): CableOption[] {
  const cables = allAssets.filter(a => a.category === 'cable');
  const matched: CableOption[] = [];

  for (const c of cables) {
    // Match by checking if any port of the cable matches the required standard
    const hasPorts = c.ports.some(p =>
      p.standard === standard ||
      (standard === 'hdmi-out' && (p.standard === 'hdmi' || p.standard === 'hdmi-in')) ||
      (standard === 'hdmi-in'  && (p.standard === 'hdmi' || p.standard === 'hdmi-out')) ||
      (standard === 'rj45'     && (p.standard === 'rj45' || p.standard === 'rj45-poe')) ||
      (standard === 'usb-a'    && ['usb-a', 'usb-b', 'usb-c', 'usb-micro'].includes(p.standard)) ||
      (standard === 'usb-micro' && ['usb-a', 'usb-micro'].includes(p.standard)) ||
      (standard === 'logi-micpod-out' && p.standard.startsWith('logi-micpod')) ||
      (standard === 'power-adapter' && (p.standard === 'power' || p.standard === 'power-adapter'))
    );
    if (hasPorts) {
      matched.push({ assetId: c.id, label: `${c.vendor} ${c.model}`, vendor: c.vendor, model: c.model });
    }
  }

  // Deduplicate and add generic fallback if nothing found
  if (matched.length === 0) {
    matched.push({ assetId: null, label: cableLabel });
  }

  return matched;
}

/**
 * Find intermediate device assets (e.g. power adapters) in the DB.
 */
function findIntermediateAssets(
  hint: string,
  fromPort: PortDef,
  allAssets: Asset[],
): CableOption[] {
  const matches: CableOption[] = [];
  for (const a of allAssets) {
    // A power adapter bridges power-adapter ↔ power
    if (hint === 'power-adapter') {
      const hasPowerAdapterIn  = a.ports.some(p => p.standard === 'power-adapter' && p.maleFemale === 'male');
      const hasPowerOut        = a.ports.some(p => p.standard === 'power' && p.maleFemale === 'male');
      if (hasPowerAdapterIn && hasPowerOut) {
        matches.push({ assetId: a.id, label: `${a.vendor} ${a.model}`, vendor: a.vendor, model: a.model });
      }
    }
  }
  return matches;
}

// ── Main validation ───────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface CableSuggestion {
  rule: PairingRule;
  /** For direct/adapter-cable: selectable cable options */
  cableOptions: CableOption[];
  /** For intermediate: selectable intermediate device options */
  intermediateOptions?: CableOption[];
  /** The "canonical" standard used for DB lookup */
  lookupStandard: PortType;
  fromPort: PortDef;
  toPort: PortDef;
}

export function validateConnection(a: PortDef, b: PortDef): ValidationResult {
  if (!layersCompatible(a, b)) {
    return { valid: false, error: `Inkompatible Layer: ${a.layer} ↔ ${b.layer}` };
  }
  const pairing = PAIRINGS.get(key(a.standard, b.standard));
  if (!pairing || pairing.kind === 'incompatible') {
    return { valid: false, error: `Inkompatible Standards: ${a.standard} ↔ ${b.standard}` };
  }
  return { valid: true };
}

export function buildCableSuggestion(
  fromPort: PortDef,
  toPort: PortDef,
  allAssets: Asset[],
): CableSuggestion | null {
  const pairing = PAIRINGS.get(key(fromPort.standard, toPort.standard));
  if (!pairing || pairing.kind === 'incompatible') return null;

  // ── Direct Connect: plug (male) → socket (female), same standard ──────────
  // One is a plug, the other a socket, and they share the same physical standard.
  const samePhysical =
    fromPort.standard === toPort.standard ||
    (fromPort.standard === 'hdmi-out' && toPort.standard === 'hdmi-in') ||
    (fromPort.standard === 'hdmi-in'  && toPort.standard === 'hdmi-out') ||
    (fromPort.standard === 'logi-micpod-out' && toPort.standard === 'logi-micpod-in') ||
    (fromPort.standard === 'logi-micpod-in'  && toPort.standard === 'logi-micpod-out');

  const oneMale   = fromPort.maleFemale === 'male' || toPort.maleFemale === 'male';
  const oneFemale = fromPort.maleFemale === 'female' || toPort.maleFemale === 'female';
  const isDirectConnect = samePhysical && oneMale && oneFemale;

  if (isDirectConnect) {
    return {
      rule: { kind: 'direct-connect' },
      cableOptions: [],
      lookupStandard: fromPort.standard,
      fromPort,
      toPort,
    };
  }

  // Canonical standard: prefer the "out" side, or hdmi/rj45/usb-a as anchor
  const anchor: PortType =
    fromPort.standard === 'hdmi-out'        ? 'hdmi-out' :
    toPort.standard   === 'hdmi-out'        ? 'hdmi-out' :
    fromPort.standard === 'logi-micpod-out' ? 'logi-micpod-out' :
    toPort.standard   === 'logi-micpod-out' ? 'logi-micpod-out' :
    fromPort.standard;

  const cableOptions = pairing.cableLabel
    ? findCableAssets(pairing.cableLabel, anchor, allAssets)
    : [];

  const intermediateOptions = pairing.kind === 'intermediate' && pairing.intermediateHint
    ? findIntermediateAssets(pairing.intermediateHint, fromPort, allAssets)
    : undefined;

  return { rule: pairing, cableOptions, intermediateOptions, lookupStandard: anchor, fromPort, toPort };
}
