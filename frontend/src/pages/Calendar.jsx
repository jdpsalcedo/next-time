import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MdChevronLeft, MdChevronRight, MdAdd, MdAccessTime, MdDelete, MdOpenInNew, MdEdit } from 'react-icons/md';
import { useData } from '../data.jsx';
import {
  useTimerEventsForRange,
  createTimerEvent,
  updateTimerEvent,
  deleteTimerEvent,
  monthBounds,
  monthGridCells,
  shiftMonth,
  parseMonthParam,
  formatMonthParam,
  formatMonthLabel,
  formatDayLabel,
  formatScheduledAt,
  todayString,
  weekStartFor,
  weekBounds,
  weekGridCells,
  shiftWeek,
  formatWeekLabel,
} from '../timerEvents.js';
import Modal from '../components/Modal.jsx';
import TagChip from '../components/TagChip.jsx';
import { useToast } from '../toast.jsx';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_VISIBLE_CHIPS_MONTH = 3;

export default function Calendar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const navigate = useNavigate();

  const view = searchParams.get('view') === 'week' ? 'week' : 'month';

  const currentMonth = useMemo(() => {
    const parsed = parseMonthParam(searchParams.get('month'));
    if (parsed) return parsed;
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, [searchParams]);

  const currentWeekStart = useMemo(() => {
    const raw = searchParams.get('weekStart');
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return weekStartFor(raw);
    return weekStartFor(todayString());
  }, [searchParams]);

  const { from, to } = useMemo(
    () => (view === 'week' ? weekBounds(currentWeekStart) : monthBounds(currentMonth)),
    [view, currentWeekStart, currentMonth],
  );
  const events = useTimerEventsForRange({ from, to });

  const { timers } = useData();
  const timersById = useMemo(() => {
    const m = new Map();
    for (const t of timers) m.set(t.id, t);
    return m;
  }, [timers]);

  const eventsByDate = useMemo(() => {
    const m = new Map();
    for (const e of events) {
      if (!m.has(e.date)) m.set(e.date, []);
      m.get(e.date).push(e);
    }
    for (const list of m.values()) {
      list.sort((a, b) => {
        const ta = a.scheduledAt || '99:99';
        const tb = b.scheduledAt || '99:99';
        if (ta !== tb) return ta.localeCompare(tb);
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
    }
    return m;
  }, [events]);

  const cells = useMemo(
    () => (view === 'week' ? weekGridCells(currentWeekStart) : monthGridCells(currentMonth)),
    [view, currentWeekStart, currentMonth],
  );

  function setMonthInUrl(m) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('month', formatMonthParam(m));
      next.delete('weekStart');
      return next;
    });
  }
  function setWeekInUrl(weekStart) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('weekStart', weekStart);
      next.delete('month');
      return next;
    });
  }
  function setView(nextView) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nextView === 'month') {
        next.set('view', 'month');
        const [y, m] = currentWeekStart.split('-').map(Number);
        next.set('month', formatMonthParam({ year: y, month: m }));
        next.delete('weekStart');
      } else {
        next.set('view', 'week');
        const anchor = todayString();
        next.set('weekStart', weekStartFor(anchor));
        next.delete('month');
      }
      return next;
    });
  }
  function goPrev() {
    if (view === 'week') setWeekInUrl(shiftWeek(currentWeekStart, -7));
    else setMonthInUrl(shiftMonth(currentMonth, -1));
  }
  function goNext() {
    if (view === 'week') setWeekInUrl(shiftWeek(currentWeekStart, +7));
    else setMonthInUrl(shiftMonth(currentMonth, +1));
  }
  function goToday() {
    const t = todayString();
    if (view === 'week') setWeekInUrl(weekStartFor(t));
    else {
      const d = new Date();
      setMonthInUrl({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
  }

  const [activeDate, setActiveDate] = useState(null);
  const activeEvents = activeDate ? eventsByDate.get(activeDate) || [] : [];

  const headerLabel = useMemo(
    () => (view === 'week' ? formatWeekLabel(currentWeekStart) : formatMonthLabel(currentMonth)),
    [view, currentMonth, currentWeekStart],
  );
  const today = todayString();

  async function addEventForDate(date, payload) {
    try {
      await createTimerEvent({ ...payload, date });
      toast.success('Added to calendar');
    } catch (e) {
      toast.error(e.message);
    }
  }
  async function editEvent(id, patch) {
    try {
      await updateTimerEvent(id, patch);
    } catch (e) {
      toast.error(e.message);
    }
  }
  async function removeEvent(id) {
    try {
      await deleteTimerEvent(id);
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div>
      <div className="section-header cal-section-header">
        <h1>{headerLabel}</h1>
        <div className="cal-controls">
          <div className="cal-view-toggle" role="group" aria-label="Calendar view">
            <button
              type="button"
              className={`cal-view-btn ${view === 'month' ? 'active' : ''}`}
              onClick={() => setView('month')}
              aria-pressed={view === 'month'}
            >
              Month
            </button>
            <button
              type="button"
              className={`cal-view-btn ${view === 'week' ? 'active' : ''}`}
              onClick={() => setView('week')}
              aria-pressed={view === 'week'}
            >
              Week
            </button>
          </div>
          <button
            className="icon-btn"
            onClick={goPrev}
            aria-label={view === 'week' ? 'Previous week' : 'Previous month'}
          >
            <MdChevronLeft />
          </button>
          <button
            className="btn btn-ghost btn-sm cal-today-btn"
            onClick={goToday}
            title="Jump to today"
          >
            Today
          </button>
          <button
            className="icon-btn"
            onClick={goNext}
            aria-label={view === 'week' ? 'Next week' : 'Next month'}
          >
            <MdChevronRight />
          </button>
        </div>
      </div>

      <div className="cal-weekdays" aria-hidden>
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="cal-weekday">{w}</div>
        ))}
      </div>

      <div className={`cal-grid ${view === 'week' ? 'cal-grid-week' : ''}`}>
        {cells.map((c) => {
          const dayEvents = eventsByDate.get(c.date) || [];
          const cap = view === 'week' ? dayEvents.length : MAX_VISIBLE_CHIPS_MONTH;
          const visible = dayEvents.slice(0, cap);
          const hidden = dayEvents.length - visible.length;
          return (
            <button
              type="button"
              key={c.date}
              className={`cal-cell ${c.inMonth ? '' : 'cal-out'} ${c.isToday ? 'cal-today' : ''} ${dayEvents.length ? 'cal-has-events' : ''}`}
              onClick={() => setActiveDate(c.date)}
              aria-label={`${c.date}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}` : ''}`}
            >
              <div className="cal-cell-day">{c.day}</div>
              <div className="cal-cell-events">
                {visible.map((e) => {
                  const timer = timersById.get(e.timerId);
                  const color = timer?.activities?.[0]?.tags?.[0]?.color || 'var(--muted)';
                  return (
                    <div key={e.id} className="cal-chip" style={{ background: color }}>
                      <span className="cal-chip-label">{timer?.title || 'Timer'}</span>
                    </div>
                  );
                })}
                {hidden > 0 && (
                  <div className="cal-chip cal-chip-more">+{hidden}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {activeDate && (
        <DayDetailModal
          date={activeDate}
          events={activeEvents}
          timers={timers}
          timersById={timersById}
          onClose={() => setActiveDate(null)}
          onAdd={(payload) => addEventForDate(activeDate, payload)}
          onEdit={editEvent}
          onDelete={removeEvent}
          onOpenTimer={(timerId) => {
            setActiveDate(null);
            navigate(`/timers?focus=${encodeURIComponent(timerId)}`);
          }}
          isToday={activeDate === today}
        />
      )}
    </div>
  );
}

function DayDetailModal({
  date,
  events,
  timers,
  timersById,
  onClose,
  onAdd,
  onEdit,
  onDelete,
  onOpenTimer,
  isToday,
}) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const filteredTimers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...timers].sort((a, b) => a.title.localeCompare(b.title));
    if (!q) return sorted;
    return sorted.filter((t) => {
      if (t.title.toLowerCase().includes(q)) return true;
      if ((t.description || '').toLowerCase().includes(q)) return true;
      return t.activities.some((a) => {
        if ((a.title || '').toLowerCase().includes(q)) return true;
        return (a.tags || []).some((tg) => tg.name.toLowerCase().includes(q));
      });
    });
  }, [timers, search]);

  function startEdit(e) {
    setEditingId(e.id);
    setEditDraft({ scheduledAt: e.scheduledAt || '', notes: e.notes || '' });
  }
  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }
  async function saveEdit(id) {
    await onEdit(id, { scheduledAt: editDraft.scheduledAt, notes: editDraft.notes });
    cancelEdit();
  }

  function pickTimer(timerId) {
    onAdd({ timerId, scheduledAt: null, notes: '' });
  }

  return (
    <Modal title={formatDayLabel(date)} onClose={onClose}>
      {isToday && <div className="modal-subtitle">Today</div>}

      {events.length > 0 && (
        <div className="list" style={{ marginBottom: 16 }}>
          {events.map((e) => {
            const timer = timersById.get(e.timerId);
            const tags = timer?.activities?.[0]?.tags || [];
            const color = tags[0]?.color || 'var(--muted)';
            const editing = editingId === e.id;
            return (
              <div key={e.id} className="card cal-event-row" style={{ borderLeft: `3px solid ${color}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{timer?.title || 'Timer (deleted)'}</div>
                    {!editing && e.scheduledAt && (
                      <div className="muted" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <MdAccessTime aria-hidden />
                        {formatScheduledAt(e.scheduledAt)}
                      </div>
                    )}
                    {!editing && e.notes && (
                      <div className="muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>{e.notes}</div>
                    )}
                    {editing && (
                      <div className="form" style={{ marginTop: 8 }}>
                        <div>
                          <label className="label">Time (optional)</label>
                          <input
                            className="input"
                            type="time"
                            value={editDraft.scheduledAt}
                            onChange={(ev) => setEditDraft({ ...editDraft, scheduledAt: ev.target.value })}
                          />
                        </div>
                        <div>
                          <label className="label">Notes</label>
                          <input
                            className="input"
                            value={editDraft.notes}
                            onChange={(ev) => setEditDraft({ ...editDraft, notes: ev.target.value })}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={cancelEdit}>Cancel</button>
                          <button type="button" className="btn btn-sm" onClick={() => saveEdit(e.id)}>Save</button>
                        </div>
                      </div>
                    )}
                  </div>
                  {!editing && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      {timer && (
                        <button
                          type="button"
                          className="icon-btn btn-sm"
                          onClick={() => onOpenTimer(timer.id)}
                          aria-label="Open timer"
                          title="Open in Timers"
                        >
                          <MdOpenInNew />
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-btn btn-sm"
                        onClick={() => startEdit(e)}
                        aria-label="Edit"
                        title="Edit"
                      >
                        <MdEdit />
                      </button>
                      <button
                        type="button"
                        className="icon-btn btn-sm"
                        onClick={() => onDelete(e.id)}
                        aria-label="Delete"
                        title="Delete"
                      >
                        <MdDelete />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="modal-subtitle" style={{ marginTop: 0 }}>
        {events.length === 0 ? 'Add a timer to this day' : 'Add another'}
      </div>
      <input
        type="search"
        className="input"
        placeholder="Search timers by name or tag…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="activity-list activity-picker-list" style={{ marginTop: 10 }}>
        {filteredTimers.length === 0 ? (
          <div className="muted" style={{ padding: 12, textAlign: 'center' }}>
            {timers.length === 0 ? 'No timers yet.' : 'No matching timers.'}
          </div>
        ) : (
          filteredTimers.map((t) => {
            const firstTags = t.activities?.[0]?.tags || [];
            return (
              <button
                key={t.id}
                type="button"
                className="activity-pick"
                onClick={() => pickTimer(t.id)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{t.title}</div>
                  {firstTags.length > 0 && (
                    <div className="tag-row wrap" style={{ marginTop: 4, marginBottom: 0 }}>
                      {firstTags.map((tg) => <TagChip key={tg.id} tag={tg} />)}
                    </div>
                  )}
                </div>
                <MdAdd aria-hidden />
              </button>
            );
          })
        )}
      </div>
    </Modal>
  );
}
