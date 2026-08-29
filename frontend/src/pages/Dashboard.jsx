import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { fetcher, tasksApi } from '../api';
import SocialIcon from '../components/SocialIcon';
import { AccountAvatar } from '../components/AccountPanel';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const COL_META = {
  backlog: { label: 'Backlog', color: '#3b82f6' },
  todo: { label: 'To Do', color: '#8b5cf6' },
  inprogress: { label: 'In Progress', color: '#f59e0b' },
  qa: { label: 'QA', color: '#06b6d4' },
  done: { label: 'Done', color: '#10b981' },
  cancelled: { label: 'Cancelled', color: '#6b7280' },
};

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

            <div className="pie-legend-container" style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 130 }}>
              {slices.map((s, i) => (
                <div
                  key={s.id || i}
                  className="pie-legend-item"
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
                    transition: 'all 0.15s',
                    width: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span className="pie-legend-label" style={{ fontWeight: 550, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>{s.value}</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)', minWidth: 32, textAlign: 'right' }}>{s.percentage}%</span>
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
        <div className="priority-chart-legend" style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 11, flexWrap: 'wrap' }}>
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

      <div className="chart-body" style={{ flexDirection: 'column', justifyContent: 'flex-end', padding: '10px 0 0', width: '100%', overflowX: 'hidden' }}>
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
              <div key={d.priority} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, zIndex: 2, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 130 }}>
                  {/* Blackfire bar */}
                  <div
                    onMouseEnter={() => setActiveHover({ group: d.priority, type: 'Blackfire', val: d.blackfire })}
                    onMouseLeave={() => setActiveHover(null)}
                    style={{
                      width: 22,
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
                      width: 22,
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
                <span className="priority-label" style={{ fontSize: 11, fontWeight: 650, color: 'var(--text2)', textAlign: 'center', wordBreak: 'break-word' }}>{d.priority}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AssigneeWorkloadChart({ tasks = [], users = [] }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  // Build per-user task count from users list first, then fall back to assigneeName from tasks
  const allNames = new Set();
  users.forEach(u => u.name && allNames.add(u.name));
  tasks.forEach(t => (t.assigneeName || t.assignee) && allNames.add(t.assigneeName || t.assignee));

  const palette = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#6b7280'];

  const data = Array.from(allNames)
    .map((name, i) => ({
      name,
      total: tasks.filter(t => (t.assigneeName || t.assignee) === name).length,
      inProgress: tasks.filter(t => (t.assigneeName || t.assignee) === name && t.column === 'inprogress').length,
      done: tasks.filter(t => (t.assigneeName || t.assignee) === name && t.column === 'done').length,
      color: palette[i % palette.length],
    }))
    .filter(d => d.total > 0)
    .sort((a, b) => b.total - a.total);

  const maxVal = Math.max(...data.map(d => d.total), 1);

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <div className="chart-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="7" r="4"/>
              <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
              <path d="M16 11l2 2 4-4"/>
            </svg>
            Assignee Workload
          </div>
          <div className="chart-sub">Tasks assigned per team member</div>
        </div>
      </div>

      <div className="chart-body" style={{ flexDirection: 'column', gap: 10, padding: '10px 0', alignItems: 'stretch', width: '100%', minHeight: 'auto' }}>
        {data.length === 0 ? (
          <div className="text-muted text-sm" style={{ padding: '30px 0', textAlign: 'center' }}>No assignments found</div>
        ) : (
          data.map((d, i) => {
            const barW = (d.total / maxVal) * 100;
            const isHov = hoveredIdx === i;
            return (
              <div
                key={d.name}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: isHov ? 'var(--surface2)' : 'var(--bg)',
                  border: '1px solid var(--border)',
                  transition: 'all 0.15s ease',
                  width: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                <div className="workload-name" style={{ fontSize: 12, fontWeight: 650, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {d.name}
                </div>
                <div style={{ flex: 1, height: 10, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', minWidth: 30 }}>
                  <div style={{
                    height: '100%',
                    width: `${barW}%`,
                    background: d.color,
                    borderRadius: 99,
                    transition: 'width 0.4s ease',
                    boxShadow: `0 0 6px ${d.color}66`
                  }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 30, justifyContent: 'flex-end', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{d.total}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function AssignedTaskBarChart({ tasks = [] }) {
  const [metric, setMetric] = useState('status'); // 'status' or 'priority'
  const [hoveredId, setHoveredId] = useState(null);

  const totalAssigned = tasks.length;
  if (totalAssigned === 0) return null;

  let items = [];
  if (metric === 'status') {
    const statuses = [
      { id: 'backlog', label: 'Backlog', color: '#3b82f6' },
      { id: 'todo', label: 'To Do', color: '#8b5cf6' },
      { id: 'inprogress', label: 'In Progress', color: '#f59e0b' },
      { id: 'qa', label: 'QA / Review', color: '#06b6d4' },
      { id: 'done', label: 'Done', color: '#10b981' },
      { id: 'cancelled', label: 'Cancelled', color: '#6b7280' },
    ];
    items = statuses.map(s => ({
      ...s,
      count: tasks.filter(t => (t.column || 'backlog') === s.id).length
    }));
  } else {
    const priorities = [
      { id: 'high', label: 'High Priority', color: '#ef4444' },
      { id: 'medium', label: 'Medium Priority', color: '#f59e0b' },
      { id: 'low', label: 'Low Priority', color: '#10b981' },
    ];
    items = priorities.map(p => ({
      ...p,
      count: tasks.filter(t => (t.priority || 'medium') === p.id).length
    }));
  }

  const maxVal = Math.max(...items.map(i => i.count), 1);

  return (
    <div className="assigned-chart-card" style={{ marginTop: 4, padding: '12px', background: 'var(--surface2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          Assigned Tasks Chart
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button className={`btn btn-sm ${metric === 'status' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMetric('status')} style={{ fontSize: 10, padding: '2px 7px' }}>Status</button>
          <button className={`btn btn-sm ${metric === 'priority' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMetric('priority')} style={{ fontSize: 10, padding: '2px 7px' }}>Priority</button>
        </div>
      </div>

      <div className="assigned-scroll-segment" style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowX: 'auto', maxHeight: 180 }}>
        {items.map(item => {
          const barW = (item.count / maxVal) * 100;
          const isHov = hoveredId === item.id;
          const pct = totalAssigned > 0 ? Math.round((item.count / totalAssigned) * 100) : 0;

          return (
            <div
              key={item.id}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                padding: '3px 4px',
                borderRadius: 4,
                background: isHov ? 'var(--surface)' : 'transparent',
                transition: 'background 0.15s ease',
                cursor: 'pointer',
                width: '100%',
                minWidth: 0,
                boxSizing: 'border-box'
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
              <span className="assigned-chart-label" style={{ fontWeight: 600, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {item.label}
              </span>
              <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', position: 'relative', minWidth: 25 }}>
                <div style={{
                  height: '100%',
                  width: `${barW}%`,
                  background: item.color,
                  borderRadius: 99,
                  transition: 'width 0.35s ease'
                }} />
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 38, justifyContent: 'flex-end', flexShrink: 0 }}>
                <span style={{ fontWeight: 750, color: 'var(--text)' }}>{item.count}</span>
                <span style={{ fontSize: 9.5, color: 'var(--text3)' }}>({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Sprint Velocity Chart — 14-day task creation vs completion SVG area chart
function SprintVelocityChart({ activities = [] }) {
  const [hoverDay, setHoverDay] = useState(null);

  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const data = days.map(day => {
    const created   = activities.filter(a => a.action === 'created'  && (a.createdAt || '').slice(0, 10) === day).length;
    const completed = activities.filter(a => a.action === 'moved' && a.toColumn === 'done' && (a.createdAt || '').slice(0, 10) === day).length;
    return { day, created, completed };
  });

  const maxVal = Math.max(...data.map(d => Math.max(d.created, d.completed)), 4);
  const W = 460; const H = 130;
  const PAD = { t: 14, r: 10, b: 24, l: 28 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  function xPos(i) { return PAD.l + (i / Math.max(data.length - 1, 1)) * chartW; }
  function yPos(v) { return PAD.t + chartH - (v / maxVal) * chartH; }

  function makeLine(key) {
    return data.map((d, i) => `${xPos(i)},${yPos(d[key])}`).join(' ');
  }
  function makeArea(key) {
    if (!data.length) return '';
    const pts = data.map((d, i) => `${xPos(i)} ${yPos(d[key])}`).join(' L ');
    const bottom = PAD.t + chartH;
    return `M ${xPos(0)} ${bottom} L ${pts} L ${xPos(data.length - 1)} ${bottom} Z`;
  }

  return (
    <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
      <div className="chart-header">
        <div>
          <div className="chart-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            Sprint Velocity — Last 14 Days
          </div>
          <div className="chart-sub">Daily tasks created vs completed</div>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 11, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 20, height: 3, background: '#f97316', display: 'inline-block', borderRadius: 2 }} />
            <span style={{ fontWeight: 600, color: 'var(--text2)' }}>Created</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 20, height: 3, background: '#10b981', display: 'inline-block', borderRadius: 2 }} />
            <span style={{ fontWeight: 600, color: 'var(--text2)' }}>Completed</span>
          </div>
        </div>
      </div>
      <div className="chart-body" style={{ padding: '4px 0 0', justifyContent: 'flex-start', overflowX: 'auto', minHeight: 150, position: 'relative', width: '100%' }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', minWidth: 260, overflow: 'visible' }}>
          {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => (
            <line key={i} x1={PAD.l} y1={PAD.t + chartH * frac} x2={W - PAD.r} y2={PAD.t + chartH * frac}
              stroke="var(--border)" strokeWidth="0.8" strokeDasharray="3 3" />
          ))}
          {[maxVal, Math.round(maxVal / 2), 0].map((v, i) => (
            <text key={i} x={PAD.l - 4} y={yPos(v) + 4} fontSize="8" fill="var(--text3)" textAnchor="end" fontFamily="Inter,sans-serif">{v}</text>
          ))}
          <path d={makeArea('created')}   fill="rgba(249,115,22,0.09)" />
          <path d={makeArea('completed')} fill="rgba(16,185,129,0.10)" />
          <polyline points={makeLine('created')}   fill="none" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" />
          <polyline points={makeLine('completed')} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" />
          {data.map((d, i) => (
            <g key={i}>
              <rect x={xPos(i) - 12} y={PAD.t} width={24} height={chartH} fill="transparent"
                onMouseEnter={() => setHoverDay(i)} onMouseLeave={() => setHoverDay(null)}
                style={{ cursor: 'crosshair' }}
              />
              {hoverDay === i && <line x1={xPos(i)} y1={PAD.t} x2={xPos(i)} y2={PAD.t + chartH} stroke="var(--border2)" strokeWidth="1" strokeDasharray="4 2" />}
              <circle cx={xPos(i)} cy={yPos(d.created)}   r={hoverDay === i ? 4 : 2.5} fill="#f97316" style={{ transition: 'r 0.12s' }} />
              <circle cx={xPos(i)} cy={yPos(d.completed)} r={hoverDay === i ? 4 : 2.5} fill="#10b981" style={{ transition: 'r 0.12s' }} />
            </g>
          ))}
          {data.map((d, i) => i % 2 === 0 && (
            <text key={i} x={xPos(i)} y={H - 4} fontSize="7.5" fill="var(--text3)" textAnchor="middle" fontFamily="Inter,sans-serif">{d.day.slice(5)}</text>
          ))}
        </svg>
        {hoverDay !== null && (
          <div style={{ position: 'absolute', top: 14, right: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: 'var(--shadow-md)', pointerEvents: 'none', zIndex: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>{data[hoverDay]?.day}</div>
            <div style={{ color: '#f97316', fontWeight: 600 }}>Created: {data[hoverDay]?.created}</div>
            <div style={{ color: '#10b981', fontWeight: 600 }}>Completed: {data[hoverDay]?.completed}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [focusUserId, setFocusUserId] = useState('');
  const [taskFilter, setTaskFilter] = useState('open');

  const { data: clients = [] } = useSWR('/clients', fetcher, { revalidateOnFocus: false });
  const { data: allEvents = [] } = useSWR('/events', fetcher, { revalidateOnFocus: false });
  const { data: tasks = [], mutate: mutateTasks } = useSWR('/tasks', fetcher, { revalidateOnFocus: false });
  const { data: users = [] } = useSWR('/users', fetcher, { revalidateOnFocus: false });
  const { data: activities = [] } = useSWR('/activity?days=50', fetcher, { revalidateOnFocus: false });
  const { data: sprintActivities = [] } = useSWR('/activity?days=14', fetcher, { revalidateOnFocus: false });

  useEffect(() => {
    if (!focusUserId && user?._id) setFocusUserId(String(user._id));
  }, [focusUserId, user]);

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

  async function quickDoneTask(taskId) {
    mutateTasks(prev => (prev || []).map(t => t._id === taskId ? { ...t, column: 'done' } : t), false);
    toast('Task marked as done', 'success');
    try {
      await tasksApi.move(taskId, 'done');
      mutateTasks();
    } catch {
      toast('Error updating task', 'error');
      mutateTasks();
    }
  }
  const focusUser = users.find(u => String(u._id) === String(focusUserId)) || user;
  const assignedTasks = tasks.filter(t => {
    const taskAssigneeId = String(t.assigneeId || '');
    const taskAssigneeName = t.assigneeName || t.assignee || '';
    if (focusUser?._id && taskAssigneeId && taskAssigneeId === String(focusUser._id)) return true;
    if (focusUser?.email && t.assigneeEmail && t.assigneeEmail === focusUser.email) return true;
    if (focusUser?.name && taskAssigneeName && taskAssigneeName === focusUser.name) return true;
    return false;
  });
  const openAssigned = assignedTasks.filter(t => t.column !== 'done' && t.column !== 'cancelled');
  const doneAssigned = assignedTasks.filter(t => t.column === 'done');
  const visibleAssigned = taskFilter === 'open'
    ? openAssigned
    : taskFilter === 'done'
      ? doneAssigned
      : assignedTasks;
  const activityBacklog = activities.slice(0, 12);

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
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Clients</div>
            <div className="stat-value">{clients.length}</div>
            <div className="stat-sub">{active} active · {prospect} prospects</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Upcoming</div>
            <div className="stat-value">{upcoming.length}</div>
            <div className="stat-sub">Next 30 days</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">In Progress</div>
            <div className="stat-value">{inProgress}</div>
            <div className="stat-sub">Active workflow</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Completion</div>
            <div className="stat-value">{completionRate}%</div>
            <div className="stat-sub">{completed} of {tasks.length} done</div>
          </div>
          <div className={`stat-card${totalOverdue > 0 ? ' stat-card--overdue' : ''}`}>
            <div className="stat-label">Overdue</div>
            <div className="stat-value" style={{ color: totalOverdue > 0 ? '#ef4444' : undefined }}>{totalOverdue}</div>
            <div className="stat-sub">{overdueEvents.length} events · {overdueTasks.length} tasks</div>
          </div>
        </div>

        <div className="dash-grid">
          <div>
            {/* Visual Charts Grid (Pie Chart + Bar Chart) */}
            <div className="charts-grid">
              <TaskPieChart tasks={tasks} clients={clients} />
              <PriorityBarChart tasks={tasks} />
            </div>

            {/* Assignee Workload Chart */}
            <div style={{ marginTop: 24 }}>
              <AssigneeWorkloadChart tasks={tasks} users={users} />
            </div>

            {/* Sprint Velocity Chart — 14-day area chart */}
            <div className="charts-grid" style={{ marginTop: 24 }}>
              <SprintVelocityChart activities={sprintActivities} />
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
                            {t.assigneeName && <span>{t.assigneeName}</span>}
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

            <div className="card" style={{ marginTop: 24 }}>
              <div className="section-title" style={{ marginBottom: 14 }}>Backlog, last 50 days</div>
              <div className="activity-list" style={{ maxHeight: 450 }}>
                {activityBacklog.length === 0 && <div className="empty" style={{ padding: '24px 0' }}>No recent activity.</div>}
                {activityBacklog.map(item => {
                  const detailedSentence = item.summary || [
                    item.actorName || 'System',
                    item.action,
                    item.targetName ? `"${item.targetName}"` : '',
                    item.fromColumn && item.toColumn ? `from ${item.fromColumn} to ${item.toColumn}` : item.toColumn ? `to ${item.toColumn}` : '',
                    item.assigneeName ? `(assigned to ${item.assigneeName})` : ''
                  ].filter(Boolean).join(' ');

                  return (
                    <div key={item._id} className="activity-item">
                      <div className="activity-top">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className={`activity-badge badge-${item.action}`}>{item.action}</span>
                          {item.project && <span className="activity-project-tag">{item.project}</span>}
                        </div>
                        <span className="activity-date">{new Date(item.createdAt).toLocaleString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="activity-sentence" style={{ fontSize: 13.5, fontWeight: 550, color: 'var(--text)', marginTop: 8, lineHeight: 1.45 }}>
                        {detailedSentence}
                      </div>
                      <div className="activity-meta" style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 12 }}>
                        <span>By: {item.actorName || 'System'}</span>
                        {item.assigneeName && <span>Assigned to: {item.assigneeName}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="dash-side card">
            <div className="section-title" style={{ marginBottom: 4 }}>Assigned Tasks</div>
            <div className="text-sm text-muted" style={{ marginBottom: 10 }}>
              {user?.role === 'admin' ? 'Tasks for the selected account.' : 'Your assigned tasks.'}
            </div>
            {user?.role === 'admin' && (
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label>Account</label>
                <select value={focusUserId} onChange={e => setFocusUserId(e.target.value)}>
                  {users.map(u => <option key={u._id} value={u._id}>{u.name} ({u.username})</option>)}
                </select>
              </div>
            )}

            <div className="assigned-person">
              <AccountAvatar name={focusUser?.name || '?'} size={34} />
              <div className="assigned-person-info">
                <div className="assigned-person-name">{focusUser?.name || 'Unassigned'}</div>
                <div className="assigned-person-meta">{focusUser?.email || 'No email on file'}</div>
              </div>
            </div>

            <div className="assigned-filters">
              <button type="button" className={`assigned-filter${taskFilter === 'open' ? ' active' : ''}`} onClick={() => setTaskFilter('open')}>
                Open <span className="count">{openAssigned.length}</span>
              </button>
              <button type="button" className={`assigned-filter${taskFilter === 'done' ? ' active' : ''}`} onClick={() => setTaskFilter('done')}>
                Done <span className="count">{doneAssigned.length}</span>
              </button>
              <button type="button" className={`assigned-filter${taskFilter === 'all' ? ' active' : ''}`} onClick={() => setTaskFilter('all')}>
                All <span className="count">{assignedTasks.length}</span>
              </button>
            </div>

            <div className="assigned-scroll-segment">
              <div className="assigned-list">
                {visibleAssigned.length === 0 && (
                  <div className="empty" style={{ padding: '18px 0' }}>
                    {taskFilter === 'open' ? 'No open tasks.' : taskFilter === 'done' ? 'No completed tasks.' : 'No tasks assigned.'}
                  </div>
                )}
                {visibleAssigned.map(task => {
                  const col = COL_META[task.column] || COL_META.backlog;
                  const isDone = task.column === 'done';
                  return (
                    <div
                      key={task._id}
                      className={`assigned-item${isDone ? ' is-done' : ''}`}
                      title="Click to view task on board"
                    >
                      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/board?project=${task.project || 'blackfire'}`)}>
                        <div className="assigned-title" style={{ textDecoration: isDone ? 'line-through' : 'none' }}>{task.title}</div>
                        <div className="assigned-meta">
                          <span className="assigned-pill">
                            <span className="assigned-pill-dot" style={{ background: col.color }} />
                            {col.label}
                          </span>
                          {task.project && <span className="assigned-pill">{task.project}</span>}
                        </div>
                      </div>
                      {isDone ? (
                        <span className="assigned-done-mark">✓</span>
                      ) : (
                        <button
                          className="assigned-done-btn"
                          aria-label="Mark as done"
                          title="Mark as done"
                          onClick={e => { e.stopPropagation(); quickDoneTask(task._id); }}
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <AssignedTaskBarChart tasks={assignedTasks} />
          </aside>
        </div>
      </div>
    </>
  );
}
