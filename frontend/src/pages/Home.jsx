import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MdInfoOutline } from 'react-icons/md';
import { api, formatDuration } from '../api.js';
import Modal from '../components/Modal.jsx';
import TagChip from '../components/TagChip.jsx';

export default function Home() {
  const [activities, setActivities] = useState([]);
  const [timers, setTimers] = useState([]);
  const [tags, setTags] = useState([]);
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    Promise.all([api.listActivities(), api.listTimers(), api.listTags()])
      .then(([a, t, g]) => { setActivities(a); setTimers(t); setTags(g); })
      .catch(() => {});
  }, []);

  const totalDuration = activities.reduce((acc, a) => acc + a.duration_seconds, 0);

  const tagsWithCounts = useMemo(() => {
    const counts = new Map();
    for (const a of activities) {
      for (const t of a.tags) {
        counts.set(t.id, (counts.get(t.id) || 0) + 1);
      }
    }
    return tags.map((t) => ({ ...t, count: counts.get(t.id) || 0 }));
  }, [tags, activities]);

  return (
    <div>
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <h1>Welcome</h1>
          <button
            className="icon-btn"
            aria-label="Quick start info"
            onClick={() => setInfoOpen(true)}
          >
            <MdInfoOutline />
          </button>
        </div>
      </div>
      <p>Track activities, group them into timers, and run through them on the clock.</p>

      {tags.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div
            className="muted"
            style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}
          >
            Browse by tag
          </div>
          <div className="tag-grid">
            {tagsWithCounts.map((g) => (
              <Link
                key={g.id}
                to={`/activities?tags=${encodeURIComponent(g.id)}`}
                className="card tag-preview-card"
                style={{ borderTop: `3px solid ${g.color}` }}
              >
                <TagChip tag={g} />
                <div className="muted" style={{ fontSize: '0.8rem' }}>
                  {g.count} {g.count === 1 ? 'activity' : 'activities'}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {infoOpen && (
        <Modal title="Quick start" onClose={() => setInfoOpen(false)}>
          <p style={{ marginTop: 0 }}>
            Head to <Link to="/activities" onClick={() => setInfoOpen(false)}>Activities</Link> to create
            something to track, then build a{' '}
            <Link to="/timers" onClick={() => setInfoOpen(false)}>Timer</Link> that runs through them in order.
          </p>
          {activities.length > 0 && (
            <p className="muted" style={{ marginBottom: 0 }}>
              Total tracked activity time: {formatDuration(totalDuration)}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
