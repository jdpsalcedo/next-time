import { useEffect, useMemo, useState } from 'react';
import { subscribeCosmeticCatalog } from '../firebaseStore.js';
import { SEED_COSMETICS } from './seedCosmetics.js';

// Body-anchor positions per slot, per slime hop frame.
// These are the (x,y) pixel inside the 32x32 slime where a cosmetic's anchor
// pixel attaches. Different per frame because the slime's head/back/face moves
// as it hops.
export const BODY_ANCHORS = {
  hat:  [[16, 18], [16, 19], [16, 9],  [16, 3],  [16, 9],  [16, 18]],
  face: [[16, 22], [16, 23], [16, 14], [16, 9],  [16, 14], [16, 22]],
  back: [[16, 24], [16, 25], [16, 18], [16, 13], [16, 18], [16, 24]],
};

// Body anchors for the 2-frame sleeping animation. Frame 0 mirrors hop
// frame 0 (resting squash); frame 1 is the same slime shifted down 1 pixel
// for the inhale beat, so anchors all move down by one.
export const SLEEPING_BODY_ANCHORS = {
  hat:  [[16, 18], [16, 19]],
  face: [[16, 22], [16, 23]],
  back: [[16, 24], [16, 25]],
};

export const COSMETIC_SLOTS = ['hat', 'face', 'back', 'skin'];

// Read a cosmetic's anchor for the given frame. Cosmetics may store anchor
// as a flat [x, y] pair (same for every frame) or as a 6-element array of
// pairs (per-frame override). Centralized here so all renderers agree.
export function getAnchorForFrame(item, frameIdx) {
  const a = item?.anchor;
  if (!a) return null;
  if (Array.isArray(a[0])) return a[frameIdx] || a[0];
  return a;
}

// Sleeping uses a 2-frame breath cycle that doesn't move like the hop, so we
// always anchor cosmetics using the first hop frame's anchor — same shape on
// every breath. Single anchors pass through.
export function getAnchorForSleepFrame(item) {
  const a = item?.anchor;
  if (!a) return null;
  if (Array.isArray(a[0])) return a[0];
  return a;
}

// Bundled seed cosmetics — shipped with the app, available to every user
// without a Firestore round-trip. Definitions live in ./seedCosmetics.js to
// keep this file lean. Edit there to add/remove day-one items.
export { SEED_COSMETICS };

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const RARITY_LABEL = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

export const CHESTS = {
  basic: {
    id: 'basic',
    label: 'Basic chest',
    cost: 1,
    weights: { common: 70, uncommon: 25, rare: 5, epic: 0, legendary: 0 },
  },
  premium: {
    id: 'premium',
    label: 'Premium chest',
    cost: 3,
    weights: { common: 30, uncommon: 40, rare: 22, epic: 7, legendary: 1 },
  },
};

export function useCosmeticCatalog() {
  const [remote, setRemote] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const unsub = subscribeCosmeticCatalog((items) => {
      setRemote(items);
      setLoaded(true);
    });
    return unsub;
  }, []);
  const items = useMemo(() => [...SEED_COSMETICS, ...remote], [remote]);
  return { items, loaded };
}

