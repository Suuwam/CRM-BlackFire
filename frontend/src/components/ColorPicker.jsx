import { useEffect, useRef, useState } from 'react';

// One colour picker for tasks, events, boards, websites and the calendar: the preset swatches,
// plus a rainbow swatch that opens an in-app panel (shade grid + hex box) for any other colour.
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

function hslHex(h, sat, l) {
  sat /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const f = n => l - sat * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
// 18 hues × 5 shades, then a grey ramp: enough to find "that" colour without a gradient field.
const SHADES = [80, 66, 54, 42, 30];
const GRID = [
  ...SHADES.map(l => Array.from({ length: 18 }, (_, i) => hslHex(i * 20, l > 70 ? 70 : 78, l))),
  Array.from({ length: 18 }, (_, i) => hslHex(0, 0, Math.round(98 - i * (94 / 17)))),
];

/** Readable text colour (black or white) on top of `hex`. */
export function inkOn(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hexOf(hex).slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#111111' : '#ffffff';
}

function ColorPanel({ value, onPick, onClose }) {
  const ref = useRef(null);
  const [draft, setDraft] = useState(hexOf(value));
  useEffect(() => {
    const away = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const esc = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [onClose]);
  const typed = draft.startsWith('#') ? draft : `#${draft}`;
  const ok = isHex(typed);
  return (
    <div className="color-panel" ref={ref} role="dialog" aria-label="Pick a colour">
      <div className="color-panel-grid">
        {GRID.flat().map(c => (
          <button key={c} type="button" className={`color-panel-cell${hexOf(value) === c ? ' on' : ''}`} style={{ background: c }} title={c}
            onClick={() => { onPick(c); onClose(); }} />
        ))}
      </div>
      <div className="color-panel-foot">
        <span className="color-panel-preview" style={{ background: ok ? typed : 'transparent' }} />
        <input value={draft} maxLength={7} spellCheck={false} aria-label="Hex colour"
          onChange={e => setDraft(e.target.value.trim())}
          onKeyDown={e => { if (e.key === 'Enter' && ok) { e.preventDefault(); onPick(typed.toLowerCase()); onClose(); } }} />
        <button type="button" className="btn btn-sm btn-primary" disabled={!ok} onClick={() => { onPick(typed.toLowerCase()); onClose(); }}>Use</button>
      </div>
    </div>
  );
}

/**
 * value: a preset id or a hex. onChange gets a preset id for a swatch (what tasks and events
 * have always stored) or a hex for a custom colour; with `hex` it always gets a hex.
 */
export default function ColorPicker({ value, onChange, hex = false }) {
  const [open, setOpen] = useState(false);
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
      <span className="color-custom-wrap">
        <button type="button" className={`color-dot-opt color-dot-custom${custom ? ' selected' : ''}`} title="More colours"
          aria-label="More colours" aria-expanded={open} style={custom ? { background: current } : undefined}
          onClick={() => setOpen(o => !o)} />
        {open && <ColorPanel value={current} onPick={onChange} onClose={() => setOpen(false)} />}
      </span>
    </div>
  );
}
