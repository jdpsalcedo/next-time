const KEYS = {
  tags: 'next-time.tags',
  activities: 'next-time.activities',
  timers: 'next-time.timers',
  settings: 'next-time.settings',
  seq: 'next-time.seq',
};

const SETTINGS_DEFAULTS = {
  dark_mode: true,
  reverse_countdown: false,
  dummy_data: false,
  static_mode: true,
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or disabled — ignore */
  }
}

function nextId() {
  const n = (Number(read(KEYS.seq, 0)) || 0) + 1;
  write(KEYS.seq, n);
  return n;
}

function getTags() { return read(KEYS.tags, []); }
function getActivities() { return read(KEYS.activities, []); }
function getTimers() { return read(KEYS.timers, []); }

function hydrateActivity(act, tagsById) {
  return {
    id: act.id,
    title: act.title,
    description: act.description || '',
    duration_seconds: act.duration_seconds,
    tags: (act.tag_ids || []).map((tid) => tagsById.get(tid)).filter(Boolean),
  };
}

function hydrateTimer(timer, activitiesById, tagsById) {
  const activities = (timer.activity_ids || [])
    .map((aid) => activitiesById.get(aid))
    .filter(Boolean)
    .map((a) => hydrateActivity(a, tagsById));
  return {
    id: timer.id,
    title: timer.title,
    description: timer.description || '',
    activities,
  };
}

function publicTag(t) {
  return { id: t.id, name: t.name, color: t.color };
}

export function listTags() {
  return getTags().map(publicTag);
}

export function createTag({ name, color }) {
  const tags = getTags();
  const tag = { id: nextId(), name, color: color || '#888888', is_seed: false };
  tags.push(tag);
  write(KEYS.tags, tags);
  return publicTag(tag);
}

export function updateTag(id, patch) {
  const tags = getTags();
  const tag = tags.find((t) => t.id === id);
  if (!tag) throw new Error('404: tag not found');
  if (patch.name !== undefined) tag.name = patch.name;
  if (patch.color !== undefined) tag.color = patch.color;
  write(KEYS.tags, tags);
  return publicTag(tag);
}

export function deleteTag(id) {
  write(KEYS.tags, getTags().filter((t) => t.id !== id));
  write(
    KEYS.activities,
    getActivities().map((a) => ({ ...a, tag_ids: (a.tag_ids || []).filter((tid) => tid !== id) }))
  );
  return null;
}

export function listActivities() {
  const tagsById = new Map(getTags().map((t) => [t.id, t]));
  return [...getActivities()]
    .sort((a, b) => b.id - a.id)
    .map((a) => hydrateActivity(a, tagsById));
}

export function createActivity({ title, description = '', duration_seconds = 0, tag_ids = [] }) {
  const activities = getActivities();
  const tagIds = new Set(getTags().map((t) => t.id));
  const missing = tag_ids.filter((id) => !tagIds.has(id));
  if (missing.length) throw new Error(`400: unknown tag ids: ${missing.join(',')}`);
  const act = {
    id: nextId(),
    title,
    description,
    duration_seconds,
    tag_ids: [...tag_ids],
    is_seed: false,
  };
  activities.push(act);
  write(KEYS.activities, activities);
  const tagsById = new Map(getTags().map((t) => [t.id, t]));
  return hydrateActivity(act, tagsById);
}

export function updateActivity(id, patch) {
  const activities = getActivities();
  const act = activities.find((a) => a.id === id);
  if (!act) throw new Error('404: activity not found');
  if (patch.title !== undefined) act.title = patch.title;
  if (patch.description !== undefined) act.description = patch.description;
  if (patch.duration_seconds !== undefined) act.duration_seconds = patch.duration_seconds;
  if (patch.tag_ids !== undefined) {
    const tagIds = new Set(getTags().map((t) => t.id));
    const missing = patch.tag_ids.filter((tid) => !tagIds.has(tid));
    if (missing.length) throw new Error(`400: unknown tag ids: ${missing.join(',')}`);
    act.tag_ids = [...patch.tag_ids];
  }
  write(KEYS.activities, activities);
  const tagsById = new Map(getTags().map((t) => [t.id, t]));
  return hydrateActivity(act, tagsById);
}

export function deleteActivity(id) {
  write(KEYS.activities, getActivities().filter((a) => a.id !== id));
  write(
    KEYS.timers,
    getTimers().map((t) => ({
      ...t,
      activity_ids: (t.activity_ids || []).filter((aid) => aid !== id),
    }))
  );
  return null;
}

export function listTimers() {
  const tagsById = new Map(getTags().map((t) => [t.id, t]));
  const activitiesById = new Map(getActivities().map((a) => [a.id, a]));
  return getTimers().map((t) => hydrateTimer(t, activitiesById, tagsById));
}

export function createTimer({ title, description = '', activity_ids = [] }) {
  const timers = getTimers();
  const timer = {
    id: nextId(),
    title,
    description,
    activity_ids: [...activity_ids],
    is_seed: false,
  };
  timers.push(timer);
  write(KEYS.timers, timers);
  const tagsById = new Map(getTags().map((t) => [t.id, t]));
  const activitiesById = new Map(getActivities().map((a) => [a.id, a]));
  return hydrateTimer(timer, activitiesById, tagsById);
}

export function updateTimer(id, patch) {
  const timers = getTimers();
  const timer = timers.find((t) => t.id === id);
  if (!timer) throw new Error('404: timer not found');
  if (patch.title !== undefined) timer.title = patch.title;
  if (patch.description !== undefined) timer.description = patch.description;
  if (patch.activity_ids !== undefined) timer.activity_ids = [...patch.activity_ids];
  write(KEYS.timers, timers);
  const tagsById = new Map(getTags().map((t) => [t.id, t]));
  const activitiesById = new Map(getActivities().map((a) => [a.id, a]));
  return hydrateTimer(timer, activitiesById, tagsById);
}

export function deleteTimer(id) {
  write(KEYS.timers, getTimers().filter((t) => t.id !== id));
  return null;
}

export function getSettings() {
  return { ...SETTINGS_DEFAULTS, ...(read(KEYS.settings, {}) || {}) };
}

export function updateSettings(patch) {
  const prev = getSettings();
  const next = { ...prev, ...patch };
  write(KEYS.settings, next);
  if (patch.dummy_data !== undefined && patch.dummy_data !== prev.dummy_data) {
    if (patch.dummy_data) seedDummyData();
    else clearDummyData();
  }
  return next;
}

const SEED_TAGS = [
  { name: 'cardio', color: '#ef4444' },
  { name: 'strength', color: '#3b82f6' },
  { name: 'stretch', color: '#22c55e' },
];

const SEED_ACTIVITIES = [
  { title: 'Jumping jacks', description: 'Warm-up', duration_seconds: 30, tag_names: ['cardio'] },
  { title: 'Pushups', description: '20 reps', duration_seconds: 60, tag_names: ['strength'] },
  { title: 'Hamstring stretch', description: 'Hold per side', duration_seconds: 45, tag_names: ['stretch'] },
];

const SEED_TIMERS = [
  {
    title: 'Quick warm-up',
    description: '3 short activities',
    activity_titles: ['Jumping jacks', 'Pushups', 'Hamstring stretch'],
  },
];

function seedDummyData() {
  const tags = getTags();
  const tagByName = new Map(tags.map((t) => [t.name, t]));
  for (const spec of SEED_TAGS) {
    if (tagByName.has(spec.name)) continue;
    const tag = { id: nextId(), name: spec.name, color: spec.color, is_seed: true };
    tags.push(tag);
    tagByName.set(tag.name, tag);
  }
  write(KEYS.tags, tags);

  const activities = getActivities();
  const actByTitle = new Map(activities.map((a) => [a.title, a]));
  for (const spec of SEED_ACTIVITIES) {
    if (actByTitle.has(spec.title)) continue;
    const act = {
      id: nextId(),
      title: spec.title,
      description: spec.description,
      duration_seconds: spec.duration_seconds,
      tag_ids: spec.tag_names.map((n) => tagByName.get(n)?.id).filter((v) => v != null),
      is_seed: true,
    };
    activities.push(act);
    actByTitle.set(act.title, act);
  }
  write(KEYS.activities, activities);

  const timers = getTimers();
  const timerByTitle = new Map(timers.map((t) => [t.title, t]));
  for (const spec of SEED_TIMERS) {
    if (timerByTitle.has(spec.title)) continue;
    timers.push({
      id: nextId(),
      title: spec.title,
      description: spec.description,
      activity_ids: spec.activity_titles.map((t) => actByTitle.get(t)?.id).filter((v) => v != null),
      is_seed: true,
    });
  }
  write(KEYS.timers, timers);
}

function clearDummyData() {
  const seededTagIds = new Set(getTags().filter((t) => t.is_seed).map((t) => t.id));
  const seededActIds = new Set(getActivities().filter((a) => a.is_seed).map((a) => a.id));

  const timers = getTimers()
    .filter((t) => !t.is_seed)
    .map((t) => ({
      ...t,
      activity_ids: (t.activity_ids || []).filter((id) => !seededActIds.has(id)),
    }));
  write(KEYS.timers, timers);

  const activities = getActivities()
    .filter((a) => !a.is_seed)
    .map((a) => ({
      ...a,
      tag_ids: (a.tag_ids || []).filter((id) => !seededTagIds.has(id)),
    }));
  write(KEYS.activities, activities);

  write(KEYS.tags, getTags().filter((t) => !t.is_seed));
}
