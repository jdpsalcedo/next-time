import { useEffect, useState } from 'react';
import {
  subscribeTimerEvents,
  createTimerEvent,
  updateTimerEvent,
  deleteTimerEvent,
} from './firebaseStore.js';

export function useTimerEventsForRange({ from, to }) {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    if (!from || !to) {
      setEvents([]);
      return;
    }
    const unsub = subscribeTimerEvents({ from, to }, (e) => setEvents(e));
    return unsub;
  }, [from, to]);
  return events;
}

export { createTimerEvent, updateTimerEvent, deleteTimerEvent };

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function dateString(year, monthOneBased, day) {
  return `${year}-${pad2(monthOneBased)}-${pad2(day)}`;
}

export function todayString() {
  const d = new Date();
  return dateString(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function monthBounds({ year, month }) {
  const from = dateString(year, month, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const to = dateString(year, month, lastDay);
  return { from, to };
}

export function monthGridCells({ year, month, weekStartsOn = 0 }) {
  const first = new Date(year, month - 1, 1);
  const startOffset = (first.getDay() - weekStartsOn + 7) % 7;
  const today = todayString();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month - 1, 1 - startOffset + i);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const ds = dateString(y, m, day);
    cells.push({
      date: ds,
      day,
      inMonth: m === month && y === year,
      isToday: ds === today,
      weekday: d.getDay(),
    });
  }
  return cells;
}

export function shiftMonth({ year, month }, delta) {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export function weekStartFor(dateStr, weekStartsOn = 0) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const local = new Date(y, m - 1, d);
  const delta = (local.getDay() - weekStartsOn + 7) % 7;
  local.setDate(local.getDate() - delta);
  return dateString(local.getFullYear(), local.getMonth() + 1, local.getDate());
}

export function weekBounds(weekStart) {
  const [y, m, d] = weekStart.split('-').map(Number);
  const last = new Date(y, m - 1, d + 6);
  return { from: weekStart, to: dateString(last.getFullYear(), last.getMonth() + 1, last.getDate()) };
}

export function weekGridCells(weekStart) {
  const [y, m, d] = weekStart.split('-').map(Number);
  const today = todayString();
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const local = new Date(y, m - 1, d + i);
    const ds = dateString(local.getFullYear(), local.getMonth() + 1, local.getDate());
    cells.push({
      date: ds,
      day: local.getDate(),
      inMonth: true,
      isToday: ds === today,
      weekday: local.getDay(),
    });
  }
  return cells;
}

export function shiftWeek(weekStart, days) {
  return addDays(weekStart, days);
}

export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const local = new Date(y, m - 1, d + days);
  return dateString(local.getFullYear(), local.getMonth() + 1, local.getDate());
}

export function formatRelativeDay(dateStr) {
  const today = todayString();
  if (dateStr === today) return 'Today';
  if (dateStr === addDays(today, 1)) return 'Tomorrow';
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const deltaDays = Math.round((target - t) / 86_400_000);
  if (deltaDays > 1 && deltaDays < 7) {
    return target.toLocaleDateString(undefined, { weekday: 'long' });
  }
  return target.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatWeekLabel(weekStart) {
  const [y, m, d] = weekStart.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 6);
  const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short' });
  const startMonth = monthFmt.format(start);
  const endMonth = monthFmt.format(end);
  const startDay = start.getDate();
  const endDay = end.getDate();
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameMonth) return `${startMonth} ${startDay} – ${endDay}`;
  if (sameYear) return `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
  return `${startMonth} ${startDay}, ${start.getFullYear()} – ${endMonth} ${endDay}, ${end.getFullYear()}`;
}

export function parseMonthParam(s) {
  if (typeof s !== 'string') return null;
  const match = s.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function formatMonthParam({ year, month }) {
  return `${year}-${pad2(month)}`;
}

export function formatMonthLabel({ year, month }) {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function formatDayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const local = new Date(y, m - 1, d);
  return local.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatScheduledAt(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
