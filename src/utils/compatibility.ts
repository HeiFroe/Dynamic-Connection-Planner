import { Asset, Port, AttachmentPoint, Connection } from '../types';

/**
 * True when port A's optional `cablePeers` whitelist allows the given (assetId, portId) peer.
 * If A has no cablePeers, anything is allowed.
 */
function peerAllowed(port: Port, peerAssetId: string, peerPortId: string): boolean {
  if (!port.cablePeers || port.cablePeers.length === 0) return true;
  return port.cablePeers.some(cp =>
    cp.assetId === peerAssetId && (!cp.portIds || cp.portIds.includes(peerPortId))
  );
}

/**
 * Both ports must accept each other as cable peers (symmetric whitelist check).
 * Used both for cable lookup and direct plug-to-socket connections.
 */
export function arePeersAllowed(
  portA: Port, assetA: Asset,
  portB: Port, assetB: Asset,
): boolean {
  return peerAllowed(portA, assetB.id, portB.id) && peerAllowed(portB, assetA.id, portA.id);
}

/**
 * Find cables whose two ends are type-compatible with portA / portB.
 * `cablePeers` is a device-to-device whitelist (e.g. Extend TX↔RX): it gates the final
 * peer device, NOT the intermediate cable. So we check arePeersAllowed once at the
 * device level, then per cable only verify type compatibility on each end.
 */
export function findCompatibleCables(
  portA: Port, assetA: Asset,
  portB: Port, assetB: Asset,
  assets: Asset[],
): Asset[] {
  if (!arePeersAllowed(portA, assetA, portB, assetB)) return [];
  return assets.filter(asset => {
    if (asset.category !== 'cable') return false;
    if (asset.ports.length < 2) return false;
    const [p0, p1] = asset.ports;
    const fwd = p0.compatibleWith.includes(portA.type) && p1.compatibleWith.includes(portB.type);
    const rev = p0.compatibleWith.includes(portB.type) && p1.compatibleWith.includes(portA.type);
    return fwd || rev;
  });
}

export function arePortsCompatible(portA: Port, portB: Port): boolean {
  if (portA.id === portB.id) return false;
  if (portA.direction === portB.direction && portA.direction !== 'bidirectional') return false;
  return portA.compatibleWith.includes(portB.type) || portB.compatibleWith.includes(portA.type);
}

/**
 * True when one side is a 'plug' and the other is a 'socket' (or unspecified = socket)
 * and types are compatible. A plug+plug or socket+socket cannot directly connect.
 */
export function canConnectDirectly(
  portA: Port, assetA: Asset,
  portB: Port, assetB: Asset,
): boolean {
  const aIsPlug = portA.connector === 'plug';
  const bIsPlug = portB.connector === 'plug';
  if (aIsPlug === bIsPlug) return false; // both plugs or both sockets → impossible
  if (!arePortsCompatible(portA, portB)) return false;
  return arePeersAllowed(portA, assetA, portB, assetB);
}

/**
 * Sum the cable lengths of existing connections that touch any of the given (instance, port) pairs.
 * Returns 0 if no matching connection exists.
 */
export function getCableLengthSum(
  connections: Connection[],
  instanceId: string,
  portIds: string[],
  assetMap: Record<string, Asset>,
): number {
  let total = 0;
  for (const c of connections) {
    const matches =
      (c.fromInstanceId === instanceId && portIds.includes(c.fromPortId)) ||
      (c.toInstanceId === instanceId && portIds.includes(c.toPortId));
    if (!matches) continue;
    const cable = assetMap[c.cableAssetId];
    if (cable?.cableLength) total += cable.cableLength;
  }
  return total;
}

export function canAttach(
  guestAsset: Asset,
  hostAsset: Asset,
  hostPointId: string
): boolean {
  const hostPoint = hostAsset.attachmentPoints.find(ap => ap.id === hostPointId);
  if (!hostPoint || hostPoint.role !== 'host') return false;
  return hostPoint.accepts.includes(guestAsset.category);
}

export function getAttachPosition(
  hostX: number, hostY: number, hostW: number, hostH: number,
  hostPoint: AttachmentPoint,
  guestW: number, guestH: number
): { x: number; y: number } {
  switch (hostPoint.edge) {
    case 'top':
      return {
        x: hostX + hostPoint.position * hostW - guestW / 2,
        y: hostY - guestH,
      };
    case 'bottom':
      return {
        x: hostX + hostPoint.position * hostW - guestW / 2,
        y: hostY + hostH,
      };
    case 'left':
      return {
        x: hostX - guestW,
        y: hostY + hostPoint.position * hostH - guestH / 2,
      };
    case 'right':
      return {
        x: hostX + hostW,
        y: hostY + hostPoint.position * hostH - guestH / 2,
      };
  }
}
