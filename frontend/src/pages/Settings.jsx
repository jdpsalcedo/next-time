import { useState } from 'react';
import { useSettings } from '../settings.jsx';

export default function Settings() {
  const { settings, synced, update } = useSettings();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

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
          label="Dark mode"
          description="Switch between dark and light themes."
          on={settings.dark_mode}
          busy={busy === 'dark_mode'}
          onToggle={() => toggle('dark_mode')}
        />
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
          label="Static mode"
          description="Reserved for future behavior."
          on={settings.static_mode}
          busy={busy === 'static_mode'}
          onToggle={() => toggle('static_mode')}
        />
      </div>
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
