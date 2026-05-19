const KEYS = {
  tags: 'next-time.tags',
  activities: 'next-time.activities',
  timers: 'next-time.timers',
  settings: 'next-time.settings',
  seq: 'next-time.seq',
};

const SETTINGS_DEFAULTS = {
  dark_mode: false,
  reverse_countdown: true,
  dummy_data: false,
  static_mode: true,
};

export const STATIC_LIMITS = {
  tags: 20,
  activities: 50,
  timers: 20,
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
    liked: !!act.liked,
    is_inline: !!act.is_inline,
    tags: (act.tag_ids || []).map((tid) => tagsById.get(tid)).filter(Boolean),
  };
}

function normalizeTimerItems(timer) {
  if (Array.isArray(timer.items)) return timer.items;
  const overrides = timer.duration_overrides || {};
  return (timer.activity_ids || []).map((aid) => ({
    id: nextId(),
    activity_id: aid,
    duration_override: typeof overrides[aid] === 'number' ? overrides[aid] : null,
  }));
}

function hydrateTimer(timer, activitiesById, tagsById) {
  const items = normalizeTimerItems(timer);
  const activities = items
    .map((item) => {
      if (item.activity_id != null) {
        const a = activitiesById.get(item.activity_id);
        if (!a) return null;
        const hydrated = hydrateActivity(a, tagsById);
        const override = item.duration_override;
        return {
          id: item.id,
          type: 'ref',
          activity_id: a.id,
          title: hydrated.title,
          description: hydrated.description,
          duration_seconds:
            typeof override === 'number' ? override : hydrated.duration_seconds,
          liked: hydrated.liked,
          tags: hydrated.tags,
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

function publicTag(t) {
  return { id: t.id, name: t.name, color: t.color };
}

export function listTags() {
  return getTags().map(publicTag);
}

export function createTag({ name, color }) {
  const tags = getTags();
  if (tags.length >= STATIC_LIMITS.tags) {
    throw new Error(`Static mode allows up to ${STATIC_LIMITS.tags} tags. Delete some to add more.`);
  }
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

export function listActivities({ include_inline = false } = {}) {
  const tagsById = new Map(getTags().map((t) => [t.id, t]));
  return [...getActivities()]
    .filter((a) => include_inline || !a.is_inline)
    .sort((a, b) => b.id - a.id)
    .map((a) => hydrateActivity(a, tagsById));
}

export function createActivity({
  title,
  description = '',
  duration_seconds = 0,
  tag_ids = [],
  liked = false,
  is_inline = false,
}) {
  const activities = getActivities();
  if (activities.length >= STATIC_LIMITS.activities) {
    throw new Error(`Static mode allows up to ${STATIC_LIMITS.activities} activities. Delete some to add more.`);
  }
  const tagIds = new Set(getTags().map((t) => t.id));
  const missing = tag_ids.filter((id) => !tagIds.has(id));
  if (missing.length) throw new Error(`400: unknown tag ids: ${missing.join(',')}`);
  const act = {
    id: nextId(),
    title,
    description,
    duration_seconds,
    tag_ids: [...tag_ids],
    liked: !!liked,
    is_inline: !!is_inline,
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
  if (patch.liked !== undefined) act.liked = !!patch.liked;
  if (patch.is_inline !== undefined) act.is_inline = !!patch.is_inline;
  write(KEYS.activities, activities);
  const tagsById = new Map(getTags().map((t) => [t.id, t]));
  return hydrateActivity(act, tagsById);
}

export function deleteActivity(id) {
  write(KEYS.activities, getActivities().filter((a) => a.id !== id));
  write(
    KEYS.timers,
    getTimers().map((t) => {
      const items = normalizeTimerItems(t).filter(
        (it) => it.activity_id !== id
      );
      const next = { ...t, items };
      delete next.activity_ids;
      delete next.duration_overrides;
      return next;
    })
  );
  return null;
}

export function listTimers() {
  const tagsById = new Map(getTags().map((t) => [t.id, t]));
  const activitiesById = new Map(getActivities().map((a) => [a.id, a]));
  return getTimers().map((t) => hydrateTimer(t, activitiesById, tagsById));
}

function payloadToItems(payload) {
  if (!Array.isArray(payload?.activities)) {
    if (Array.isArray(payload?.activity_ids)) {
      return payload.activity_ids.map((aid) => ({
        id: nextId(),
        activity_id: aid,
        duration_override: null,
      }));
    }
    return [];
  }
  return payload.activities.map((it) => {
    if (it.activity_id != null) {
      return {
        id: nextId(),
        activity_id: it.activity_id,
        duration_override:
          typeof it.duration_seconds === 'number' ? it.duration_seconds : null,
      };
    }
    return {
      id: nextId(),
      inline_title: it.inline_title || '',
      inline_description: it.inline_description || '',
      inline_duration_seconds:
        typeof it.duration_seconds === 'number' ? it.duration_seconds : 0,
    };
  });
}

export function createTimer(payload = {}) {
  const { title = '', description = '' } = payload;
  const timers = getTimers();
  if (timers.length >= STATIC_LIMITS.timers) {
    throw new Error(`Static mode allows up to ${STATIC_LIMITS.timers} timers. Delete some to add more.`);
  }
  const timer = {
    id: nextId(),
    title,
    description,
    items: payloadToItems(payload),
    is_seed: false,
  };
  timers.push(timer);
  write(KEYS.timers, timers);
  const tagsById = new Map(getTags().map((t) => [t.id, t]));
  const activitiesById = new Map(getActivities().map((a) => [a.id, a]));
  return hydrateTimer(timer, activitiesById, tagsById);
}

export function updateTimer(id, patch = {}) {
  const timers = getTimers();
  const timer = timers.find((t) => t.id === id);
  if (!timer) throw new Error('404: timer not found');
  if (patch.title !== undefined) timer.title = patch.title;
  if (patch.description !== undefined) timer.description = patch.description;
  if (patch.activities !== undefined || patch.activity_ids !== undefined) {
    timer.items = payloadToItems(patch);
    delete timer.activity_ids;
    delete timer.duration_overrides;
  }
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
  const next = { ...getSettings(), ...patch };
  write(KEYS.settings, next);
  if (patch.dummy_data !== undefined) {
    if (patch.dummy_data) seedDummyData();
    else clearDummyData();
  }
  return next;
}

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
  {
    title: 'Sports HIIT round',
    description: 'Three-move blast',
    activity_titles: ['Sprint interval', 'Box jumps', 'Burpee set'],
  },
  {
    title: 'Lagree mini set',
    description: 'Slow strength flow',
    activity_titles: ['Bear plank', 'Wheelbarrow', 'Mega donkey'],
  },
  {
    title: 'Steak dinner timing',
    description: 'Onions to plate',
    activity_titles: ['Caramelize onions', 'Boil pasta', 'Rest the steak'],
  },
  {
    title: 'Pomodoro cycle',
    description: 'Focus then breathe',
    activity_titles: ['Focus block', 'Short break', 'Focus block', 'Long break'],
  },
  {
    title: 'Easy run',
    description: 'Warm up, push, recover',
    activity_titles: ['Easy warmup jog', 'Tempo interval', 'Recovery walk'],
  },
];

function seedDummyData() {
  const tags = getTags();
  const tagByName = new Map(tags.map((t) => [t.name, t]));
  for (const spec of SEED_TAGS) {
    if (tagByName.has(spec.name)) continue;
    if (tags.length >= STATIC_LIMITS.tags) break;
    const tag = { id: nextId(), name: spec.name, color: spec.color, is_seed: true };
    tags.push(tag);
    tagByName.set(tag.name, tag);
  }
  write(KEYS.tags, tags);

  const activities = getActivities();
  const actByTitle = new Map(activities.map((a) => [a.title, a]));
  for (const spec of SEED_ACTIVITIES) {
    if (actByTitle.has(spec.title)) continue;
    if (activities.length >= STATIC_LIMITS.activities) break;
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
    if (timers.length >= STATIC_LIMITS.timers) break;
    timers.push({
      id: nextId(),
      title: spec.title,
      description: spec.description,
      items: spec.activity_titles
        .map((t) => actByTitle.get(t)?.id)
        .filter((v) => v != null)
        .map((aid) => ({ id: nextId(), activity_id: aid, duration_override: null })),
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
    .map((t) => {
      const items = normalizeTimerItems(t).filter(
        (it) => it.activity_id == null || !seededActIds.has(it.activity_id)
      );
      const next = { ...t, items };
      delete next.activity_ids;
      delete next.duration_overrides;
      return next;
    });
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
