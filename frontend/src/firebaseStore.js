import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase.js';

function uid() {
  const u = auth.currentUser?.uid;
  if (!u) throw new Error('Not signed in');
  return u;
}

function userCol(name) {
  return collection(db, 'users', uid(), name);
}

function userDoc(name, id) {
  return doc(db, 'users', uid(), name, id);
}

function newItemId() {
  return crypto.randomUUID();
}

function publicTag(d) {
  return { id: d.id, name: d.name, color: d.color };
}

function hydrateActivity(a, tagsById) {
  return {
    id: a.id,
    title: a.title,
    description: a.description || '',
    duration_seconds: a.duration_seconds || 0,
    tags: (a.tag_ids || []).map((tid) => tagsById.get(tid)).filter(Boolean).map(publicTag),
  };
}

function hydrateTimer(timer, activitiesById, tagsById) {
  const activities = (timer.items || [])
    .map((item) => {
      if (item.activity_id) {
        const a = activitiesById.get(item.activity_id);
        if (!a) return null;
        const override = item.duration_override;
        return {
          id: item.id,
          type: 'ref',
          activity_id: a.id,
          title: a.title,
          description: a.description || '',
          duration_seconds:
            typeof override === 'number' ? override : a.duration_seconds || 0,
          tags: (a.tag_ids || [])
            .map((tid) => tagsById.get(tid))
            .filter(Boolean)
            .map(publicTag),
        };
      }
      return {
        id: item.id,
        type: 'inline',
        activity_id: null,
        title: item.inline_title || '',
        description: item.inline_description || '',
        duration_seconds: item.inline_duration_seconds || 0,
        tags: [],
      };
    })
    .filter(Boolean);
  return {
    id: timer.id,
    title: timer.title,
    description: timer.description || '',
    activities,
  };
}

function payloadToItems(payload) {
  if (!Array.isArray(payload?.activities)) {
    if (Array.isArray(payload?.activity_ids)) {
      return payload.activity_ids.map((aid) => ({
        id: newItemId(),
        activity_id: aid,
        duration_override: null,
      }));
    }
    return [];
  }
  return payload.activities.map((it) => {
    if (it.activity_id != null) {
      return {
        id: newItemId(),
        activity_id: it.activity_id,
        duration_override:
          typeof it.duration_seconds === 'number' ? it.duration_seconds : null,
      };
    }
    return {
      id: newItemId(),
      inline_title: it.inline_title || '',
      inline_description: it.inline_description || '',
      inline_duration_seconds:
        typeof it.duration_seconds === 'number' ? it.duration_seconds : 0,
    };
  });
}

async function fetchTagsMap() {
  const snap = await getDocs(userCol('tags'));
  return new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
}

async function fetchActivitiesMap() {
  const snap = await getDocs(userCol('activities'));
  return new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
}

export { hydrateActivity, hydrateTimer, publicTag };

// ---- Live subscriptions (cross-device sync) ----
// Each callback receives ({ docs, fromCache, hasPendingWrites }).
// docs is an array of { id, ...data } in arbitrary order; callers sort/hydrate.

function subscribeCol(name, callback) {
  return onSnapshot(
    userCol(name),
    { includeMetadataChanges: true },
    (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback({
        docs,
        fromCache: snap.metadata.fromCache,
        hasPendingWrites: snap.metadata.hasPendingWrites,
      });
    },
  );
}

export function subscribeTags(callback) {
  return subscribeCol('tags', callback);
}

export function subscribeActivities(callback) {
  return subscribeCol('activities', callback);
}

export function subscribeTimers(callback) {
  return subscribeCol('timers', callback);
}

// ---- Tags ----

export async function createTag({ name, color }) {
  const data = {
    name,
    color: color || '#888888',
    is_seed: false,
    created_at: serverTimestamp(),
  };
  const ref = await addDoc(userCol('tags'), data);
  return publicTag({ id: ref.id, ...data });
}

export async function updateTag(id, patch) {
  const update = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.color !== undefined) update.color = patch.color;
  await updateDoc(userDoc('tags', id), update);
  const snap = await getDoc(userDoc('tags', id));
  return publicTag({ id, ...snap.data() });
}

export async function deleteTag(id) {
  await deleteDoc(userDoc('tags', id));
  const actsSnap = await getDocs(userCol('activities'));
  const batch = writeBatch(db);
  for (const d of actsSnap.docs) {
    const data = d.data();
    if ((data.tag_ids || []).includes(id)) {
      batch.update(d.ref, { tag_ids: data.tag_ids.filter((t) => t !== id) });
    }
  }
  await batch.commit();
  return null;
}

// ---- Activities ----

export async function createActivity({
  title,
  description = '',
  duration_seconds = 0,
  tag_ids = [],
}) {
  const tagsById = await fetchTagsMap();
  const missing = tag_ids.filter((tid) => !tagsById.has(tid));
  if (missing.length) throw new Error(`unknown tag ids: ${missing.join(',')}`);
  const data = {
    title,
    description,
    duration_seconds,
    tag_ids: [...tag_ids],
    is_seed: false,
    created_at: serverTimestamp(),
  };
  const ref = await addDoc(userCol('activities'), data);
  return hydrateActivity({ id: ref.id, ...data }, tagsById);
}

export async function updateActivity(id, patch) {
  const update = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.duration_seconds !== undefined) update.duration_seconds = patch.duration_seconds;
  if (patch.tag_ids !== undefined) {
    const tagsById = await fetchTagsMap();
    const missing = patch.tag_ids.filter((tid) => !tagsById.has(tid));
    if (missing.length) throw new Error(`unknown tag ids: ${missing.join(',')}`);
    update.tag_ids = [...patch.tag_ids];
  }
  await updateDoc(userDoc('activities', id), update);
  const [actSnap, tagsById] = await Promise.all([
    getDoc(userDoc('activities', id)),
    fetchTagsMap(),
  ]);
  return hydrateActivity({ id, ...actSnap.data() }, tagsById);
}

export async function deleteActivity(id) {
  await deleteDoc(userDoc('activities', id));
  const timersSnap = await getDocs(userCol('timers'));
  const batch = writeBatch(db);
  for (const d of timersSnap.docs) {
    const items = d.data().items || [];
    const next = items.filter((it) => it.activity_id !== id);
    if (next.length !== items.length) {
      batch.update(d.ref, { items: next });
    }
  }
  await batch.commit();
  return null;
}

// ---- Timers ----

async function getHydratedTimer(id) {
  const [tSnap, activitiesById, tagsById] = await Promise.all([
    getDoc(userDoc('timers', id)),
    fetchActivitiesMap(),
    fetchTagsMap(),
  ]);
  return hydrateTimer({ id, ...tSnap.data() }, activitiesById, tagsById);
}

export async function createTimer(payload = {}) {
  const data = {
    title: payload.title || '',
    description: payload.description || '',
    items: payloadToItems(payload),
    is_seed: false,
    created_at: serverTimestamp(),
  };
  const ref = await addDoc(userCol('timers'), data);
  return getHydratedTimer(ref.id);
}

export async function updateTimer(id, patch = {}) {
  const update = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.activities !== undefined || patch.activity_ids !== undefined) {
    update.items = payloadToItems(patch);
  }
  await updateDoc(userDoc('timers', id), update);
  return getHydratedTimer(id);
}

export async function deleteTimer(id) {
  await deleteDoc(userDoc('timers', id));
  return null;
}

// ---- Timer runs (wall-clock-anchored, multi-client) ----

export function subscribeTimerRuns(callback) {
  return onSnapshot(
    userCol('timerRuns'),
    { includeMetadataChanges: true },
    (snap) => {
      const runs = {};
      for (const d of snap.docs) {
        const data = d.data();
        runs[d.id] = {
          isPlaying: !!data.isPlaying,
          anchorAt: typeof data.anchorAt === 'number' ? data.anchorAt : null,
          pausedTotalElapsedSec:
            typeof data.pausedTotalElapsedSec === 'number'
              ? data.pausedTotalElapsedSec
              : 0,
        };
      }
      callback(runs, {
        fromCache: snap.metadata.fromCache,
        hasPendingWrites: snap.metadata.hasPendingWrites,
      });
    },
  );
}

export async function setTimerRun(timerId, patch) {
  await setDoc(userDoc('timerRuns', timerId), patch, { merge: true });
}

export async function deleteTimerRun(timerId) {
  await deleteDoc(userDoc('timerRuns', timerId));
}

// ---- Timer events (calendar — timers tagged with a date) ----

function hydrateTimerEvent(id, data) {
  return {
    id,
    timerId: data.timerId,
    date: data.date,
    scheduledAt: typeof data.scheduledAt === 'string' ? data.scheduledAt : null,
    notes: data.notes || '',
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
  };
}

export function subscribeTimerEvents({ from, to }, callback) {
  const q = query(
    userCol('timerEvents'),
    where('date', '>=', from),
    where('date', '<=', to),
  );
  return onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
    const events = snap.docs.map((d) => hydrateTimerEvent(d.id, d.data()));
    callback(events, {
      fromCache: snap.metadata.fromCache,
      hasPendingWrites: snap.metadata.hasPendingWrites,
    });
  });
}

export async function createTimerEvent({ timerId, date, scheduledAt = null, notes = '' }) {
  const data = {
    timerId,
    date,
    scheduledAt: scheduledAt || null,
    notes: notes || '',
    createdAt: Date.now(),
  };
  const ref = await addDoc(userCol('timerEvents'), data);
  return hydrateTimerEvent(ref.id, data);
}

export async function updateTimerEvent(id, patch) {
  const update = {};
  if (patch.timerId !== undefined) update.timerId = patch.timerId;
  if (patch.date !== undefined) update.date = patch.date;
  if (patch.scheduledAt !== undefined) update.scheduledAt = patch.scheduledAt || null;
  if (patch.notes !== undefined) update.notes = patch.notes || '';
  await setDoc(userDoc('timerEvents', id), update, { merge: true });
}

export async function deleteTimerEvent(id) {
  await deleteDoc(userDoc('timerEvents', id));
}

// ---- Settings ----

const SETTINGS_DEFAULTS = {
  dark_mode: false,
  reverse_countdown: false,
  dummy_data: false,
  accent_color: '#38bdf8',
  split_warning_seconds: 5,
  slime: {
    enabled: false,
    on: false,
    attached_timer_id: null,
    skin: 'emerald',
    hat: null,
    accessory: null,
    animation: 'hop',
    coins: 0,
    accrued_seconds: 0,
    running_since_ms: null,
    cosmetics: {
      owned: [],
      equipped: { skin: 'emerald', hat: null, face: null, back: null },
    },
  },
};

export async function getSettings() {
  const ref = userDoc('settings', 'main');
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, SETTINGS_DEFAULTS);
    return { ...SETTINGS_DEFAULTS };
  }
  return { ...SETTINGS_DEFAULTS, ...snap.data() };
}

export async function updateSettings(patch) {
  const ref = userDoc('settings', 'main');
  const prev = await getSettings();
  const next = { ...prev, ...patch };
  await setDoc(ref, next, { merge: true });
  if (patch.dummy_data !== undefined) {
    if (patch.dummy_data) await seedDummyData();
    else await clearDummyData();
  }
  return next;
}

// ---- Seed data ----

// ---- Cosmetic catalog (shared across all users) ----

const COSMETIC_CATALOG_DOC = doc(db, 'cosmetics', 'main');
const SLIME_DEFAULTS_DOC = doc(db, 'cosmetics', 'defaults');

// Frames are arrays of row-strings. Firestore disallows arrays-of-arrays so
// we wrap each frame as { rows: string[] } before writing and unwrap on read.
function encodeFrames(frames) {
  if (!frames) return frames;
  return frames.map((rows) => ({ rows }));
}
function decodeFrames(encoded) {
  if (!encoded) return encoded;
  return encoded.map((obj) => obj?.rows || obj);
}

// Firestore disallows nested arrays, so cosmetic pixels are stored on disk
// as { palette: { A: '#hex', ... }, rows: ['..AB..', ...] } and rehydrated
// to the 2D color array consumers expect.
const PALETTE_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#$%&*+=?@';

function encodePixels(pixels) {
  if (!pixels) return null;
  const colorToChar = {};
  const charToColor = {};
  let nextIdx = 0;
  for (const row of pixels) {
    if (!row) continue;
    for (const c of row) {
      if (!c || colorToChar[c]) continue;
      if (nextIdx >= PALETTE_CHARS.length) {
        throw new Error(`Cosmetic uses more than ${PALETTE_CHARS.length} unique colors — reduce palette size before publishing.`);
      }
      const ch = PALETTE_CHARS[nextIdx++];
      colorToChar[c] = ch;
      charToColor[ch] = c;
    }
  }
  const rows = pixels.map((row) =>
    (row || []).map((c) => (c ? colorToChar[c] : '.')).join(''),
  );
  return { palette: charToColor, rows };
}

function decodePixels(encoded) {
  if (!encoded?.rows) return null;
  const palette = encoded.palette || {};
  return encoded.rows.map((row) =>
    row.split('').map((ch) => (ch === '.' ? null : palette[ch] || null)),
  );
}

// Per-frame anchor `[[x,y], ...]` is also a nested array, so flatten it to
// `[x0, y0, x1, y1, ...]` on write and reconstruct on read. Single anchors
// `[x, y]` pass through unchanged.
function encodeAnchor(anchor) {
  if (!anchor) return anchor;
  if (Array.isArray(anchor[0])) return anchor.flatMap(([x, y]) => [x, y]);
  return anchor;
}

function decodeAnchor(anchor) {
  if (!anchor || !Array.isArray(anchor)) return anchor;
  if (anchor.length === 2 && typeof anchor[0] === 'number') return anchor;
  if (Array.isArray(anchor[0])) return anchor; // already a nested array
  // Flat per-frame, unflatten back to [[x,y], ...]
  const out = [];
  for (let i = 0; i < anchor.length; i += 2) out.push([anchor[i], anchor[i + 1]]);
  return out;
}

function encodeEntry(entry) {
  if (!entry) return entry;
  const out = { ...entry };
  if (entry.pixels) out.pixels = encodePixels(entry.pixels);
  if (entry.anchor) out.anchor = encodeAnchor(entry.anchor);
  if (entry.frames) out.frames = encodeFrames(entry.frames);
  return out;
}

function decodeEntry(entry) {
  if (!entry) return entry;
  const out = { ...entry };
  if (entry.pixels?.rows) out.pixels = decodePixels(entry.pixels);
  if (entry.anchor) out.anchor = decodeAnchor(entry.anchor);
  if (entry.frames) out.frames = decodeFrames(entry.frames);
  return out;
}

export function subscribeCosmeticCatalog(callback) {
  return onSnapshot(COSMETIC_CATALOG_DOC, (snap) => {
    const items = snap.data()?.items || [];
    callback(items.map(decodeEntry));
  });
}

export async function addCosmeticEntry(entry) {
  const encoded = encodeEntry(entry);
  await setDoc(
    COSMETIC_CATALOG_DOC,
    {
      items: arrayUnion(encoded),
      updated_at: serverTimestamp(),
    },
    { merge: true },
  );
}

// Read-modify-write since arrayRemove requires byte-identical object match.
// Single-admin workshop, so the race window is irrelevant in practice.
export async function deleteCosmeticEntry(id) {
  const snap = await getDoc(COSMETIC_CATALOG_DOC);
  const items = (snap.data()?.items || []).filter((c) => c.id !== id);
  await setDoc(
    COSMETIC_CATALOG_DOC,
    { items, updated_at: serverTimestamp() },
    { merge: true },
  );
}

// ---- Slime defaults (global hop/sleep frames + default skin override) ----
// Admin-edited animations and the "replace default emerald" overrides live
// in this single doc. SlimeSprite reads it via the SlimeDefaultsProvider and
// falls back to bundled FRAMES/SLEEPING_FRAMES/SLIME_SKINS.emerald when a
// field is missing.

export function subscribeSlimeDefaults(callback) {
  return onSnapshot(SLIME_DEFAULTS_DOC, (snap) => {
    const data = snap.data() || {};
    callback({
      hop_frames: decodeFrames(data.hop_frames),
      sleep_frames: decodeFrames(data.sleep_frames),
      emerald_skin: data.emerald_skin || null, // { palette, frames? }
    });
  });
}

export async function setSlimeDefaults(patch) {
  const out = { updated_at: serverTimestamp() };
  if (patch.hop_frames !== undefined) out.hop_frames = encodeFrames(patch.hop_frames);
  if (patch.sleep_frames !== undefined) out.sleep_frames = encodeFrames(patch.sleep_frames);
  if (patch.emerald_skin !== undefined) {
    out.emerald_skin = patch.emerald_skin
      ? { ...patch.emerald_skin, frames: encodeFrames(patch.emerald_skin.frames) }
      : null;
  }
  await setDoc(SLIME_DEFAULTS_DOC, out, { merge: true });
}

// ---- Seeds (per-user demo data) ----

const SEED_TAGS = [
  { name: 'sports', color: '#ef4444' },
  { name: 'lagree', color: '#a855f7' },
  { name: 'cooking', color: '#f59e0b' },
  { name: 'study', color: '#3b82f6' },
  { name: 'running', color: '#22c55e' },
];

const SEED_ACTIVITIES = [
  { title: 'Sprint interval', description: 'All-out effort', duration_seconds: 30, tag_names: ['sports'] },
  { title: 'Box jumps', description: 'Plyometric power', duration_seconds: 45, tag_names: ['sports'] },
  { title: 'Burpee set', description: '10 reps', duration_seconds: 60, tag_names: ['sports'] },
  { title: 'Bear plank', description: 'Hold tight, knees hovering', duration_seconds: 45, tag_names: ['lagree'] },
  { title: 'Wheelbarrow', description: 'Slow and controlled', duration_seconds: 60, tag_names: ['lagree'] },
  { title: 'Mega donkey', description: 'Kickback hold', duration_seconds: 90, tag_names: ['lagree'] },
  { title: 'Caramelize onions', description: 'Low heat, stir often', duration_seconds: 1200, tag_names: ['cooking'] },
  { title: 'Boil pasta', description: 'Salt the water', duration_seconds: 600, tag_names: ['cooking'] },
  { title: 'Rest the steak', description: 'Tent in foil', duration_seconds: 300, tag_names: ['cooking'] },
  { title: 'Focus block', description: 'Pomodoro work session', duration_seconds: 1500, tag_names: ['study'] },
  { title: 'Short break', description: 'Stand, water, stretch', duration_seconds: 300, tag_names: ['study'] },
  { title: 'Long break', description: 'Step away from the desk', duration_seconds: 900, tag_names: ['study'] },
  { title: 'Easy warmup jog', description: 'Conversational pace', duration_seconds: 600, tag_names: ['running'] },
  { title: 'Tempo interval', description: 'Comfortably hard', duration_seconds: 240, tag_names: ['running'] },
  { title: 'Recovery walk', description: 'Catch your breath', duration_seconds: 90, tag_names: ['running'] },
];

const SEED_TIMERS = [
  { title: 'Sports HIIT round', description: 'Three-move blast', activity_titles: ['Sprint interval', 'Box jumps', 'Burpee set'] },
  { title: 'Lagree mini set', description: 'Slow strength flow', activity_titles: ['Bear plank', 'Wheelbarrow', 'Mega donkey'] },
  { title: 'Steak dinner timing', description: 'Onions to plate', activity_titles: ['Caramelize onions', 'Boil pasta', 'Rest the steak'] },
  { title: 'Pomodoro cycle', description: 'Focus then breathe', activity_titles: ['Focus block', 'Short break', 'Focus block', 'Long break'] },
  { title: 'Easy run', description: 'Warm up, push, recover', activity_titles: ['Easy warmup jog', 'Tempo interval', 'Recovery walk'] },
];

async function seedDummyData() {
  // Tags: skip-by-name idempotent
  const tagsSnap = await getDocs(userCol('tags'));
  const tagByName = new Map(
    tagsSnap.docs.map((d) => [d.data().name, { id: d.id, ...d.data() }])
  );
  const batch = writeBatch(db);
  for (const spec of SEED_TAGS) {
    if (tagByName.has(spec.name)) continue;
    const ref = doc(userCol('tags'));
    const data = { ...spec, is_seed: true, created_at: serverTimestamp() };
    batch.set(ref, data);
    tagByName.set(spec.name, { id: ref.id, ...data });
  }
  await batch.commit();

  // Activities
  const actsSnap = await getDocs(userCol('activities'));
  const actByTitle = new Map(
    actsSnap.docs.map((d) => [d.data().title, { id: d.id, ...d.data() }])
  );
  const batch2 = writeBatch(db);
  for (const spec of SEED_ACTIVITIES) {
    if (actByTitle.has(spec.title)) continue;
    const ref = doc(userCol('activities'));
    const data = {
      title: spec.title,
      description: spec.description,
      duration_seconds: spec.duration_seconds,
      tag_ids: spec.tag_names
        .map((n) => tagByName.get(n)?.id)
        .filter(Boolean),
      is_seed: true,
      created_at: serverTimestamp(),
    };
    batch2.set(ref, data);
    actByTitle.set(spec.title, { id: ref.id, ...data });
  }
  await batch2.commit();

  // Timers
  const timersSnap = await getDocs(userCol('timers'));
  const timerByTitle = new Map(timersSnap.docs.map((d) => [d.data().title, d]));
  const batch3 = writeBatch(db);
  for (const spec of SEED_TIMERS) {
    if (timerByTitle.has(spec.title)) continue;
    const ref = doc(userCol('timers'));
    const items = spec.activity_titles
      .map((t) => actByTitle.get(t)?.id)
      .filter(Boolean)
      .map((aid) => ({ id: newItemId(), activity_id: aid, duration_override: null }));
    batch3.set(ref, {
      title: spec.title,
      description: spec.description,
      items,
      is_seed: true,
      created_at: serverTimestamp(),
    });
  }
  await batch3.commit();
}

async function clearDummyData() {
  const [tagsSnap, actsSnap, timersSnap] = await Promise.all([
    getDocs(query(userCol('tags'), where('is_seed', '==', true))),
    getDocs(query(userCol('activities'), where('is_seed', '==', true))),
    getDocs(query(userCol('timers'), where('is_seed', '==', true))),
  ]);
  const batch = writeBatch(db);
  for (const d of tagsSnap.docs) batch.delete(d.ref);
  for (const d of actsSnap.docs) batch.delete(d.ref);
  for (const d of timersSnap.docs) batch.delete(d.ref);
  await batch.commit();
}
