import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { fetcher } from '../api';
import SocialIcon from '../components/SocialIcon';

// Helper to calculate Donut Arc paths
function getDonutPath(cx, cy, radius, innerRadius, startAngle, endAngle) {
  const angleDiff = endAngle - startAngle;
  if (angleDiff <= 0) return '';
  const effectiveEnd = angleDiff >= 359.99 ? startAngle + 359.99 : endAngle;
  
  const startRad = (startAngle - 90) * (Math.PI / 180);
  const endRad = (effectiveEnd - 90) * (Math.PI / 180);
  
  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy + radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy + radius * Math.sin(endRad);
  
  const x3 = cx + innerRadius * Math.cos(endRad);
  const y3 = cy + innerRadius * Math.sin(endRad);
  const x4 = cx + innerRadius * Math.cos(startRad);
  const y4 = cy + innerRadius * Math.sin(startRad);
  
  const largeArc = angleDiff > 180 ? 1 : 0;
  
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
}

function TaskPieChart({ tasks = [], clients = [] }) {
  const [chartType, setChartType] = useState('tasks'); // 'tasks' or 'clients'
  const [hoveredIdx, setHoveredIdx] = useState(null);

  let data = [];
  if (chartType === 'tasks') {
    const statuses = [
      { id: 'backlog', label: 'Backlog', color: '#3b82f6' },
      { id: 'todo', label: 'To Do', color: '#8b5cf6' },
      { id: 'inprogress', label: 'In Progress', color: '#f59e0b' },
      { id: 'qa', label: 'QA / Review', color: '#06b6d4' },
      { id: 'done', label: 'Done', color: '#10b981' },
      { id: 'cancelled', label: 'Cancelled', color: '#6b7280' },
    ];
    data = statuses.map(s => ({
      ...s,
      value: tasks.filter(t => (t.column || 'backlog') === s.id).length
    })).filter(d => d.value > 0);
  } else {
    const statuses = [
      { id: 'Active', label: 'Active Clients', color: '#10b981' },
      { id: 'Prospect', label: 'Prospects', color: '#3b82f6' },
      { id: 'Inactive', label: 'Inactive', color: '#6b7280' },
    ];
    data = statuses.map(s => ({
      ...s,
      value: clients.filter(c => (c.status || 'Active') === s.id).length
    })).filter(d => d.value > 0);
  }

  const total = data.reduce((acc, d) => acc + d.value, 0);

  // Compute angles
  let currentAngle = 0;
  const slices = data.map((d, i) => {
    const angle = total > 0 ? (d.value / total) * 360 : 0;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;
    return {
      ...d,
      startAngle,
      endAngle,
      percentage: total > 0 ? ((d.value / total) * 100).toFixed(1) : '0'
    };
  });

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <div className="chart-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
              <path d="M22 12A10 10 0 0 0 12 2v10z"/>
            </svg>
            {chartType === 'tasks' ? 'Task Distribution' : 'Client Status Distribution'}
          </div>
          <div className="chart-sub">Real-time status breakdown</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className={`btn btn-sm ${chartType === 'tasks' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setChartType('tasks')} style={{ fontSize: 11, padding: '3px 8px' }}>Tasks</button>
          <button className={`btn btn-sm ${chartType === 'clients' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setChartType('clients')} style={{ fontSize: 11, padding: '3px 8px' }}>Clients</button>
        </div>
      </div>

      <div className="chart-body" style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        {total === 0 ? (
          <div className="text-muted text-sm" style={{ padding: '40px 0' }}>No data available</div>
        ) : (
          <>
            <div style={{ position: 'relative', width: 170, height: 170, flexShrink: 0 }}>
              <svg width="170" height="170" viewBox="0 0 200 200">
                {slices.map((slice, i) => {
                  const isHovered = hoveredIdx === i;
                  const path = getDonutPath(100, 100, isHovered ? 84 : 78, 48, slice.startAngle, slice.endAngle);
                  return (
                    <path
                      key={slice.id || i}
                      d={path}
                      fill={slice.color}
                      opacity={hoveredIdx === null || isHovered ? 1 : 0.45}
                      style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredIdx(i)}
                      onMouseLeave={() => setHoveredIdx(null)}
                    />
                  );
                })}
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', textAlign: 'center' }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
                  {hoveredIdx !== null ? slices[hoveredIdx].value : total}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>
                  {hoveredIdx !== null ? slices[hoveredIdx].label : (chartType === 'tasks' ? 'Total Tasks' : 'Total Clients')}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 150 }}>
              {slices.map((s, i) => (
                <div
                  key={s.id || i}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: hoveredIdx === i ? 'var(--surface2)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 550, color: 'var(--text)' }}>{s.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>{s.value}</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)', width: 36, textAlign: 'right' }}>{s.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PriorityBarChart({ tasks = [] }) {
  const [activeHover, setActiveHover] = useState(null);

  const priorities = [
    { id: 'low', label: 'Low' },
    { id: 'medium', label: 'Medium' },
    { id: 'high', label: 'High' },
  ];

  const data = priorities.map(p => {
    const bf = tasks.filter(t => (t.project === 'blackfire' || !t.project) && (t.priority || 'medium') === p.id).length;
    const aw = tasks.filter(t => t.project === 'aawazz' && (t.priority || 'medium') === p.id).length;
    return { priority: p.label, blackfire: bf, aawazz: aw, total: bf + aw };
  });

  const maxVal = Math.max(...data.map(d => Math.max(d.blackfire, d.aawazz)), 4);

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <div className="chart-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            Tasks by Priority & Product
          </div>
          <div className="chart-sub">Blackfire AI vs Aawazz Product breakdown</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#f97316' }} />
            <span style={{ fontWeight: 600, color: 'var(--text2)' }}>Blackfire AI</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#2563eb' }} />
            <span style={{ fontWeight: 600, color: 'var(--text2)' }}>Aawazz Product</span>
          </div>
        </div>
      </div>

      <div className="chart-body" style={{ flexDirection: 'column', justifyContent: 'flex-end', padding: '10px 0 0' }}>
        <div style={{ width: '100%', height: 170, position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
          {/* Grid background lines */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none', opacity: 0.15 }}>
            <div style={{ borderTop: '1px dashed var(--text)', width: '100%' }} />
            <div style={{ borderTop: '1px dashed var(--text)', width: '100%' }} />
            <div style={{ borderTop: '1px dashed var(--text)', width: '100%' }} />
          </div>

          {data.map((d) => {
            const bfHeight = (d.blackfire / maxVal) * 130;
            const awHeight = (d.aawazz / maxVal) * 130;

            return (
              <div key={d.priority} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, zIndex: 2 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 130 }}>
                  {/* Blackfire bar */}
                  <div
                    onMouseEnter={() => setActiveHover({ group: d.priority, type: 'Blackfire', val: d.blackfire })}
                    onMouseLeave={() => setActiveHover(null)}
                    style={{
                      width: 26,
                      height: Math.max(bfHeight, 6),
                      background: '#f97316',
                      borderRadius: '4px 4px 0 0',
                      transition: 'all 0.25s ease',
                      position: 'relative',
                      boxShadow: activeHover?.group === d.priority && activeHover?.type === 'Blackfire' ? '0 0 10px rgba(249,115,22,0.5)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {d.blackfire > 0 && (
                      <span style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>
                        {d.blackfire}
                      </span>
                    )}
                  </div>

                  {/* Aawazz bar */}
                  <div
                    onMouseEnter={() => setActiveHover({ group: d.priority, type: 'Aawazz', val: d.aawazz })}
                    onMouseLeave={() => setActiveHover(null)}
                    style={{
                      width: 26,
                      height: Math.max(awHeight, 6),
                      background: '#3b82f6',
                      borderRadius: '4px 4px 0 0',
                      transition: 'all 0.25s ease',
                      position: 'relative',
                      boxShadow: activeHover?.group === d.priority && activeHover?.type === 'Aawazz' ? '0 0 10px rgba(37,99,235,0.5)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {d.aawazz > 0 && (
                      <span style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>
                        {d.aawazz}
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 650, color: 'var(--text2)' }}>{d.priority} Priority</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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

  // Overdue: past-date events not done/cancelled
  const overdueEvents = allEvents
    .filter(e => e.date < today && e.status !== 'done' && e.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date));
  // Overdue: past-dueDate tasks not in done column
  const overdueTasks = tasks
    .filter(t => t.dueDate && t.dueDate < today && t.column !== 'done')
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const totalOverdue = overdueEvents.length + overdueTasks.length;

  const active   = clients.filter(c => c.status === 'Active').length;
  const prospect = clients.filter(c => c.status === 'Prospect').length;
  const inProgress = tasks.filter(t => t.column === 'inprogress').length;
  const completed = tasks.filter(t => t.column === 'done').length;
  const completionRate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

  function fmtDate(d) {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Blackfire AI, Product Platform & Venture Engine Overview</p>
        </div>
      </div>
      <div className="page-body">
        {/* Metric Cards (KPIs) */}
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
            <div className="stat-label">Feature Completion Rate</div>
            <div className="stat-value">{completionRate}%</div>
            <div className="stat-sub">{completed} of {tasks.length} features done</div>
          </div>
          {totalOverdue > 0 && (
            <div className="stat-card stat-card--overdue">
              <div className="stat-label">Overdue Items</div>
              <div className="stat-value" style={{ color: '#ef4444' }}>{totalOverdue}</div>
              <div className="stat-sub">{overdueEvents.length} event{overdueEvents.length !== 1 ? 's' : ''} · {overdueTasks.length} task{overdueTasks.length !== 1 ? 's' : ''}</div>
            </div>
          )}
        </div>

        {/* Visual Charts Grid (Pie Chart + Bar Chart) */}
        <div className="charts-grid">
          <TaskPieChart tasks={tasks} clients={clients} />
          <PriorityBarChart tasks={tasks} />
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

          {/* Overdue Items */}
          {totalOverdue > 0 && (
            <div style={{ marginTop: 24 }}>
              <div className="section-title" style={{ color: '#ef4444' }}>⚠ Overdue Items</div>
              <div className="upcoming-list">
                {overdueEvents.map(ev => (
                  <div key={ev._id} className="upcoming-item overdue-item">
                    <div className="up-dot" style={{ background: '#ef4444' }} />
                    <div className="up-info">
                      <div className="up-title">{ev.title}</div>
                      <div className="up-meta">
                        {ev.clientId?.name && <span>{ev.clientId.name}</span>}
                        <span className="overdue-badge">Overdue</span>
                      </div>
                    </div>
                    <div className="up-date" style={{ color: '#ef4444' }}>{fmtDate(ev.date)}</div>
                  </div>
                ))}
                {overdueTasks.map(t => (
                  <div key={t._id} className="upcoming-item overdue-item">
                    <div className="up-dot" style={{ background: '#ef4444' }} />
                    <div className="up-info">
                      <div className="up-title">{t.title}</div>
                      <div className="up-meta">
                        <span>Task</span>
                        {t.assignee && <span>{t.assignee}</span>}
                        <span className="overdue-badge">Overdue</span>
                      </div>
                    </div>
                    <div className="up-date" style={{ color: '#ef4444' }}>{fmtDate(t.dueDate)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
