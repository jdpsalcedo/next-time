import SlimeSprite, { SLIME_SKINS } from './SlimeSprite.jsx';

const SLOT_ORDER = ['skin', 'hat', 'face', 'back'];
const SLOT_ICON = { skin: '🎨', hat: '🎩', face: '👓', back: '🦋' };
const SLOT_LABEL = { skin: 'Skin', hat: 'Hat', face: 'Face', back: 'Back' };

function chipLabel(slot, resolved, equippedId) {
  if (slot === 'skin') {
    if (typeof resolved.skin === 'string') {
      const s = SLIME_SKINS[resolved.skin];
      return s?.name || resolved.skin;
    }
    return resolved.skin?.name || 'custom';
  }
  const item = resolved[slot];
  return item?.name || (equippedId ? 'missing' : 'none');
}

export default function FullSetPreview({
  equipped,
  resolved,
  activeFilter,
  onSlotClick,
  spriteSize = 144,
  state = 'hopping',
}) {
  return (
    <div className="full-set-preview">
      <div className="full-set-stage">
        <SlimeSprite
          skin={resolved.skin}
          equipped={resolved}
          size={spriteSize}
          state={state}
          fps={6}
        />
      </div>
      <div className="full-set-chips">
        {SLOT_ORDER.map((slot) => {
          const equippedId = equipped?.[slot];
          const isEmpty = slot !== 'skin' && !equippedId;
          const isActive = activeFilter === slot;
          return (
            <button
              key={slot}
              type="button"
              className={`full-set-chip ${isActive ? 'active' : ''} ${isEmpty ? 'empty' : ''}`}
              onClick={() => onSlotClick?.(slot)}
              aria-pressed={isActive}
              title={`Filter to ${SLOT_LABEL[slot]}s`}
            >
              <span className="full-set-chip-icon" aria-hidden>{SLOT_ICON[slot]}</span>
              <span className="full-set-chip-body">
                <span className="full-set-chip-slot">{SLOT_LABEL[slot]}</span>
                <span className="full-set-chip-name">
                  {chipLabel(slot, resolved, equippedId)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
