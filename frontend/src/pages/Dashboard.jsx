import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientsApi, eventsApi, tasksApi } from '../api';

export default function Dashboard() {
  const [clients, setClients]   = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [aawazzTasks, setAawazzTasks] = useState([]);
  const [bfTasks, setBfTasks] = useState([]);
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
    tasksApi.list('aawazz').then(r => setAawazzTasks(r.data));
    tasksApi.list('blackfire').then(r => setBfTasks(r.data));
  }, []);

  const active   = clients.filter(c => c.status === 'Active').length;
  const prospect = clients.filter(c => c.status === 'Prospect').length;

  const aawazzDone = aawazzTasks.filter(t => t.column === 'done').length;
  const aawazzInProgress = aawazzTasks.filter(t => t.column === 'inprogress').length;
  const bfDone = bfTasks.filter(t => t.column === 'done').length;

  function fmtDate(d) {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Upcoming posts with platform icons
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
          <h1>Project Dashboard</h1>
          <p>Blackfire AI & Aawazz — at a glance</p>
        </div>
      </div>
      <div className="page-body">

        {/* Aawazz Hero Banner */}
        <div className="aawazz-banner" style={{ marginBottom: 24 }}>
          <div>
            <div className="aawazz-logo-wrap">
              <span className="aawazz-logo-text">
                aa
                <svg className="aawazz-wave-svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M 10 50 Q 30 10 50 50 T 90 50" />
                </svg>
                wazz
              </span>
              <span className="aawazz-badge">SaaS Product</span>
            </div>
            <div className="aawazz-slogan">
              Say it your way, <span className="aawazz-highlight">script to sound</span> made for creators.
            </div>
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <button className="btn btn-sm" onClick={() => nav('/board')}
              style={{ background:'rgba(59,130,246,0.2)', color:'#93c5fd', border:'1px solid rgba(59,130,246,0.4)', fontWeight:700 }}>
              Open Board →
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card" style={{ borderTop: '3px solid #2563eb' }}>
            <div className="stat-label" style={{ color: '#2563eb' }}>Aawazz Tasks</div>
            <div className="stat-value">{aawazzTasks.length}</div>
            <div className="stat-sub">{aawazzInProgress} in progress · {aawazzDone} done</div>
          </div>
          <div className="stat-card" style={{ borderTop: '3px solid #18181b' }}>
            <div className="stat-label">Blackfire Tasks</div>
            <div className="stat-value">{bfTasks.length}</div>
            <div className="stat-sub">{bfDone} completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active Clients</div>
            <div className="stat-value">{active}</div>
            <div className="stat-sub">{prospect} prospects</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Upcoming Posts</div>
            <div className="stat-value">{upcoming.length}</div>
            <div className="stat-sub">Next 30 days</div>
          </div>
        </div>

        <div className="dash-grid">
          {/* Upcoming Schedule */}
          <div>
            <div className="section-title">Upcoming Schedule & Posts</div>
            <div className="upcoming-list">
              {upcoming.length === 0 && <p className="text-muted text-sm">No upcoming events or posts.</p>}
              {upcoming.map(ev => (
                <div key={ev._id} className="upcoming-item">
                  <div className={`up-dot`} style={{ background: ev.color === 'blue' ? '#3b82f6' : ev.color === 'green' ? '#10b981' : ev.color === 'amber' ? '#f59e0b' : ev.color === 'purple' ? '#8b5cf6' : ev.color === 'red' ? '#ef4444' : ev.color === 'pink' ? '#ec4899' : '#71717a' }} />
                  <div className="up-info">
                    <div className="up-title">{ev.title}</div>
                    <div className="up-meta">
                      {ev.clientId?.name && <span>{ev.clientId.name}</span>}
                      {ev.time && <span>{ev.time}</span>}
                      {/* Platform icons */}
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
              <button className="quick-btn" onClick={() => nav('/board')} style={{ borderLeft: '3px solid #2563eb' }}>
                <span style={{ fontSize: 18 }}>🎵</span> Aawazz Board
              </button>
              <button className="quick-btn" onClick={() => nav('/calendar')}>
                <span style={{ fontSize: 18 }}>📅</span> Content Calendar
              </button>
              <button className="quick-btn" onClick={() => nav('/clients')}>
                <span style={{ fontSize: 18 }}>👤</span> Client Management
              </button>
              <button className="quick-btn" onClick={() => nav('/email')}>
                <span style={{ fontSize: 18 }}>✉️</span> Email Automation
              </button>
              <button className="quick-btn" onClick={() => nav('/references')}>
                <span style={{ fontSize: 18 }}>🔗</span> Reference Library
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
