import { NavLink, useNavigate } from 'react-router-dom';

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

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="name">Blackfire × Aawazz</div>
        <div className="sub">Internal CRM</div>
        <span className="sb-badge">CRM</span>
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

        <div className="sb-section" style={{ marginTop: 8 }}>Projects</div>
        {boardNav.map(n => (
          <NavLink key={n.to} to={n.to}
            className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}>
            <span className="ico">{n.ico}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>

      <div className="sb-footer">
        <button onClick={() => window.open('https://cloud.mongodb.com', '_blank')}>
          <span>🛢</span> MongoDB Atlas
        </button>
      </div>
    </aside>
  );
}
