import { useState } from 'react';
import { NavLink, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { MdSearch, MdPlayArrow, MdExpandLess, MdExpandMore } from 'react-icons/md';
import Home from './pages/Home.jsx';
import Activities from './pages/Activities.jsx';
import Timers from './pages/Timers.jsx';
import Settings from './pages/Settings.jsx';
import UniversalSearch from './components/UniversalSearch.jsx';
import { useActiveTimers } from './timerRuns.js';
import { SettingsProvider } from './settings.jsx';
import { ToastProvider } from './toast.jsx';
import { useAuth } from './auth.jsx';

export default function App() {
  const { user, loading, signIn } = useAuth();

  if (loading) {
    return <div className="auth-screen"><div className="muted">Loading…</div></div>;
  }
  if (!user) {
    return (
      <div className="auth-screen">
        <h1 style={{ marginBottom: 8 }}>next-time</h1>
        <p style={{ marginBottom: 20, maxWidth: 320, textAlign: 'center' }}>
          Sign in to sync your activities and timers across devices.
        </p>
        <button className="btn" onClick={signIn}>Sign in with Google</button>
      </div>
    );
  }
  return (
    <SettingsProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </SettingsProvider>
  );
}

const IS_STATIC = import.meta.env.VITE_STATIC_MODE === 'true';

function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const activeTimers = useActiveTimers();
  const hasActive = activeTimers.length > 0;
  const location = useLocation();

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span>next-time</span>
          {IS_STATIC && (
            <span
              className="brand-badge"
              title="GitHub Pages static deploy — same Firebase data as the App Hosting site"
            >
              static
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <nav className="tabs" aria-label="Primary">
            <NavLink to="/" end className="tab">Home</NavLink>
            <NavLink to="/activities" className="tab">Activities</NavLink>
            <NavLink
              to="/timers"
              className={({ isActive }) =>
                `tab ${hasActive ? 'tab-timer-running' : ''} ${isActive ? 'active' : ''}`
              }
            >
              Timers
            </NavLink>
            <NavLink to="/settings" className="tab">Settings</NavLink>
          </nav>
          <button
            className="icon-btn"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
          >
            <MdSearch />
          </button>
        </div>
      </header>
      {searchOpen && <UniversalSearch onClose={() => setSearchOpen(false)} />}
      <main className="main">
        <div className="page-enter" key={location.pathname}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/activities" element={<Activities />} />
            <Route path="/timers" element={<Timers />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
      <nav className="bottomnav" aria-label="Primary mobile">
        <NavLink to="/" end className="bottomtab">
          <span className="bticon" aria-hidden>⌂</span>
          <span>Home</span>
        </NavLink>
        <NavLink to="/activities" className="bottomtab">
          <span className="bticon" aria-hidden>≡</span>
          <span>Activities</span>
        </NavLink>
        <NavLink
          to="/timers"
          className={({ isActive }) =>
            `bottomtab ${hasActive ? 'bottomtab-timer-running' : ''} ${isActive ? 'active' : ''}`
          }
        >
          <span className="bticon" aria-hidden>◷</span>
          <span>Timers</span>
        </NavLink>
        <NavLink to="/settings" className="bottomtab">
          <span className="bticon" aria-hidden>⚙</span>
          <span>Settings</span>
        </NavLink>
      </nav>
      <ActiveTimersDrawer activeTimers={activeTimers} />
    </div>
  );
}

function ActiveTimersDrawer({ activeTimers }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  if (activeTimers.length === 0) return null;

  function openFocus(id) {
    navigate(`/timers?focus=${encodeURIComponent(id)}`);
    setExpanded(false);
  }

  return (
    <div className={`active-drawer ${expanded ? 'expanded' : ''}`}>
      <div className="active-drawer-inner">
        <div
          className={`active-drawer-list ${expanded ? '' : 'collapsed'}`}
          role="list"
          aria-hidden={!expanded}
        >
          {activeTimers.map((t) => (
            <button
              key={t.id}
              type="button"
              className="active-drawer-item"
              onClick={() => openFocus(t.id)}
              role="listitem"
              tabIndex={expanded ? 0 : -1}
            >
              <MdPlayArrow aria-hidden />
              <span className="active-drawer-item-title">{t.title}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="active-drawer-handle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Hide running timers' : 'Show running timers'}
        >
          <span className="active-drawer-dot" aria-hidden />
          <span className="active-drawer-summary">
            {activeTimers.length} {activeTimers.length === 1 ? 'timer' : 'timers'} running
          </span>
          {expanded ? <MdExpandMore /> : <MdExpandLess />}
        </button>
      </div>
    </div>
  );
}
