import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const STORAGE_KEY = 'next-time.settings';

const DEFAULTS = {
  dark_mode: false,
  reverse_countdown: true,
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

function readCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return null;
  }
}

function writeCache(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => readCache() || DEFAULTS);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then((server) => {
        setSettings(server);
        writeCache(server);
      })
      .catch(() => {})
      .finally(() => setSynced(true));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.dark_mode ? 'dark' : 'light');
  }, [settings.dark_mode]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.accent_color) {
      root.style.setProperty('--accent', settings.accent_color);
    } else {
      root.style.removeProperty('--accent');
    }
  }, [settings.accent_color]);

  const update = useCallback(async (patch) => {
    const optimistic = { ...settings, ...patch };
    setSettings(optimistic);
    writeCache(optimistic);
    try {
      const server = await api.updateSettings(patch);
      setSettings(server);
      writeCache(server);
      return server;
    } catch (err) {
      setSettings(settings);
      writeCache(settings);
      throw err;
    }
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, synced, update }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
