import { useEffect, useRef } from 'react';

const W = 32;
const H = 32;

const FRAMES = [
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

// Frame 0 is the "ground squash" — used as the sleeping/resting pose.
const SLEEP_FRAME_INDEX = 0;

export default function SlimeSprite({
  skin = 'emerald',
  size = 48,
  fps = 8,
  paused = false,
  state = 'hopping',
}) {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pixelSize = Math.max(1, Math.floor(size / W));
    const drawSize = pixelSize * W;
    canvas.width = drawSize;
    canvas.height = drawSize;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const palette = (SLIME_SKINS[skin] || SLIME_SKINS.emerald).palette;

    function render() {
      ctx.clearRect(0, 0, drawSize, drawSize);
      const frame = FRAMES[frameRef.current];
      for (let y = 0; y < H; y++) {
        const row = frame[y];
        for (let x = 0; x < W; x++) {
          const ch = row[x];
          if (ch === '.' || ch === ' ' || ch === undefined) continue;
          ctx.fillStyle = palette[ch] || palette['!'];
          ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        }
      }
    }

    if (state === 'sleeping') {
      frameRef.current = SLEEP_FRAME_INDEX;
      render();
      return undefined;
    }

    render();
    if (paused) return undefined;

    const interval = 1000 / fps;
    let last = 0;
    let rafId;
    function loop(t) {
      if (t - last >= interval) {
        frameRef.current = (frameRef.current + 1) % FRAMES.length;
        render();
        last = t;
      }
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [skin, size, fps, paused, state]);

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
