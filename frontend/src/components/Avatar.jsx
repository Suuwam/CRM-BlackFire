// Split out of AccountPanel so pages that only render an avatar do not pull the whole
// account modal (and its api/auth/toast imports) into their bundle chunk.

const PALETTE = ['#18181b', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#059669', '#0891b2', '#4f46e5'];

export function avatarColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initialsOf(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

export function AccountAvatar({ name, photo, size = 32, onClick, title, className = '' }) {
  const style = {
    width: size,
    height: size,
    fontSize: Math.max(10, Math.round(size * 0.36)),
    background: photo ? 'var(--surface2)' : avatarColor(name),
  };
  const content = photo
    ? <img src={photo} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
    : initialsOf(name);
  if (onClick) {
    return (
      <button
        type="button"
        className={`account-avatar ${className}`.trim()}
        style={style}
        onClick={onClick}
        title={title || 'Account'}
        aria-label={title || 'Open account'}
      >
        {content}
      </button>
    );
  }
  return (
    <span className={`account-avatar ${className}`.trim()} style={style} title={title || name}>
      {content}
    </span>
  );
}
