import { useEffect, useMemo, useState } from 'react';
import { api, formatDuration } from '../api.js';
import TagChip from '../components/TagChip.jsx';
import Modal from '../components/Modal.jsx';

const EMPTY_FORM = { title: '', description: '', minutes: 0, seconds: 0, tag_ids: [] };

const SORT_OPTIONS = [
  { value: 'alpha-asc', label: 'A to Z' },
  { value: 'alpha-desc', label: 'Z to A' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'dur-asc', label: 'Shortest' },
  { value: 'dur-desc', label: 'Longest' },
];

export default function Activities() {
  const [activities, setActivities] = useState([]);
  const [tags, setTags] = useState([]);
  const [editing, setEditing] = useState(null);
  const [tagModal, setTagModal] = useState(false);
  const [newTag, setNewTag] = useState({ name: '', color: '#38bdf8' });
  const [error, setError] = useState('');

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('alpha-asc');
  const [selectedTagIds, setSelectedTagIds] = useState([]);

  async function refresh() {
    const [a, g] = await Promise.all([api.listActivities(), api.listTags()]);
    setActivities(a);
    setTags(g);
  }

  useEffect(() => { refresh().catch((e) => setError(e.message)); }, []);

  useEffect(() => {
    setSelectedTagIds((prev) => prev.filter((id) => tags.some((t) => t.id === id)));
  }, [tags]);

  const view = useMemo(() => {
    let list = activities;

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.tags.some((t) => t.name.toLowerCase().includes(q))
      );
    }

    if (selectedTagIds.length > 0) {
      list = list.filter((a) => a.tags.some((t) => selectedTagIds.includes(t.id)));
    }

    const sorted = [...list];
    switch (sortBy) {
      case 'alpha-asc':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'alpha-desc':
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'newest':
        sorted.sort((a, b) => b.id - a.id);
        break;
      case 'oldest':
        sorted.sort((a, b) => a.id - b.id);
        break;
      case 'dur-asc':
        sorted.sort((a, b) => a.duration_seconds - b.duration_seconds);
        break;
      case 'dur-desc':
        sorted.sort((a, b) => b.duration_seconds - a.duration_seconds);
        break;
      default:
        break;
    }

    const isAlpha = sortBy === 'alpha-asc' || sortBy === 'alpha-desc';
    if (isAlpha) {
      const groups = new Map();
      for (const a of sorted) {
        const first = (a.title.trim()[0] || '#').toUpperCase();
        const key = /[A-Z]/.test(first) ? first : '#';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(a);
      }
      return { grouped: true, groups: [...groups.entries()] };
    }
    return { grouped: false, items: sorted };
  }, [activities, search, sortBy, selectedTagIds]);

  const filtersActive = search.trim() !== '' || selectedTagIds.length > 0;
  const totalShown = view.grouped
    ? view.groups.reduce((acc, [, items]) => acc + items.length, 0)
    : view.items.length;

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

  function toggleFilterTag(id) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div>
      <div className="section-header">
        <h1>Activities</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className={`icon-btn ${filtersActive ? 'has-dot' : ''}`}
            aria-label={filtersOpen ? 'Hide filters' : 'Show filters'}
            aria-pressed={filtersOpen}
            onClick={() => setFiltersOpen((v) => !v)}
            title={filtersOpen ? 'Hide filters' : 'Show filters'}
          >
            <FilterIcon crossed={!filtersOpen} />
          </button>
          <button className="btn btn-ghost" onClick={() => setTagModal(true)}>Manage tags</button>
          <button className="btn" onClick={openCreate}>New activity</button>
        </div>
      </div>

      {error && <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: 12 }}>{error}</div>}

      {filtersOpen && (
        <div className="card filter-card">
          <div className="filter-top">
            <input
              className="input"
              placeholder="Search activities by name or tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="input"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {tags.length > 0 && (
            <div className="filter-tags">
              <div className="filter-tags-head">
                <button
                  className="collapse-btn"
                  onClick={() => setTagsOpen((v) => !v)}
                  aria-expanded={tagsOpen}
                >
                  <span style={{ fontWeight: 600 }}>Tags</span>
                  <span className="chevron" aria-hidden>{tagsOpen ? '⌄' : '›'}</span>
                </button>
                {selectedTagIds.length > 0 && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedTagIds([])}>
                    Clear
                  </button>
                )}
              </div>
              {tagsOpen && (
                <div className="tag-row" style={{ marginTop: 10 }}>
                  {tags.map((t) => (
                    <TagChip
                      key={t.id}
                      tag={t}
                      selectable
                      selected={selectedTagIds.includes(t.id)}
                      onClick={() => toggleFilterTag(t.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activities.length === 0 ? (
        <div className="card empty">No activities yet. Create one to get started.</div>
      ) : totalShown === 0 ? (
        <div className="card empty">No activities match your filters.</div>
      ) : view.grouped ? (
        <div className="list">
          {view.groups.map(([letter, items]) => (
            <div key={letter} className="letter-group">
              <div className="letter-header">{letter}</div>
              <div className="list">
                {items.map((a) => (
                  <ActivityCard key={a.id} activity={a} onEdit={openEdit} onDelete={removeActivity} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="list">
          {view.items.map((a) => (
            <ActivityCard key={a.id} activity={a} onEdit={openEdit} onDelete={removeActivity} />
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

function ActivityCard({ activity, onEdit, onDelete }) {
  return (
    <div className="card">
      <div className="row">
        <div className="row-main">
          <div style={{ fontWeight: 600 }}>{activity.title}</div>
          {activity.description && <div className="muted">{activity.description}</div>}
          <div className="muted" style={{ marginTop: 4 }}>{formatDuration(activity.duration_seconds)}</div>
          {activity.tags.length > 0 && (
            <div className="tag-row" style={{ marginTop: 8 }}>
              {activity.tags.map((t) => <TagChip key={t.id} tag={t} />)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onEdit(activity)}>Edit</button>
          <button className="btn btn-danger btn-sm" onClick={() => onDelete(activity.id)}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function FilterIcon({ crossed }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="14" y2="12" />
      <line x1="4" y1="18" x2="8" y2="18" />
      {crossed && <line x1="3" y1="21" x2="21" y2="3" />}
    </svg>
  );
}
