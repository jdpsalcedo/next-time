import { useEffect, useState } from 'react';
import { api, formatDuration } from '../api.js';
import TagChip from '../components/TagChip.jsx';
import Modal from '../components/Modal.jsx';

const EMPTY_FORM = { title: '', description: '', minutes: 0, seconds: 0, tag_ids: [] };

export default function Activities() {
  const [activities, setActivities] = useState([]);
  const [tags, setTags] = useState([]);
  const [editing, setEditing] = useState(null);
  const [tagModal, setTagModal] = useState(false);
  const [newTag, setNewTag] = useState({ name: '', color: '#38bdf8' });
  const [error, setError] = useState('');

  async function refresh() {
    const [a, g] = await Promise.all([api.listActivities(), api.listTags()]);
    setActivities(a);
    setTags(g);
  }

  useEffect(() => { refresh().catch((e) => setError(e.message)); }, []);

  function openCreate() {
    setEditing({ mode: 'create', form: { ...EMPTY_FORM } });
  }

  function openEdit(activity) {
    setEditing({
      mode: 'edit',
      id: activity.id,
      form: {
        title: activity.title,
        description: activity.description,
        minutes: Math.floor(activity.duration_seconds / 60),
        seconds: activity.duration_seconds % 60,
        tag_ids: activity.tags.map((t) => t.id),
      },
    });
  }

  async function saveActivity() {
    setError('');
    const { form } = editing;
    const duration_seconds = Number(form.minutes) * 60 + Number(form.seconds);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      duration_seconds,
      tag_ids: form.tag_ids,
    };
    if (!payload.title) { setError('Title is required'); return; }
    try {
      if (editing.mode === 'create') await api.createActivity(payload);
      else await api.updateActivity(editing.id, payload);
      setEditing(null);
      await refresh();
    } catch (e) { setError(e.message); }
  }

  async function removeActivity(id) {
    if (!confirm('Delete this activity? Tags will not be removed.')) return;
    try {
      await api.deleteActivity(id);
      await refresh();
    } catch (e) { setError(e.message); }
  }

  async function createTag() {
    setError('');
    if (!newTag.name.trim()) return;
    try {
      await api.createTag({ name: newTag.name.trim(), color: newTag.color });
      setNewTag({ name: '', color: '#38bdf8' });
      await refresh();
    } catch (e) { setError(e.message); }
  }

  async function removeTag(id) {
    if (!confirm('Delete this tag? It will be removed from any activities using it.')) return;
    try {
      await api.deleteTag(id);
      await refresh();
    } catch (e) { setError(e.message); }
  }

  function toggleTagInForm(tagId) {
    setEditing((prev) => {
      const has = prev.form.tag_ids.includes(tagId);
      return {
        ...prev,
        form: {
          ...prev.form,
          tag_ids: has ? prev.form.tag_ids.filter((id) => id !== tagId) : [...prev.form.tag_ids, tagId],
        },
      };
    });
  }

  return (
    <div>
      <div className="section-header">
        <h1>Activities</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setTagModal(true)}>Manage tags</button>
          <button className="btn" onClick={openCreate}>New activity</button>
        </div>
      </div>

      {error && <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: 12 }}>{error}</div>}

      {activities.length === 0 ? (
        <div className="card empty">No activities yet. Create one to get started.</div>
      ) : (
        <div className="list">
          {activities.map((a) => (
            <div key={a.id} className="card">
              <div className="row">
                <div className="row-main">
                  <div style={{ fontWeight: 600 }}>{a.title}</div>
                  {a.description && <div className="muted">{a.description}</div>}
                  <div className="muted" style={{ marginTop: 4 }}>
                    {formatDuration(a.duration_seconds)}
                  </div>
                  {a.tags.length > 0 && (
                    <div className="tag-row" style={{ marginTop: 8 }}>
                      {a.tags.map((t) => <TagChip key={t.id} tag={t} />)}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(a)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => removeActivity(a.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal
          title={editing.mode === 'create' ? 'New activity' : 'Edit activity'}
          onClose={() => setEditing(null)}
        >
          <div className="form">
            <div>
              <label className="label">Title</label>
              <input
                className="input"
                value={editing.form.title}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, title: e.target.value } })}
                autoFocus
              />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                className="textarea"
                value={editing.form.description}
                onChange={(e) => setEditing({ ...editing, form: { ...editing.form, description: e.target.value } })}
              />
            </div>
            <div className="form-row">
              <div>
                <label className="label">Minutes</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={editing.form.minutes}
                  onChange={(e) => setEditing({ ...editing, form: { ...editing.form, minutes: e.target.value } })}
                />
              </div>
              <div>
                <label className="label">Seconds</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="59"
                  value={editing.form.seconds}
                  onChange={(e) => setEditing({ ...editing, form: { ...editing.form, seconds: e.target.value } })}
                />
              </div>
            </div>
            <div>
              <label className="label">Tags</label>
              {tags.length === 0 ? (
                <div className="muted">No tags yet. Create one from "Manage tags".</div>
              ) : (
                <div className="tag-row">
                  {tags.map((t) => (
                    <TagChip
                      key={t.id}
                      tag={t}
                      selectable
                      selected={editing.form.tag_ids.includes(t.id)}
                      onClick={() => toggleTagInForm(t.id)}
                    />
                  ))}
                </div>
              )}
            </div>
            {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn" onClick={saveActivity}>Save</button>
            </div>
          </div>
        </Modal>
      )}

      {tagModal && (
        <Modal title="Tags" onClose={() => setTagModal(false)}>
          <div className="form">
            <div className="form-row">
              <div>
                <label className="label">Name</label>
                <input
                  className="input"
                  value={newTag.name}
                  onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Color</label>
                <input
                  className="input"
                  type="color"
                  value={newTag.color}
                  onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
                />
              </div>
            </div>
            <button className="btn" onClick={createTag}>Add tag</button>
            <div style={{ marginTop: 8 }}>
              {tags.length === 0 ? (
                <div className="muted">No tags yet.</div>
              ) : (
                <div className="list">
                  {tags.map((t) => (
                    <div key={t.id} className="row">
                      <TagChip tag={t} />
                      <button className="btn btn-danger btn-sm" onClick={() => removeTag(t.id)}>Delete</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setTagModal(false)}>Close</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
