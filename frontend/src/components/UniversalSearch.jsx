import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDuration } from '../api.js';
import { useData } from '../data.jsx';
import Modal from './Modal.jsx';
import TagChip from './TagChip.jsx';

const MAX_PER_GROUP = 5;

export default function UniversalSearch({ onClose }) {
  const [search, setSearch] = useState('');
  const { activities, timers, tags } = useData();

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const matchedActivities = activities
      .filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.tags.some((t) => t.name.toLowerCase().includes(q)),
      )
      .slice(0, MAX_PER_GROUP);
    const matchedTimers = timers
      .filter((t) => {
        if (t.title.toLowerCase().includes(q)) return true;
        if ((t.description || '').toLowerCase().includes(q)) return true;
        return t.activities.some((a) => {
          if ((a.title || '').toLowerCase().includes(q)) return true;
          return (a.tags || []).some((tg) => tg.name.toLowerCase().includes(q));
        });
      })
      .slice(0, MAX_PER_GROUP);
    const matchedTags = tags
      .filter((g) => g.name.toLowerCase().includes(q))
      .slice(0, MAX_PER_GROUP);
    return {
      activities: matchedActivities,
      timers: matchedTimers,
      tags: matchedTags,
    };
  }, [search, activities, timers, tags]);

  const noResults =
    results &&
    results.activities.length === 0 &&
    results.timers.length === 0 &&
    results.tags.length === 0;

  return (
    <Modal title="Search" onClose={onClose}>
      <input
        className="input input-search"
        placeholder="Search activities, timers, or tags..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      {results && (
        <div style={{ marginTop: 12 }}>
          {noResults ? (
            <div className="muted">No matches.</div>
          ) : (
            <>
              {results.tags.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <GroupLabel>Tags</GroupLabel>
                  <div className="tag-row wrap" style={{ marginBottom: 0 }}>
                    {results.tags.map((g) => (
                      <Link
                        key={g.id}
                        to={`/activities?tags=${encodeURIComponent(g.id)}`}
                        onClick={onClose}
                        style={{ textDecoration: 'none' }}
                      >
                        <TagChip tag={g} />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {results.activities.length > 0 && (
                <ResultGroup
                  label="Activities"
                  items={results.activities}
                  toHref={(a) => `/activities?q=${encodeURIComponent(a.title)}`}
                  caption={(a) => formatDuration(a.duration_seconds)}
                  onNavigate={onClose}
                />
              )}
              {results.timers.length > 0 && (
                <ResultGroup
                  label="Timers"
                  items={results.timers}
                  toHref={(t) => `/timers?q=${encodeURIComponent(t.title)}`}
                  caption={(t) =>
                    `${t.activities.length} ${t.activities.length === 1 ? 'activity' : 'activities'}`
                  }
                  onNavigate={onClose}
                />
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

function GroupLabel({ children }) {
  return (
    <div
      className="muted"
      style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}
    >
      {children}
    </div>
  );
}

function ResultGroup({ label, items, toHref, caption, onNavigate }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <GroupLabel>{label}</GroupLabel>
      <div className="list">
        {items.map((item) => (
          <Link
            key={item.id}
            to={toHref(item)}
            onClick={onNavigate}
            className="card"
            style={{ display: 'block', padding: 12, textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{ fontWeight: 500 }}>{item.title}</div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>{caption(item)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
