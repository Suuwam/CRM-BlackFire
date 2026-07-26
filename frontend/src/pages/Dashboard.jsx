import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientsApi, eventsApi, tasksApi } from '../api';

export default function Dashboard() {
  const [clients, setClients]   = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [tasks, setTasks]       = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    clientsApi.list().then(r => setClients(r.data));
    eventsApi.list().then(r => {
      const today = new Date().toISOString().slice(0, 10);
      const sorted = r.data
        .filter(e => e.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 6);
      setUpcoming(sorted);
    });
    tasksApi.list().then(r => setTasks(r.data));
  }, []);

  const active   = clients.filter(c => c.status === 'Active').length;
  const prospect = clients.filter(c => c.status === 'Prospect').length;
  const inProgress = tasks.filter(t => t.column === 'inprogress').length;
  const completed = tasks.filter(t => t.column === 'done').length;

  function fmtDate(d) {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const PLATFORM_MAP = {
    linkedin:  { icon: '💼', label: 'LinkedIn' },
    instagram: { icon: '📸', label: 'Instagram' },
    facebook:  { icon: '📘', label: 'Facebook' },
    tiktok:    { icon: '🎵', label: 'TikTok' },
    x:         { icon: '𝕏', label: 'X' },
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back — here's your high-level overview.</p>
        </div>
      </div>
      <div className="page-body">
        {/* Metric Cards */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-label">Total Clients</div>
            <div className="stat-value">{clients.length}</div>
            <div className="stat-sub">{active} active · {prospect} prospects</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Upcoming Events & Posts</div>
            <div className="stat-value">{upcoming.length}</div>
            <div className="stat-sub">Next 30 days</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Tasks In Progress</div>
            <div className="stat-value">{inProgress}</div>
            <div className="stat-sub">Active workflow</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Completed Tasks</div>
            <div className="stat-value">{completed}</div>
            <div className="stat-sub">All projects</div>
          </div>
        </div>

        <div className="dash-grid">
          {/* Upcoming Schedule */}
          <div>
            <div className="section-title">Upcoming Schedule & Social Posts</div>
            <div className="upcoming-list">
              {upcoming.length === 0 && <p className="text-muted text-sm">No upcoming events scheduled.</p>}
              {upcoming.map(ev => (
                <div key={ev._id} className="upcoming-item">
                  <div className={`up-dot`} style={{ background: ev.color === 'blue' ? '#3b82f6' : ev.color === 'green' ? '#10b981' : ev.color === 'amber' ? '#f59e0b' : ev.color === 'purple' ? '#8b5cf6' : ev.color === 'red' ? '#ef4444' : ev.color === 'pink' ? '#ec4899' : '#71717a' }} />
                  <div className="up-info">
                    <div className="up-title">{ev.title}</div>
                    <div className="up-meta">
                      {ev.clientId?.name && <span>{ev.clientId.name}</span>}
                      {ev.time && <span>{ev.time}</span>}
                      {(ev.platforms || []).map(pId => (
                        <span key={pId} title={PLATFORM_MAP[pId]?.label || pId} style={{ fontSize:13 }}>
                          {PLATFORM_MAP[pId]?.icon || pId}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="up-date">{fmtDate(ev.date)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <div className="section-title">Quick Actions</div>
            <div className="quick-actions">
              <button className="quick-btn" onClick={() => nav('/clients')}>
                <span style={{ fontSize: 18 }}>👤</span> Manage Clients
              </button>
              <button className="quick-btn" onClick={() => nav('/calendar')}>
                <span style={{ fontSize: 18 }}>📅</span> Open Calendar
              </button>
              <button className="quick-btn" onClick={() => nav('/board')}>
                <span style={{ fontSize: 18 }}>📋</span> Aawazz Project Board
              </button>
              <button className="quick-btn" onClick={() => nav('/email')}>
                <span style={{ fontSize: 18 }}>✉️</span> Email Automation
              </button>
              <button className="quick-btn" onClick={() => nav('/references')}>
                <span style={{ fontSize: 18 }}>🔗</span> Reference Links
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
