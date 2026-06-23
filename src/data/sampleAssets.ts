import { Asset } from '../types';

const now = new Date().toISOString();

export const SAMPLE_ASSETS: Asset[] = [
  // ── Displays ────────────────────────────────────────────────────────────────
  {
    id: 'lg-65-qned85',
    name: 'LG 65" QNED85',
    manufacturer: 'LG',
    model: 'QNED85',
    category: 'display',
    width: 220,
    height: 130,
    physicalWidth: 1456,
    physicalHeight: 840,
    color: '#1F2937',
    ports: [
      { id: 'hdmi-in-1', label: 'HDMI In 1', type: 'hdmi-in', direction: 'in', layer: 'video', position: { x: 0.75, y: 0.92 }, compatibleWith: ['hdmi-out'] },
      { id: 'hdmi-in-2', label: 'HDMI In 2', type: 'hdmi-in', direction: 'in', layer: 'video', position: { x: 0.84, y: 0.92 }, compatibleWith: ['hdmi-out'] },
      { id: 'hdmi-in-3', label: 'HDMI In 3', type: 'hdmi-in', direction: 'in', layer: 'video', position: { x: 0.93, y: 0.92 }, compatibleWith: ['hdmi-out'] },
      { id: 'usb-a-1',   label: 'USB-A 1',   type: 'usb-a',   direction: 'in', layer: 'usb',   position: { x: 0.75, y: 0.80 }, compatibleWith: ['usb-a', 'usb-c-out'] },
      { id: 'usb-a-2',   label: 'USB-A 2',   type: 'usb-a',   direction: 'in', layer: 'usb',   position: { x: 0.84, y: 0.80 }, compatibleWith: ['usb-a', 'usb-c-out'] },
      { id: 'power-in',  label: 'Power',      type: 'power-c13', direction: 'in', layer: 'power', position: { x: 0.5, y: 0.97 }, compatibleWith: ['power-c14'] },
    ],
    attachmentPoints: [
      { id: 'top-center',    edge: 'top',    position: 0.5, role: 'host', accepts: ['mount'] },
      { id: 'bottom-center', edge: 'bottom', position: 0.5, role: 'host', accepts: ['mount'] },
    ],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'lg-86-qned85',
    name: 'LG 86" QNED85',
    manufacturer: 'LG',
    model: 'QNED85 86"',
    category: 'display',
    width: 280,
    height: 165,
    physicalWidth: 1916,
    physicalHeight: 1105,
    color: '#1F2937',
    ports: [
      { id: 'hdmi-in-1', label: 'HDMI In 1', type: 'hdmi-in', direction: 'in', layer: 'video', position: { x: 0.75, y: 0.92 }, compatibleWith: ['hdmi-out'] },
      { id: 'hdmi-in-2', label: 'HDMI In 2', type: 'hdmi-in', direction: 'in', layer: 'video', position: { x: 0.84, y: 0.92 }, compatibleWith: ['hdmi-out'] },
      { id: 'hdmi-in-3', label: 'HDMI In 3', type: 'hdmi-in', direction: 'in', layer: 'video', position: { x: 0.93, y: 0.92 }, compatibleWith: ['hdmi-out'] },
      { id: 'usb-a-1',   label: 'USB-A',     type: 'usb-a',   direction: 'in', layer: 'usb',   position: { x: 0.75, y: 0.80 }, compatibleWith: ['usb-a', 'usb-c-out'] },
      { id: 'power-in',  label: 'Power',      type: 'power-c13', direction: 'in', layer: 'power', position: { x: 0.5, y: 0.97 }, compatibleWith: ['power-c14'] },
    ],
    attachmentPoints: [
      { id: 'top-center',    edge: 'top',    position: 0.5, role: 'host', accepts: ['mount'] },
      { id: 'bottom-center', edge: 'bottom', position: 0.5, role: 'host', accepts: ['mount'] },
    ],
    createdAt: now, updatedAt: now,
  },

  // ── Video Bars ───────────────────────────────────────────────────────────────
  {
    id: 'logi-rally-bar',
    name: 'Rally Bar',
    manufacturer: 'Logitech',
    model: 'Rally Bar',
    category: 'collaboration-system',
    width: 180,
    height: 52,
    physicalWidth: 700,
    physicalHeight: 140,
    color: '#111827',
    supportsMicPodPorts: true,
    micPodChainLimits: { maxPods: 7, maxHubs: 0, description: 'Rally Bar: up to 7 MicPods direct, no hub' },
    requires: ['logi-rally-bar-psu'],
    ports: [
      // TOP exits → connect upward to LG display
      { id: 'hdmi-out-1',   label: 'HDMI Out 1',  type: 'hdmi-out',  direction: 'out',          layer: 'video',    position: { x: 0.88, y: 0.03 }, compatibleWith: ['hdmi-in'] },
      { id: 'rj45',         label: 'Ethernet',    type: 'rj45',      direction: 'bidirectional', layer: 'ethernet', position: { x: 0.25, y: 0.03 }, compatibleWith: ['rj45', 'rj45-poe'] },
      // LEFT exits → connect leftward to Extend RX
      { id: 'hdmi-in',      label: 'HDMI In',     type: 'hdmi-in',   direction: 'in',           layer: 'video',    position: { x: 0.03, y: 0.20 }, compatibleWith: ['hdmi-out'] },
      { id: 'usb-c-host',   label: 'USB-C',       type: 'usb-c',     direction: 'out',          layer: 'usb',      position: { x: 0.03, y: 0.45 }, compatibleWith: ['usb-c', 'usb-a'] },
      { id: 'usb-a-host',   label: 'USB-A',       type: 'usb-a',     direction: 'out',          layer: 'usb',      position: { x: 0.03, y: 0.65 }, compatibleWith: ['usb-a'] },
      // USB-A for Cat5e Dongle (left) + Mic USB (bottom-left area)
      { id: 'usb-a-host-2', label: 'USB-A 2',     type: 'usb-a',     direction: 'out',          layer: 'usb',      position: { x: 0.03, y: 0.85 }, compatibleWith: ['usb-a'] },
      // BOTTOM exit → connect downward to MicPod chain
      { id: 'micpod-port',  label: 'MicPod Port', type: 'logi-micpod-host', direction: 'in',   layer: 'other',    position: { x: 0.50, y: 0.97 }, compatibleWith: ['logi-micpod-out', 'logi-micpod'] },
      // RIGHT exit → connect rightward to PSU
      { id: 'power-in',     label: 'Power',       type: 'power-c13', direction: 'in',           layer: 'power',    position: { x: 0.97, y: 0.50 }, compatibleWith: ['power-c14'] },
    ],
    attachmentPoints: [
      { id: 'bottom-mount', edge: 'bottom', position: 0.5, role: 'guest', accepts: ['mount'] },
    ],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'logi-rally-bar-mini',
    name: 'Rally Bar Mini',
    manufacturer: 'Logitech',
    model: 'Rally Bar Mini',
    category: 'collaboration-system',
    width: 145,
    height: 46,
    physicalWidth: 575,
    physicalHeight: 90,
    color: '#111827',
    ports: [
      { id: 'hdmi-out',   label: 'HDMI Out',   type: 'hdmi-out',  direction: 'out',          layer: 'video',    position: { x: 0.88, y: 0.5 }, compatibleWith: ['hdmi-in'] },
      { id: 'usb-c-host', label: 'USB-C Host', type: 'usb-c',     direction: 'out',          layer: 'usb',      position: { x: 0.76, y: 0.5 }, compatibleWith: ['usb-c', 'usb-a'] },
      { id: 'rj45',       label: 'Ethernet',   type: 'rj45',      direction: 'bidirectional', layer: 'ethernet', position: { x: 0.62, y: 0.5 }, compatibleWith: ['rj45', 'rj45-poe'] },
      { id: 'power-in',   label: 'Power',      type: 'power-c13', direction: 'in',           layer: 'power',    position: { x: 0.97, y: 0.5 }, compatibleWith: ['power-c14'] },
    ],
    attachmentPoints: [
      { id: 'bottom-mount', edge: 'bottom', position: 0.5, role: 'guest', accepts: ['mount'] },
    ],
    createdAt: now, updatedAt: now,
  },

  // ── Controller ───────────────────────────────────────────────────────────────
  {
    id: 'logi-tap-ip',
    name: 'Tap IP',
    manufacturer: 'Logitech',
    model: 'Tap IP',
    category: 'controller',
    width: 95,
    height: 58,
    physicalWidth: 218,
    physicalHeight: 130,
    color: '#1F2937',
    ports: [
      { id: 'rj45',     label: 'Ethernet (PoE)', type: 'rj45-poe', direction: 'bidirectional', layer: 'ethernet', position: { x: 0.5,  y: 0.97 }, compatibleWith: ['rj45', 'rj45-poe'] },
      { id: 'usb-c',    label: 'USB-C',          type: 'usb-c',    direction: 'bidirectional', layer: 'usb',      position: { x: 0.25, y: 0.97 }, compatibleWith: ['usb-c'] },
      { id: 'power-in', label: 'Power',          type: 'power-c13', direction: 'in', layer: 'power', position: { x: 0.75, y: 0.97 }, compatibleWith: ['power-c14'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'logi-tap-cat5e',
    name: 'Tap Cat5e',
    manufacturer: 'Logitech',
    model: 'Tap Cat5e',
    category: 'controller',
    width: 95,
    height: 58,
    color: '#1F2937',
    ports: [
      // RJ45 PoE: TAP bekommt PoE vom PoE Adapter (Strom + Daten)
      { id: 'rj45-poe',  label: 'RJ45 PoE (PoE Adapter)',    type: 'rj45-poe', direction: 'bidirectional', layer: 'ethernet', position: { x: 0.35, y: 0.97 }, compatibleWith: ['rj45-poe'],
        cablePeers: [{ assetId: 'logi-poe-adapter', portIds: ['rj45-poe-out'] }] },
      // RJ45 P2P: TAP → Cat5e Extender Dongle (NICHT Rally Bar RJ45 — kein PoE dort)
      // Diese Verbindung läuft über PoE Adapter LAN-In → Cat5e Extender Dongle → Rally Bar USB-A
      // cablePeers einschränken: nur zu PoE Adapter rj45-lan erlaubt
      { id: 'rj45-p2p',  label: 'RJ45 P2P (to PoE LAN-In)',  type: 'rj45',     direction: 'bidirectional', layer: 'ethernet', position: { x: 0.65, y: 0.97 }, compatibleWith: ['rj45'],
        cablePeers: [{ assetId: 'logi-poe-adapter', portIds: ['rj45-lan'] }] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },

  // ── Mount ────────────────────────────────────────────────────────────────────
  {
    id: 'logi-mount-video-bar',
    name: 'Mount for Video Bars',
    manufacturer: 'Logitech',
    model: 'TV Mount for Video Bars',
    category: 'mount',
    width: 80,
    height: 28,
    color: '#374151',
    ports: [],
    attachmentPoints: [
      { id: 'top-to-tv',     edge: 'top',    position: 0.5, role: 'guest', accepts: ['display'] },
      { id: 'bottom-to-tv',  edge: 'bottom', position: 0.5, role: 'guest', accepts: ['display'] },
      { id: 'inner-for-bar', edge: 'top',    position: 0.5, role: 'host',  accepts: ['collaboration-system'] },
    ],
    createdAt: now, updatedAt: now,
  },

  // ── Switcher / Hub ───────────────────────────────────────────────────────────
  {
    id: 'hdmi-switcher-4x1',
    name: 'HDMI Switcher 4×1',
    manufacturer: 'Generic',
    model: 'HDMI 4×1 Switch',
    category: 'collab-extension',
    width: 120,
    height: 52,
    color: '#374151',
    ports: [
      { id: 'hdmi-in-1',  label: 'HDMI In 1', type: 'hdmi-in',  direction: 'in',  layer: 'video', position: { x: 0.1, y: 0.03 }, compatibleWith: ['hdmi-out'] },
      { id: 'hdmi-in-2',  label: 'HDMI In 2', type: 'hdmi-in',  direction: 'in',  layer: 'video', position: { x: 0.3, y: 0.03 }, compatibleWith: ['hdmi-out'] },
      { id: 'hdmi-in-3',  label: 'HDMI In 3', type: 'hdmi-in',  direction: 'in',  layer: 'video', position: { x: 0.5, y: 0.03 }, compatibleWith: ['hdmi-out'] },
      { id: 'hdmi-in-4',  label: 'HDMI In 4', type: 'hdmi-in',  direction: 'in',  layer: 'video', position: { x: 0.7, y: 0.03 }, compatibleWith: ['hdmi-out'] },
      { id: 'hdmi-out-1', label: 'HDMI Out',  type: 'hdmi-out', direction: 'out', layer: 'video', position: { x: 0.9, y: 0.03 }, compatibleWith: ['hdmi-in'] },
      { id: 'power-in',   label: 'Power',     type: 'power-eu', direction: 'in',  layer: 'power', position: { x: 0.5, y: 0.97 }, compatibleWith: ['power-eu'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },

  // ── Adapter ──────────────────────────────────────────────────────────────────
  {
    id: 'logi-poe-adapter',
    name: 'PoE Adapter',
    manufacturer: 'Logitech',
    model: 'PoE Injector',
    category: 'device-content',
    width: 80,
    height: 55,
    color: '#1F2937',
    cableLengthLimit: {
      portIds: ['rj45-lan', 'rj45-poe-out'],
      maxMeters: 30,
      description: 'Logitech: Combined cable length LAN-In + PoE-Out ≤ 30m',
    },
    ports: [
      // LAN In: kommt vom Cat5e Extender Dongle RJ45 (der ist am Rally Bar USB-A)
      { id: 'rj45-lan',    label: 'LAN In (Cat5e Dongle)',  type: 'rj45', direction: 'in',  layer: 'ethernet', position: { x: 0.15, y: 0.97 }, compatibleWith: ['rj45'],
        cablePeers: [{ assetId: 'logi-cat5e-extender-dongle', portIds: ['rj45'] }, { assetId: 'logi-tap-cat5e', portIds: ['rj45-p2p'] }] },
      // PoE Out: geht zum TAP Cat5e
      { id: 'rj45-poe-out',label: 'PoE Out (to TAP)',       type: 'rj45-poe', direction: 'out', layer: 'ethernet', position: { x: 0.85, y: 0.97 }, compatibleWith: ['rj45-poe'],
        cablePeers: [{ assetId: 'logi-tap-cat5e', portIds: ['rj45-poe'] }] },
      // AC Power
      { id: 'power-in',    label: 'Power',                  type: 'power-eu', direction: 'in',  layer: 'power', position: { x: 0.5,  y: 0.03 }, compatibleWith: ['power-eu-out'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'logi-cat5e-extender-dongle',
    name: 'Cat5e Extender USB Dongle',
    manufacturer: 'Logitech',
    model: 'Cat5e Extender Dongle (USB-A)',
    category: 'device-content',
    width: 70,
    height: 28,
    color: '#374151',
    ports: [
      // RJ45: verbindet mit PoE Adapter LAN-In
      { id: 'rj45',  label: 'RJ45 (to PoE Adapter LAN-In)', type: 'rj45', direction: 'in',  layer: 'ethernet', position: { x: 0.03, y: 0.5 }, compatibleWith: ['rj45'],
        cablePeers: [{ assetId: 'logi-poe-adapter', portIds: ['rj45-lan'] }] },
      // USB-A Stecker: steckt direkt in Rally Bar USB-A (plug → socket, kein Kabel)
      { id: 'usb-a', label: 'USB-A Stecker (→ Rally Bar)', type: 'usb-a', direction: 'out', layer: 'usb', position: { x: 0.97, y: 0.5 }, compatibleWith: ['usb-a'],
        connector: 'plug',
        cablePeers: [{ assetId: 'logi-rally-bar', portIds: ['usb-a-host'] }] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'rj45-usb-a-adapter',
    name: 'RJ45 to USB-A Adapter',
    manufacturer: 'Generic',
    model: 'RJ45 USB-A Adapter',
    category: 'device-content',
    width: 65,
    height: 35,
    color: '#374151',
    ports: [
      { id: 'rj45',  label: 'RJ45',  type: 'rj45',  direction: 'bidirectional', layer: 'ethernet', position: { x: 0.1, y: 0.5 }, compatibleWith: ['rj45', 'rj45-poe'] },
      { id: 'usb-a', label: 'USB-A Stecker', type: 'usb-a', direction: 'out', layer: 'usb', position: { x: 0.9, y: 0.5 }, compatibleWith: ['usb-a'],
        connector: 'plug' },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },

  // ── Infrastruktur ─────────────────────────────────────────────────────────────
  {
    id: 'schuko-outlet',
    name: 'Power Outlet',
    manufacturer: 'Infrastruktur',
    model: 'Schuko CEE 7/3',
    category: 'infrastructure',
    width: 55,
    height: 55,
    color: '#F3F4F6',
    ports: [
      { id: 'power-out-1', label: 'Power Out 1', type: 'power-eu-out', direction: 'out', layer: 'power', position: { x: 0.3, y: 0.03 }, compatibleWith: ['power-eu'] },
      { id: 'power-out-2', label: 'Power Out 2', type: 'power-eu-out', direction: 'out', layer: 'power', position: { x: 0.7, y: 0.03 }, compatibleWith: ['power-eu'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'ethernet-wall-port',
    name: 'Ethernet Wall Port',
    manufacturer: 'Infrastruktur',
    model: 'LAN Port (Corporate Network)',
    category: 'infrastructure',
    width: 55,
    height: 40,
    color: '#F59E0B',
    ports: [
      { id: 'rj45-out', label: 'LAN (Corporate)', type: 'rj45', direction: 'out', layer: 'ethernet', position: { x: 0.5, y: 0.5 }, compatibleWith: ['rj45'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },

  // ── Kabel ────────────────────────────────────────────────────────────────────
  {
    id: 'logi-hdmi-cable-1m',
    name: 'HDMI Cable 1m',
    manufacturer: 'Logitech',
    model: 'HDMI 2.0 1m',
    category: 'cable',
    width: 70,
    height: 14,
    color: '#111827',
    cableLength: 1,
    ports: [
      { id: 'a', label: 'HDMI A', type: 'hdmi-out', direction: 'bidirectional', layer: 'video', position: { x: 0.05, y: 0.5 }, compatibleWith: ['hdmi-in', 'hdmi-out'] },
      { id: 'b', label: 'HDMI B', type: 'hdmi-in',  direction: 'bidirectional', layer: 'video', position: { x: 0.95, y: 0.5 }, compatibleWith: ['hdmi-in', 'hdmi-out'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'logi-hdmi-cable-2m',
    name: 'HDMI Cable 2m',
    manufacturer: 'Logitech',
    model: 'HDMI 2.0 2m',
    category: 'cable',
    width: 70,
    height: 14,
    color: '#111827',
    cableLength: 2,
    ports: [
      { id: 'a', label: 'HDMI A', type: 'hdmi-out', direction: 'bidirectional', layer: 'video', position: { x: 0.05, y: 0.5 }, compatibleWith: ['hdmi-in', 'hdmi-out'] },
      { id: 'b', label: 'HDMI B', type: 'hdmi-in',  direction: 'bidirectional', layer: 'video', position: { x: 0.95, y: 0.5 }, compatibleWith: ['hdmi-in', 'hdmi-out'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'lightware-hdmi-cable-2m',
    name: 'HDMI Cable 2m',
    manufacturer: 'Lightware',
    model: 'HDMI 2.0 Active 2m',
    category: 'cable',
    width: 70,
    height: 14,
    color: '#1E40AF',
    cableLength: 2,
    ports: [
      { id: 'a', label: 'HDMI A', type: 'hdmi-out', direction: 'bidirectional', layer: 'video', position: { x: 0.05, y: 0.5 }, compatibleWith: ['hdmi-in', 'hdmi-out'] },
      { id: 'b', label: 'HDMI B', type: 'hdmi-in',  direction: 'bidirectional', layer: 'video', position: { x: 0.95, y: 0.5 }, compatibleWith: ['hdmi-in', 'hdmi-out'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'logi-usbc-usba-cable',
    name: 'USB-C to USB-A Cable',
    manufacturer: 'Logitech',
    model: 'USB-C / USB-A 2m',
    category: 'cable',
    width: 70,
    height: 14,
    color: '#065F46',
    cableLength: 2,
    ports: [
      { id: 'a', label: 'USB-C', type: 'usb-c', direction: 'bidirectional', layer: 'usb', position: { x: 0.05, y: 0.5 }, compatibleWith: ['usb-c', 'usb-c-out'] },
      { id: 'b', label: 'USB-A', type: 'usb-a', direction: 'bidirectional', layer: 'usb', position: { x: 0.95, y: 0.5 }, compatibleWith: ['usb-a'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'usbc-usbc-cable',
    name: 'USB-C to USB-C Cable',
    manufacturer: 'Generic',
    model: 'USB-C 3.1 2m',
    category: 'cable',
    width: 70,
    height: 14,
    color: '#047857',
    cableLength: 2,
    ports: [
      { id: 'a', label: 'USB-C A', type: 'usb-c', direction: 'bidirectional', layer: 'usb', position: { x: 0.05, y: 0.5 }, compatibleWith: ['usb-c', 'usb-c-out'] },
      { id: 'b', label: 'USB-C B', type: 'usb-c', direction: 'bidirectional', layer: 'usb', position: { x: 0.95, y: 0.5 }, compatibleWith: ['usb-c', 'usb-c-out'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'cat5e-cable-5m',
    name: 'Cat5e Cable 5m',
    manufacturer: 'Generic',
    model: 'Cat5e Patch 5m',
    category: 'cable',
    width: 70,
    height: 14,
    color: '#92400E',
    cableLength: 5,
    ports: [
      { id: 'a', label: 'RJ45 A', type: 'rj45', direction: 'bidirectional', layer: 'ethernet', position: { x: 0.05, y: 0.5 }, compatibleWith: ['rj45', 'rj45-poe'] },
      { id: 'b', label: 'RJ45 B', type: 'rj45', direction: 'bidirectional', layer: 'ethernet', position: { x: 0.95, y: 0.5 }, compatibleWith: ['rj45', 'rj45-poe'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'cat5e-cable-10m',
    name: 'Cat5e Cable 10m',
    manufacturer: 'Generic',
    model: 'Cat5e Patch 10m',
    category: 'cable',
    width: 70,
    height: 14,
    color: '#92400E',
    cableLength: 10,
    ports: [
      { id: 'a', label: 'RJ45 A', type: 'rj45', direction: 'bidirectional', layer: 'ethernet', position: { x: 0.05, y: 0.5 }, compatibleWith: ['rj45', 'rj45-poe'] },
      { id: 'b', label: 'RJ45 B', type: 'rj45', direction: 'bidirectional', layer: 'ethernet', position: { x: 0.95, y: 0.5 }, compatibleWith: ['rj45', 'rj45-poe'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'cat6a-p2p-cable',
    name: 'Cat6a P2P Cable 2m',
    manufacturer: 'Generic',
    model: 'Cat6a Patch 2m',
    category: 'cable',
    width: 70,
    height: 14,
    color: '#92400E',
    cableLength: 2,
    ports: [
      { id: 'a', label: 'RJ45 A', type: 'rj45', direction: 'bidirectional', layer: 'ethernet', position: { x: 0.05, y: 0.5 }, compatibleWith: ['rj45', 'rj45-poe'] },
      { id: 'b', label: 'RJ45 B', type: 'rj45', direction: 'bidirectional', layer: 'ethernet', position: { x: 0.95, y: 0.5 }, compatibleWith: ['rj45', 'rj45-poe'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'cat6-cable-15m',
    name: 'Cat6 Cable 15m',
    manufacturer: 'Generic',
    model: 'Cat6 Patch 15m',
    category: 'cable',
    width: 70,
    height: 14,
    color: '#92400E',
    cableLength: 15,
    ports: [
      { id: 'a', label: 'RJ45 A', type: 'rj45', direction: 'bidirectional', layer: 'ethernet', position: { x: 0.05, y: 0.5 }, compatibleWith: ['rj45', 'rj45-poe'] },
      { id: 'b', label: 'RJ45 B', type: 'rj45', direction: 'bidirectional', layer: 'ethernet', position: { x: 0.95, y: 0.5 }, compatibleWith: ['rj45', 'rj45-poe'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'power-c13-cable',
    name: 'Power Cable C13',
    manufacturer: 'Generic',
    model: 'C13 / Schuko 1.8m',
    category: 'cable',
    width: 70,
    height: 14,
    color: '#7F1D1D',
    cableLength: 1.8,
    ports: [
      { id: 'a', label: 'C14 (Device)', type: 'power-c14',    direction: 'out', layer: 'power', position: { x: 0.05, y: 0.5 }, compatibleWith: ['power-c13'] },
      { id: 'b', label: 'Schuko',      type: 'power-eu',     direction: 'in',  layer: 'power', position: { x: 0.95, y: 0.5 }, compatibleWith: ['power-eu-out'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },

  // ── Rally Bar PSU ────────────────────────────────────────────────────────────
  {
    id: 'logi-rally-bar-psu',
    name: 'Rally Bar PSU',
    manufacturer: 'Logitech',
    model: 'Rally Bar Power Supply',
    category: 'device-content',
    width: 90,
    height: 55,
    color: '#1F2937',
    ports: [
      // RIGHT exits → connect rightward to Rally Bar
      { id: 'power-out', label: 'Power Out (to Rally Bar)', type: 'power-c14', direction: 'out', layer: 'power', position: { x: 0.97, y: 0.50 }, compatibleWith: ['power-c13'] },
      // BOTTOM exit → connect downward to Schuko
      { id: 'power-in',  label: 'Power (Schuko)',           type: 'power-eu',  direction: 'in',  layer: 'power', position: { x: 0.50, y: 0.97 }, compatibleWith: ['power-eu-out'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },

  // ── Logitech Extend RX / TX ──────────────────────────────────────────────────
  {
    id: 'logi-extend-rx',
    name: 'Extend RX',
    manufacturer: 'Logitech',
    model: 'Logitech Extend RX',
    category: 'collab-extension',
    width: 100,
    height: 50,
    color: '#1F2937',
    ports: [
      // RIGHT exits → connect rightward to Rally Bar
      { id: 'hdmi-out',  label: 'HDMI Out', type: 'hdmi-out',  direction: 'out',          layer: 'video',    position: { x: 0.97, y: 0.20 }, compatibleWith: ['hdmi-in'] },
      { id: 'usb-a',     label: 'USB-A',    type: 'usb-a',     direction: 'in',           layer: 'usb',      position: { x: 0.97, y: 0.45 }, compatibleWith: ['usb-a', 'usb-c'] },
      { id: 'usb-micro', label: 'MicroUSB', type: 'usb-micro', direction: 'out',          layer: 'usb',      position: { x: 0.97, y: 0.70 }, compatibleWith: ['usb-micro', 'usb-a'] },
      // BOTTOM exit → RJ45 connects downward to Extend TX (directly below)
      { id: 'rj45',      label: 'RJ45',     type: 'rj45',      direction: 'bidirectional', layer: 'ethernet', position: { x: 0.50, y: 0.97 }, compatibleWith: ['rj45'] },
      // TOP exit → AC power from Schuko (above)
      { id: 'power-in',  label: 'AC Power', type: 'power-eu',  direction: 'in',           layer: 'power',    position: { x: 0.15, y: 0.03 }, compatibleWith: ['power-eu-out'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'logi-extend-tx',
    name: 'Extend TX',
    manufacturer: 'Logitech',
    model: 'Logitech Extend TX',
    category: 'collab-extension',
    width: 100,
    height: 50,
    color: '#1F2937',
    ports: [
      // TOP exit → RJ45 connects upward to Extend RX (directly above)
      { id: 'rj45',      label: 'RJ45',          type: 'rj45',      direction: 'bidirectional', layer: 'ethernet', position: { x: 0.15, y: 0.03 }, compatibleWith: ['rj45'] },
      // LEFT exit → USB-A for MicPod (Mic USB)
      { id: 'usb-a-out', label: 'USB-A (Mic)',   type: 'usb-a',     direction: 'out',           layer: 'usb',      position: { x: 0.03, y: 0.50 }, compatibleWith: ['usb-a'] },
      // RIGHT exits → HDMI In from content player / Laptop; USB-C passthrough to Laptop (100W)
      { id: 'hdmi-in',   label: 'HDMI In',        type: 'hdmi-in',   direction: 'in',            layer: 'video',    position: { x: 0.97, y: 0.25 }, compatibleWith: ['hdmi-out'] },
      { id: 'usb-c-out', label: 'USB-C (100W)',   type: 'usb-c',     direction: 'out',           layer: 'usb',      position: { x: 0.97, y: 0.50 }, compatibleWith: ['usb-c', 'usb-c-out'] },
      { id: 'usb-c-pwr', label: 'USB-C Power In', type: 'usb-c',     direction: 'in',            layer: 'power',    position: { x: 0.97, y: 0.75 }, compatibleWith: ['usb-c', 'usb-c-out'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },

  // ── LG 65" UH5-Q ────────────────────────────────────────────────────────────
  {
    id: 'lg-65-uh5q',
    name: 'LG 65" UH5-Q',
    manufacturer: 'LG',
    model: 'UH5-Q 65"',
    category: 'display',
    width: 220,
    height: 130,
    physicalWidth: 1448,
    physicalHeight: 838,
    color: '#1F2937',
    ports: [
      { id: 'hdmi-in-1', label: 'HDMI In 1', type: 'hdmi-in',    direction: 'in', layer: 'video', position: { x: 0.70, y: 0.97 }, compatibleWith: ['hdmi-out'] },
      { id: 'hdmi-in-2', label: 'HDMI In 2', type: 'hdmi-in',    direction: 'in', layer: 'video', position: { x: 0.82, y: 0.97 }, compatibleWith: ['hdmi-out'] },
      { id: 'usb-a-1',   label: 'USB-A',     type: 'usb-a',      direction: 'in', layer: 'usb',   position: { x: 0.94, y: 0.97 }, compatibleWith: ['usb-a', 'usb-c-out'] },
      { id: 'power-in',  label: 'Power',     type: 'power-eu',   direction: 'in', layer: 'power', position: { x: 0.03, y: 0.97 }, compatibleWith: ['power-eu-out'] },
    ],
    attachmentPoints: [
      { id: 'top-center',    edge: 'top',    position: 0.5, role: 'host', accepts: ['mount'] },
      { id: 'bottom-center', edge: 'bottom', position: 0.5, role: 'host', accepts: ['mount'] },
    ],
    createdAt: now, updatedAt: now,
  },

  // ── MicPod ───────────────────────────────────────────────────────────────────
  {
    id: 'logi-micpod',
    name: 'MicPod',
    manufacturer: 'Logitech',
    model: 'Rally MicPod',
    category: 'collab-extension',
    width: 60,
    height: 60,
    color: '#111827',
    supportsMicPodPorts: true,
    ports: [
      { id: 'micpod-out',  label: 'MicPod Stecker', type: 'logi-micpod-out', direction: 'out', layer: 'other', position: { x: 0.5, y: 0.97 }, compatibleWith: ['logi-micpod-host', 'logi-micpod-in'] },
      { id: 'micpod-in',   label: 'MicPod Port',    type: 'logi-micpod-in',  direction: 'in',  layer: 'other', position: { x: 0.5, y: 0.03 }, compatibleWith: ['logi-micpod-out'] },
      // USB-A: Mic USB cable to Rally Bar or Extend TX
      { id: 'usb-a',       label: 'Mic USB',        type: 'usb-a',           direction: 'out', layer: 'usb',   position: { x: 0.97, y: 0.5 },  compatibleWith: ['usb-a'], connector: 'plug' as const },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },

  // ── MicroUSB zu USB-A Kabel ──────────────────────────────────────────────────
  {
    id: 'logi-microusb-usba-cable',
    name: 'MicroUSB to USB-A Cable',
    manufacturer: 'Logitech',
    model: 'MicroUSB / USB-A 1m',
    category: 'cable',
    width: 70,
    height: 14,
    color: '#065F46',
    cableLength: 1,
    ports: [
      { id: 'a', label: 'MicroUSB', type: 'usb-micro', direction: 'bidirectional', layer: 'usb', position: { x: 0.05, y: 0.5 }, compatibleWith: ['usb-micro', 'usb-a'] },
      { id: 'b', label: 'USB-A',    type: 'usb-a',     direction: 'bidirectional', layer: 'usb', position: { x: 0.95, y: 0.5 }, compatibleWith: ['usb-micro', 'usb-a'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },

  // ── MicPod Kabel (direkt) ─────────────────────────────────────────────────────
  {
    id: 'logi-micpod-cable',
    name: 'MicPod Cable',
    manufacturer: 'Logitech',
    model: 'Rally MicPod Extension Cable',
    category: 'cable',
    width: 70,
    height: 14,
    color: '#6D28D9',
    cableLength: 1,
    ports: [
      { id: 'a', label: 'MicPod Out', type: 'logi-micpod-out', direction: 'bidirectional', layer: 'other', position: { x: 0.05, y: 0.5 }, compatibleWith: ['logi-micpod-host', 'logi-micpod-in', 'logi-micpod-out'] },
      { id: 'b', label: 'MicPod In',  type: 'logi-micpod-in',  direction: 'bidirectional', layer: 'other', position: { x: 0.95, y: 0.5 }, compatibleWith: ['logi-micpod-host', 'logi-micpod-in', 'logi-micpod-out'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },

  // ── User Laptop ───────────────────────────────────────────────────────────────
  {
    id: 'user-laptop',
    name: 'User Laptop',
    manufacturer: 'Generic',
    model: 'Laptop (USB-C)',
    category: 'pc',
    width: 120,
    height: 80,
    color: '#6B7280',
    ports: [
      // USB-C: HDMI + Power Delivery + USB data (all in one port as USB-C)
      { id: 'usb-c-1', label: 'USB-C (HDMI/Power/Data)', type: 'usb-c', direction: 'bidirectional', layer: 'usb', position: { x: 0.97, y: 0.50 }, compatibleWith: ['usb-c', 'usb-c-out'] },
      { id: 'usb-c-2', label: 'USB-C 2',                 type: 'usb-c', direction: 'bidirectional', layer: 'usb', position: { x: 0.97, y: 0.75 }, compatibleWith: ['usb-c', 'usb-c-out'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },

  // ── Logitech Extend PSU (Power Adapter 100W für TX-Seite) ─────────────────────
  {
    id: 'logi-extend-psu-100w',
    name: 'Logitech Power Adapter 100W',
    manufacturer: 'Logitech',
    model: 'Power Adapter 100W (Extend TX)',
    category: 'device-content',
    width: 90,
    height: 55,
    color: '#1F2937',
    ports: [
      // USB-C Out → Extend TX USB-C power input
      { id: 'usb-c-out', label: 'USB-C Out (100W)',  type: 'usb-c-out', direction: 'out', layer: 'power', position: { x: 0.97, y: 0.50 }, compatibleWith: ['usb-c'] },
      // Schuko mains input
      { id: 'power-in',  label: 'Power (Schuko)',    type: 'power-eu',  direction: 'in',  layer: 'power', position: { x: 0.50, y: 0.97 }, compatibleWith: ['power-eu-out'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },

  // ── USB-C Kabel 100W (für Laptop ↔ Extend TX) ────────────────────────────────
  {
    id: 'usbc-100w-cable',
    name: 'USB-C Cable 100W 2m',
    manufacturer: 'Logitech',
    model: 'USB-C 100W 2m',
    category: 'cable',
    width: 70,
    height: 14,
    color: '#DC2626',
    cableLength: 2,
    ports: [
      { id: 'a', label: 'USB-C A', type: 'usb-c', direction: 'bidirectional', layer: 'usb', position: { x: 0.05, y: 0.5 }, compatibleWith: ['usb-c', 'usb-c-out'] },
      { id: 'b', label: 'USB-C B', type: 'usb-c', direction: 'bidirectional', layer: 'usb', position: { x: 0.95, y: 0.5 }, compatibleWith: ['usb-c', 'usb-c-out'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },

  // ── USB-A Kabel (Mic USB) ──────────────────────────────────────────────────
  {
    id: 'usba-usba-cable',
    name: 'USB-A Cable 1.5m',
    manufacturer: 'Logitech',
    model: 'USB-A 1.5m (Mic USB)',
    category: 'cable',
    width: 70,
    height: 14,
    color: '#1D4ED8',
    cableLength: 1.5,
    ports: [
      { id: 'a', label: 'USB-A A', type: 'usb-a', direction: 'bidirectional', layer: 'usb', position: { x: 0.05, y: 0.5 }, compatibleWith: ['usb-a'] },
      { id: 'b', label: 'USB-A B', type: 'usb-a', direction: 'bidirectional', layer: 'usb', position: { x: 0.95, y: 0.5 }, compatibleWith: ['usb-a'] },
    ],
    attachmentPoints: [],
    createdAt: now, updatedAt: now,
  },
];
