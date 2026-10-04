// One colour picker for tasks, events, boards and feedback websites: the preset swatches,
// plus a rainbow swatch that opens the system picker for any other colour.
export const PALETTE = [
  { id: 'blue', hex: '#3b82f6' }, { id: 'purple', hex: '#8b5cf6' }, { id: 'pink', hex: '#ec4899' },
  { id: 'green', hex: '#10b981' }, { id: 'amber', hex: '#f59e0b' }, { id: 'red', hex: '#ef4444' },
  { id: 'teal', hex: '#06b6d4' }, { id: 'gray', hex: '#71717a' }, { id: 'indigo', hex: '#6366f1' },
  { id: 'sky', hex: '#0ea5e9' }, { id: 'lime', hex: '#84cc16' }, { id: 'orange', hex: '#f97316' },
  { id: 'rose', hex: '#f43f5e' }, { id: 'fuchsia', hex: '#d946ef' }, { id: 'yellow', hex: '#eab308' },
  { id: 'black', hex: '#18181b' },
];

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (v) => HEX.test(String(v || ''));

/** A stored colour (a preset id like "blue", or "#rrggbb") as a hex string. */
export const hexOf = (v, fallback = '#3b82f6') => (isHex(v) ? v.toLowerCase() : PALETTE.find(c => c.id === v)?.hex || fallback);

/**
 * value: a preset id or a hex. onChange gets a preset id for a swatch (what tasks and events
 * have always stored) or a hex for a custom colour; with `hex` it always gets a hex.
 */
export default function ColorPicker({ value, onChange, hex = false }) {
  const current = hexOf(value);
  const preset = PALETTE.find(c => c.hex === current);
  const custom = !preset;
  return (
    <div className="color-picker-row">
      {PALETTE.map(c => (
        <button type="button" key={c.id} aria-label={c.id} title={c.id}
          className={`color-dot-opt${preset?.id === c.id ? ' selected' : ''}`}
          style={{ background: c.hex }}
          onClick={() => onChange(hex ? c.hex : c.id)} />
      ))}
      <label className={`color-dot-opt color-dot-custom${custom ? ' selected' : ''}`} title="Any colour"
        style={custom ? { background: current } : undefined}>
        <input type="color" value={current} onChange={e => onChange(e.target.value)} aria-label="Pick any colour" />
      </label>
    </div>
  );
}
