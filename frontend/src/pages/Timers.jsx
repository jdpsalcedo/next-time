import { useEffect, useRef, useState } from 'react';
import { api, formatDuration } from '../api.js';
import Modal from '../components/Modal.jsx';
import { useSettings } from '../settings.jsx';

export default function Timers() {
  const [timers, setTimers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [editing, setEditing] = useState(null);
  const [running, setRunning] = useState(null);
  const [error, setError] = useState('');

  async function refresh() {
    const [t, a] = await Promise.all([api.listTimers(), api.listActivities()]);
    setTimers(t);
    setActivities(a);
  }

  useEffect(() => { refresh().catch((e) => setError(e.message)); }, []);

  function openCreate() {
    setEditing({ mode: 'create', form: { title: '', description: '', activity_ids: [] } });
  }

  function openEdit(timer) {
    setEditing({
      mode: 'edit',
      id: timer.id,
      form: {
        title: timer.title,
        description: timer.description,
        activity_ids: timer.activities.map((a) => a.id),
      },
    });
  }

  async function saveTimer() {
    setError('');
    const { form } = editing;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      activity_ids: form.activity_ids,
    };
    if (!payload.title) { setError('Title is required'); return; }
    try {
      if (editing.mode === 'create') await api.createTimer(payload);
      else await api.updateTimer(editing.id, payload);
      setEditing(null);
      await refresh();
    } catch (e) { setError(e.message); }
  }

  async function removeTimer(id) {
    if (!confirm('Delete this timer? Its activities will not be removed.')) return;
    try {
      await api.deleteTimer(id);
      await refresh();
    } catch (e) { setError(e.message); }
  }

  function toggleActivity(id) {
    setEditing((prev) => {
      const has = prev.form.activity_ids.includes(id);
      return {
        ...prev,
        form: {
          ...prev.form,
          activity_ids: has
            ? prev.form.activity_ids.filter((x) => x !== id)
            : [...prev.form.activity_ids, id],
        },
      };
    });
  }

  return (
    <div>
      <div className="section-header">
        <h1>Timers</h1>
        <button className="btn" onClick={openCreate}>New timer</button>
      </div>

      {error && <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: 12 }}>{error}</div>}

      {timers.length === 0 ? (
        <div className="card empty">
          No timers yet. Build one to chain activities together.
        </div>
      ) : (
        <div className="list">
          {timers.map((t) => {
            const total = t.activities.reduce((acc, a) => acc + a.duration_seconds, 0);
            return (
              <div key={t.id} className="card">
                <div className="row">
                  <div className="row-main">
                    <div style={{ fontWeight: 600 }}>{t.title}</div>
                    {t.description && <div className="muted">{t.description}</div>}
                    <div className="muted" style={{ marginTop: 4 }}>
                      {t.activities.length} activities · total {formatDuration(total)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-sm"
                      onClick={() => setRunning(t)}
                      disabled={t.activities.length === 0}
                    >
                      Run
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => removeTimer(t.id)}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <Modal
          title={editing.mode === 'create' ? 'New timer' : 'Edit timer'}
          onClose={() => setEditing(null)}
        >
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
              <label className="label">Activities (in order)</label>
              {activities.length === 0 ? (
                <div className="muted">No activities yet. Create some on the Activities tab.</div>
              ) : (
                <div className="activity-list">
                  {activities.map((a) => (
                    <label key={a.id} className="activity-pick">
                      <input
                        type="checkbox"
                        checked={editing.form.activity_ids.includes(a.id)}
                        onChange={() => toggleActivity(a.id)}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500 }}>{a.title}</div>
                        <div className="muted">{formatDuration(a.duration_seconds)}</div>
                      </div>
                    </label>
                  ))}
                </div>
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

      {running && (
        <TimerRunner timer={running} onClose={() => setRunning(null)} />
      )}
    </div>
  );
}

function TimerRunner({ timer, onClose }) {
  const { settings } = useSettings();
  const reverse = settings.reverse_countdown;
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const tickRef = useRef(null);

  const current = timer.activities[index];
  const next = timer.activities[index + 1];
  const duration = current?.duration_seconds ?? 0;
  const done = !current || (index === timer.activities.length - 1 && elapsed >= duration);

  useEffect(() => {
    if (!isPlaying || done) return;
    if (elapsed >= duration) {
      if (index < timer.activities.length - 1) {
        setIndex((i) => i + 1);
        setElapsed(0);
      } else {
        setIsPlaying(false);
      }
      return;
    }
    tickRef.current = setTimeout(() => setElapsed((e) => e + 1), 1000);
    return () => clearTimeout(tickRef.current);
  }, [isPlaying, elapsed, index, duration, done, timer.activities.length]);

  function reset() {
    setIndex(0);
    setElapsed(0);
    setIsPlaying(true);
  }

  function skip() {
    if (index < timer.activities.length - 1) {
      setIndex(index + 1);
      setElapsed(0);
    } else {
      setElapsed(duration);
    }
  }

  const displaySeconds = reverse ? elapsed : Math.max(0, duration - elapsed);

  return (
    <Modal title={timer.title} onClose={onClose}>
      <div className="runner">
        {done ? (
          <>
            <div className="now">All done</div>
            <div className="clock">{formatDuration(reverse ? duration : 0)}</div>
          </>
        ) : (
          <>
            <div className="now">{current.title}</div>
            <div className="clock">{formatDuration(displaySeconds)}</div>
            <div className="next">
              {reverse ? `of ${formatDuration(duration)} · ` : ''}
              {next ? `Next: ${next.title} (${formatDuration(next.duration_seconds)})` : 'Last activity'}
            </div>
          </>
        )}
        <div className="runner-actions">
          {!done && (
            <button className="btn btn-ghost" onClick={() => setIsPlaying((p) => !p)}>
              {isPlaying ? 'Pause' : 'Resume'}
            </button>
          )}
          {!done && <button className="btn btn-ghost" onClick={skip}>Skip</button>}
          <button className="btn btn-ghost" onClick={reset}>Reset</button>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}
