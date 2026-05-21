import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MdInfoOutline, MdAccessTime, MdPlayArrow, MdSearch, MdExpandLess, MdExpandMore } from 'react-icons/md';
import { smoothUpdate } from '../viewTransition.js';
import { formatDuration } from '../api.js';
import Modal from '../components/Modal.jsx';
import TagChip from '../components/TagChip.jsx';
import { useUI } from '../ui.jsx';
import { useData } from '../data.jsx';
import {
  useTimerEventsForRange,
  todayString,
  addDays,
  formatRelativeDay,
  formatScheduledAt,
} from '../timerEvents.js';

const LOOKAHEAD_DAYS = 14;
const MAX_VISIBLE_TAGS = 5;

function randomGlowStyle() {
  const corners = ['tl', 'tr', 'bl', 'br'];
  const corner = corners[Math.floor(Math.random() * corners.length)];
  const off1 = -(20 + Math.random() * 60);
  const off2 = -(20 + Math.random() * 60);
  const size = 120 + Math.random() * 140;
  const angle = Math.floor(Math.random() * 360);
  const style = {
    '--glow-size': `${size}px`,
    '--glow-angle': `${angle}deg`,
    '--glow-top': 'auto',
    '--glow-right': 'auto',
    '--glow-bottom': 'auto',
    '--glow-left': 'auto',
  };
  if (corner === 'tl') { style['--glow-top'] = `${off1}px`; style['--glow-left'] = `${off2}px`; }
  else if (corner === 'tr') { style['--glow-top'] = `${off1}px`; style['--glow-right'] = `${off2}px`; }
  else if (corner === 'bl') { style['--glow-bottom'] = `${off1}px`; style['--glow-left'] = `${off2}px`; }
  else { style['--glow-bottom'] = `${off1}px`; style['--glow-right'] = `${off2}px`; }
  return style;
}

export default function Home() {
  const { activities, timers, tags } = useData();
  const [infoOpen, setInfoOpen] = useState(false);
  const navigate = useNavigate();
  const { openSearch } = useUI();

  const today = todayString();
  const eventsRange = useMemo(
    () => ({ from: today, to: addDays(today, LOOKAHEAD_DAYS) }),
    [today],
  );
  const events = useTimerEventsForRange(eventsRange);

  const timersById = useMemo(() => {
    const m = new Map();
    for (const t of timers) m.set(t.id, t);
    return m;
  }, [timers]);

  const todayEvents = useMemo(() => {
    return events
      .filter((e) => e.date === today)
      .sort((a, b) => (a.scheduledAt || '99:99').localeCompare(b.scheduledAt || '99:99') || (a.createdAt - b.createdAt));
  }, [events, today]);

  const upcomingByDate = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      if (e.date === today) continue;
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    }
    const sorted = [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => (a.scheduledAt || '99:99').localeCompare(b.scheduledAt || '99:99') || (a.createdAt - b.createdAt)),
      }));
    return sorted;
  }, [events, today]);

  const totalDuration = activities.reduce((acc, a) => acc + a.duration_seconds, 0);

  const tagsWithCounts = useMemo(() => {
    const counts = new Map();
    for (const a of activities) {
      for (const t of a.tags) {
        counts.set(t.id, (counts.get(t.id) || 0) + 1);
      }
    }
    return tags
      .map((t) => ({ ...t, count: counts.get(t.id) || 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [tags, activities]);

  const visibleTags = tagsWithCounts.slice(0, MAX_VISIBLE_TAGS);
  const hiddenTagCount = Math.max(0, tagsWithCounts.length - MAX_VISIBLE_TAGS);

  function openTimer(timerId) {
    navigate(`/timers?focus=${encodeURIComponent(timerId)}`);
  }

  const todayLabel = useMemo(() => {
    const [y, m, d] = today.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, [today]);

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

      <div className={`home-day-section ${upcomingByDate.length > 0 ? 'two-up' : ''}`}>
        <TodayCard
          events={todayEvents}
          timersById={timersById}
          onOpen={openTimer}
          label={todayLabel}
        />
        {upcomingByDate.length > 0 && (
          <PlanAheadCard
            groups={upcomingByDate}
            timersById={timersById}
            onOpen={openTimer}
          />
        )}
      </div>

      {tags.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div
            className="muted"
            style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}
          >
            Browse by tag
          </div>
          <div className="tag-grid">
            {visibleTags.map((g) => (
              <TagPreviewCard key={g.id} tag={g} />
            ))}
            {hiddenTagCount > 0 && (
              <MoreTagsCard count={hiddenTagCount} onClick={openSearch} />
            )}
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

function TodayCard({ events, timersById, onOpen, label }) {
  const empty = events.length === 0;
  const glow = useMemo(() => randomGlowStyle(), []);
  const [expanded, setExpanded] = useState(true);
  const toggle = () => smoothUpdate(() => setExpanded((v) => !v));
  return (
    <div className="card today-card" style={glow}>
      <button
        type="button"
        className="card-collapse-header"
        onClick={toggle}
        aria-expanded={expanded}
      >
        <div>
          <div className="today-card-eyebrow">Today</div>
          <div className="today-card-date">{label}</div>
        </div>
        <span className="card-collapse-chevron" aria-hidden>
          {expanded ? <MdExpandLess /> : <MdExpandMore />}
        </span>
      </button>
      {expanded && (empty ? (
        <div className="muted today-card-empty">
          Nothing on the calendar — the day is yours.{' '}
          <Link to="/calendar">Plan something</Link>?
        </div>
      ) : (
        <div className="today-card-list">
          {events.map((e) => (
            <EventRow
              key={e.id}
              event={e}
              timer={timersById.get(e.timerId)}
              onOpen={onOpen}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function PlanAheadCard({ groups, timersById, onOpen }) {
  const glow = useMemo(() => randomGlowStyle(), []);
  const [expanded, setExpanded] = useState(true);
  const toggle = () => smoothUpdate(() => setExpanded((v) => !v));
  return (
    <div className="card plan-ahead-card" style={glow}>
      <button
        type="button"
        className="card-collapse-header"
        onClick={toggle}
        aria-expanded={expanded}
      >
        <div className="today-card-eyebrow">Plan ahead</div>
        <span className="card-collapse-chevron" aria-hidden>
          {expanded ? <MdExpandLess /> : <MdExpandMore />}
        </span>
      </button>
      {expanded && (
        <div className="plan-ahead-list">
          {groups.map(({ date, items }) => (
            <div key={date} className="plan-ahead-group">
              <div className="plan-ahead-day">{formatRelativeDay(date)}</div>
              <div className="today-card-list">
                {items.map((e) => (
                  <EventRow
                    key={e.id}
                    event={e}
                    timer={timersById.get(e.timerId)}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TagPreviewCard({ tag }) {
  const glow = useMemo(() => randomGlowStyle(), []);
  return (
    <Link
      to={`/activities?tags=${encodeURIComponent(tag.id)}`}
      className="card tag-preview-card"
      style={glow}
    >
      <TagChip tag={tag} />
      <div className="muted" style={{ fontSize: '0.8rem' }}>
        {tag.count} {tag.count === 1 ? 'activity' : 'activities'}
      </div>
    </Link>
  );
}

function MoreTagsCard({ count, onClick }) {
  const glow = useMemo(() => randomGlowStyle(), []);
  return (
    <button
      type="button"
      onClick={onClick}
      className="card tag-preview-card tag-preview-more"
      style={glow}
      aria-label={`Show ${count} more tags`}
    >
      <MdSearch aria-hidden style={{ fontSize: '1.1rem' }} />
      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>+{count} more tags</div>
      <div className="muted" style={{ fontSize: '0.75rem' }}>Open search</div>
    </button>
  );
}

function EventRow({ event, timer, onOpen }) {
  const color = timer?.activities?.[0]?.tags?.[0]?.color || 'var(--muted)';
  return (
    <button
      type="button"
      className="today-event"
      onClick={() => timer && onOpen(timer.id)}
      disabled={!timer}
    >
      <span className="today-event-accent" style={{ background: color }} />
      <span className="today-event-main">
        <span className="today-event-title">{timer?.title || 'Timer (deleted)'}</span>
        {event.scheduledAt && (
          <span className="today-event-time">
            <MdAccessTime aria-hidden /> {formatScheduledAt(event.scheduledAt)}
          </span>
        )}
      </span>
      {timer && <MdPlayArrow className="today-event-cta" aria-hidden />}
    </button>
  );
}
