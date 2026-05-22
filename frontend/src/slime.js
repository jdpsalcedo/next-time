import { useMemo } from 'react';
import { useSettings } from './settings.jsx';
import { useCosmeticCatalog, CHESTS, RARITIES } from './slime/catalog.js';
import { SLIME_SKINS } from './components/SlimeSprite.jsx';

export const SECONDS_PER_COIN = 300; // 5 minutes
export const MAX_COMMIT_DELTA_SEC = 60 * 60; // safety cap if app was inactive

export function commitSlimeAccrual(slime, nowMs = Date.now()) {
  if (!slime?.running_since_ms) {
    return {
      coins: slime?.coins || 0,
      accrued_seconds: slime?.accrued_seconds || 0,
    };
  }
  const raw = (nowMs - slime.running_since_ms) / 1000;
  const deltaSec = Math.min(MAX_COMMIT_DELTA_SEC, Math.max(0, raw));
  const total = (slime.accrued_seconds || 0) + deltaSec;
  const newCoins = Math.floor(total / SECONDS_PER_COIN);
  return {
    coins: (slime.coins || 0) + newCoins,
    accrued_seconds: total - newCoins * SECONDS_PER_COIN,
  };
}

export function isSlimeAttachedTo(slime, timerId) {
  return !!slime?.enabled && !!slime?.on && slime?.attached_timer_id === timerId;
}

// Lazy-migrate a slime object so callers can always rely on slime.cosmetics
// being present, even for users who signed up before the cosmetics shape existed.
export function ensureCosmeticsShape(slime) {
  if (!slime) return slime;
  if (slime.cosmetics?.equipped) return slime;
  return {
    ...slime,
    cosmetics: {
      owned: [],
      equipped: {
        skin: slime.skin || 'emerald',
        hat: null,
        face: slime.accessory || null,
        back: null,
      },
    },
  };
}

// Resolve an arbitrary equipped slot map to objects ready for <SlimeSprite>.
// Built-in skins ('emerald', 'azure', ...) stay as keys (SlimeSprite handles
// them natively); workshop-published skins become palette-bearing objects;
// hat/face/back map to their full catalog entry or null.
export function resolveEquippedItems(equipped, catalog) {
  const byId = new Map((catalog || []).map((c) => [c.id, c]));
  const resolveOverlay = (id) => (id ? byId.get(id) || null : null);
  let skin = equipped?.skin || 'emerald';
  if (skin && !SLIME_SKINS[skin]) {
    const c = byId.get(skin);
    if (c?.palette) skin = c;
    else skin = 'emerald';
  }
  return {
    skin,
    hat: resolveOverlay(equipped?.hat),
    face: resolveOverlay(equipped?.face),
    back: resolveOverlay(equipped?.back),
  };
}

// Convenience hook for the currently signed-in user's equipped loadout.
export function useResolvedEquipped() {
  const { settings } = useSettings();
  const { items } = useCosmeticCatalog();
  return useMemo(() => {
    const slime = ensureCosmeticsShape(settings.slime || {});
    return resolveEquippedItems(slime.cosmetics.equipped, items);
  }, [settings.slime, items]);
}

// Roll a chest deterministically from a catalog. Returns { rarity, item } or
// { rarity, item: null } if the rolled rarity has no cosmetics yet.
export function rollChest(chestId, catalog, rng = Math.random) {
  const chest = CHESTS[chestId];
  if (!chest) return null;
  const weights = chest.weights;
  const total = Object.values(weights).reduce((s, n) => s + n, 0);
  if (total <= 0) return { rarity: 'common', item: null };
  let r = rng() * total;
  let chosen = RARITIES[0];
  for (const rarity of RARITIES) {
    r -= weights[rarity] || 0;
    if (r <= 0) { chosen = rarity; break; }
  }
  const pool = catalog.filter((c) => c.rarity === chosen);
  if (pool.length === 0) return { rarity: chosen, item: null };
  return { rarity: chosen, item: pool[Math.floor(rng() * pool.length)] };
}
