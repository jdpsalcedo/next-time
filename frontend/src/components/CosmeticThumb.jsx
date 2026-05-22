import SlimeSprite, { SLIME_SKINS } from './SlimeSprite.jsx';

/**
 * Compact preview of a cosmetic, composed onto a static slime so the user
 * sees how it actually looks when equipped. Always renders frame 0 (the
 * resting squash pose) so the preview is stable.
 *
 * Built-in skins are referenced by their key string; workshop-published
 * skins carry their own palette and are passed through directly.
 *
 * When `locked` is true, renders an opaque silhouette with a "?" instead so
 * a wardrobe shows the slot is fillable without spoiling the art.
 */
export default function CosmeticThumb({ item, size = 64, locked = false }) {
  if (!item) return null;

  if (locked) {
    return (
      <div
        className="cosmetic-thumb-locked"
        style={{ width: size, height: size }}
        aria-label="Locked cosmetic"
      >
        ?
      </div>
    );
  }

  if (item.slot === 'skin') {
    const skinArg = item._builtIn ? item.id : item;
    return (
      <SlimeSprite skin={skinArg} size={size} state="sleeping" />
    );
  }

  // For hat/face/back, equip just this one item on an emerald slime.
  const equipped = { hat: null, face: null, back: null, [item.slot]: item };
  return (
    <SlimeSprite
      skin="emerald"
      equipped={equipped}
      size={size}
      state="sleeping"
    />
  );
}

/**
 * Tiny circular skin badge, useful for tabular lists or chips.
 */
export function CosmeticSwatch({ item, size = 16 }) {
  if (item?.slot === 'skin') {
    const palette = item.palette || (item._builtIn ? SLIME_SKINS[item.id]?.palette : null);
    if (palette?.O) {
      return (
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: size,
            height: size,
            borderRadius: '50%',
            background: palette.O,
            border: `1px solid ${palette['!']}`,
          }}
        />
      );
    }
  }
  return null;
}
