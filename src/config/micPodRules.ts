/**
 * Logitech proprietary 12-pin Mic Pod chain rules.
 *
 * These rules limit how many Rally Mic Pods and Rally Mic Pod Hubs can be
 * connected downstream of a host (Rally Bar, Rally Bar Mini, Rally Plus).
 * The validator counts all `logi-micpod-*` ports reachable through the chain
 * and rejects layouts that exceed the host's caps.
 *
 * Caps are firmware-enforced by Logitech and apply identically across BYOD,
 * MTR-on-Android (CollabOS appliance), and MTR-on-Windows modes — the bar's
 * audio firmware enforces the cap regardless of attached compute.
 *
 * Source: Logitech Rally product page + Logitech presales FAQ (sync hub).
 * Pod and Hub budgets are independent — a Hub does NOT reduce the pod cap.
 * Hub→Hub cascading is NOT formally documented; the validator treats it as
 * unsupported.
 */
export interface MicPodChainCaps {
  /** Maximum number of Rally Mic Pods downstream of this host. */
  maxPods: number;
  /** Maximum number of Rally Mic Pod Hubs downstream of this host. */
  maxHubs: number;
  /** Human-readable explanation shown to the user when a rule is violated. */
  description: string;
}

export const MIC_POD_DEFAULT_CAPS: Record<string, MicPodChainCaps> = {
  'rally-bar': {
    maxPods: 4,
    maxHubs: 2,
    description: 'Rally Bar supports up to 4 Mic Pods and 2 Mic Pod Hubs.',
  },
  'rally-bar-mini': {
    maxPods: 3,
    maxHubs: 2,
    description: 'Rally Bar Mini supports up to 3 Mic Pods and 2 Mic Pod Hubs.',
  },
  'rally-plus': {
    maxPods: 7,
    maxHubs: 0,
    description:
      'Rally / Rally Plus supports up to 7 Mic Pods, daisy-chained from the Table Hub. Mic Pod Hub usage is not formally documented for this host.',
  },
};

/** Hub→Hub cascading is not formally documented; the validator rejects it. */
export const MIC_POD_HUB_CASCADE_ALLOWED = false;
