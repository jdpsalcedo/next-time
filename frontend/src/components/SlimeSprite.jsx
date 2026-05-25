import { useEffect, useRef } from 'react';
import {
  BODY_ANCHORS,
  SLEEPING_BODY_ANCHORS,
  getAnchorForFrame,
  getAnchorForSleepFrame,
} from '../slime/catalog.js';
import { useSlimeDefaults } from '../slimeDefaults.jsx';

export const W = 32;
export const H = 32;

export const FRAMES = [
  [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '............!!!!!!!!............',
    '..........!!HHHHHHHH!!..........',
    '........!!HHHHOOOOOHHH!!........',
    '......!!HHOOOOOOOOOOOOHH!!......',
    '.....!HOOOOEOOOOOOOOEOOOH!......',
    '....!OOOOOWEOOOOOOOOEWOOOO!.....',
    '...!OOOOOOEEOOOMMMOOEEOOOOO!....',
    '...!OOOOOOOOOOOMMMOOOOOOSSO!....',
    '....!OOOOOOOOOOOOOOOOOSSSS!.....',
    '....!SSSSSSSSSSSSSSSSSSSS!......',
    '.....!!SSSSSSSSSSSSSSSS!!.......',
    '......BBBBBBBBBBBBBBBBBB........',
    '................................',
    '................................',
  ],
  [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..............!!!!!!............',
    '............!!HHHHHH!!..........',
    '.........!!HHOOOOOOOHH!!........',
    '.......!HHOOOOOOOOOOOHHH!.......',
    '......!OOOOEOOOOOOOEOOOOO!......',
    '.....!OOOOWEOOOOOOEWOOOOO!......',
    '.....!OOOOOEEOOMMMEEOOOSSO!.....',
    '....!OOOOOOOOOMMMOOOOSSSSS!.....',
    '....!SSSSSSSSSSSSSSSSSSSS!......',
    '.....!!SSSSSSSSSSSSSS!!.........',
    '......BBBBBBBBBBBBBBBB..........',
    '................................',
    '................................',
  ],
  [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '...............!!!!!............',
    '.............!!HHHH!!...........',
    '............!HHOOOHH!...........',
    '...........!HOOOOOOH!...........',
    '..........!HOOOEOEOOH!..........',
    '.........!HOOOWEEOOOOH!.........',
    '.........!OOOOOEEOOOOO!.........',
    '.........!OOOOOMMMOOOO!.........',
    '........!OOOOOOMMMOOOOO!........',
    '........!OOOOOOOOOOOOOO!........',
    '.......!OOOOOOOOOOOOOOO!........',
    '.......!OOOOOOOOOOOOOOSO!.......',
    '......!OOOOOOOOOOOOOOSSO!.......',
    '......!SSSSSSSSSSSSSSSSS!.......',
    '.......!SSSSSSSSSSSSSS!.........',
    '........!!SSSSSSSSSS!!..........',
    '..........BBBBBBBBBBBB..........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
  [
    '................................',
    '................................',
    '................................',
    '.............!!!!!!.............',
    '...........!!HHHHHH!!...........',
    '.........!!HHOOOOOOHH!!.........',
    '........!HHOOOOOOOOOHH!.........',
    '.......!HOOOOOOOOOOOOOH!........',
    '......!HOOOOEOOOOOOEOOOH!.......',
    '.....!OOOOOWEOOOOOOEWOOOO!......',
    '.....!OOOOOOEEOOOOEEOOOOO!......',
    '.....!OOOOOOOOMMMMOOOOOOO!......',
    '....!OOOOOOOOOMMMMOOOOOOOO!.....',
    '....!OOOOOOOOOOOOOOOOOOOO!......',
    '....!OOOOOOOOOOOOOOOOOSSO!......',
    '....!OOOOOOOOOOOOOOOSSSSO!......',
    '.....!SSSSSSSSSSSSSSSSSSS!......',
    '.....!!SSSSSSSSSSSSSSSS!!.......',
    '......!!SSSSSSSSSSSSSS!!........',
    '.........!!!!!!!!!!!!...........',
    '................................',
    '................................',
    '................................',
    '................................',
    '...........bbbbbbbbbb...........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
  [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '...............!!!!!............',
    '.............!!HHHH!!...........',
    '............!HHOOOHH!...........',
    '...........!HOOOOOOH!...........',
    '..........!HOOOEOEOOH!..........',
    '.........!HOOOWEEOOOOH!.........',
    '.........!OOOOOEEOOOOO!.........',
    '.........!OOOOOMMMOOOO!.........',
    '........!OOOOOOMMMOOOOO!........',
    '........!OOOOOOOOOOOOOO!........',
    '.......!OOOOOOOOOOOOOOO!........',
    '.......!OOOOOOOOOOOOOOSO!.......',
    '......!OOOOOOOOOOOOOOSSO!.......',
    '......!SSSSSSSSSSSSSSSSS!.......',
    '.......!SSSSSSSSSSSSSS!.........',
    '........!!SSSSSSSSSS!!..........',
    '..........BBBBBBBBBBBB..........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
  [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '............!!!!!!!!............',
    '..........!!HHHHHHHH!!..........',
    '........!!HHHHOOOOOHHH!!........',
    '......!!HHOOOOOOOOOOOOHH!!......',
    '.....!HOOOOEOOOOOOOOEOOOH!......',
    '....!OOOOOWEOOOOOOOOEWOOOO!.....',
    '...!OOOOOOEEOOOMMMOOEEOOOOO!....',
    '...!OOOOOOOOOOOMMMOOOOOOSSO!....',
    '....!OOOOOOOOOOOOOOOOOSSSS!.....',
    '....!SSSSSSSSSSSSSSSSSSSS!......',
    '.....!!SSSSSSSSSSSSSSSS!!.......',
    '......BBBBBBBBBBBBBBBBBB........',
    '................................',
    '................................',
  ],
];

// --- Sleeping animation ---
// Generated from the resting-squash frame: eyes get closed (E → !), sparkles
// vanish (W → O), and the inhale frame nudges the slime down a pixel so the
// body looks like it's gently rising and settling on the ground.
function sleepify(frame) {
  return frame.map((row) => row.replace(/E/g, '!').replace(/W/g, 'O'));
}
function shiftDown(frame, n) {
  const blank = '.'.repeat(W);
  const out = [];
  for (let i = 0; i < n; i++) out.push(blank);
  for (let i = 0; i < frame.length - n; i++) out.push(frame[i]);
  return out;
}
const SLEEP_BASE = sleepify(FRAMES[0]);
export const SLEEPING_FRAMES = [
  SLEEP_BASE,                  // exhale — settled
  shiftDown(SLEEP_BASE, 1),    // inhale — sinks 1px lower
];

export const SLEEPING_FPS = 1.5; // ~1 breath every 1.3s

export const SLIME_SKINS = {
  emerald: {
    name: 'blob',
    swatch: '#62d489',
    palette: {
      '!': '#0d2818',
      O: '#62d489',
      H: '#a8f5c2',
      S: '#2d8a4f',
      E: '#0d2818',
      W: '#ffffff',
      M: '#0d2818',
      B: 'rgba(0,0,0,0.3)',
      b: 'rgba(0,0,0,0.15)',
    },
  },
  azure: {
    name: 'splash',
    swatch: '#4ea8ff',
    palette: {
      '!': '#0a1e3a',
      O: '#4ea8ff',
      H: '#a8d8ff',
      S: '#1f5a9c',
      E: '#0a1e3a',
      W: '#ffffff',
      M: '#0a1e3a',
      B: 'rgba(0,0,0,0.3)',
      b: 'rgba(0,0,0,0.15)',
    },
  },
  bubblegum: {
    name: 'pop',
    swatch: '#ff85b8',
    palette: {
      '!': '#3a0a24',
      O: '#ff85b8',
      H: '#ffd0e3',
      S: '#c44a82',
      E: '#3a0a24',
      W: '#ffffff',
      M: '#3a0a24',
      B: 'rgba(0,0,0,0.3)',
      b: 'rgba(0,0,0,0.15)',
    },
  },
  honey: {
    name: 'buzz',
    swatch: '#ffd23f',
    palette: {
      '!': '#3a2208',
      O: '#ffd23f',
      H: '#fff0a8',
      S: '#c49520',
      E: '#3a2208',
      W: '#ffffff',
      M: '#3a2208',
      B: 'rgba(0,0,0,0.3)',
      b: 'rgba(0,0,0,0.15)',
    },
  },
  shadow: {
    name: 'void',
    swatch: '#7c3aed',
    palette: {
      '!': '#0a0414',
      O: '#7c3aed',
      H: '#c4a8ff',
      S: '#3d1f6b',
      E: '#fff8e7',
      W: '#ffd23f',
      M: '#fff8e7',
      B: 'rgba(0,0,0,0.4)',
      b: 'rgba(0,0,0,0.2)',
    },
  },
};

export const DEFAULT_SLIME = {
  on: false,
  attached_timer_id: null,
  skin: 'emerald',
  hat: null,
  accessory: null,
  animation: 'hop',
};

function drawCosmeticOverlay(ctx, item, slot, pixelSize, frameIdx, bodyAnchorTable, anchorFn) {
  if (!item?.pixels) return;
  const bodyAnchor = bodyAnchorTable[slot]?.[frameIdx];
  if (!bodyAnchor) return;
  const [bX, bY] = bodyAnchor;
  const anchor = anchorFn(item, frameIdx)
    || [Math.floor(item.pixels[0].length / 2), Math.floor(item.pixels.length / 2)];
  const [aX, aY] = anchor;
  const startX = (bX - aX) * pixelSize;
  const startY = (bY - aY) * pixelSize;
  for (let y = 0; y < item.pixels.length; y++) {
    const row = item.pixels[y];
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(startX + x * pixelSize, startY + y * pixelSize, pixelSize, pixelSize);
    }
  }
}

export function resolveSkinPalette(skin, defaults) {
  // skin can be a built-in key, a full palette object, or null
  if (!skin) {
    return defaults?.emerald_skin?.palette || SLIME_SKINS.emerald.palette;
  }
  if (typeof skin === 'string') {
    // The "emerald" built-in is the global default — admins can replace it.
    if (skin === 'emerald' && defaults?.emerald_skin?.palette) {
      return defaults.emerald_skin.palette;
    }
    return (SLIME_SKINS[skin] || SLIME_SKINS.emerald).palette;
  }
  if (skin.palette) return skin.palette;
  return SLIME_SKINS.emerald.palette;
}

// Workshop-published skins can ship their own sprite frames. Built-in keys
// don't carry frames; "emerald" falls back to the admin override if any.
function resolveSkinFrames(skin, defaults) {
  if (!skin) return defaults?.emerald_skin?.frames || null;
  if (typeof skin === 'string') {
    if (skin === 'emerald') return defaults?.emerald_skin?.frames || null;
    return null;
  }
  return skin.frames || null;
}

export default function SlimeSprite({
  skin = 'emerald',
  equipped = null,
  size = 48,
  fps = 8,
  paused = false,
  state = 'hopping',
}) {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const defaults = useSlimeDefaults();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pixelSize = Math.max(1, Math.floor(size / W));
    const drawSize = pixelSize * W;
    canvas.width = drawSize;
    canvas.height = drawSize;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const palette = resolveSkinPalette(skin, defaults);
    const skinFrames = resolveSkinFrames(skin, defaults);
    const eq = equipped || {};

    const isSleeping = state === 'sleeping';
    // Precedence for hop frames: per-skin custom > admin global override > bundled.
    const hopFrames = skinFrames || defaults?.hop_frames || FRAMES;
    const sleepFrames = defaults?.sleep_frames || SLEEPING_FRAMES;
    const frames = isSleeping ? sleepFrames : hopFrames;
    const bodyAnchors = isSleeping ? SLEEPING_BODY_ANCHORS : BODY_ANCHORS;
    const anchorFn = isSleeping ? getAnchorForSleepFrame : getAnchorForFrame;
    const effectiveFps = isSleeping ? SLEEPING_FPS : fps;

    // Reset frame index when switching frame sets so a hopping idx of 5
    // doesn't briefly read out of bounds in the 2-frame sleep array.
    if (frameRef.current >= frames.length) frameRef.current = 0;

    function render() {
      ctx.clearRect(0, 0, drawSize, drawSize);
      const frameIdx = frameRef.current;
      if (eq.back) drawCosmeticOverlay(ctx, eq.back, 'back', pixelSize, frameIdx, bodyAnchors, anchorFn);
      const frame = frames[frameIdx];
      for (let y = 0; y < H; y++) {
        const row = frame[y];
        for (let x = 0; x < W; x++) {
          const ch = row[x];
          if (ch === '.' || ch === ' ' || ch === undefined) continue;
          ctx.fillStyle = palette[ch] || palette['!'];
          ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        }
      }
      if (eq.hat) drawCosmeticOverlay(ctx, eq.hat, 'hat', pixelSize, frameIdx, bodyAnchors, anchorFn);
      if (eq.face) drawCosmeticOverlay(ctx, eq.face, 'face', pixelSize, frameIdx, bodyAnchors, anchorFn);
    }

    render();
    if (paused) return undefined;

    const interval = 1000 / effectiveFps;
    let last = 0;
    let rafId;
    function loop(t) {
      if (t - last >= interval) {
        frameRef.current = (frameRef.current + 1) % frames.length;
        render();
        last = t;
      }
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [skin, equipped, size, fps, paused, state, defaults]);

  return (
    <div
      className={`slime-sprite-wrap slime-state-${state}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <canvas
        ref={canvasRef}
        className="slime-sprite"
        style={{ width: size, height: size, imageRendering: 'pixelated' }}
      />
      {state === 'sleeping' && (
        <div className="slime-zzz" aria-hidden>
          <span className="slime-z slime-z-1">z</span>
          <span className="slime-z slime-z-2">z</span>
          <span className="slime-z slime-z-3">Z</span>
        </div>
      )}
    </div>
  );
}
