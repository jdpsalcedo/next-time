import { useState } from 'react';
import Modal from './Modal.jsx';
import TagChip from './TagChip.jsx';

export default function ActivityFormModal({
  title,
  initialValues,
  tags,
  onClose,
  onSave,
  onOpenTagManager,
}) {
  const [form, setForm] = useState(() => ({
    title: initialValues?.title ?? '',
    description: initialValues?.description ?? '',
    minutes: initialValues?.minutes ?? 0,
    seconds: initialValues?.seconds ?? 0,
    tag_ids: initialValues?.tag_ids ?? [],
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sortedTags = [...(tags || [])].sort((a, b) => a.name.localeCompare(b.name));

  function toggleTag(tagId) {
    setForm((prev) => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter((id) => id !== tagId)
        : [...prev.tag_ids, tagId],
    }));
  }

  async function handleSave() {
    setError('');
    const duration_seconds = Number(form.minutes) * 60 + Number(form.seconds);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      duration_seconds,
      tag_ids: form.tag_ids,
    };
    if (!payload.title) { setError('Title is required'); return; }
    setBusy(true);
    try {
      await onSave(payload);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="form">
        <div>
          <label className="label">Title</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            autoFocus
          />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            className="textarea"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="form-row">
          <div>
            <label className="label">Minutes</label>
            <input
              className="input"
              type="number"
              min="0"
              value={form.minutes}
              onChange={(e) => setForm({ ...form, minutes: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Seconds</label>
            <input
              className="input"
              type="number"
              min="0"
              max="59"
              value={form.seconds}
              onChange={(e) => setForm({ ...form, seconds: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="label">Tags</label>
          <div className="tag-row wrap">
            {sortedTags.map((t) => (
              <TagChip
                key={t.id}
                tag={t}
                selectable
                selected={form.tag_ids.includes(t.id)}
                onClick={() => toggleTag(t.id)}
              />
            ))}
            {onOpenTagManager && (
              <button
                className="tag-chip tag-chip-more"
                onClick={onOpenTagManager}
                aria-label="Add tag"
              >
                +
              </button>
            )}
          </div>
        </div>
        {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn" onClick={handleSave} disabled={busy}>Save</button>
        </div>
      </div>
    </Modal>
  );
}
