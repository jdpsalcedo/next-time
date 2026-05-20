import { useEffect, useMemo, useRef, useState } from 'react';
import { api, formatDuration } from '../api.js';
import { useToast } from '../toast.jsx';
import Modal from '../components/Modal.jsx';
import ContextMenu from '../components/ContextMenu.jsx';
import SortableActivityList from '../components/SortableActivityList.jsx';
import TagChip from '../components/TagChip.jsx';
import TimerDial from '../components/TimerDial.jsx';
import ActivityFormModal from '../components/ActivityFormModal.jsx';
import { useSettings } from '../settings.jsx';
import {
  MdAdd,
  MdPlayArrow,
  MdPause,
  MdRefresh,
  MdCenterFocusStrong,
  MdSkipPrevious,
  MdSkipNext,
} from 'react-icons/md';

function pad(n) {
  return String(n).padStart(2, '0');
}

function totalOf(timer) {
  return timer.activities.reduce((s, a) => s + a.duration_seconds, 0);
}

function formatRich(secs) {
  const negative = secs < 0;
  const abs = Math.abs(secs);
  const totalCs = Math.floor(abs * 100);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const tail = `${pad(m)}:${pad(s)}.${pad(cs)}`;
  return `${negative ? '-' : ''}${h > 0 ? `${pad(h)}:${tail}` : tail}`;
}

function formatHMS(secs) {
  const sec = Math.max(0, Math.floor(secs));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatLongDuration(secs) {
  const total = Math.max(0, Math.floor(secs));
  if (total === 0) return '0 sec';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [];
  if (h > 0) parts.push(`${h} hr`);
  if (m > 0) parts.push(`${m} min`);
  if (s > 0) parts.push(`${s} sec`);
  return parts.join(' ');
}

function captionDuration(secs) {
  if (secs === 0) return '0 min';
  if (secs % 60 === 0) {
    const min = secs / 60;
    if (min >= 60 && min % 60 === 0) return `${min / 60} hr`;
    return `${min} min`;
  }
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${pad(s)}`;
}

function deriveRun(timer, run) {
  const splits = timer.activities;
  const total = totalOf(timer);
  if (splits.length === 0) {
    return { state: 'idle', index: 0, splitElapsed: 0, totalElapsed: 0, totalRemaining: 0, total };
  }
  if (!run) {
    return { state: 'idle', index: 0, splitElapsed: 0, totalElapsed: 0, totalRemaining: total, total };
  }
  const idx = Math.min(run.index, splits.length - 1);
  let cumBefore = 0;
  for (let i = 0; i < idx; i++) cumBefore += splits[i].duration_seconds;
  const totalElapsed = cumBefore + run.splitElapsedSec;
  const totalRemaining = total - totalElapsed;
  let state;
  if (totalRemaining < 0) state = 'overtime';
  else if (run.isPlaying) state = 'running';
  else state = 'paused';
  return { state, index: idx, splitElapsed: run.splitElapsedSec, totalElapsed, totalRemaining, total };
}

export default function Timers() {
  const { settings } = useSettings();
  const reverse = !!settings.reverse_countdown;

  const toast = useToast();
  const [timers, setTimers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [tags, setTags] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [saveAsForm, setSaveAsForm] = useState(null);

  const [runStates, setRunStates] = useState({});
  const [focusedId, setFocusedId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [customForm, setCustomForm] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const timersRef = useRef(timers);
  useEffect(() => { timersRef.current = timers; }, [timers]);

  async function refresh() {
    const [t, a, g] = await Promise.all([api.listTimers(), api.listActivities(), api.listTags()]);
    setTimers(t);
    setActivities(a);
    setTags(g);
  }

  const tmpIdRef = useRef(0);
  function newTmpId() {
    tmpIdRef.current += 1;
    return `tmp-${tmpIdRef.current}`;
  }

  useEffect(() => { refresh().catch((e) => setError(e.message)); }, []);

  useEffect(() => {
    let rafId;
    let last = performance.now();
    function tick(now) {
      const dt = (now - last) / 1000;
      last = now;
      setRunStates((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const id in prev) {
          const s = prev[id];
          if (!s.isPlaying) continue;
          const timer = timersRef.current.find((t) => String(t.id) === id);
          if (!timer || timer.activities.length === 0) continue;
          let index = s.index;
          let elapsed = s.splitElapsedSec + dt;
          const splits = timer.activities;
          while (index < splits.length - 1 && elapsed >= splits[index].duration_seconds) {
            elapsed -= splits[index].duration_seconds;
            index += 1;
          }
          next[id] = { ...s, index, splitElapsedSec: elapsed };
          changed = true;
        }
        return changed ? next : prev;
      });
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  function setRun(timerId, mut) {
    setRunStates((prev) => {
      const cur = prev[timerId] || { index: 0, splitElapsedSec: 0, isPlaying: false };
      const updated = typeof mut === 'function' ? mut(cur) : { ...cur, ...mut };
      return { ...prev, [timerId]: updated };
    });
  }

  function togglePlay(timer) {
    if (timer.activities.length === 0) return;
    setRun(timer.id, (cur) => ({ ...cur, isPlaying: !cur.isPlaying }));
  }

  function resetRun(timerId) {
    setRunStates((prev) => {
      const next = { ...prev };
      delete next[timerId];
      return next;
    });
  }

  function prevSplit(timer) {
    setRun(timer.id, (cur) => {
      if (cur.splitElapsedSec > 1.2 || cur.index === 0) {
        return { ...cur, splitElapsedSec: 0 };
      }
      return { ...cur, index: cur.index - 1, splitElapsedSec: 0 };
    });
  }

  function nextSplit(timer) {
    setRun(timer.id, (cur) => {
      const last = timer.activities.length - 1;
      if (cur.index >= last) return { ...cur, splitElapsedSec: timer.activities[last]?.duration_seconds ?? 0 };
      return { ...cur, index: cur.index + 1, splitElapsedSec: 0 };
    });
  }

  function seekTimer(timer, totalElapsedSec) {
    let remaining = Math.max(0, totalElapsedSec);
    let index = 0;
    for (; index < timer.activities.length - 1; index++) {
      const dur = timer.activities[index].duration_seconds;
      if (remaining < dur) break;
      remaining -= dur;
    }
    setRun(timer.id, (cur) => ({ ...cur, index, splitElapsedSec: remaining }));
  }

  function openCreate() {
    setEditing({
      mode: 'create',
      form: { title: '', description: '', items: [] },
    });
  }

  function openEdit(timer) {
    const items = timer.activities.map((a) => {
      if (a.type === 'inline') {
        return {
          id: newTmpId(),
          type: 'inline',
          inline_title: a.title,
          inline_description: a.description || '',
          duration_seconds: a.duration_seconds,
        };
      }
      return {
        id: newTmpId(),
        type: 'ref',
        activity_id: a.activity_id,
        duration_seconds: a.duration_seconds,
      };
    });
    setEditing({
      mode: 'edit',
      id: timer.id,
      form: { title: timer.title, description: timer.description, items },
    });
  }

  async function saveTimer() {
    setError('');
    const { form } = editing;
    const activitiesById = new Map(activities.map((a) => [a.id, a]));
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      activities: form.items.map((it) => {
        if (it.type === 'ref') {
          const orig = activitiesById.get(it.activity_id);
          const entry = { activity_id: it.activity_id };
          if (
            typeof it.duration_seconds === 'number' &&
            it.duration_seconds !== orig?.duration_seconds
          ) {
            entry.duration_seconds = it.duration_seconds;
          }
          return entry;
        }
        return {
          inline_title: it.inline_title || 'Custom',
          inline_description: it.inline_description || '',
          duration_seconds: it.duration_seconds || 0,
        };
      }),
    };
    if (!payload.title) { setError('Title is required'); return; }
    const wasCreate = editing.mode === 'create';
    try {
      if (wasCreate) await api.createTimer(payload);
      else await api.updateTimer(editing.id, payload);
      setEditing(null);
      await refresh();
      toast.success(wasCreate ? `Created "${payload.title}"` : `Updated "${payload.title}"`);
    } catch (e) {
      setError(e.message);
      toast.error(e.message);
    }
  }

  async function duplicateTimer(id) {
    const src = timers.find((t) => t.id === id);
    if (!src) return;
    const payload = {
      title: `${src.title} (copy)`,
      description: src.description || '',
      activities: src.activities.map((a) => {
        if (a.type === 'inline') {
          return {
            inline_title: a.title,
            inline_description: a.description || '',
            duration_seconds: a.duration_seconds || 0,
          };
        }
        const orig = activities.find((x) => x.id === a.activity_id);
        const entry = { activity_id: a.activity_id };
        if (
          typeof a.duration_seconds === 'number' &&
          a.duration_seconds !== orig?.duration_seconds
        ) {
          entry.duration_seconds = a.duration_seconds;
        }
        return entry;
      }),
    };
    try {
      await api.createTimer(payload);
      await refresh();
      toast.success(`Duplicated "${src.title}"`);
    } catch (e) {
      setError(e.message);
      toast.error(e.message);
    }
  }

  async function removeTimer(id) {
    if (!confirm('Delete this timer? Its activities will not be removed.')) return;
    const removed = timers.find((t) => t.id === id);
    try {
      await api.deleteTimer(id);
      resetRun(id);
      if (focusedId === id) setFocusedId(null);
      await refresh();
      toast.success(removed ? `Deleted "${removed.title}"` : 'Timer deleted');
    } catch (e) {
      setError(e.message);
      toast.error(e.message);
    }
  }

  function removeItem(itemId) {
    setEditing((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        form: {
          ...prev.form,
          items: prev.form.items.filter((it) => it.id !== itemId),
        },
      };
    });
  }

  function setItemDuration(itemId, seconds) {
    setEditing((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        form: {
          ...prev.form,
          items: prev.form.items.map((it) =>
            it.id === itemId ? { ...it, duration_seconds: seconds } : it
          ),
        },
      };
    });
  }

  function appendItem(newItem) {
    setEditing((prev) => {
      if (!prev) return prev;
      return { ...prev, form: { ...prev.form, items: [...prev.form.items, newItem] } };
    });
  }

  function openCustomForm() {
    setCustomForm({ title: '', minutes: 0, seconds: 30 });
  }

  function submitCustomActivity() {
    if (!customForm) return;
    const title = customForm.title.trim();
    if (!title) return;
    const dur = Math.max(0, Number(customForm.minutes) * 60 + Number(customForm.seconds));
    appendItem({
      id: newTmpId(),
      type: 'inline',
      inline_title: title,
      inline_description: '',
      duration_seconds: dur,
    });
    setCustomForm(null);
  }

  function duplicateItem(itemId) {
    setEditing((prev) => {
      if (!prev) return prev;
      const items = prev.form.items;
      const idx = items.findIndex((it) => it.id === itemId);
      if (idx < 0) return prev;
      const copy = { ...items[idx], id: newTmpId() };
      const next = [...items];
      next.splice(idx + 1, 0, copy);
      return { ...prev, form: { ...prev.form, items: next } };
    });
  }

  function saveAsActivity(itemId) {
    const item = editing?.form?.items.find((it) => it.id === itemId);
    if (!item || item.type !== 'inline') return;
    const duration = item.duration_seconds || 0;
    setSaveAsForm({
      itemId,
      initialValues: {
        title: item.inline_title || '',
        description: item.inline_description || '',
        minutes: Math.floor(duration / 60),
        seconds: duration % 60,
        tag_ids: [],
      },
    });
  }

  async function commitSaveAsActivity(payload) {
    const { itemId } = saveAsForm;
    const created = await api.createActivity(payload);
    setActivities((prev) => [created, ...prev]);
    setEditing((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        form: {
          ...prev.form,
          items: prev.form.items.map((it) =>
            it.id === itemId
              ? {
                  id: it.id,
                  type: 'ref',
                  activity_id: created.id,
                  duration_seconds: created.duration_seconds,
                }
              : it
          ),
        },
      };
    });
    setSaveAsForm(null);
    toast.success(`Saved "${created.title}" as activity`);
  }

  function pickActivityFromList(activity) {
    appendItem({
      id: newTmpId(),
      type: 'ref',
      activity_id: activity.id,
      duration_seconds: activity.duration_seconds,
    });
  }

  function reorderItems(srcId, destId) {
    setEditing((prev) => {
      if (!prev) return prev;
      const items = prev.form.items;
      const srcIdx = items.findIndex((it) => it.id === srcId);
      const destIdx = items.findIndex((it) => it.id === destId);
      if (srcIdx < 0 || destIdx < 0 || srcIdx === destIdx) return prev;
      const next = [...items];
      const [moved] = next.splice(srcIdx, 1);
      next.splice(destIdx, 0, moved);
      return { ...prev, form: { ...prev.form, items: next } };
    });
  }

  const selectedActivities = useMemo(() => {
    if (!editing) return [];
    const byId = new Map(activities.map((a) => [a.id, a]));
    return editing.form.items
      .map((it) => {
        if (it.type === 'inline') {
          return {
            id: it.id,
            is_inline: true,
            title: it.inline_title || '',
            duration_seconds: it.duration_seconds || 0,
            tags: [],
          };
        }
        const a = byId.get(it.activity_id);
        if (!a) return null;
        return {
          id: it.id,
          is_inline: false,
          activity_id: a.id,
          title: a.title,
          duration_seconds: it.duration_seconds,
          tags: a.tags || [],
        };
      })
      .filter(Boolean);
  }, [editing, activities]);

  const focusedTimer = focusedId == null ? null : timers.find((t) => t.id === focusedId);

  return (
    <div>
      <div className="section-header">
        <h1>Timers</h1>
        <button className="icon-btn" onClick={openCreate} aria-label="New timer">
          <MdAdd />
        </button>
      </div>

      {error && <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: 12 }}>{error}</div>}

      {timers.length === 0 ? (
        <div className="card empty">
          No timers yet. Build one to chain activities together.
        </div>
      ) : (
        <div className="list">
          {timers.map((t) => (
            <TimerCard
              key={t.id}
              timer={t}
              run={runStates[t.id]}
              reverse={reverse}
              expanded={expandedId === t.id}
              onToggleExpand={() =>
                setExpandedId((prev) => (prev === t.id ? null : t.id))
              }
              onTogglePlay={() => togglePlay(t)}
              onReset={() => resetRun(t.id)}
              onFocus={() => setFocusedId(t.id)}
              onEdit={() => openEdit(t)}
              onDuplicate={() => duplicateTimer(t.id)}
              onDelete={() => removeTimer(t.id)}
            />
          ))}
        </div>
      )}

      {editing && (
        <Modal
          title={editing.mode === 'create' ? 'New timer' : 'Edit timer'}
          onClose={() => setEditing(null)}
        >
          <div className="modal-subtitle">
            {selectedActivities.length}{' '}
            {selectedActivities.length === 1 ? 'activity' : 'activities'} ·{' '}
            {formatLongDuration(
              selectedActivities.reduce((s, a) => s + (a.duration_seconds || 0), 0)
            )}
          </div>
          <div className="form">
            <div>
              <label className="label">Title</label>
              <input
                className="input"
                value={editing.form.title}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, title: e.target.value } })}
                autoFocus
              />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                className="textarea"
                value={editing.form.description}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, description: e.target.value } })}
              />
            </div>
            <div>
              <div className="timer-activities-head">
                <label className="label" style={{ margin: 0 }}>
                  Activities (drag to reorder)
                </label>
                <ContextMenu
                  icon={<MdAdd size={20} aria-hidden />}
                  label="Add activity"
                  items={[
                    { label: 'Custom activity', onClick: openCustomForm },
                    { label: 'Add from activity', onClick: () => setPickerOpen(true) },
                  ]}
                />
              </div>
              {selectedActivities.length === 0 && !customForm ? (
                <div className="muted">No activities yet. Use the + button to add one.</div>
              ) : (
                <>
                  {selectedActivities.length > 0 && (
                    <SortableActivityList
                      items={selectedActivities}
                      onReorder={reorderItems}
                      onRemove={removeItem}
                      onDuplicate={duplicateItem}
                      onDurationChange={setItemDuration}
                      onSaveAsActivity={saveAsActivity}
                    />
                  )}
                  {customForm && (
                    <CustomActivityForm
                      form={customForm}
                      onChange={setCustomForm}
                      onCancel={() => setCustomForm(null)}
                      onSubmit={submitCustomActivity}
                    />
                  )}
                </>
              )}
            </div>
            {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn" onClick={saveTimer}>Save</button>
            </div>
          </div>
        </Modal>
      )}

      {editing && pickerOpen && (
        <ActivityPickerModal
          activities={activities}
          selectedActivities={selectedActivities}
          onPick={pickActivityFromList}
          onRemove={removeItem}
          onReorder={reorderItems}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {saveAsForm && (
        <ActivityFormModal
          title="New activity"
          initialValues={saveAsForm.initialValues}
          tags={tags}
          onClose={() => setSaveAsForm(null)}
          onSave={commitSaveAsActivity}
        />
      )}

      {focusedTimer && (
        <FocusedTimer
          timer={focusedTimer}
          run={runStates[focusedTimer.id]}
          reverse={reverse}
          onClose={() => setFocusedId(null)}
          onTogglePlay={() => togglePlay(focusedTimer)}
          onReset={() => resetRun(focusedTimer.id)}
          onPrev={() => prevSplit(focusedTimer)}
          onNext={() => nextSplit(focusedTimer)}
          onSeek={(sec) => seekTimer(focusedTimer, sec)}
          onEdit={() => { setFocusedId(null); openEdit(focusedTimer); }}
          onDuplicate={() => duplicateTimer(focusedTimer.id)}
          onDelete={() => removeTimer(focusedTimer.id)}
        />
      )}
    </div>
  );
}

function SplitList({ activities, index, splitElapsed, state, reverse, showAll = false }) {
  if (activities.length === 0) return null;
  const clamped = Math.min(Math.max(index, 0), activities.length - 1);
  let visibleIndices;
  if (showAll) {
    visibleIndices = activities.map((_, i) => i);
  } else {
    visibleIndices = [];
    if (clamped > 0) visibleIndices.push(clamped - 1);
    visibleIndices.push(clamped);
    if (clamped < activities.length - 1) visibleIndices.push(clamped + 1);
  }

  const hiddenAbove = visibleIndices[0];
  const hiddenBelow = activities.length - 1 - visibleIndices[visibleIndices.length - 1];

  return (
    <div className="timer-splits">
      {hiddenAbove > 0 && (
        <div className="timer-split-more">+{hiddenAbove} more</div>
      )}
      {visibleIndices.map((i) => {
        const a = activities[i];
        if (!a) return null;
        const isActive = i === index;
        const dur = a.duration_seconds;
        const liveValue = reverse ? splitElapsed : Math.max(0, dur - splitElapsed);
        return (
          <div key={i} className={`timer-split ${isActive ? 'active' : ''}`}>
            <span className="timer-split-num">{i + 1}</span>
            <span className="timer-split-name">{a.title}</span>
            <span className="timer-split-time">
              {isActive && state !== 'idle'
                ? `${formatHMS(liveValue)} - ${formatHMS(dur)}`
                : formatHMS(dur)}
            </span>
          </div>
        );
      })}
      {hiddenBelow > 0 && (
        <div className="timer-split-more">+{hiddenBelow} more</div>
      )}
    </div>
  );
}

function TimerCard({
  timer,
  run,
  reverse,
  expanded,
  onToggleExpand,
  onTogglePlay,
  onReset,
  onFocus,
  onEdit,
  onDuplicate,
  onDelete,
}) {
  const d = deriveRun(timer, run);
  const empty = timer.activities.length === 0;
  const displayTime = reverse
    ? d.totalElapsed
    : d.state === 'overtime'
      ? d.totalRemaining
      : Math.max(0, d.totalRemaining);
  let caption;
  if (d.state === 'overtime') caption = `Overtime from ${captionDuration(d.total)}`;
  else if (reverse) caption = `Elapsed of ${captionDuration(d.total)}`;
  else caption = `Remaining from ${captionDuration(d.total)}`;

  const cardRef = useRef(null);
  useEffect(() => {
    if (!expanded || !cardRef.current) return;
    const topbar = document.querySelector('.topbar');
    const offset = (topbar?.offsetHeight ?? 0) + 8;
    const rect = cardRef.current.getBoundingClientRect();
    window.scrollTo({
      top: window.scrollY + rect.top - offset,
      behavior: 'smooth',
    });
  }, [expanded]);

  return (
    <div
      ref={cardRef}
      className={`card timer-card timer-state-${d.state} ${expanded ? 'expanded' : ''}`}
      onClick={onToggleExpand}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
    >
      <div className="timer-card-head">
        <div className="timer-card-title">{timer.title}</div>
        <div className="timer-card-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="icon-btn timer-play-btn"
            onClick={onTogglePlay}
            disabled={empty}
            aria-label={d.state === 'running' ? 'Pause' : 'Play'}
          >
            {d.state === 'running' ? <MdPause /> : <MdPlayArrow />}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onReset}
            disabled={!run}
            aria-label="Reset"
          >
            <MdRefresh />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onFocus}
            aria-label="Focus"
          >
            <MdCenterFocusStrong />
          </button>
          <ContextMenu
            items={[
              { label: 'Edit', onClick: onEdit },
              { label: 'Duplicate', onClick: onDuplicate },
              { label: 'Delete', danger: true, onClick: onDelete },
            ]}
          />
        </div>
      </div>
      <div className="timer-card-time">{formatRich(displayTime)}</div>
      <div className="timer-card-caption">{caption}</div>
      {!empty && (
        <SplitList
          activities={timer.activities}
          index={d.index}
          splitElapsed={d.splitElapsed}
          state={d.state}
          reverse={reverse}
          showAll={expanded}
        />
      )}
    </div>
  );
}

function FocusedTimer({
  timer,
  run,
  reverse,
  onClose,
  onTogglePlay,
  onReset,
  onPrev,
  onNext,
  onSeek,
  onEdit,
  onDuplicate,
  onDelete,
}) {
  const d = deriveRun(timer, run);
  const splits = timer.activities;
  const current = splits[d.index];
  const displayTime = reverse
    ? d.totalElapsed
    : d.state === 'overtime'
      ? d.totalRemaining
      : Math.max(0, d.totalRemaining);
  let caption;
  if (d.state === 'overtime') caption = `Overtime from ${captionDuration(d.total)}`;
  else if (reverse) caption = `Elapsed of ${captionDuration(d.total)}`;
  else caption = `Remaining from ${captionDuration(d.total)}`;

  const [seeAll, setSeeAll] = useState(false);

  const controls = (
    <div className="focused-timer-controls">
      <button
        type="button"
        className="icon-btn"
        onClick={onPrev}
        disabled={splits.length === 0}
        aria-label="Previous split"
      >
        <MdSkipPrevious />
      </button>
      <button
        type="button"
        className="icon-btn timer-play-btn"
        onClick={onTogglePlay}
        disabled={splits.length === 0}
        aria-label={d.state === 'running' ? 'Pause' : 'Play'}
      >
        {d.state === 'running' ? <MdPause /> : <MdPlayArrow />}
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={onReset}
        disabled={!run}
        aria-label="Reset"
      >
        <MdRefresh />
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={onNext}
        disabled={splits.length === 0}
        aria-label="Next split"
      >
        <MdSkipNext />
      </button>
    </div>
  );

  return (
    <Modal title={null} onClose={onClose}>
      <div className={`focused-timer timer-state-${d.state} ${seeAll ? 'see-all' : ''}`}>
        <div className="focused-timer-head">
          <div className="timer-card-title">{timer.title}</div>
          <ContextMenu
            items={[
              {
                label: seeAll ? 'Show dial' : 'See all splits',
                onClick: () => setSeeAll((v) => !v),
              },
              { label: 'Edit', onClick: onEdit },
              { label: 'Duplicate', onClick: onDuplicate },
              { label: 'Delete', danger: true, onClick: onDelete },
            ]}
          />
        </div>
        {seeAll ? (
          <div className="focused-timer-compact">
            <div className="focused-timer-clock">
              <div className="timer-card-time">{formatRich(displayTime)}</div>
              <div className="timer-card-caption">{caption}</div>
            </div>
            {controls}
          </div>
        ) : (
          <>
            <div className="focused-timer-dial">
              <TimerDial
                totalSec={d.total}
                totalElapsed={d.totalElapsed}
                splits={splits}
                topLabel={captionDuration(d.total)}
                centerLabel={formatRich(displayTime)}
                bottomLabel={current?.title || ''}
                onSeek={onSeek}
                onCenterTap={splits.length > 0 ? onTogglePlay : undefined}
              />
            </div>
            {controls}
          </>
        )}
        {splits.length > 0 && (
          <SplitList
            activities={splits}
            index={d.index}
            splitElapsed={d.splitElapsed}
            state={d.state}
            reverse={reverse}
            showAll={seeAll}
          />
        )}
      </div>
    </Modal>
  );
}

function CustomActivityForm({ form, onChange, onCancel, onSubmit }) {
  return (
    <div className="card custom-activity-form">
      <input
        className="input"
        placeholder="Title"
        value={form.title}
        onChange={(e) => onChange({ ...form, title: e.target.value })}
        autoFocus
      />
      <div className="custom-activity-row">
        <div className="dur-input-group">
          <input
            type="number"
            min="0"
            className="input dur-input"
            value={form.minutes}
            onChange={(e) => onChange({ ...form, minutes: Math.max(0, Number(e.target.value) || 0) })}
            aria-label="Minutes"
          />
          <span className="dur-sep">:</span>
          <input
            type="number"
            min="0"
            max="59"
            className="input dur-input"
            value={String(form.seconds).padStart(2, '0')}
            onChange={(e) =>
              onChange({
                ...form,
                seconds: Math.max(0, Math.min(59, Number(e.target.value) || 0)),
              })
            }
            aria-label="Seconds"
          />
        </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onSubmit}
            disabled={!form.title.trim()}
          >
            Add
          </button>
      </div>
    </div>
  );
}

function ActivityPickerModal({
  activities,
  selectedActivities,
  onPick,
  onRemove,
  onReorder,
  onClose,
}) {
  const [search, setSearch] = useState('');
  const previewRef = useRef(null);
  const [draggingId, setDraggingId] = useState(null);
  useEffect(() => {
    if (draggingId != null) return;
    const el = previewRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
  }, [selectedActivities.length, draggingId]);
  useEffect(() => {
    if (draggingId == null) return;
    function move(e) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const target = el?.closest('[data-pill-id]');
      if (!target) return;
      const targetId = target.dataset.pillId;
      if (!targetId || targetId === String(draggingId)) return;
      onReorder?.(draggingId, targetId);
    }
    function stop() {
      setDraggingId(null);
    }
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', stop);
    document.addEventListener('pointercancel', stop);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', stop);
      document.removeEventListener('pointercancel', stop);
    };
  }, [draggingId, onReorder]);
  const q = search.trim().toLowerCase();
  const filtered = q
    ? activities.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.tags.some((t) => t.name.toLowerCase().includes(q))
      )
    : activities;

  return (
    <Modal title="Add from activity" onClose={onClose}>
      <input
        type="search"
        className="input"
        placeholder="Search by name or tag..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      {selectedActivities.length > 0 && (
        <div ref={previewRef} className="picker-preview" aria-label="Added activities">
          {selectedActivities.map((a) => (
            <span
              key={a.id}
              data-pill-id={a.id}
              className={`picker-pill ${draggingId === a.id ? 'dragging' : ''}`}
              onPointerDown={(e) => {
                if (!onReorder) return;
                e.preventDefault();
                setDraggingId(a.id);
              }}
            >
              <span className="picker-pill-label">{a.title}</span>
              <button
                type="button"
                className="picker-pill-remove"
                aria-label={`Remove ${a.title}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onRemove(a.id)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="activity-list activity-picker-list" style={{ marginTop: 12 }}>
        {filtered.length === 0 ? (
          <div className="muted" style={{ padding: 12, textAlign: 'center' }}>
            {activities.length === 0
              ? 'No activities yet.'
              : 'No matching activities.'}
          </div>
        ) : (
          filtered.map((a) => (
            <button
              key={a.id}
              type="button"
              className="activity-pick"
              onClick={() => onPick(a)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>{a.title}</div>
                <div className="muted">{formatDuration(a.duration_seconds)}</div>
                {a.tags.length > 0 && (
                  <div className="tag-row wrap" style={{ marginTop: 4 }}>
                    {a.tags.map((t) => <TagChip key={t.id} tag={t} />)}
                  </div>
                )}
              </div>
              <MdAdd aria-hidden />
            </button>
          ))
        )}
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
