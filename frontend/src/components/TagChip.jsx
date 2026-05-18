export default function TagChip({ tag, selectable = false, selected = false, onClick }) {
  return (
    <span
      className={`tag-chip ${selectable ? 'selectable' : ''} ${selected ? 'selected' : ''}`}
      style={{ background: tag.color }}
      onClick={onClick}
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
    >
      {tag.name}
    </span>
  );
}
