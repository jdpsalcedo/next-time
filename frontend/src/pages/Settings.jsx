import { useState } from 'react';
import { useSettings } from '../settings.jsx';
import { useAuth } from '../auth.jsx';
import Modal from '../components/Modal.jsx';
import ColorSwatchPicker from '../components/ColorSwatchPicker.jsx';

const ACCENT_PRESETS = [
  '#38bdf8', '#22c55e', '#a855f7', '#f59e0b',
  '#ec4899', '#ef4444', '#3b82f6', '#14b8a6',
];

export default function Settings() {
  const { settings, synced, update } = useSettings();
  const { user, signOut } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [accentPickerOpen, setAccentPickerOpen] = useState(false);

  async function toggle(key) {
    setError('');
    setBusy(key);
    try {
      await update({ [key]: !settings[key] });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function setAccent(color) {
    setError('');
    setBusy('accent_color');
    try {
      await update({ accent_color: color });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="section-header">
        <h1>Settings</h1>
      </div>

      {!synced && <p className="muted">Syncing with server…</p>}
      {error && (
        <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="list">
        <SettingRow
          label="Reverse timer countdown"
          description="Count up from 0 to the activity's duration instead of counting down."
          on={settings.reverse_countdown}
          busy={busy === 'reverse_countdown'}
          onToggle={() => toggle('reverse_countdown')}
        />
        <SettingRow
          label="Dummy data"
          description="Add a set of sample tags, activities, and a timer to play with. Turning this off removes only the samples — your own data is preserved."
          on={settings.dummy_data}
          busy={busy === 'dummy_data'}
          onToggle={() => toggle('dummy_data')}
        />
        <SettingRow
          label="Dark mode"
          description="Switch between dark and light themes."
          on={settings.dark_mode}
          busy={busy === 'dark_mode'}
          onToggle={() => toggle('dark_mode')}
        />
        <div
          className="card setting-card-clickable"
          role="button"
          tabIndex={0}
          onClick={() => setAccentPickerOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setAccentPickerOpen(true);
            }
          }}
          aria-label="Open accent color picker"
        >
          <div className="row">
            <div className="row-main">
              <div style={{ fontWeight: 600 }}>Accent color</div>
              <div className="muted" style={{ marginTop: 4 }}>
                Highlight color for nav, card borders, the play button, and Home accents.
              </div>
            </div>
            <span
              className="accent-preview-dot"
              style={{ background: settings.accent_color || '#38bdf8' }}
              aria-hidden
            />
          </div>
        </div>
        <div className="card">
          <div className="row">
            <div className="row-main">
              <div style={{ fontWeight: 600 }}>Signed in</div>
              <div className="muted" style={{ marginTop: 4 }}>
                {user?.email ?? user?.displayName ?? 'Google account'}
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </div>

      {accentPickerOpen && (
        <Modal title="Accent color" onClose={() => setAccentPickerOpen(false)}>
          <p className="muted" style={{ marginTop: 0 }}>
            Pick a highlight color. Selecting one turns the override on.
          </p>
          <ColorSwatchPicker
            value={settings.accent_color || '#38bdf8'}
            onChange={(c) => { setAccent(c); }}
            presets={ACCENT_PRESETS}
            ariaLabel="Accent color"
          />
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setAccentPickerOpen(false)}
            >
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SettingRow({ label, description, on, busy, onToggle }) {
  return (
    <div className="card">
      <div className="row">
        <div className="row-main">
          <div style={{ fontWeight: 600 }}>{label}</div>
          {description && <div className="muted" style={{ marginTop: 4 }}>{description}</div>}
        </div>
        <button
          type="button"
          className={`toggle ${on ? 'on' : ''}`}
          role="switch"
          aria-checked={on}
          aria-label={label}
          disabled={busy}
          onClick={onToggle}
        >
          <span className="toggle-thumb" />
        </button>
      </div>
    </div>
  );
}
