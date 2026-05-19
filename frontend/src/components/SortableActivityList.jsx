import { useEffect, useRef, useState } from 'react';
import { MdDragHandle } from 'react-icons/md';
import { formatDuration } from '../api.js';
import ContextMenu from './ContextMenu.jsx';

export default function SortableActivityList({
  items,
  onReorder,
  onRemove,
  onDuplicate,
  onDurationChange,
  onSaveAsActivity,
}) {
  const [draggingId, setDraggingId] = useState(null);

  useEffect(() => {
    if (draggingId == null) return;

    function move(e) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const target = el?.closest('[data-sortable-id]');
      if (!target) return;
      const targetId = target.dataset.sortableId;
      if (!targetId || targetId === String(draggingId)) return;
      onReorder(draggingId, targetId);
    }
    function stop() {
      setDraggingId(null);
    }

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', stop);
    document.addEventListener('pointercancel', stop);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', stop);
      document.removeEventListener('pointercancel', stop);
    };
  }, [draggingId, onReorder]);

  return (
    <div className="sortable">
      {items.map((a) => {
        const menuItems = [];
        if (a.is_inline && onSaveAsActivity) {
          menuItems.push({ label: 'Save as Activity', onClick: () => onSaveAsActivity(a.id) });
        }
        if (onDuplicate) {
          menuItems.push({ label: 'Duplicate', onClick: () => onDuplicate(a.id) });
        }
        if (onRemove) {
          menuItems.push({ label: 'Remove', danger: true, onClick: () => onRemove(a.id) });
        }
        return (
          <SortableItem
            key={a.id}
            a={a}
            dragging={draggingId === a.id}
            onStartDrag={() => setDraggingId(a.id)}
            menuItems={menuItems}
            onDurationChange={onDurationChange}
          />
        );
      })}
    </div>
  );
}

function SortableItem({ a, dragging, onStartDrag, menuItems, onDurationChange }) {
  const itemRef = useRef(null);

  function focusItem() {
    itemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div
      ref={itemRef}
      data-sortable-id={a.id}
      className={`sortable-item ${dragging ? 'dragging' : ''}`}
    >
      <button
        type="button"
        className="drag-handle"
        aria-label="Drag to reorder"
        onPointerDown={(e) => {
          e.preventDefault();
          onStartDrag();
        }}
      >
        <MdDragHandle size={18} aria-hidden />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, overflowWrap: 'anywhere' }}>
          {a.title}
        </div>
        {!onDurationChange && (
          <div className="muted">{formatDuration(a.duration_seconds)}</div>
        )}
      </div>
      {onDurationChange && (
        <DurationInput
          seconds={a.duration_seconds}
          onChange={(sec) => onDurationChange(a.id, sec)}
          onFocus={focusItem}
        />
      )}
      {menuItems.length > 0 && <ContextMenu items={menuItems} onOpen={focusItem} />}
    </div>
  );
}

function DurationInput({ seconds, onChange, onFocus }) {
  const m = Math.floor((seconds || 0) / 60);
  const s = (seconds || 0) % 60;

  function update(nextM, nextS) {
    const safeM = Math.max(0, Number(nextM) || 0);
    const safeS = Math.max(0, Math.min(59, Number(nextS) || 0));
    onChange(safeM * 60 + safeS);
  }

  return (
    <div className="dur-input-group" onPointerDown={(e) => e.stopPropagation()}>
      <input
        type="number"
        min="0"
        className="input dur-input"
        value={m}
        onChange={(e) => update(e.target.value, s)}
        onFocus={onFocus}
        aria-label="Minutes"
      />
      <span className="dur-sep">:</span>
      <input
        type="number"
        min="0"
        max="59"
        className="input dur-input"
        value={String(s).padStart(2, '0')}
        onChange={(e) => update(m, e.target.value)}
        onFocus={onFocus}
        aria-label="Seconds"
      />
    </div>
  );
}
