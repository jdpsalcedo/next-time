import { useEffect, useMemo, useState } from 'react';
import { useSettings } from '../settings.jsx';
import { useData } from '../data.jsx';
import { useToast } from '../toast.jsx';
import {
  commitSlimeAccrual,
  ensureCosmeticsShape,
  resolveEquippedItems,
  rollChest,
  SECONDS_PER_COIN,
} from '../slime.js';
import {
  CHESTS,
  COSMETIC_SLOTS,
  RARITIES,
  RARITY_LABEL,
  useCosmeticCatalog,
} from '../slime/catalog.js';
import Modal from './Modal.jsx';
import SlimeSprite, { SLIME_SKINS } from './SlimeSprite.jsx';
import CosmeticThumb from './CosmeticThumb.jsx';
import FullSetPreview from './FullSetPreview.jsx';

function formatProgress(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const SLOT_LABEL = {
  hat: 'Hats',
  face: 'Faces',
  back: 'Backs',
  skin: 'Skins',
};

export function SlimeProfileButton({ onClick }) {
  const { settings } = useSettings();
  const rawSlime = settings.slime || {};
  if (!rawSlime.enabled) return null;
  const slime = ensureCosmeticsShape(rawSlime);
  const equippedSkinKey = slime.cosmetics.equipped.skin;
  const skin = SLIME_SKINS[equippedSkinKey] || SLIME_SKINS.emerald;
  const accruing = !!slime.running_since_ms;
  return (
    <button
      type="button"
      className="icon-btn slime-profile-btn"
      onClick={onClick}
      aria-label={accruing ? 'Open slime profile (earning coins)' : 'Open slime profile'}
      title={accruing ? 'Slime is earning coins' : 'Slime profile'}
    >
      <span
        className="slime-profile-dot"
        aria-hidden
        style={{ background: skin.swatch }}
      />
      {accruing && <span className="slime-accrual-dot" aria-hidden />}
    </button>
  );
}

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'wardrobe', label: 'Wardrobe' },
  { id: 'shop', label: 'Shop' },
];

export default function SlimeProfileModal({ onClose }) {
  const { settings, update: updateSettings } = useSettings();
  const toast = useToast();
  const slime = useMemo(() => ensureCosmeticsShape(settings.slime || {}), [settings.slime]);
  const [tab, setTab] = useState('profile');
  const [reveal, setReveal] = useState(null);

  async function equipItem(item) {
    if (!item?.slot) return;
    const nextEquipped = { ...slime.cosmetics.equipped, [item.slot]: item.id };
    try {
      await updateSettings({
        slime: {
          ...slime,
          cosmetics: { ...slime.cosmetics, equipped: nextEquipped },
        },
      });
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <Modal title="Slime" onClose={onClose}>
      <div className="slime-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className={`slime-tab ${tab === t.id ? 'active' : ''}`}
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && <ProfileTab slime={slime} />}
      {tab === 'wardrobe' && <WardrobeTab slime={slime} />}
      {tab === 'shop' && <ShopTab slime={slime} onReveal={setReveal} />}

      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>

      {reveal && (
        <ChestRevealModal
          result={reveal}
          slime={slime}
          onEquip={equipItem}
          onClose={() => setReveal(null)}
        />
      )}
    </Modal>
  );
}

// ----- Profile tab -----
function ProfileTab({ slime }) {
  const { timers } = useData();
  const accruing = !!slime.running_since_ms;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!accruing) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [accruing]);

  const projection = useMemo(() => commitSlimeAccrual(slime, now), [slime, now]);
  const coins = projection.coins;
  const progressSec = projection.accrued_seconds;
  const pctToNext = Math.min(100, (progressSec / SECONDS_PER_COIN) * 100);

  const attachedTimer = slime.attached_timer_id
    ? timers.find((t) => t.id === slime.attached_timer_id)
    : null;

  const equippedSkinKey = slime.cosmetics.equipped.skin;
  const skin = SLIME_SKINS[equippedSkinKey] || SLIME_SKINS.emerald;
  const equippedItems = useResolvedEquippedFromSlime(slime);

  return (
    <div className="slime-profile">
      <div className="slime-profile-hero">
        <SlimeSprite
          skin={equippedSkinKey}
          equipped={equippedItems}
          size={96}
          fps={8}
          state={accruing ? 'hopping' : 'sleeping'}
        />
      </div>
      <div className="slime-profile-stats">
        <div className="slime-stat">
          <div className="slime-stat-label">Coins</div>
          <div className="slime-stat-value">
            <span className="slime-coin" aria-hidden>◉</span> {coins}
          </div>
        </div>
        <div className="slime-stat">
          <div className="slime-stat-label">Progress to next coin</div>
          <div className="slime-progress">
            <div
              className="slime-progress-fill"
              style={{ width: `${pctToNext}%`, background: skin.swatch }}
            />
          </div>
          <div className="slime-stat-meta">
            {formatProgress(progressSec)} / {formatProgress(SECONDS_PER_COIN)}
          </div>
        </div>
        <div className="slime-stat">
          <div className="slime-stat-label">Attached to</div>
          <div className="slime-stat-value slime-attached">
            {attachedTimer ? attachedTimer.title : <span className="muted">Not attached</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Internal version of useResolvedEquipped that works on a pre-extracted slime
// object (so the modal doesn't double-read settings).
function useResolvedEquippedFromSlime(slime) {
  const { items } = useCosmeticCatalog();
  return useMemo(() => {
    const eq = slime.cosmetics.equipped;
    const byId = new Map(items.map((c) => [c.id, c]));
    return {
      hat: eq.hat ? byId.get(eq.hat) || null : null,
      face: eq.face ? byId.get(eq.face) || null : null,
      back: eq.back ? byId.get(eq.back) || null : null,
    };
  }, [slime, items]);
}

// ----- Wardrobe tab -----
function WardrobeTab({ slime }) {
  const { update: updateSettings } = useSettings();
  const { items: catalog, loaded } = useCosmeticCatalog();
  const toast = useToast();
  const [filter, setFilter] = useState('all');

  const owned = new Set(slime.cosmetics.owned || []);
  const equipped = slime.cosmetics.equipped;

  // Synthesize built-in skin entries so they appear in the wardrobe alongside
  // workshop-created cosmetics. Built-ins are always owned.
  const builtInSkins = useMemo(
    () =>
      Object.entries(SLIME_SKINS).map(([key, s]) => ({
        id: key,
        slot: 'skin',
        name: s.name || key,
        rarity: 'common',
        palette: s.palette,
        _builtIn: true,
      })),
    [],
  );

  const all = useMemo(() => [...builtInSkins, ...catalog], [builtInSkins, catalog]);
  const visible = filter === 'all' ? all : all.filter((c) => c.slot === filter);

  const resolved = useMemo(
    () => resolveEquippedItems(equipped, catalog),
    [equipped, catalog],
  );

  async function equip(item) {
    const isOwned = item._builtIn || owned.has(item.id);
    if (!isOwned) {
      toast.info(`Locked — open a chest to unlock "${item.name}"`);
      return;
    }
    const nextEquipped = { ...equipped };
    if (equipped[item.slot] === item.id) {
      // toggle off (except skin — must always have one equipped)
      if (item.slot === 'skin') return;
      nextEquipped[item.slot] = null;
    } else {
      nextEquipped[item.slot] = item.id;
    }
    try {
      await updateSettings({
        slime: {
          ...slime,
          cosmetics: { ...slime.cosmetics, equipped: nextEquipped },
        },
      });
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="slime-wardrobe">
      <FullSetPreview
        equipped={equipped}
        resolved={resolved}
        activeFilter={filter}
        onSlotClick={(slot) => setFilter((cur) => (cur === slot ? 'all' : slot))}
      />
      <div className="slime-filter-bar">
        <button
          type="button"
          className={`slime-filter ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        {COSMETIC_SLOTS.map((s) => (
          <button
            key={s}
            type="button"
            className={`slime-filter ${filter === s ? 'active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {SLOT_LABEL[s]}
          </button>
        ))}
      </div>
      {!loaded ? (
        <div className="muted" style={{ padding: 16, textAlign: 'center' }}>Loading catalog…</div>
      ) : visible.length === 0 ? (
        <div className="muted" style={{ padding: 16, textAlign: 'center' }}>
          Nothing here yet. Open a chest in the shop to start collecting.
        </div>
      ) : (
        <div className="slime-wardrobe-grid">
          {visible.map((item) => {
            const isOwned = item._builtIn || owned.has(item.id);
            const isEquipped = equipped[item.slot] === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`slime-wardrobe-item rarity-${item.rarity} ${isOwned ? '' : 'locked'} ${isEquipped ? 'equipped' : ''}`}
                onClick={() => equip(item)}
              >
                <CosmeticThumb item={item} locked={!isOwned} />
                <div className="slime-wardrobe-name">{item.name}</div>
                <div className={`slime-wardrobe-rarity rarity-${item.rarity}`}>
                  {RARITY_LABEL[item.rarity]}
                </div>
                {isEquipped && <div className="slime-wardrobe-equipped-tag">equipped</div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ----- Shop tab -----
function ShopTab({ slime, onReveal }) {
  const { update: updateSettings } = useSettings();
  const { items: catalog, loaded } = useCosmeticCatalog();
  const toast = useToast();
  const [busy, setBusy] = useState(null);

  async function openChest(chestId) {
    const chest = CHESTS[chestId];
    if (!chest) return;
    if ((slime.coins || 0) < chest.cost) {
      toast.info(`Need ${chest.cost} coin${chest.cost === 1 ? '' : 's'}.`);
      return;
    }
    setBusy(chestId);
    try {
      const result = rollChest(chestId, catalog);
      const owned = new Set(slime.cosmetics.owned || []);

      let coinsAfter = slime.coins - chest.cost;
      let outcome = 'new';
      let refund = 0;

      if (!result?.item) {
        // empty pool for the rolled rarity — full refund, no item
        refund = chest.cost;
        coinsAfter = slime.coins;
        outcome = 'empty';
      } else if (owned.has(result.item.id)) {
        // duplicate — half refund rounded up
        refund = Math.ceil(chest.cost / 2);
        coinsAfter = slime.coins - chest.cost + refund;
        outcome = 'duplicate';
      } else {
        owned.add(result.item.id);
      }

      await updateSettings({
        slime: {
          ...slime,
          coins: coinsAfter,
          cosmetics: { ...slime.cosmetics, owned: [...owned] },
        },
      });

      onReveal({
        outcome,
        chest,
        item: result?.item || null,
        rarity: result?.rarity || 'common',
        refund,
      });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="slime-shop">
      <div className="slime-coins-bar">
        <span className="slime-coin" aria-hidden>◉</span>
        <span>{slime.coins || 0}</span>
        <span className="muted" style={{ fontSize: '0.85rem', marginLeft: 6 }}>coins</span>
      </div>
      <div className="slime-chest-grid">
        {Object.values(CHESTS).map((chest) => {
          const canAfford = (slime.coins || 0) >= chest.cost;
          return (
            <div key={chest.id} className={`slime-chest-card chest-${chest.id}`}>
              <div className="slime-chest-icon" aria-hidden>📦</div>
              <div className="slime-chest-label">{chest.label}</div>
              <div className="slime-chest-cost">
                <span className="slime-coin" aria-hidden>◉</span> {chest.cost}
              </div>
              <ul className="slime-chest-odds">
                {RARITIES.map((r) => {
                  const w = chest.weights[r] || 0;
                  if (w === 0) return null;
                  return (
                    <li key={r} className={`rarity-${r}`}>
                      <span>{RARITY_LABEL[r]}</span>
                      <span>{w}%</span>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                className="btn slime-chest-buy"
                onClick={() => openChest(chest.id)}
                disabled={!canAfford || busy === chest.id || !loaded}
              >
                {busy === chest.id ? 'Opening…' : 'Open'}
              </button>
            </div>
          );
        })}
      </div>
      <div className="muted" style={{ fontSize: '0.8rem', marginTop: 12, textAlign: 'center' }}>
        Duplicates refund half the coin cost. Empty rarity tiers refund in full.
      </div>
    </div>
  );
}

// ----- Chest reveal -----
function ChestRevealModal({ result, slime, onEquip, onClose }) {
  const { outcome, item, rarity, refund } = result;
  let title;
  let body;
  if (outcome === 'empty') {
    title = 'Empty pool';
    body = (
      <div className="muted" style={{ textAlign: 'center' }}>
        Nothing was published in this rarity tier yet. Got your coins back.
      </div>
    );
  } else if (outcome === 'duplicate') {
    title = 'Duplicate';
    body = (
      <>
        <CosmeticThumb item={item} size={96} />
        <div className={`slime-reveal-name rarity-${rarity}`}>{item.name}</div>
        <div className="muted" style={{ marginTop: 6 }}>
          Already owned. Refunded {refund} coin{refund === 1 ? '' : 's'}.
        </div>
      </>
    );
  } else {
    title = `${RARITY_LABEL[rarity]}!`;
    body = (
      <>
        <CosmeticThumb item={item} size={96} />
        <div className={`slime-reveal-name rarity-${rarity}`}>{item.name}</div>
        <div className="muted" style={{ marginTop: 6 }}>{item.slot}</div>
      </>
    );
  }

  const isAlreadyEquipped =
    item && slime?.cosmetics?.equipped?.[item.slot] === item.id;
  const showEquip = item && !isAlreadyEquipped;

  async function equipAndClose() {
    await onEquip(item);
    onClose();
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className={`slime-reveal rarity-${rarity}`}>{body}</div>
      <div className="modal-actions">
        {showEquip && (
          <button type="button" className="btn" onClick={equipAndClose}>
            Equip now
          </button>
        )}
        <button type="button" className={showEquip ? 'btn btn-ghost' : 'btn'} onClick={onClose}>
          {showEquip ? 'Later' : 'Awesome'}
        </button>
      </div>
    </Modal>
  );
}
