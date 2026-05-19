import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Activities from './pages/Activities.jsx';
import Timers from './pages/Timers.jsx';
import Settings from './pages/Settings.jsx';
import { useSettings } from './settings.jsx';

export default function App() {
  const { settings } = useSettings();
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span>next-time</span>
          {settings.static_mode && (
            <span className="brand-badge" title="Running in static mode — data is stored in this browser only">
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
