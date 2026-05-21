import { useEffect, useRef } from 'react';
import TagChip from './TagChip.jsx';

export default function FilterPanel({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  tags = [],
  selectedTagIds = [],
  onToggleTag,
  autoFocus = true,
}) {
  const inputRef = useRef(null);
  useEffect(() => {
    if (!autoFocus) return;
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches) return;
    inputRef.current?.focus();
  }, []);

  return (
    <div className="filter-panel">
      <input
        ref={inputRef}
        type="search"
        className="input input-search"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      {tags.length > 0 && (
        <div className="tag-row filter-panel-tags">
          {tags.map((t) => (
            <TagChip
              key={t.id}
              tag={t}
              selectable
              selected={selectedTagIds.includes(t.id)}
              onClick={() => onToggleTag?.(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
