const STORAGE_KEY = 'next-time.recent-tag-colors';
const MAX_RECENTS = 3;

export function getRecentTagColors() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

export function recordRecentTagColor(color) {
  if (!color || typeof color !== 'string') return;
  const lower = color.toLowerCase();
  try {
    const list = getRecentTagColors();
    const next = [lower, ...list.filter((c) => c.toLowerCase() !== lower)].slice(0, MAX_RECENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}
