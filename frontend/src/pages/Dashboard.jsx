import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientsApi, eventsApi } from '../api';

export default function Dashboard() {
  const [clients, setClients]   = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    clientsApi.list().then(r => setClients(r.data));
    const today = new Date().toISOString().slice(0, 10);
    eventsApi.list().then(r => {
      const sorted = r.data
        .filter(e => e.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 6);
      setUpcoming(sorted);
    });
  }, []);

  const active   = clients.filter(c => c.status === 'Active').length;
  const prospect = clients.filter(c => c.status === 'Prospect').length;

  function fmtDate(d) {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Good to see you — here's what's happening today.</p>
        </div>
      </div>
      <div className="page-body">
        <div className="stats-grid" style={{ marginBottom: 22 }}>
          <div className="stat-card">
            <div className="stat-label">Total Clients</div>
            <div className="stat-value">{clients.length}</div>
            <div className="stat-sub">All time</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active</div>
            <div className="stat-value">{active}</div>
            <div className="stat-sub">Current projects</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Prospects</div>
            <div className="stat-value">{prospect}</div>
            <div className="stat-sub">Pipeline</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Upcoming Events</div>
            <div className="stat-value">{upcoming.length}</div>
            <div className="stat-sub">Next 30 days</div>
          </div>
        </div>

        <div className="dash-grid">
          <div>
            <div className="section-title">Upcoming Schedule</div>
            <div className="upcoming-list">
              {upcoming.length === 0 && <p className="text-muted text-sm">No upcoming events.</p>}
              {upcoming.map(ev => (
                <div key={ev._id} className="upcoming-item">
                  <div className={`up-dot ${ev.color}`} />
                  <div className="up-info">
                    <div className="up-title">{ev.title}</div>
                    <div className="up-meta">
                      {ev.clientId?.name && <span>{ev.clientId.name}</span>}
                      {ev.time && <span>{ev.time}</span>}
                    </div>
                  </div>
                  <div className="up-date">{fmtDate(ev.date)}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="section-title">Quick Actions</div>
            <div className="quick-actions">
              <button className="quick-btn" onClick={() => nav('/clients')}>
                <span style={{ fontSize: 18 }}>👤</span> Add New Client
              </button>
              <button className="quick-btn" onClick={() => nav('/calendar')}>
                <span style={{ fontSize: 18 }}>📅</span> Schedule Event
              </button>
              <button className="quick-btn" onClick={() => nav('/email')}>
                <span style={{ fontSize: 18 }}>✉️</span> Compose Email
              </button>
              <button className="quick-btn" onClick={() => nav('/board')}>
                <span style={{ fontSize: 18 }}>📋</span> View Project Board
              </button>
              <button className="quick-btn" onClick={() => nav('/references')}>
                <span style={{ fontSize: 18 }}>🔗</span> Add Reference Link
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
