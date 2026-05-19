export default function TagChip({
  tag,
  selectable = false,
  selected = false,
  onClick,
  onRemove,
}) {
  const classes = [
    'tag-chip',
    selectable && 'selectable',
    selected && 'selected',
    onRemove && 'removable',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={classes}
      style={{ background: tag.color }}
      onClick={onClick}
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          className="tag-remove"
          aria-label={`Remove ${tag.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}
