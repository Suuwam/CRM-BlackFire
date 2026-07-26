import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { fetcher } from '../api';
import SocialIcon from '../components/SocialIcon';

export default function Dashboard() {
  const nav = useNavigate();

  const { data: clients = [] } = useSWR('/clients', fetcher, { revalidateOnFocus: false });
  const { data: allEvents = [] } = useSWR('/events', fetcher, { revalidateOnFocus: false });
  const { data: tasks = [] } = useSWR('/tasks', fetcher, { revalidateOnFocus: false });

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = allEvents
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  const active   = clients.filter(c => c.status === 'Active').length;
  const prospect = clients.filter(c => c.status === 'Prospect').length;
  const inProgress = tasks.filter(t => t.column === 'inprogress').length;
  const completed = tasks.filter(t => t.column === 'done').length;

  function fmtDate(d) {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Blackfire AI — Product Platform & Venture Engine Overview</p>
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
            <div className="stat-label">Upcoming Schedule & Posts</div>
            <div className="stat-value">{upcoming.length}</div>
            <div className="stat-sub">Next 30 days</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Product Tasks In Progress</div>
            <div className="stat-value">{inProgress}</div>
            <div className="stat-sub">Active workflow</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Completed Features</div>
            <div className="stat-value">{completed}</div>
            <div className="stat-sub">All products</div>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
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
                      {/* Official SVG Vector Icons */}
                      {(ev.platforms || []).map(pId => (
                        <span key={pId} style={{ display:'inline-flex', alignItems:'center', marginLeft:4 }} title={pId}>
                          <SocialIcon id={pId} size={12} />
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="up-date">{fmtDate(ev.date)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
