import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  subscribeTags,
  subscribeActivities,
  subscribeTimers,
  hydrateActivity,
  hydrateTimer,
  publicTag,
} from './firebaseStore.js';
import { useAuth } from './auth.jsx';

const DataCtx = createContext(null);

// Sync status:
//   'loading'  — first snapshot for at least one collection not yet received
//   'offline'  — latest snapshot served from cache (server unreachable)
//   'syncing'  — connected, but a local write hasn't acked yet
//   'synced'   — connected, no pending writes
function deriveStatus(initialized, meta) {
  if (!initialized) return 'loading';
  if (meta.fromCache) return 'offline';
  if (meta.hasPendingWrites) return 'syncing';
  return 'synced';
}

export function DataProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const [rawTags, setRawTags] = useState([]);
  const [rawActivities, setRawActivities] = useState([]);
  const [rawTimers, setRawTimers] = useState([]);
  const [meta, setMeta] = useState({
    tags: { fromCache: true, hasPendingWrites: false, ready: false },
    activities: { fromCache: true, hasPendingWrites: false, ready: false },
    timers: { fromCache: true, hasPendingWrites: false, ready: false },
  });

  useEffect(() => {
    if (!uid) {
      setRawTags([]);
      setRawActivities([]);
      setRawTimers([]);
      setMeta({
        tags: { fromCache: true, hasPendingWrites: false, ready: false },
        activities: { fromCache: true, hasPendingWrites: false, ready: false },
        timers: { fromCache: true, hasPendingWrites: false, ready: false },
      });
      return;
    }
    const unsubT = subscribeTags(({ docs, fromCache, hasPendingWrites }) => {
      setRawTags(docs);
      setMeta((m) => ({ ...m, tags: { fromCache, hasPendingWrites, ready: true } }));
    });
    const unsubA = subscribeActivities(({ docs, fromCache, hasPendingWrites }) => {
      setRawActivities(docs);
      setMeta((m) => ({ ...m, activities: { fromCache, hasPendingWrites, ready: true } }));
    });
    const unsubTm = subscribeTimers(({ docs, fromCache, hasPendingWrites }) => {
      setRawTimers(docs);
      setMeta((m) => ({ ...m, timers: { fromCache, hasPendingWrites, ready: true } }));
    });
    return () => { unsubT(); unsubA(); unsubTm(); };
  }, [uid]);

  const tagsById = useMemo(
    () => new Map(rawTags.map((t) => [t.id, t])),
    [rawTags],
  );
  const activitiesById = useMemo(
    () => new Map(rawActivities.map((a) => [a.id, a])),
    [rawActivities],
  );

  const tags = useMemo(
    () =>
      [...rawTags]
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .map(publicTag),
    [rawTags],
  );

  const activities = useMemo(
    () =>
      [...rawActivities]
        .sort((a, b) => {
          const ta = a.created_at?.toMillis?.() ?? 0;
          const tb = b.created_at?.toMillis?.() ?? 0;
          return tb - ta;
        })
        .map((a) => hydrateActivity(a, tagsById)),
    [rawActivities, tagsById],
  );

  const timers = useMemo(
    () =>
      [...rawTimers]
        .sort((a, b) => {
          const ta = a.created_at?.toMillis?.() ?? 0;
          const tb = b.created_at?.toMillis?.() ?? 0;
          return tb - ta;
        })
        .map((t) => hydrateTimer(t, activitiesById, tagsById)),
    [rawTimers, activitiesById, tagsById],
  );

  const initialized = meta.tags.ready && meta.activities.ready && meta.timers.ready;

  const aggregateMeta = {
    fromCache:
      meta.tags.fromCache || meta.activities.fromCache || meta.timers.fromCache,
    hasPendingWrites:
      meta.tags.hasPendingWrites ||
      meta.activities.hasPendingWrites ||
      meta.timers.hasPendingWrites,
  };

  const status = deriveStatus(initialized, aggregateMeta);

  const value = {
    tags,
    activities,
    timers,
    tagsById,
    activitiesById,
    initialized,
    status,
    meta: aggregateMeta,
  };

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export function useData() {
  const v = useContext(DataCtx);
  if (!v) throw new Error('useData requires DataProvider');
  return v;
}
