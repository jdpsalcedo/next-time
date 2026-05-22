import { useEffect, useRef, useState } from 'react';
import { SLIME_SKINS } from './SlimeSprite.jsx';

const W = 32;
const H = 32;
const CANVAS_PX = 512;
const PIXEL = CANVAS_PX / W;

// Palette roles use single-character codes that map into the skin palette,
// so edits stay skin-compatible (a skin swap recolors the result automatically).
export const BLOB_ROLES = [
  { ch: '!', name: 'outline',       desc: 'dark border' },
  { ch: 'O', name: 'body',          desc: 'main slime color' },
  { ch: 'H', name: 'highlight',     desc: 'top shine' },
  { ch: 'S', name: 'shadow',        desc: 'bottom darker' },
  { ch: 'E', name: 'eye',           desc: 'eye outline' },
  { ch: 'W', name: 'sparkle',       desc: 'eye highlight' },
  { ch: 'M', name: 'mouth',         desc: 'wiggly mouth' },
  { ch: 'B', name: 'ground shadow', desc: 'on ground' },
  { ch: 'b', name: 'air shadow',    desc: 'in air (smaller)' },
];

function framesToGrids(frames) {
  return (frames || []).map((rows) =>
    rows.map((r) => (typeof r === 'string' ? r.split('') : r.slice())),
  );
}
function gridsToFrames(grids) {
  return grids.map((g) => g.map((row) => row.join('')));
}

/**
 * Reusable 32x32 multi-frame pixel painter. Each pixel holds a palette role
 * letter (!, O, H, S, E, W, M, B, b) or '.' for transparent. Renders the
 * current frame using the supplied palette (defaults to emerald).
 *
 * Props:
 *   frames     – array of frames; each frame is an array of 32 row-strings
 *   palette    – optional palette object { '!': '#hex', ... } for rendering
 *   onChange   – called with the new frames array on every edit
 */
export default function BlobEditor({ frames, palette, onChange }) {
  const activePalette = palette || SLIME_SKINS.emerald.palette;
  const [grids, setGrids] = useState(() => framesToGrids(frames));
  const [frameIdx, setFrameIdx] = useState(0);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('!');
  const [showGrid, setShowGrid] = useState(true);
  const [applyAll, setApplyAll] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  const canvasRef = useRef(null);
  const gridRef = useRef(null);

  // Re-sync internal state when caller swaps which animation is being edited.
  useEffect(() => {
    setGrids(framesToGrids(frames));
    setFrameIdx((idx) => Math.min(idx, (frames?.length || 1) - 1));
  }, [frames]);

  // Paint canvas
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
    const frame = grids[frameIdx];
    if (!frame) return;
    for (let y = 0; y < H; y++) {
      const row = frame[y];
      if (!row) continue;
      for (let x = 0; x < W; x++) {
        const ch = row[x];
        if (!ch || ch === '.') continue;
        ctx.fillStyle = activePalette[ch] || activePalette['!'] || '#000';
        ctx.fillRect(x * PIXEL, y * PIXEL, PIXEL, PIXEL);
      }
    }
  }, [grids, frameIdx, activePalette]);

  // Grid overlay
  useEffect(() => {
    const ctx = gridRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
    if (!showGrid) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= W; i++) {
      ctx.beginPath();
      ctx.moveTo(i * PIXEL + 0.5, 0);
      ctx.lineTo(i * PIXEL + 0.5, CANVAS_PX);
      ctx.stroke();
    }
    for (let i = 0; i <= H; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * PIXEL + 0.5);
      ctx.lineTo(CANVAS_PX, i * PIXEL + 0.5);
      ctx.stroke();
    }
  }, [showGrid]);

  function getCell(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = CANVAS_PX / rect.width;
    const cx = (e.clientX - rect.left) * scale;
    const cy = (e.clientY - rect.top) * scale;
    const x = Math.floor(cx / PIXEL);
    const y = Math.floor(cy / PIXEL);
    if (x < 0 || x >= W || y < 0 || y >= H) return null;
    return [x, y];
  }

  function floodFill(grid, x, y, replacement) {
    const target = grid[y][x];
    if (target === replacement) return grid;
    const next = grid.map((row) => row.slice());
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cx >= W || cy < 0 || cy >= H) continue;
      if (next[cy][cx] !== target) continue;
      next[cy][cx] = replacement;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    return next;
  }

  function applyAt(x, y) {
    if (tool === 'picker') {
      const ch = grids[frameIdx][y][x];
      if (ch && ch !== '.') setColor(ch);
      return;
    }
    const replacement = tool === 'eraser' ? '.' : color;
    setGrids((prev) => {
      const targetIndices =
        applyAll && tool !== 'fill'
          ? prev.map((_, i) => i)
          : [frameIdx];
      const next = prev.map((g, i) => {
        if (!targetIndices.includes(i)) return g;
        if (tool === 'fill') return floodFill(g, x, y, replacement);
        if (g[y][x] === replacement) return g;
        const ng = g.map((row) => row.slice());
        ng[y][x] = replacement;
        return ng;
      });
      onChange?.(gridsToFrames(next));
      return next;
    });
  }

  function onPointerDown(e) {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    const cell = getCell(e);
    if (!cell) return;
    setIsDrawing(true);
    applyAt(cell[0], cell[1]);
  }
  function onPointerMove(e) {
    if (!isDrawing) return;
    if (tool === 'fill' || tool === 'picker') return;
    const cell = getCell(e);
    if (!cell) return;
    applyAt(cell[0], cell[1]);
  }
  function onPointerUp(e) {
    if (canvasRef.current?.hasPointerCapture?.(e.pointerId)) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }
    setIsDrawing(false);
  }

  return (
    <div className="blob-editor">
      <div className="blob-editor-frame-tabs">
        {grids.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`blob-frame-tab ${frameIdx === i ? 'active' : ''}`}
            onClick={() => setFrameIdx(i)}
            aria-pressed={frameIdx === i}
          >
            f{i + 1}
          </button>
        ))}
      </div>

      <label className="blob-apply-all">
        <input
          type="checkbox"
          checked={applyAll}
          onChange={(e) => setApplyAll(e.target.checked)}
        />
        <b>Apply</b> pen / eraser edits to every frame at the same pixel
      </label>

      <div className="workshop-tools">
        <button type="button" className={`workshop-tool-btn ${tool === 'pen' ? 'active' : ''}`} onClick={() => setTool('pen')} title="Pen">✏</button>
        <button type="button" className={`workshop-tool-btn ${tool === 'eraser' ? 'active' : ''}`} onClick={() => setTool('eraser')} title="Eraser">⌫</button>
        <button type="button" className={`workshop-tool-btn ${tool === 'fill' ? 'active' : ''}`} onClick={() => setTool('fill')} title="Fill (current frame only)">▣</button>
        <button type="button" className={`workshop-tool-btn ${tool === 'picker' ? 'active' : ''}`} onClick={() => setTool('picker')} title="Picker">⊙</button>
        <label className="workshop-grid-toggle">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
          />
          grid
        </label>
      </div>

      <div className="workshop-canvas-wrap">
        <div className="workshop-canvas-stack" style={{ width: CANVAS_PX, height: CANVAS_PX }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_PX}
            height={CANVAS_PX}
            className="workshop-canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          <canvas
            ref={gridRef}
            width={CANVAS_PX}
            height={CANVAS_PX}
            className="workshop-canvas workshop-grid-overlay"
          />
        </div>
      </div>

      <div className="blob-roles">
        {BLOB_ROLES.map((role) => {
          const swatch = activePalette[role.ch] || '#000';
          return (
            <button
              key={role.ch}
              type="button"
              className={`blob-role ${color === role.ch ? 'active' : ''}`}
              onClick={() => setColor(role.ch)}
              title={role.desc}
            >
              <span className="blob-role-swatch" style={{ background: swatch }} />
              <span className="blob-role-name">{role.name}</span>
              <span className="blob-role-char">{role.ch}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
