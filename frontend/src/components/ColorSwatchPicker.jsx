export default function ColorSwatchPicker({ value, onChange, presets, ariaLabel = 'Color' }) {
  const lower = (value || '').toLowerCase();
  const isPreset = presets.includes(lower);
  return (
    <div className="color-swatches" role="radiogroup" aria-label={ariaLabel}>
      {presets.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={lower === c}
          className={`color-swatch ${lower === c ? 'selected' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={`Color ${c}`}
        />
      ))}
      <label
        className={`color-swatch color-swatch-custom ${isPreset ? '' : 'selected'}`}
        aria-label="Custom color"
      >
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}
