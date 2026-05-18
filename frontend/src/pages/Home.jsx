import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDuration } from '../api.js';

export default function Home() {
  const [activities, setActivities] = useState([]);
  const [timers, setTimers] = useState([]);
  const [tags, setTags] = useState([]);

  useEffect(() => {
    Promise.all([api.listActivities(), api.listTimers(), api.listTags()])
      .then(([a, t, g]) => { setActivities(a); setTimers(t); setTags(g); })
      .catch(() => {});
  }, []);

  const totalDuration = activities.reduce((acc, a) => acc + a.duration_seconds, 0);

  return (
    <div>
      <div className="section-header">
        <h1>Welcome</h1>
      </div>
      <p>Track activities, group them into timers, and run through them on the clock.</p>

      <div className="kpi-grid" style={{ marginTop: 20 }}>
        <div className="card kpi">
          <div className="kpi-value">{activities.length}</div>
          <div className="kpi-label">Activities</div>
        </div>
        <div className="card kpi">
          <div className="kpi-value">{timers.length}</div>
          <div className="kpi-label">Timers</div>
        </div>
        <div className="card kpi">
          <div className="kpi-value">{tags.length}</div>
          <div className="kpi-label">Tags</div>
        </div>
      </div>

      <div className="list">
        <div className="card">
          <div className="section-header">
            <h2>Quick start</h2>
          </div>
          <p style={{ marginTop: 0 }}>
            Head to <Link to="/activities">Activities</Link> to create something to track,
            then build a <Link to="/timers">Timer</Link> that runs through them in order.
          </p>
          {activities.length > 0 && (
            <p className="muted" style={{ marginBottom: 0 }}>
              Total tracked activity time: {formatDuration(totalDuration)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
