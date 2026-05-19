import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Activities from './pages/Activities.jsx';
import Timers from './pages/Timers.jsx';
import Settings from './pages/Settings.jsx';
import { SettingsProvider } from './settings.jsx';
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
      <AppShell />
    </SettingsProvider>
  );
}

const IS_STATIC = import.meta.env.VITE_STATIC_MODE === 'true';

function AppShell() {
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
        <nav className="tabs" aria-label="Primary">
          <NavLink to="/" end className="tab">Home</NavLink>
          <NavLink to="/activities" className="tab">Activities</NavLink>
          <NavLink to="/timers" className="tab">Timers</NavLink>
          <NavLink to="/settings" className="tab">Settings</NavLink>
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/activities" element={<Activities />} />
          <Route path="/timers" element={<Timers />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
        <NavLink to="/timers" className="bottomtab">
          <span className="bticon" aria-hidden>◷</span>
          <span>Timers</span>
        </NavLink>
        <NavLink to="/settings" className="bottomtab">
          <span className="bticon" aria-hidden>⚙</span>
          <span>Settings</span>
        </NavLink>
      </nav>
    </div>
  );
}
