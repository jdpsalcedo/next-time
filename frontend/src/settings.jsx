import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const STORAGE_KEY = 'next-time.settings';

const DEFAULTS = {
  dark_mode: true,
  reverse_countdown: false,
  dummy_data: false,
  static_mode: false,
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
