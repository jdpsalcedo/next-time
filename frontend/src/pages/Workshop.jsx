import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { isAdminUser } from '../admin.js';
import { useToast } from '../toast.jsx';
import {
  addCosmeticEntry,
  deleteCosmeticEntry,
  setSlimeDefaults,
  updateCosmeticEntry,
} from '../firebaseStore.js';
import {
  BODY_ANCHORS,
  COSMETIC_SLOTS,
  RARITY_LABEL,
  useCosmeticCatalog,
} from '../slime/catalog.js';
import { resolveEquippedItems } from '../slime.js';
import {
  FRAMES as SLIME_FRAMES,
  SLEEPING_FRAMES as SLIME_SLEEP_FRAMES,
  SLIME_SKINS,
  W as SLIME_W,
  H as SLIME_H,
} from '../components/SlimeSprite.jsx';
import { useSlimeDefaults } from '../slimeDefaults.jsx';
import CosmeticThumb from '../components/CosmeticThumb.jsx';
import FullSetPreview from '../components/FullSetPreview.jsx';
import BlobEditor from '../components/BlobEditor.jsx';

const GRID = 16;
const CANVAS_PX = 320;
const PIXEL = CANVAS_PX / GRID;

const DEFAULT_COSMETIC_ANCHOR = {
  hat:  [8, 15],
  face: [8, 8],
  back: [8, 8],
};

const EDITOR_PALETTE = [
  null, '#000000', '#1a0e1f', '#3a2208', '#3a1f08', '#0d2818', '#0a0414', '#0a1e3a',
  '#ffffff', '#fff8e7', '#fff0a8', '#a8f5c2', '#a8d8ff', '#ffd0e3', '#c4a8ff',
  '#62d489', '#2d8a4f', '#4ea8ff', '#1f5a9c', '#ff85b8', '#c44a82', '#7c3aed',
  '#ffd23f', '#c49520', '#ff4444', '#a01515', '#ff8c42', '#ff5e7e', '#4a2870',
];

const SLOTS = [
  { id: 'hat', label: 'Hat', icon: '🎩' },
  { id: 'face', label: 'Face', icon: '👓' },
  { id: 'back', label: 'Back', icon: '🦋' },
  { id: 'skin', label: 'Skin', icon: '🎨' },
];

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const SKIN_PALETTE_FIELDS = [
  { key: 'O',   label: 'Main body' },
  { key: 'H',   label: 'Highlight' },
  { key: 'S',   label: 'Shadow' },
  { key: '!',   label: 'Outline' },
  { key: 'E',   label: 'Eyes & mouth' },
  { key: 'W',   label: 'Eye sparkle' },
];

// Skin presets aligned with existing in-app SKINS but exposed by-key for the editor.
function paletteFromSkin(key) {
  const p = SLIME_SKINS[key].palette;
  return { '!': p['!'], O: p.O, H: p.H, S: p.S, E: p.E, W: p.W, M: p.M, B: p.B, b: p.b };
}
const SKIN_PRESETS = {
  emerald:   paletteFromSkin('emerald'),
  azure:     paletteFromSkin('azure'),
  bubblegum: paletteFromSkin('bubblegum'),
  honey:     paletteFromSkin('honey'),
  shadow:    paletteFromSkin('shadow'),
};

function emptyGrid() {
  return Array.from({ length: GRID }, () => Array(GRID).fill(null));
}

function emptyPixelsBySlot() {
  return { hat: emptyGrid(), face: emptyGrid(), back: emptyGrid() };
}

function floodFill(grid, x, y, replacement) {
  const target = grid[y][x];
  if (target === replacement) return grid;
  const next = grid.map((row) => row.slice());
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cx >= GRID || cy < 0 || cy >= GRID) continue;
    if (next[cy][cx] !== target) continue;
    next[cy][cx] = replacement;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return next;
}

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function drawSlimeFrame(ctx, frameIdx, pixelSize, paletteOverride, offsetX = 0, offsetY = 0) {
  const palette = paletteOverride || SLIME_SKINS.emerald.palette;
  const frame = SLIME_FRAMES[frameIdx];
  for (let y = 0; y < SLIME_H; y++) {
    const row = frame[y];
    for (let x = 0; x < SLIME_W; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ' || ch === undefined) continue;
      ctx.fillStyle = palette[ch] || palette['!'];
      ctx.fillRect(offsetX + x * pixelSize, offsetY + y * pixelSize, pixelSize, pixelSize);
    }
  }
}

function drawCosmetic(ctx, pixels, slot, anchor, frameIdx, pixelSize, offsetX = 0, offsetY = 0) {
  const bodyAnchor = BODY_ANCHORS[slot]?.[frameIdx];
  if (!bodyAnchor) return;
  const [bX, bY] = bodyAnchor;
  const [aX, aY] = anchor;
  const startX = offsetX + (bX - aX) * pixelSize;
  const startY = offsetY + (bY - aY) * pixelSize;
  for (let y = 0; y < pixels.length; y++) {
    const row = pixels[y];
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(startX + x * pixelSize, startY + y * pixelSize, pixelSize, pixelSize);
    }
  }
}

function hasAnyPixels(grid) {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x]) return true;
    }
  }
  return false;
}

export default function Workshop() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [view, setView] = useState('create');
  const [slot, setSlot] = useState('hat');

  // Overlay editor state, per slot.
  const [pixelsBySlot, setPixelsBySlot] = useState(emptyPixelsBySlot);
  // Anchors are always stored as 6 [x,y] pairs internally. When perFrame is
  // off, edits mirror across all 6 so they stay identical.
  const [anchorBySlot, setAnchorBySlot] = useState({
    hat: Array(6).fill(null).map(() => [...DEFAULT_COSMETIC_ANCHOR.hat]),
    face: Array(6).fill(null).map(() => [...DEFAULT_COSMETIC_ANCHOR.face]),
    back: Array(6).fill(null).map(() => [...DEFAULT_COSMETIC_ANCHOR.back]),
  });
  const [perFrameBySlot, setPerFrameBySlot] = useState({ hat: false, face: false, back: false });

  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#ff85b8');
  const [showGrid, setShowGrid] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);

  const [previewFrame, setPreviewFrame] = useState(3);
  const [anchorDragging, setAnchorDragging] = useState(false);

  // Skin editor state.
  const [skinPalette, setSkinPalette] = useState(() => ({ ...SKIN_PRESETS.emerald }));
  // Optional custom sprite frames for the skin. Null means "use default frames".
  const [skinFramesDraft, setSkinFramesDraft] = useState(null);
  const [skinUseCustomFrames, setSkinUseCustomFrames] = useState(false);
  const [replaceDefault, setReplaceDefault] = useState(false);
  const [publishingDefault, setPublishingDefault] = useState(false);

  // Submit form state.
  const [submitName, setSubmitName] = useState('');
  const [submitRarity, setSubmitRarity] = useState('common');
  const [submitting, setSubmitting] = useState(false);
  // When set, the editor is loaded from this catalog entry and Submit will
  // overwrite it (preserving id + original created_by/created_at) instead of
  // appending a new entry.
  const [editing, setEditing] = useState(null);

  const canvasRef = useRef(null);
  const gridRef = useRef(null);
  const anchorCanvasRef = useRef(null);
  const stripRefs = useRef([]);
  const skinStripRefs = useRef([]);
  const dragStateRef = useRef(null);

  const overlaySlot = slot === 'skin' ? null : slot;
  const pixels = overlaySlot ? pixelsBySlot[overlaySlot] : null;
  const perFrame = overlaySlot ? perFrameBySlot[overlaySlot] : false;
  const anchorFrames = overlaySlot ? anchorBySlot[overlaySlot] : null;
  // Anchor for the *currently previewed* frame — what the nudge pad edits.
  const anchor = anchorFrames ? anchorFrames[previewFrame] : null;
  const offsetFromDefault = useMemo(() => {
    if (!overlaySlot) return [0, 0];
    const def = DEFAULT_COSMETIC_ANCHOR[overlaySlot];
    return [anchor[0] - def[0], anchor[1] - def[1]];
  }, [overlaySlot, anchor]);

  // Editor canvas
  useEffect(() => {
    if (!pixels) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const c = pixels[y][x];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x * PIXEL, y * PIXEL, PIXEL, PIXEL);
      }
    }
  }, [pixels]);

  // Grid overlay
  useEffect(() => {
    if (!overlaySlot) return;
    const ctx = gridRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
    if (!showGrid) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * PIXEL + 0.5, 0);
      ctx.lineTo(i * PIXEL + 0.5, CANVAS_PX);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * PIXEL + 0.5);
      ctx.lineTo(CANVAS_PX, i * PIXEL + 0.5);
      ctx.stroke();
    }
  }, [showGrid, overlaySlot]);

  // Anchor preview (overlay mode)
  const ANCHOR_PIXEL = 12;
  const ANCHOR_CANVAS_PX = SLIME_W * ANCHOR_PIXEL;
  useEffect(() => {
    if (!overlaySlot) return;
    const canvas = anchorCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, ANCHOR_CANVAS_PX, ANCHOR_CANVAS_PX);

    const frameAnchor = anchorFrames[previewFrame];
    if (slot === 'back') drawCosmetic(ctx, pixels, slot, frameAnchor, previewFrame, ANCHOR_PIXEL);
    drawSlimeFrame(ctx, previewFrame, ANCHOR_PIXEL, SLIME_SKINS.emerald.palette);
    if (slot === 'hat' || slot === 'face') drawCosmetic(ctx, pixels, slot, frameAnchor, previewFrame, ANCHOR_PIXEL);

    const bodyAnchor = BODY_ANCHORS[slot]?.[previewFrame];
    if (bodyAnchor) {
      const [bX, bY] = bodyAnchor;
      const bodyCenterX = bX * ANCHOR_PIXEL + ANCHOR_PIXEL / 2;
      const bodyCenterY = bY * ANCHOR_PIXEL + ANCHOR_PIXEL / 2;
      ctx.strokeStyle = '#62d489';
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bodyCenterX - 10, bodyCenterY);
      ctx.lineTo(bodyCenterX + 10, bodyCenterY);
      ctx.moveTo(bodyCenterX, bodyCenterY - 10);
      ctx.lineTo(bodyCenterX, bodyCenterY + 10);
      ctx.stroke();
      ctx.strokeStyle = '#ff85b8';
      ctx.beginPath();
      ctx.moveTo(bodyCenterX - 8, bodyCenterY);
      ctx.lineTo(bodyCenterX + 8, bodyCenterY);
      ctx.moveTo(bodyCenterX, bodyCenterY - 8);
      ctx.lineTo(bodyCenterX, bodyCenterY + 8);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [pixels, slot, anchorFrames, previewFrame, overlaySlot]);

  // Overlay preview strip
  useEffect(() => {
    if (!overlaySlot) return;
    const STRIP_PIXEL = 2;
    SLIME_FRAMES.forEach((_, i) => {
      const c = stripRefs.current[i];
      if (!c) return;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, c.width, c.height);
      const frameAnchor = anchorFrames[i];
      if (slot === 'back') drawCosmetic(ctx, pixels, slot, frameAnchor, i, STRIP_PIXEL);
      drawSlimeFrame(ctx, i, STRIP_PIXEL, SLIME_SKINS.emerald.palette);
      if (slot === 'hat' || slot === 'face') drawCosmetic(ctx, pixels, slot, frameAnchor, i, STRIP_PIXEL);
    });
  }, [pixels, slot, anchorFrames, overlaySlot]);

  // Skin preview strip
  useEffect(() => {
    if (slot !== 'skin') return;
    const STRIP_PIXEL = 2;
    SLIME_FRAMES.forEach((_, i) => {
      const c = skinStripRefs.current[i];
      if (!c) return;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, c.width, c.height);
      // Merge user-selected colors into the rest of the palette (M=E by default, B/b stay)
      const merged = {
        ...SKIN_PRESETS.emerald,
        ...skinPalette,
        M: skinPalette.M ?? skinPalette.E,
      };
      drawSlimeFrame(ctx, i, STRIP_PIXEL, merged);
    });
  }, [slot, skinPalette]);

  // Reset name when slot changes — but not while loading an item for edit,
  // since loadForEdit sets both slot and name/rarity in the same batch.
  useEffect(() => {
    if (editing) return;
    setSubmitName('');
    setSubmitRarity('common');
  }, [slot, editing]);

  if (!isAdminUser(user)) {
    return <Navigate to="/settings" replace />;
  }

  // -- Editor handlers --
  function getEditorCell(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = CANVAS_PX / rect.width;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const x = Math.floor((cx * scale) / PIXEL);
    const y = Math.floor((cy * scale) / PIXEL);
    if (x < 0 || x >= GRID || y < 0 || y >= GRID) return null;
    return [x, y];
  }
  function applyAt(x, y) {
    if (!overlaySlot) return;
    if (tool === 'picker') {
      const c = pixelsBySlot[overlaySlot][y][x];
      if (c) {
        setColor(c);
        setTool('pen');
      }
      return;
    }
    const replacement = tool === 'eraser' ? null : color;
    setPixelsBySlot((prev) => {
      const grid = prev[overlaySlot];
      if (tool === 'fill') return { ...prev, [overlaySlot]: floodFill(grid, x, y, replacement) };
      if (grid[y][x] === replacement) return prev;
      const next = grid.map((row) => row.slice());
      next[y][x] = replacement;
      return { ...prev, [overlaySlot]: next };
    });
  }
  function onPointerDown(e) {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    const cell = getEditorCell(e);
    if (!cell) return;
    setIsDrawing(true);
    applyAt(cell[0], cell[1]);
  }
  function onPointerMove(e) {
    if (!isDrawing) return;
    const cell = getEditorCell(e);
    if (!cell) return;
    applyAt(cell[0], cell[1]);
  }
  function onPointerUp(e) {
    if (canvasRef.current?.hasPointerCapture?.(e.pointerId)) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }
    setIsDrawing(false);
  }
  function clearCanvas() {
    if (!overlaySlot) return;
    if (!confirm(`Clear all pixels for ${overlaySlot}?`)) return;
    setPixelsBySlot((prev) => ({ ...prev, [overlaySlot]: emptyGrid() }));
  }

  // -- Anchor handlers --
  // applyToFrames: returns the next 6-frame array given a transform on the
  // current frame. In per-frame mode, only the active frame changes; otherwise
  // every frame mirrors the change.
  function updateAnchor(transform) {
    if (!overlaySlot) return;
    setAnchorBySlot((prev) => {
      const frames = prev[overlaySlot];
      const next = frames.map((p, i) => {
        if (perFrame && i !== previewFrame) return p;
        const out = transform(p);
        return [
          Math.max(0, Math.min(GRID - 1, out[0])),
          Math.max(0, Math.min(GRID - 1, out[1])),
        ];
      });
      return { ...prev, [overlaySlot]: next };
    });
  }
  function nudgeAnchor(dx, dy) {
    updateAnchor(([x, y]) => [x + dx, y + dy]);
  }
  function centerAnchorH() {
    updateAnchor(([_, y]) => [Math.floor(GRID / 2), y]);
  }
  function resetAnchor() {
    if (!overlaySlot) return;
    const def = DEFAULT_COSMETIC_ANCHOR[overlaySlot];
    setAnchorBySlot((prev) => {
      const frames = prev[overlaySlot];
      const next = frames.map((p, i) => (perFrame && i !== previewFrame) ? p : [...def]);
      return { ...prev, [overlaySlot]: next };
    });
  }
  function togglePerFrame() {
    if (!overlaySlot) return;
    setPerFrameBySlot((prev) => ({ ...prev, [overlaySlot]: !prev[overlaySlot] }));
  }
  function getAnchorCanvasPos(e) {
    const rect = anchorCanvasRef.current.getBoundingClientRect();
    const scale = ANCHOR_CANVAS_PX / rect.width;
    const cx = (e.clientX - rect.left) * scale;
    const cy = (e.clientY - rect.top) * scale;
    return { px: Math.floor(cx / ANCHOR_PIXEL), py: Math.floor(cy / ANCHOR_PIXEL) };
  }
  function onAnchorPointerDown(e) {
    if (!overlaySlot) return;
    e.preventDefault();
    anchorCanvasRef.current?.setPointerCapture(e.pointerId);
    const pos = getAnchorCanvasPos(e);
    // Snapshot every frame's anchor so per-frame mode can keep non-active
    // frames pinned during a drag while still letting them mirror in
    // single-anchor mode.
    dragStateRef.current = {
      startPos: pos,
      startFrames: anchorFrames.map((p) => [...p]),
    };
    setAnchorDragging(true);
  }
  function onAnchorPointerMove(e) {
    if (!anchorDragging || !overlaySlot) return;
    const pos = getAnchorCanvasPos(e);
    const drag = dragStateRef.current;
    if (!drag) return;
    const dx = pos.px - drag.startPos.px;
    const dy = pos.py - drag.startPos.py;
    if (dx === 0 && dy === 0) return;
    setAnchorBySlot((prev) => {
      const next = drag.startFrames.map((start, i) => {
        if (perFrame && i !== previewFrame) return prev[overlaySlot][i];
        return [
          Math.max(0, Math.min(GRID - 1, start[0] - dx)),
          Math.max(0, Math.min(GRID - 1, start[1] - dy)),
        ];
      });
      return { ...prev, [overlaySlot]: next };
    });
  }
  function onAnchorPointerUp(e) {
    if (anchorCanvasRef.current?.hasPointerCapture?.(e.pointerId)) {
      anchorCanvasRef.current.releasePointerCapture(e.pointerId);
    }
    setAnchorDragging(false);
    dragStateRef.current = null;
  }

  // -- Skin handlers --
  function applyPreset(key) {
    setSkinPalette({ ...SKIN_PRESETS[key] });
  }
  function setSkinColor(roleKey, value) {
    setSkinPalette((prev) => {
      const next = { ...prev, [roleKey]: value };
      if (roleKey === 'E') next.M = value;
      return next;
    });
  }
  function resetSkin() {
    setSkinPalette({ ...SKIN_PRESETS.emerald });
  }

  // Load a catalog entry into the editor so admin can tweak and overwrite it.
  // Hydrates pixels + anchors for overlay slots, palette (+ optional custom
  // frames) for skins, and pre-fills the submit form. Switches to Create view.
  function loadForEdit(item) {
    if (!item || item._builtIn) return;
    setView('create');
    setSlot(item.slot);
    setSubmitName(item.name || '');
    setSubmitRarity(item.rarity || 'common');
    setReplaceDefault(false);
    if (item.slot === 'skin') {
      setSkinPalette({ ...SKIN_PRESETS.emerald, ...(item.palette || {}) });
      if (item.frames) {
        setSkinUseCustomFrames(true);
        setSkinFramesDraft(item.frames);
      } else {
        setSkinUseCustomFrames(false);
        setSkinFramesDraft(null);
      }
    } else {
      const grid = emptyGrid();
      if (Array.isArray(item.pixels)) {
        for (let y = 0; y < GRID; y++) {
          const row = item.pixels[y];
          if (!row) continue;
          for (let x = 0; x < GRID; x++) {
            grid[y][x] = row[x] || null;
          }
        }
      }
      setPixelsBySlot((prev) => ({ ...prev, [item.slot]: grid }));

      // Anchor may be a single [x,y] (mirrored across all frames) or a
      // 6-element array of pairs (per-frame). Expand to 6 frames either way
      // and turn per-frame mode on iff the original stored per-frame anchors.
      const a = item.anchor;
      const def = DEFAULT_COSMETIC_ANCHOR[item.slot];
      let frames;
      let perFrameNext = false;
      if (Array.isArray(a) && Array.isArray(a[0])) {
        frames = Array.from({ length: 6 }, (_, i) => {
          const p = a[i] || a[0] || def;
          return [p[0], p[1]];
        });
        perFrameNext = true;
      } else if (Array.isArray(a) && a.length === 2 && typeof a[0] === 'number') {
        frames = Array.from({ length: 6 }, () => [a[0], a[1]]);
      } else {
        frames = Array.from({ length: 6 }, () => [...def]);
      }
      setAnchorBySlot((prev) => ({ ...prev, [item.slot]: frames }));
      setPerFrameBySlot((prev) => ({ ...prev, [item.slot]: perFrameNext }));
    }
    setEditing(item);
  }

  function cancelEdit() {
    setEditing(null);
  }

  // -- Submit --
  async function handleSubmit() {
    const name = submitName.trim();
    if (!name) {
      toast.error('Name is required');
      return;
    }
    const isEditing = !!editing;
    let entry;
    if (slot === 'skin') {
      const palette = {
        '!': skinPalette['!'],
        O: skinPalette.O,
        H: skinPalette.H,
        S: skinPalette.S,
        E: skinPalette.E,
        W: skinPalette.W,
        M: skinPalette.M ?? skinPalette.E,
      };
      const customFrames = skinUseCustomFrames && skinFramesDraft ? skinFramesDraft : null;
      entry = {
        id: isEditing ? editing.id : `skin_${slugify(name)}_${Date.now().toString(36)}`,
        slot: 'skin',
        name,
        rarity: submitRarity,
        created_by: isEditing ? (editing.created_by ?? user.email) : user.email,
        created_at: isEditing ? (editing.created_at ?? Date.now()) : Date.now(),
        palette,
        ...(customFrames ? { frames: customFrames } : {}),
      };
    } else {
      if (!hasAnyPixels(pixels)) {
        toast.error('Paint some pixels first');
        return;
      }
      // Collapse anchors to a single [x,y] if every frame matches; otherwise
      // keep the full 6-frame array. Saves bytes and signals intent.
      const allEqual = anchorFrames.every(
        (p) => p[0] === anchorFrames[0][0] && p[1] === anchorFrames[0][1],
      );
      const anchorOut = allEqual
        ? [...anchorFrames[0]]
        : anchorFrames.map((p) => [...p]);
      entry = {
        id: isEditing ? editing.id : `${slot}_${slugify(name)}_${Date.now().toString(36)}`,
        slot,
        name,
        rarity: submitRarity,
        created_by: isEditing ? (editing.created_by ?? user.email) : user.email,
        created_at: isEditing ? (editing.created_at ?? Date.now()) : Date.now(),
        anchor: anchorOut,
        pixels: pixels.map((row) => row.slice()),
      };
    }
    setSubmitting(true);
    try {
      if (isEditing) {
        await updateCosmeticEntry(entry);
      } else {
        await addCosmeticEntry(entry);
      }
      // If admin asked, also overwrite the global emerald default so every
      // user's "emerald" slime takes on this look.
      if (slot === 'skin' && replaceDefault) {
        await setSlimeDefaults({
          emerald_skin: {
            palette: entry.palette,
            frames: entry.frames || null,
          },
        });
        toast.success(
          isEditing
            ? `Saved "${name}" + replaced default emerald`
            : `Published "${name}" + replaced default emerald`,
        );
      } else {
        toast.success(
          isEditing
            ? `Saved changes to "${name}"`
            : `Published "${name}" to the cosmetic catalog`,
        );
      }
      if (isEditing) {
        setEditing(null);
      } else {
        setSubmitName('');
      }
      setReplaceDefault(false);
    } catch (err) {
      toast.error(`Couldn't ${isEditing ? 'save' : 'publish'}: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  const slotMeta = SLOTS.find((s) => s.id === slot);

  return (
    <div>
      <div className="section-header">
        <h1>Cosmetic workshop</h1>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => navigate('/settings')}
        >
          Back to settings
        </button>
      </div>

      <div className="slime-tabs" role="tablist" style={{ marginBottom: 16 }}>
        <button
          type="button"
          role="tab"
          className={`slime-tab ${view === 'create' ? 'active' : ''}`}
          aria-selected={view === 'create'}
          onClick={() => setView('create')}
        >
          Create
        </button>
        <button
          type="button"
          role="tab"
          className={`slime-tab ${view === 'wardrobe' ? 'active' : ''}`}
          aria-selected={view === 'wardrobe'}
          onClick={() => setView('wardrobe')}
        >
          Wardrobe
        </button>
        <button
          type="button"
          role="tab"
          className={`slime-tab ${view === 'animations' ? 'active' : ''}`}
          aria-selected={view === 'animations'}
          onClick={() => setView('animations')}
        >
          Animations
        </button>
      </div>

      {view === 'wardrobe' && <WorkshopWardrobe onEdit={loadForEdit} />}
      {view === 'animations' && <WorkshopAnimations />}

      {view === 'create' && (
        <>
      {editing && (
        <div className="workshop-editing-banner" role="status">
          <div>
            <b>Editing</b> "{editing.name}" — submitting will overwrite this {editing.slot}.
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={cancelEdit}
          >
            Cancel edit
          </button>
        </div>
      )}
      <div className="workshop-slot-picker">
        {SLOTS.map((s) => {
          const disabled = !!editing && slot !== s.id;
          return (
            <button
              key={s.id}
              type="button"
              className={`workshop-slot-btn ${slot === s.id ? 'active' : ''}`}
              onClick={() => setSlot(s.id)}
              data-slot={s.id}
              aria-pressed={slot === s.id}
              disabled={disabled}
              title={disabled ? 'Cancel edit to switch slot' : undefined}
            >
              <span className="workshop-slot-icon" aria-hidden>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {slot === 'skin' ? (
        <div className="workshop-grid">
          <div className="card workshop-editor-card">
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Skin editor (palette swap)</div>
            <div className="muted" style={{ fontSize: '0.9rem', marginBottom: 14 }}>
              Recolor the slime's palette roles. Animates perfectly across all hop frames.
            </div>

            <div className="workshop-skin-grid">
              {SKIN_PALETTE_FIELDS.map((f) => (
                <label key={f.key} className="workshop-skin-field">
                  <span className="workshop-skin-field-label">
                    {f.label} <code>({f.key})</code>
                  </span>
                  <input
                    type="color"
                    value={skinPalette[f.key] || '#000000'}
                    onChange={(e) => setSkinColor(f.key, e.target.value)}
                  />
                </label>
              ))}
            </div>

            <div className="workshop-preset-row">
              {Object.keys(SKIN_PRESETS).map((k) => (
                <button
                  key={k}
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => applyPreset(k)}
                >
                  {k}
                </button>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" onClick={resetSkin}>
                Reset
              </button>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Live preview</div>
              <div className="workshop-preview-strip">
                {SLIME_FRAMES.map((_, i) => (
                  <canvas
                    key={i}
                    ref={(el) => { skinStripRefs.current[i] = el; }}
                    width={SLIME_W * 2}
                    height={SLIME_H * 2}
                    className="workshop-preview-frame"
                  />
                ))}
              </div>
            </div>

            <div className="workshop-anchor-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                <div style={{ fontWeight: 600 }}>Custom sprite (optional)</div>
                <label className="workshop-grid-toggle">
                  <input
                    type="checkbox"
                    checked={skinUseCustomFrames}
                    onChange={(e) => {
                      setSkinUseCustomFrames(e.target.checked);
                      if (e.target.checked && !skinFramesDraft) setSkinFramesDraft(SLIME_FRAMES);
                    }}
                  />
                  enable
                </label>
              </div>
              <div className="muted" style={{ fontSize: '0.85rem', marginBottom: 10 }}>
                Off: this skin recolors the default sprite (compatible with hats / faces / backs).
                On: this skin ships its own pixel art for every hop frame — overrides the default sprite when equipped.
              </div>
              {skinUseCustomFrames && (
                <BlobEditor
                  frames={skinFramesDraft || SLIME_FRAMES}
                  palette={skinPalette}
                  onChange={setSkinFramesDraft}
                />
              )}
            </div>
          </div>

          <div className="card workshop-palette-card">
            <SubmitCard
              slotLabel="Skin"
              name={submitName}
              setName={setSubmitName}
              rarity={submitRarity}
              setRarity={setSubmitRarity}
              onSubmit={handleSubmit}
              submitting={submitting}
              inline
              editing={!!editing}
            />
            <label className="workshop-replace-default">
              <input
                type="checkbox"
                checked={replaceDefault}
                onChange={(e) => setReplaceDefault(e.target.checked)}
              />
              <span>
                <b>Replace default emerald</b>
                <div className="muted" style={{ fontSize: '0.75rem' }}>
                  Sets this skin (palette + sprite if custom) as the global default emerald
                  for every user. Affects anyone whose equipped skin is "emerald".
                </div>
              </span>
            </label>
          </div>
        </div>
      ) : (
        <div className="workshop-grid">
          <div className="card workshop-editor-card">
            <div style={{ fontWeight: 600, marginBottom: 10 }}>
              {slotMeta.label} editor (16×16)
            </div>

            <div className="workshop-tools">
              <button type="button" className={`workshop-tool-btn ${tool === 'pen' ? 'active' : ''}`} onClick={() => setTool('pen')} title="Pen" aria-pressed={tool === 'pen'}>✏</button>
              <button type="button" className={`workshop-tool-btn ${tool === 'eraser' ? 'active' : ''}`} onClick={() => setTool('eraser')} title="Eraser" aria-pressed={tool === 'eraser'}>⌫</button>
              <button type="button" className={`workshop-tool-btn ${tool === 'fill' ? 'active' : ''}`} onClick={() => setTool('fill')} title="Fill" aria-pressed={tool === 'fill'}>▣</button>
              <button type="button" className={`workshop-tool-btn ${tool === 'picker' ? 'active' : ''}`} onClick={() => setTool('picker')} title="Picker" aria-pressed={tool === 'picker'}>⊙</button>
              <label className="workshop-grid-toggle">
                <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
                grid
              </label>
              <button type="button" className="btn btn-ghost btn-sm workshop-clear-btn" onClick={clearCanvas}>
                Clear
              </button>
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

            <div className="workshop-anchor-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                <div style={{ fontWeight: 600 }}>Anchor placement</div>
                <label className="workshop-grid-toggle" title="When on, drag/nudge only affects the selected frame">
                  <input
                    type="checkbox"
                    checked={perFrame}
                    onChange={togglePerFrame}
                  />
                  per-frame
                </label>
              </div>
              <div className="muted" style={{ fontSize: '0.85rem', marginBottom: 10 }}>
                {perFrame
                  ? 'Per-frame on — drag/nudge tweaks only the selected frame. Use this if the cosmetic needs to shift during certain hop frames.'
                  : "Drag the cosmetic to position it on every frame at once. Green cross = slime anchor, pink cross = cosmetic's anchor pixel — line them up."}
              </div>
              <div
                className={`workshop-anchor-stage ${anchorDragging ? 'dragging' : ''}`}
                style={{ width: ANCHOR_CANVAS_PX, maxWidth: '100%' }}
              >
                <canvas
                  ref={anchorCanvasRef}
                  width={ANCHOR_CANVAS_PX}
                  height={ANCHOR_CANVAS_PX}
                  className="workshop-anchor-canvas"
                  onPointerDown={onAnchorPointerDown}
                  onPointerMove={onAnchorPointerMove}
                  onPointerUp={onAnchorPointerUp}
                  onPointerCancel={onAnchorPointerUp}
                />
              </div>

              <div className="workshop-frame-tabs">
                {SLIME_FRAMES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`workshop-frame-tab ${previewFrame === i ? 'active' : ''}`}
                    onClick={() => setPreviewFrame(i)}
                    aria-pressed={previewFrame === i}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <div className="workshop-nudge-pad">
                <div />
                <button type="button" className="workshop-nudge-btn" onClick={() => nudgeAnchor(0, -1)} aria-label="Up">▲</button>
                <div />
                <button type="button" className="workshop-nudge-btn" onClick={() => nudgeAnchor(-1, 0)} aria-label="Left">◀</button>
                <button type="button" className="workshop-nudge-btn center" onClick={centerAnchorH} aria-label="Center horizontally">⊕</button>
                <button type="button" className="workshop-nudge-btn" onClick={() => nudgeAnchor(1, 0)} aria-label="Right">▶</button>
                <div />
                <button type="button" className="workshop-nudge-btn" onClick={() => nudgeAnchor(0, 1)} aria-label="Down">▼</button>
                <div />
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={resetAnchor}>
                  Reset anchor
                </button>
              </div>

              <div className="muted" style={{ textAlign: 'center', marginTop: 8, fontSize: '0.85rem' }}>
                anchor: <b style={{ color: 'var(--ink)' }}>({anchor[0]}, {anchor[1]})</b>
                {' · '}
                offset: <b style={{ color: 'var(--ink)' }}>({offsetFromDefault[0] >= 0 ? '+' : ''}{offsetFromDefault[0]}, {offsetFromDefault[1] >= 0 ? '+' : ''}{offsetFromDefault[1]})</b>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Live preview (hop cycle)</div>
              <div className="workshop-preview-strip">
                {SLIME_FRAMES.map((_, i) => (
                  <canvas
                    key={i}
                    ref={(el) => { stripRefs.current[i] = el; }}
                    width={SLIME_W * 2}
                    height={SLIME_H * 2}
                    className="workshop-preview-frame"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="card workshop-palette-card">
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Palette</div>
            <div className="workshop-palette">
              {EDITOR_PALETTE.map((c, i) => {
                const isTransparent = c === null;
                const isActive = isTransparent ? tool === 'eraser' : color === c;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`workshop-swatch ${isActive ? 'active' : ''} ${isTransparent ? 'transparent' : ''}`}
                    style={isTransparent ? undefined : { background: c }}
                    onClick={() => {
                      if (isTransparent) {
                        setTool('eraser');
                      } else {
                        setColor(c);
                        if (tool === 'eraser' || tool === 'picker') setTool('pen');
                      }
                    }}
                    aria-label={isTransparent ? 'transparent (eraser)' : c}
                    aria-pressed={isActive}
                  />
                );
              })}
            </div>
            <div style={{ marginTop: 12 }}>
              <label className="muted" style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>
                Custom color
              </label>
              <input
                type="color"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  if (tool === 'eraser' || tool === 'picker') setTool('pen');
                }}
                style={{ width: '100%', height: 36, border: 'none', background: 'transparent' }}
              />
            </div>

            <SubmitCard
              slotLabel={slotMeta.label}
              name={submitName}
              setName={setSubmitName}
              rarity={submitRarity}
              setRarity={setSubmitRarity}
              onSubmit={handleSubmit}
              submitting={submitting}
              inline
              editing={!!editing}
            />
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

function SubmitCard({ slotLabel, name, setName, rarity, setRarity, onSubmit, submitting, inline = false, editing = false }) {
  const wrapperClass = inline ? 'workshop-submit-inline' : 'card workshop-submit-card';
  const heading = editing ? `Save ${slotLabel.toLowerCase()}` : `Submit ${slotLabel.toLowerCase()}`;
  const idleLabel = editing ? 'Save changes' : 'Submit';
  const busyLabel = editing ? 'Saving…' : 'Submitting…';
  return (
    <div className={wrapperClass}>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>{heading}</div>
      <label className="workshop-field">
        <span className="muted" style={{ fontSize: '0.85rem' }}>Name</span>
        <input
          type="text"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`e.g. wizard cap`}
          maxLength={32}
        />
      </label>
      <label className="workshop-field">
        <span className="muted" style={{ fontSize: '0.85rem' }}>Rarity</span>
        <select
          className="input"
          value={rarity}
          onChange={(e) => setRarity(e.target.value)}
        >
          {RARITIES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="btn"
        onClick={onSubmit}
        disabled={submitting || !name.trim()}
        style={{ width: '100%', marginTop: 8 }}
      >
        {submitting ? busyLabel : idleLabel}
      </button>
      <div className="muted" style={{ fontSize: '0.8rem', marginTop: 8, lineHeight: 1.4 }}>
        {editing
          ? 'Overwrites the existing catalog entry. Changes are live for all users immediately.'
          : 'Publishes directly to the shared cosmetic catalog. Live for all users immediately.'}
      </div>
    </div>
  );
}

const WARDROBE_FILTERS = ['all', ...COSMETIC_SLOTS];
const SLOT_LABEL = { hat: 'Hats', face: 'Faces', back: 'Backs', skin: 'Skins' };

function WorkshopAnimations() {
  const toast = useToast();
  const defaults = useSlimeDefaults();
  const [target, setTarget] = useState('hop'); // 'hop' | 'sleep'
  const [hopDraft, setHopDraft] = useState(() => defaults.hop_frames || SLIME_FRAMES);
  const [sleepDraft, setSleepDraft] = useState(() => defaults.sleep_frames || SLIME_SLEEP_FRAMES);
  const [busy, setBusy] = useState(false);

  // Reseed drafts when the Firestore defaults change (and we haven't started
  // editing this animation locally). Heuristic: if the draft equals the
  // previous default, accept the new one.
  useEffect(() => {
    if (defaults.hop_frames) setHopDraft(defaults.hop_frames);
  }, [defaults.hop_frames]);
  useEffect(() => {
    if (defaults.sleep_frames) setSleepDraft(defaults.sleep_frames);
  }, [defaults.sleep_frames]);

  const draft = target === 'hop' ? hopDraft : sleepDraft;
  const setDraft = target === 'hop' ? setHopDraft : setSleepDraft;

  async function publish() {
    setBusy(true);
    try {
      const patch =
        target === 'hop' ? { hop_frames: hopDraft } : { sleep_frames: sleepDraft };
      await setSlimeDefaults(patch);
      toast.success(`Published ${target === 'hop' ? 'hop' : 'sleep'} animation to all slimes`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  function resetToBundled() {
    if (!confirm(`Reset ${target === 'hop' ? 'hop' : 'sleep'} draft to bundled default? (Does not publish until you click Publish.)`)) return;
    if (target === 'hop') setHopDraft(SLIME_FRAMES);
    else setSleepDraft(SLIME_SLEEP_FRAMES);
  }

  return (
    <div className="workshop-grid">
      <div className="card workshop-editor-card">
        <div style={{ fontWeight: 600, marginBottom: 10 }}>
          Animation editor
        </div>
        <div className="muted" style={{ fontSize: '0.85rem', marginBottom: 12 }}>
          Edit the global slime animation. Publishing replaces what every user sees
          (unless a skin ships its own custom frames). Sleep is 2 frames; hop is 6.
        </div>

        <div className="workshop-anim-target" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={target === 'hop'}
            className={`workshop-anim-target-btn ${target === 'hop' ? 'active' : ''}`}
            onClick={() => setTarget('hop')}
          >
            Default hop (6 frames)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={target === 'sleep'}
            className={`workshop-anim-target-btn ${target === 'sleep' ? 'active' : ''}`}
            onClick={() => setTarget('sleep')}
          >
            Sleep (2 frames)
          </button>
        </div>

        <BlobEditor
          key={target}
          frames={draft}
          onChange={setDraft}
        />
      </div>

      <div className="card workshop-palette-card">
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Publish</div>
        <div className="muted" style={{ fontSize: '0.85rem', marginBottom: 12 }}>
          Changes don't go live until you publish. Live preview on the right
          shows the draft as you edit.
        </div>
        <button
          type="button"
          className="btn"
          onClick={publish}
          disabled={busy}
          style={{ width: '100%' }}
        >
          {busy ? 'Publishing…' : `Publish ${target === 'hop' ? 'hop' : 'sleep'} animation`}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={resetToBundled}
          style={{ width: '100%', marginTop: 8 }}
        >
          Reset draft to bundled
        </button>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Live preview</div>
          <div className="workshop-anim-preview">
            <AnimationPreviewCanvas frames={draft} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AnimationPreviewCanvas({ frames }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const palette = SLIME_SKINS.emerald.palette;
  useEffect(() => { frameRef.current = 0; }, [frames]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const pixelSize = 3;
    const drawSize = SLIME_W * pixelSize;
    canvas.width = drawSize;
    canvas.height = drawSize;
    let rafId;
    let last = 0;
    function render() {
      ctx.clearRect(0, 0, drawSize, drawSize);
      const idx = frameRef.current % frames.length;
      const frame = frames[idx];
      for (let y = 0; y < SLIME_H; y++) {
        const row = typeof frame[y] === 'string' ? frame[y] : (frame[y] || []).join('');
        for (let x = 0; x < SLIME_W; x++) {
          const ch = row[x];
          if (!ch || ch === '.') continue;
          ctx.fillStyle = palette[ch] || palette['!'];
          ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        }
      }
    }
    render();
    function loop(t) {
      const fps = frames.length <= 2 ? 1.5 : 6;
      if (t - last >= 1000 / fps) {
        frameRef.current = (frameRef.current + 1) % frames.length;
        render();
        last = t;
      }
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [frames, palette]);
  return <canvas ref={canvasRef} className="workshop-canvas" style={{ width: 144, height: 144 }} />;
}

function WorkshopWardrobe({ onEdit }) {
  const { items, loaded } = useCosmeticCatalog();
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);
  // Workshop's equip state is local — admin can preview any combination
  // without writing to their own settings.
  const [previewEquipped, setPreviewEquipped] = useState({
    skin: 'emerald',
    hat: null,
    face: null,
    back: null,
  });

  // Synthesize built-in skins so the workshop wardrobe can preview them too.
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

  const all = useMemo(() => [...builtInSkins, ...items], [builtInSkins, items]);

  const visible = useMemo(() => {
    const filtered = filter === 'all' ? all : all.filter((c) => c.slot === filter);
    return [...filtered].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  }, [all, filter]);

  const resolved = useMemo(
    () => resolveEquippedItems(previewEquipped, items),
    [previewEquipped, items],
  );

  function equipPreview(item) {
    setPreviewEquipped((prev) => {
      if (item.slot === 'skin') {
        return { ...prev, skin: item.id };
      }
      // Toggle off non-skin slots if same item clicked twice.
      if (prev[item.slot] === item.id) return { ...prev, [item.slot]: null };
      return { ...prev, [item.slot]: item.id };
    });
  }

  async function handleDelete(item) {
    if (item._builtIn) {
      toast.info("Built-in skins can't be deleted.");
      return;
    }
    if (!confirm(`Delete "${item.name}"? Anyone who owned it loses it.`)) return;
    setBusyId(item.id);
    try {
      await deleteCosmeticEntry(item.id);
      toast.success(`Deleted "${item.name}"`);
      // Unequip from preview if it was in use.
      setPreviewEquipped((prev) =>
        prev[item.slot] === item.id ? { ...prev, [item.slot]: null } : prev,
      );
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="slime-wardrobe">
      <FullSetPreview
        equipped={previewEquipped}
        resolved={resolved}
        activeFilter={filter}
        onSlotClick={(slot) => setFilter((cur) => (cur === slot ? 'all' : slot))}
      />
      <div className="slime-filter-bar">
        {WARDROBE_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`slime-filter ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : SLOT_LABEL[f]}
          </button>
        ))}
      </div>
      <div className="muted" style={{ fontSize: '0.85rem' }}>
        {loaded ? `${items.length} cosmetic${items.length === 1 ? '' : 's'} published · click to preview` : 'Loading…'}
      </div>
      {!loaded ? null : visible.length === 0 ? (
        <div className="muted" style={{ padding: 16, textAlign: 'center' }}>
          {items.length === 0
            ? 'Nothing here yet. Switch to Create and publish one.'
            : 'No matches for this filter.'}
        </div>
      ) : (
        <div className="slime-wardrobe-grid">
          {visible.map((item) => {
            const isEquipped = previewEquipped[item.slot] === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`slime-wardrobe-item rarity-${item.rarity} ${isEquipped ? 'equipped' : ''}`}
                onClick={() => equipPreview(item)}
              >
                <CosmeticThumb item={item} />
                <div className="slime-wardrobe-name">{item.name}</div>
                <div className={`slime-wardrobe-rarity rarity-${item.rarity}`}>
                  {RARITY_LABEL[item.rarity]}
                </div>
                <div className="muted" style={{ fontSize: '0.7rem' }}>
                  {item.slot}
                  {item.created_by ? ` · ${item.created_by.split('@')[0]}` : ''}
                </div>
                {isEquipped && <div className="slime-wardrobe-equipped-tag">preview</div>}
                {!item._builtIn && (
                  <>
                    {onEdit && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm workshop-wardrobe-edit"
                        onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                        aria-label={`Edit ${item.name}`}
                        title="Edit"
                      >
                        ✎
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm workshop-wardrobe-delete"
                      onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                      disabled={busyId === item.id}
                      aria-label={`Delete ${item.name}`}
                      title="Delete"
                    >
                      {busyId === item.id ? '…' : '×'}
                    </button>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
