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
  listTags: () => request('/tags'),
  createTag: (data) => request('/tags', { method: 'POST', body: JSON.stringify(data) }),
  updateTag: (id, data) => request(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTag: (id) => request(`/tags/${id}`, { method: 'DELETE' }),

  listActivities: () => request('/activities'),
  createActivity: (data) => request('/activities', { method: 'POST', body: JSON.stringify(data) }),
  updateActivity: (id, data) =>
    request(`/activities/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteActivity: (id) => request(`/activities/${id}`, { method: 'DELETE' }),

  listTimers: () => request('/timers'),
  createTimer: (data) => request('/timers', { method: 'POST', body: JSON.stringify(data) }),
  updateTimer: (id, data) =>
    request(`/timers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTimer: (id) => request(`/timers/${id}`, { method: 'DELETE' }),

  getSettings: () => request('/settings'),
  updateSettings: (data) => request('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
};

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
