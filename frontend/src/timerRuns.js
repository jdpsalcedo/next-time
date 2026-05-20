import { useEffect, useMemo, useState } from 'react';
import {
  subscribeTimerRuns,
  subscribeTimerTitles,
  setTimerRun,
  deleteTimerRun,
} from './firebaseStore.js';

export function useTimerRuns() {
  const [runs, setRuns] = useState({});
  useEffect(() => {
    const unsub = subscribeTimerRuns((r) => setRuns(r));
    return unsub;
  }, []);
  return runs;
}

export function useActiveTimers() {
  const runs = useTimerRuns();
  const [titles, setTitles] = useState(() => new Map());
  useEffect(() => {
    const unsub = subscribeTimerTitles((m) => setTitles(m));
    return unsub;
  }, []);
  return useMemo(() => {
    const active = [];
    for (const [id, run] of Object.entries(runs)) {
      if (run.isPlaying) {
        active.push({ id, title: titles.get(id) || 'Timer' });
      }
    }
    return active;
  }, [runs, titles]);
}

export function deriveRun(timer, run, nowMs = Date.now()) {
  const splits = timer.activities;
  const total = splits.reduce((s, a) => s + a.duration_seconds, 0);
  if (splits.length === 0) {
    return { state: 'idle', index: 0, splitElapsed: 0, totalElapsed: 0, totalRemaining: 0, total };
  }
  if (!run) {
    return { state: 'idle', index: 0, splitElapsed: 0, totalElapsed: 0, totalRemaining: total, total };
  }
  const totalElapsed = run.isPlaying
    ? Math.max(0, (nowMs - (run.anchorAt ?? nowMs)) / 1000)
    : Math.max(0, run.pausedTotalElapsedSec || 0);
  let index = 0;
  let remaining = totalElapsed;
  for (; index < splits.length - 1; index++) {
    const dur = splits[index].duration_seconds;
    if (remaining < dur) break;
    remaining -= dur;
  }
  const totalRemaining = total - totalElapsed;
  let state;
  if (totalRemaining < 0) state = 'overtime';
  else if (run.isPlaying) state = 'running';
  else state = 'paused';
  return { state, index, splitElapsed: remaining, totalElapsed, totalRemaining, total };
}

function totalOf(timer) {
  return timer.activities.reduce((s, a) => s + a.duration_seconds, 0);
}

export function playTimer(timerId, run) {
  const paused = run?.pausedTotalElapsedSec || 0;
  return setTimerRun(timerId, {
    isPlaying: true,
    anchorAt: Date.now() - paused * 1000,
    pausedTotalElapsedSec: 0,
  });
}

export function pauseTimer(timerId, run) {
  const nowMs = Date.now();
  const elapsed = run?.isPlaying
    ? Math.max(0, (nowMs - (run.anchorAt ?? nowMs)) / 1000)
    : run?.pausedTotalElapsedSec || 0;
  return setTimerRun(timerId, {
    isPlaying: false,
    anchorAt: null,
    pausedTotalElapsedSec: elapsed,
  });
}

export function togglePlayTimer(timer, run) {
  if (timer.activities.length === 0) return Promise.resolve();
  if (run?.isPlaying) return pauseTimer(timer.id, run);
  return playTimer(timer.id, run);
}

export function resetTimerRun(timerId) {
  return deleteTimerRun(timerId);
}

export function seekTimerTotal(timer, run, totalElapsedSec) {
  const clamped = Math.max(0, Math.min(totalOf(timer), totalElapsedSec));
  if (run?.isPlaying) {
    return setTimerRun(timer.id, {
      isPlaying: true,
      anchorAt: Date.now() - clamped * 1000,
      pausedTotalElapsedSec: 0,
    });
  }
  return setTimerRun(timer.id, {
    isPlaying: false,
    anchorAt: null,
    pausedTotalElapsedSec: clamped,
  });
}

export function prevSplitTimer(timer, run) {
  const d = deriveRun(timer, run);
  let targetIndex;
  if (d.splitElapsed > 1.2 || d.index === 0) targetIndex = d.index;
  else targetIndex = d.index - 1;
  let cum = 0;
  for (let i = 0; i < targetIndex; i++) cum += timer.activities[i].duration_seconds;
  return seekTimerTotal(timer, run, cum);
}

export function nextSplitTimer(timer, run) {
  const d = deriveRun(timer, run);
  const last = timer.activities.length - 1;
  if (d.index >= last) return seekTimerTotal(timer, run, totalOf(timer));
  let cum = 0;
  for (let i = 0; i < d.index + 1; i++) cum += timer.activities[i].duration_seconds;
  return seekTimerTotal(timer, run, cum);
}
