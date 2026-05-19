import * as local from './localStore.js';

const SETTINGS_KEY = 'next-time.settings';

export function isStaticMode() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    return parsed?.static_mode !== false;
  } catch {
    return true;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  listTags: async () => (isStaticMode() ? local.listTags() : request('/tags')),
  createTag: async (data) =>
    isStaticMode() ? local.createTag(data) : request('/tags', { method: 'POST', body: JSON.stringify(data) }),
  updateTag: async (id, data) =>
    isStaticMode()
      ? local.updateTag(id, data)
      : request(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTag: async (id) =>
    isStaticMode() ? local.deleteTag(id) : request(`/tags/${id}`, { method: 'DELETE' }),

  listActivities: async ({ include_inline = false } = {}) =>
    isStaticMode()
      ? local.listActivities({ include_inline })
      : request(`/activities${include_inline ? '?include_inline=true' : ''}`),
  createActivity: async (data) =>
    isStaticMode()
      ? local.createActivity(data)
      : request('/activities', { method: 'POST', body: JSON.stringify(data) }),
  updateActivity: async (id, data) =>
    isStaticMode()
      ? local.updateActivity(id, data)
      : request(`/activities/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteActivity: async (id) =>
    isStaticMode() ? local.deleteActivity(id) : request(`/activities/${id}`, { method: 'DELETE' }),

  listTimers: async () => (isStaticMode() ? local.listTimers() : request('/timers')),
  createTimer: async (data) =>
    isStaticMode()
      ? local.createTimer(data)
      : request('/timers', { method: 'POST', body: JSON.stringify(data) }),
  updateTimer: async (id, data) =>
    isStaticMode()
      ? local.updateTimer(id, data)
      : request(`/timers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTimer: async (id) =>
    isStaticMode() ? local.deleteTimer(id) : request(`/timers/${id}`, { method: 'DELETE' }),

  getSettings: async () => (isStaticMode() ? local.getSettings() : request('/settings')),
  updateSettings: async (data) =>
    isStaticMode()
      ? local.updateSettings(data)
      : request('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
};

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
