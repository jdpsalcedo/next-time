import { useEffect, useMemo, useState } from 'react';
import { useSettings } from '../settings.jsx';
import { useData } from '../data.jsx';
import { commitSlimeAccrual, SECONDS_PER_COIN } from '../slime.js';
import Modal from './Modal.jsx';
import SlimeSprite, { SLIME_SKINS } from './SlimeSprite.jsx';

function formatProgress(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function SlimeProfileButton({ onClick }) {
  const { settings } = useSettings();
  const slime = settings.slime || {};
  if (!slime.enabled) return null;
  const skin = SLIME_SKINS[slime.skin] || SLIME_SKINS.emerald;
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

export default function SlimeProfileModal({ onClose }) {
  const { settings, update: updateSettings } = useSettings();
  const { timers } = useData();
  const slime = settings.slime || {};
  const accruing = !!slime.running_since_ms;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!accruing) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [accruing]);

  // Show live coins/progress including any uncommitted accrual.
  const projection = useMemo(() => commitSlimeAccrual(slime, now), [slime, now]);
  const coins = projection.coins;
  const progressSec = projection.accrued_seconds;
  const pctToNext = Math.min(100, (progressSec / SECONDS_PER_COIN) * 100);

  const attachedTimer = slime.attached_timer_id
    ? timers.find((t) => t.id === slime.attached_timer_id)
    : null;

  const skin = SLIME_SKINS[slime.skin] || SLIME_SKINS.emerald;

  async function pickSkin(nextSkin) {
    if (nextSkin === slime.skin) return;
    try {
      await updateSettings({ slime: { ...slime, skin: nextSkin } });
    } catch {
      /* ignore — toast lives elsewhere */
    }
  }

  return (
    <Modal title="Slime" onClose={onClose}>
      <div className="slime-profile">
        <div className="slime-profile-hero">
          <SlimeSprite
            skin={slime.skin || 'emerald'}
            size={96}
            fps={8}
            state={slime.running_since_ms ? 'hopping' : 'sleeping'}
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
        <div className="slime-skin-row">
          <div className="slime-stat-label">Skin</div>
          <div className="slime-skin-options">
            {Object.entries(SLIME_SKINS).map(([key, s]) => (
              <button
                key={key}
                type="button"
                className={`slime-skin-chip ${slime.skin === key ? 'active' : ''}`}
                onClick={() => pickSkin(key)}
                aria-label={`Use ${s.name} skin`}
                aria-pressed={slime.skin === key}
              >
                <span className="slime-skin-swatch" style={{ background: s.swatch }} />
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
