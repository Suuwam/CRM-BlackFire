import { NavLink } from 'react-router-dom';

const nav = [
  { to: '/dashboard',  label: 'Dashboard',   ico: '⬚' },
  { to: '/clients',    label: 'Clients',      ico: '👤' },
  { to: '/calendar',   label: 'Calendar',     ico: '📅' },
  { to: '/email',      label: 'Email',        ico: '✉️' },
  { to: '/references', label: 'References',   ico: '🔗' },
];

const boardNav = [
  { to: '/board', label: 'Project Board',  ico: '📋' },
];

export default function Sidebar({ onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="name">Blackfire AI</div>
        <div className="sub">Venture & Product Engine</div>
        <span className="sb-badge">Platform</span>
      </div>

      <nav className="sb-nav">
        <div className="sb-section">Workspace</div>
        {nav.map(n => (
          <NavLink key={n.to} to={n.to}
            className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}>
            <span className="ico">{n.ico}</span>
            {n.label}
          </NavLink>
        ))}

        <div className="sb-section" style={{ marginTop: 8 }}>Products</div>
        {boardNav.map(n => (
          <NavLink key={n.to} to={n.to}
            className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}>
            <span className="ico">{n.ico}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>

      <div className="sb-footer" style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <button onClick={() => window.open('https://cloud.mongodb.com', '_blank')}>
          <span>🛢</span> MongoDB Atlas
        </button>
        {onLogout && (
          <button onClick={onLogout} style={{ color: '#ef4444' }}>
            <span>🔒</span> Lock Access
          </button>
        )}
      </div>
    </aside>
  );
}
