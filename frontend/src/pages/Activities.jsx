import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, formatDuration } from '../api.js';
import { smoothUpdate } from '../viewTransition.js';
import { useToast } from '../toast.jsx';
import TagChip from '../components/TagChip.jsx';
import Modal from '../components/Modal.jsx';
import ContextMenu from '../components/ContextMenu.jsx';
import ActivityFormModal from '../components/ActivityFormModal.jsx';
import ColorSwatchPicker from '../components/ColorSwatchPicker.jsx';
import FilterPanel from '../components/FilterPanel.jsx';
import { getRecentTagColors, recordRecentTagColor } from '../recentColors.js';
import { MdAdd, MdExpandMore, MdExpandLess, MdFilterList, MdFilterListOff } from "react-icons/md";

const TAG_COLOR_PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#22c55e', '#14b8a6', '#38bdf8', '#6366f1',
  '#a855f7', '#ec4899',
];

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
  const toast = useToast();
  const [activities, setActivities] = useState([]);
  const [tags, setTags] = useState([]);
  const [editing, setEditing] = useState(null);
  const [tagModal, setTagModal] = useState(false);
  const [newTag, setNewTag] = useState({ name: '', color: '#38bdf8' });
  const [recentColors, setRecentColors] = useState(() => getRecentTagColors());
  const [error, setError] = useState('');

  const [tagsOpen, setTagsOpen] = useState(true);

  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(() => {
    const q = searchParams.get('q') || '';
    const tagsParam = searchParams.get('tags') || '';
    return q !== '' || tagsParam !== '';
  });
  const search = searchParams.get('q') || '';
  const sortBy = searchParams.get('sort') || 'alpha-asc';
  const selectedTagIds = useMemo(() => {
    const raw = searchParams.get('tags');
    if (!raw) return [];
    return raw.split(',').filter(Boolean);
  }, [searchParams]);

  function updateParams(updates, { replace = false } = {}) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(updates)) {
          if (v == null || v === '') next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace },
    );
  }
  const setSearch = (v) => updateParams({ q: v || null }, { replace: true });
  const setSortBy = (v) => updateParams({ sort: v === 'alpha-asc' ? null : v });
  function setSelectedTagIds(updater) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const raw = next.get('tags');
      const current = raw ? raw.split(',').filter(Boolean) : [];
      const updated = typeof updater === 'function' ? updater(current) : updater;
      if (updated.length > 0) next.set('tags', updated.join(','));
      else next.delete('tags');
      return next;
    });
  }

  async function refresh() {
    const [a, g] = await Promise.all([api.listActivities(), api.listTags()]);
    setActivities(a);
    setTags(g);
  }

  useEffect(() => { refresh().catch((e) => setError(e.message)); }, []);

  const tagsInitializedRef = useRef(false);
  useEffect(() => {
    if (!tagsInitializedRef.current) {
      if (tags.length === 0) return;
      tagsInitializedRef.current = true;
    }
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

  const sortedTags = useMemo(
    () => [...tags].sort((a, b) => a.name.localeCompare(b.name)),
    [tags]
  );

  const orderedTags = useMemo(() => {
    const selectedSet = new Set(selectedTagIds);
    const selected = [];
    const unselected = [];
    for (const t of tags) {
      (selectedSet.has(t.id) ? selected : unselected).push(t);
    }
    return [...selected, ...unselected];
  }, [tags, selectedTagIds]);

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

  async function saveActivity(payload) {
    const wasCreate = editing.mode === 'create';
    if (wasCreate) await api.createActivity(payload);
    else await api.updateActivity(editing.id, payload);
    setEditing(null);
    await refresh();
    toast.success(wasCreate ? `Created "${payload.title}"` : `Updated "${payload.title}"`);
  }

  async function removeActivity(id) {
    if (!confirm('Delete this activity? Tags will not be removed.')) return;
    const removed = activities.find((a) => a.id === id);
    try {
      await api.deleteActivity(id);
      await refresh();
      toast.success(removed ? `Deleted "${removed.title}"` : 'Activity deleted');
    } catch (e) {
      setError(e.message);
      toast.error(e.message);
    }
  }

  async function createTag() {
    setError('');
    if (!newTag.name.trim()) return;
    const name = newTag.name.trim();
    const usedColor = newTag.color;
    try {
      await api.createTag({ name, color: usedColor });
      recordRecentTagColor(usedColor);
      setRecentColors(getRecentTagColors());
      setNewTag({ name: '', color: '#38bdf8' });
      await refresh();
      toast.success(`Created tag "${name}"`);
    } catch (e) {
      setError(e.message);
      toast.error(e.message);
    }
  }

  async function removeTag(id) {
    if (!confirm('Delete this tag? It will be removed from any activities using it.')) return;
    const removed = tags.find((t) => t.id === id);
    try {
      await api.deleteTag(id);
      await refresh();
      toast.success(removed ? `Deleted tag "${removed.name}"` : 'Tag deleted');
    } catch (e) {
      setError(e.message);
      toast.error(e.message);
    }
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
            {filtersOpen ? <MdFilterList /> : <MdFilterListOff />}
          </button>
          <ContextMenu
            icon={<MdAdd size={20} aria-hidden />}
            label="Add"
            items={[
              { label: 'New activity', onClick: openCreate },
              { label: 'New tag', onClick: () => setTagModal(true) },
            ]}
          />
        </div>
      </div>
      {filtersOpen && (
        <FilterPanel
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search activities by name or tag…"
          tags={orderedTags}
          selectedTagIds={selectedTagIds}
          onToggleTag={toggleFilterTag}
        />
      )}

      {error && <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: 12 }}>{error}</div>}

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
        <ActivityFormModal
          title={editing.mode === 'create' ? 'New activity' : 'Edit activity'}
          initialValues={editing.form}
          tags={tags}
          onClose={() => setEditing(null)}
          onSave={saveActivity}
          onOpenTagManager={() => setTagModal(true)}
        />
      )}

      {tagModal && (
        <Modal title="Tags" onClose={() => setTagModal(false)}>
          <div className="form">
            <div className="form-row">
              <div style={{ flex: 1 }}>
                <label className="label">Name</label>
                <form
                  onSubmit={(e) => { e.preventDefault(); createTag(); }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="input"
                      value={newTag.name}
                      onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                      autoFocus
                      placeholder="Tag name"
                    />
                    <button
                      type="submit"
                      className="icon-btn"
                      aria-label="Add tag"
                      style={{ background: newTag.color, color: '#fff', borderColor: newTag.color }}
                    >
                      <MdAdd />
                    </button>
                  </div>
                  <ColorSwatchPicker
                    value={newTag.color}
                    onChange={(c) => setNewTag({ ...newTag, color: c })}
                    presets={[
                      ...recentColors,
                      ...TAG_COLOR_PRESETS.filter((c) => !recentColors.includes(c)),
                    ]}
                  />
                </form>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              {tags.length === 0 ? (
                <div className="muted">No tags yet.</div>
              ) : (
                <div className="tag-row wrap">
                  {sortedTags.map((t) => (
                    <TagChip key={t.id} tag={t} onRemove={() => removeTag(t.id)} />
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

const MAX_VISIBLE_CARD_TAGS = 2;

function ActivityCard({ activity, onEdit, onDelete }) {
  const [showAll, setShowAll] = useState(false);
  const total = activity.tags.length;
  const hasMore = total > MAX_VISIBLE_CARD_TAGS;
  const visible = showAll || !hasMore
    ? activity.tags
    : activity.tags.slice(0, MAX_VISIBLE_CARD_TAGS);
  const hiddenCount = total - MAX_VISIBLE_CARD_TAGS;

  const cardRef = useRef(null);
  function focusCard() {
    if (!cardRef.current) return;
    const topbar = document.querySelector('.topbar');
    const offset = (topbar?.offsetHeight ?? 0) + 8;
    const rect = cardRef.current.getBoundingClientRect();
    window.scrollTo({
      top: window.scrollY + rect.top - offset,
      behavior: 'smooth',
    });
  }

  return (
    <div ref={cardRef} className="card">
      <div className="row">
        <div className="row-main">
          <div className={`activity-card-head ${showAll ? 'wrap' : ''}`}>
            <span className="activity-card-title">{activity.title}</span>
            {visible.map((t) => <TagChip key={t.id} tag={t} />)}
            {hasMore && (
              <button
                type="button"
                className="tag-chip tag-chip-more"
                onClick={() => smoothUpdate(() => setShowAll((v) => !v))}
                aria-expanded={showAll}
                aria-label={showAll ? 'Show fewer tags' : `Show ${hiddenCount} more tags`}
              >
                {showAll ? 'less' : `+${hiddenCount}`}
              </button>
            )}
          </div>
          {activity.description && <div className="muted">{activity.description}</div>}
          <div className="muted" style={{ marginTop: 4 }}>{formatDuration(activity.duration_seconds)}</div>
        </div>
        <ContextMenu
          items={[
            { label: 'Edit', onClick: () => onEdit(activity) },
            { label: 'Delete', danger: true, onClick: () => onDelete(activity.id) },
          ]}
          onOpen={focusCard}
        />
      </div>
    </div>
  );
}
