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
  return (
    <div className="filter-panel">
      <input
        type="search"
        className="input input-search"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        autoFocus={autoFocus}
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
