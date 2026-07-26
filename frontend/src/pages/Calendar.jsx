import { useEffect, useState, useMemo } from 'react';
import { eventsApi, clientsApi } from '../api';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const EMPTY_EV = { title:'', date:'', time:'', clientId:'', notes:'', color:'blue', status:'scheduled' };

const COLOR_MAP = {
  blue:  { bg: '#eef2ff', border: '#818cf8', text: '#4338ca', dot: '#6366f1' },
  green: { bg: '#ecfdf5', border: '#34d399', text: '#065f46', dot: '#10b981' },
  amber: { bg: '#fffbeb', border: '#fbbf24', text: '#92400e', dot: '#f59e0b' },
  gray:  { bg: '#f3f4f6', border: '#9ca3af', text: '#374151', dot: '#6b7280' },
};

export default function Calendar() {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState([]);
  const [clients, setClients] = useState([]);
  const [sel, setSel]     = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState(EMPTY_EV);
  const [editing, setEditing] = useState(null);
  const toast = useToast();

  async function load() {
    const pad = String(month + 1).padStart(2, '0');
    const [ev, cl] = await Promise.all([
      eventsApi.list({ month: `${year}-${pad}` }),
      clientsApi.list(),
    ]);
    setEvents(ev.data);
    setClients(cl.data);
  }
  useEffect(() => { load(); }, [year, month]);

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); }

  // Build calendar grid — accurate day mapping
  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev  = new Date(year, month, 0).getDate();
    const result = [];

    // Fill leading days from previous month
    for (let i = 0; i < firstDay; i++) {
      result.push({ day: daysInPrev - firstDay + 1 + i, other: true });
    }
    // Fill current month days
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ day: d, other: false });
    }
    // Fill trailing days for next month
    const remaining = 7 - (result.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        result.push({ day: d, other: true });
      }
    }
    return result;
  }, [year, month]);

  function dateStr(d) {
    return `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  function eventsFor(d) { return events.filter(e => e.date === dateStr(d)); }
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  function openAdd(dateS) {
    setForm({ ...EMPTY_EV, date: dateS });
    setEditing(null);
    setModal(true);
  }
  function openEdit(ev) {
    setForm({ title:ev.title, date:ev.date, time:ev.time, clientId:ev.clientId?._id||ev.clientId||'', notes:ev.notes, color:ev.color, status:ev.status });
    setEditing(ev._id);
    setModal(true);
  }

  async function save() {
    if (!form.title.trim() || !form.date) return toast('Title and date required', 'error');
    try {
      if (editing) await eventsApi.update(editing, form);
      else         await eventsApi.create(form);
      toast('Event saved', 'success');
      setModal(false);
      load();
    } catch { toast('Error', 'error'); }
  }

  async function del(id) {
    if (!confirm('Delete this event?')) return;
    await eventsApi.delete(id);
    toast('Deleted', 'success');
    load();
  }

  const selEvents = sel ? eventsFor(sel) : [];
  const selDate   = sel ? dateStr(sel) : '';

  // Get week number of the selected day
  const weekRows = Math.ceil(cells.length / 7);

  return (
    <>
      <div className="page-head">
        <div><h1>Calendar</h1><p>Schedule and track your work</p></div>
      </div>
      <div className="page-body cal-page-body">
        <div className="cal-container">
          {/* Calendar Grid */}
          <div className="cal-main">
            <div className="cal-header">
              <div className="cal-header-left">
                <h2 className="cal-month-title">{MONTHS[month]}</h2>
                <span className="cal-year-badge">{year}</span>
              </div>
              <div className="cal-header-right">
                <button className="cal-nav-btn" onClick={prevMonth} aria-label="Previous month">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <button className="cal-today-btn" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSel(today.getDate()); }}>
                  Today
                </button>
                <button className="cal-nav-btn" onClick={nextMonth} aria-label="Next month">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              </div>
            </div>

            {/* Day-of-week headers */}
            <div className="cal-dow-row">
              {DAYS.map(d => <div key={d} className="cal-dow-cell">{d}</div>)}
            </div>

            {/* Day cells */}
            <div className="cal-grid-main" style={{ gridTemplateRows: `repeat(${weekRows}, 1fr)` }}>
              {cells.map((cell, i) => {
                if (cell.other) {
                  return (
                    <div key={i} className="cal-cell cal-cell--other">
                      <span className="cal-cell-num">{cell.day}</span>
                    </div>
                  );
                }
                const evs = eventsFor(cell.day);
                const ds  = dateStr(cell.day);
                const isToday = ds === todayStr;
                const isSel   = sel === cell.day;
                return (
                  <div key={i}
                    className={`cal-cell${isToday ? ' cal-cell--today' : ''}${isSel ? ' cal-cell--sel' : ''}`}
                    onClick={() => setSel(isSel ? null : cell.day)}>
                    <span className={`cal-cell-num${isToday ? ' cal-cell-num--today' : ''}`}>{cell.day}</span>
                    {evs.length > 0 && (
                      <div className="cal-cell-events">
                        {evs.slice(0, 3).map(ev => {
                          const c = COLOR_MAP[ev.color] || COLOR_MAP.blue;
                          return (
                            <div key={ev._id} className="cal-chip" style={{ background: c.bg, color: c.text, borderLeft: `2px solid ${c.border}` }}>
                              {ev.time && <span className="cal-chip-time">{ev.time}</span>}
                              <span className="cal-chip-title">{ev.title}</span>
                            </div>
                          );
                        })}
                        {evs.length > 3 && <div className="cal-chip-overflow">+{evs.length - 3} more</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Side Panel */}
          <div className={`cal-side-panel${sel ? ' cal-side-panel--active' : ''}`}>
            <div className="cal-sp-header">
              <div>
                <div className="cal-sp-date">
                  {sel ? (
                    <>
                      <span className="cal-sp-day-num">{sel}</span>
                      <div className="cal-sp-day-info">
                        <span className="cal-sp-month-label">{MONTHS[month]} {year}</span>
                        <span className="cal-sp-dow">{sel ? DAYS[new Date(year, month, sel).getDay()] : ''}</span>
                      </div>
                    </>
                  ) : (
                    <span className="cal-sp-placeholder-title">Select a day</span>
                  )}
                </div>
                {sel && (
                  <span className="cal-sp-count">
                    {selEvents.length} event{selEvents.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {sel && (
                <button className="cal-sp-add-btn" onClick={() => openAdd(selDate)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                  <span>Add</span>
                </button>
              )}
            </div>
            <div className="cal-sp-body">
              {!sel && (
                <div className="cal-sp-empty">
                  <div className="cal-sp-empty-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <p>Pick a date to view events</p>
                </div>
              )}
              {sel && selEvents.length === 0 && (
                <div className="cal-sp-empty">
                  <div className="cal-sp-empty-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                  </div>
                  <p>No events yet</p>
                  <button className="cal-sp-add-first" onClick={() => openAdd(selDate)}>Create your first event</button>
                </div>
              )}
              {selEvents.map(ev => {
                const c = COLOR_MAP[ev.color] || COLOR_MAP.blue;
                return (
                  <div key={ev._id} className="cal-ev-card" style={{ borderLeftColor: c.border }}>
                    <div className="cal-ev-head">
                      <div className="cal-ev-dot" style={{ background: c.dot }}></div>
                      <span className="cal-ev-title">{ev.title}</span>
                    </div>
                    <div className="cal-ev-meta">
                      {ev.time && (
                        <span className="cal-ev-meta-item">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          {ev.time}
                        </span>
                      )}
                      {ev.clientId?.name && (
                        <span className="cal-ev-meta-item">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          {ev.clientId.name}
                        </span>
                      )}
                      <span className="cal-ev-status" style={{ background: c.bg, color: c.text }}>{ev.status}</span>
                    </div>
                    {ev.notes && <div className="cal-ev-notes">{ev.notes}</div>}
                    <div className="cal-ev-actions">
                      <button className="cal-ev-action-btn" onClick={() => openEdit(ev)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit
                      </button>
                      <button className="cal-ev-action-btn cal-ev-action-btn--danger" onClick={() => del(ev._id)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Event' : 'Add Event'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div className="form-group"><label>Title *</label><input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="Event title" /></div>
        <div className="form-row">
          <div className="form-group"><label>Date *</label><input type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} /></div>
          <div className="form-group"><label>Time</label><input type="time" value={form.time} onChange={e => setForm(f=>({...f,time:e.target.value}))} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Client</label>
            <select value={form.clientId} onChange={e => setForm(f=>({...f,clientId:e.target.value}))}>
              <option value="">— No client —</option>
              {clients.map(c => <option key={c._id} value={c._id}>{c.name} ({c.company})</option>)}
            </select>
          </div>
          <div className="form-group"><label>Color</label>
            <select value={form.color} onChange={e => setForm(f=>({...f,color:e.target.value}))}>
              <option value="blue">Blue</option><option value="green">Green</option>
              <option value="amber">Amber</option><option value="gray">Gray</option>
            </select>
          </div>
        </div>
        <div className="form-group"><label>Status</label>
          <select value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))}>
            <option value="scheduled">Scheduled</option><option value="done">Done</option><option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Any notes..." /></div>
      </Modal>
    </>
  );
}
