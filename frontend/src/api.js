import * as store from './firebaseStore.js';

export const api = {
  createTag: (data) => store.createTag(data),
  updateTag: (id, data) => store.updateTag(id, data),
  deleteTag: (id) => store.deleteTag(id),

  createActivity: (data) => store.createActivity(data),
  updateActivity: (id, data) => store.updateActivity(id, data),
  deleteActivity: (id) => store.deleteActivity(id),

  createTimer: (data) => store.createTimer(data),
  updateTimer: (id, data) => store.updateTimer(id, data),
  deleteTimer: (id) => store.deleteTimer(id),

  getSettings: () => store.getSettings(),
  updateSettings: (data) => store.updateSettings(data),
};

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
