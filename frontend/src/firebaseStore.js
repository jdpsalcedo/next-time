import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
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
    liked: !!a.liked,
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
          liked: !!a.liked,
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
        liked: false,
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

// ---- Tags ----

export async function listTags() {
  const snap = await getDocs(userCol('tags'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(publicTag);
}

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

export async function listActivities() {
  const [actsSnap, tagsById] = await Promise.all([
    getDocs(userCol('activities')),
    fetchTagsMap(),
  ]);
  return actsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const ta = a.created_at?.toMillis?.() ?? 0;
      const tb = b.created_at?.toMillis?.() ?? 0;
      return tb - ta;
    })
    .map((a) => hydrateActivity(a, tagsById));
}

export async function createActivity({
  title,
  description = '',
  duration_seconds = 0,
  tag_ids = [],
  liked = false,
}) {
  const tagsById = await fetchTagsMap();
  const missing = tag_ids.filter((tid) => !tagsById.has(tid));
  if (missing.length) throw new Error(`unknown tag ids: ${missing.join(',')}`);
  const data = {
    title,
    description,
    duration_seconds,
    tag_ids: [...tag_ids],
    liked: !!liked,
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
  if (patch.liked !== undefined) update.liked = !!patch.liked;
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

export async function listTimers() {
  const [timersSnap, activitiesById, tagsById] = await Promise.all([
    getDocs(userCol('timers')),
    fetchActivitiesMap(),
    fetchTagsMap(),
  ]);
  return timersSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const ta = a.created_at?.toMillis?.() ?? 0;
      const tb = b.created_at?.toMillis?.() ?? 0;
      return tb - ta;
    })
    .map((t) => hydrateTimer(t, activitiesById, tagsById));
}

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

// ---- Settings ----

const SETTINGS_DEFAULTS = {
  dark_mode: false,
  reverse_countdown: false,
  dummy_data: false,
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
      liked: false,
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
