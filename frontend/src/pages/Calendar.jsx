import { useEffect, useState, useMemo, useRef } from 'react';
import { eventsApi, clientsApi } from '../api';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const PLATFORMS = [
  { id: 'linkedin',  label: 'LinkedIn',  icon: '💼', badgeClass: 'platform-linkedin' },
  { id: 'instagram', label: 'Instagram', icon: '📸', badgeClass: 'platform-instagram' },
  { id: 'facebook',  label: 'Facebook',  icon: '📘', badgeClass: 'platform-facebook' },
  { id: 'tiktok',    label: 'TikTok',    icon: '🎵', badgeClass: 'platform-tiktok' },
  { id: 'x',         label: 'X / Twitter', icon: '𝕏', badgeClass: 'platform-x' },
];

const COLORS = [
  { id: 'blue',   hex: '#3b82f6', bg: '#eef2ff', border: '#818cf8', text: '#1e40af' },
  { id: 'purple', hex: '#8b5cf6', bg: '#f3e8ff', border: '#c084fc', text: '#6b21a8' },
  { id: 'pink',   hex: '#ec4899', bg: '#fce7f3', border: '#f472b6', text: '#9d174d' },
  { id: 'green',  hex: '#10b981', bg: '#ecfdf5', border: '#34d399', text: '#065f46' },
  { id: 'amber',  hex: '#f59e0b', bg: '#fffbeb', border: '#fbbf24', text: '#92400e' },
  { id: 'red',    hex: '#ef4444', bg: '#fef2f2', border: '#f87171', text: '#991b1b' },
  { id: 'teal',   hex: '#06b6d4', bg: '#ecfeff', border: '#22d3ee', text: '#155e75' },
  { id: 'gray',   hex: '#71717a', bg: '#f4f4f5', border: '#a1a1aa', text: '#27272a' },
];

const COLOR_MAP = COLORS.reduce((acc, c) => ({ ...acc, [c.id]: c }), {});

const EMPTY_EV = { title:'', date:'', time:'', clientId:'', notes:'', color:'blue', platforms:[], status:'scheduled' };

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
  const [imageFile, setImageFile] = useState(null);
  const fileInputRef = useRef(null);
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

  // Build 1:1 square calendar grid
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
    setImageFile(null);
    setModal(true);
  }
  function openEdit(ev) {
    setForm({
      title: ev.title,
      date: ev.date,
      time: ev.time||'',
      clientId: ev.clientId?._id||ev.clientId||'',
      notes: ev.notes||'',
      color: ev.color||'blue',
      platforms: ev.platforms||[],
      status: ev.status||'scheduled'
    });
    setEditing(ev._id);
    setImageFile(null);
    setModal(true);
  }

  function togglePlatform(pId) {
    setForm(f => {
      const exists = f.platforms.includes(pId);
      const updated = exists ? f.platforms.filter(x => x !== pId) : [...f.platforms, pId];
      return { ...f, platforms: updated };
    });
  }

  async function save() {
    if (!form.title.trim() || !form.date) return toast('Title and date required', 'error');
    try {
      const payload = { ...form, clientId: form.clientId || null };
      let savedEv;
      if (editing) {
        const res = await eventsApi.update(editing, payload);
        savedEv = res.data;
      } else {
        const res = await eventsApi.create(payload);
        savedEv = res.data;
      }

      if (imageFile && savedEv?._id) {
        await eventsApi.uploadImage(savedEv._id, imageFile);
      }

      toast('Event saved', 'success');
      setModal(false);
      setImageFile(null);
      load();
    } catch (err) {
      console.error(err);
      toast('Error saving event', 'error');
    }
  }

  async function del(id) {
    await eventsApi.delete(id);
    toast('Event deleted', 'info');
    load();
  }

  async function handleDirectUpload(eventId, file) {
    try {
      await eventsApi.uploadImage(eventId, file);
      toast('Picture added', 'success');
      load();
    } catch { toast('Upload failed', 'error'); }
  }

  const selEvents = sel ? eventsFor(sel) : [];
  const selDate   = sel ? dateStr(sel) : '';

  const weekRows = Math.ceil(cells.length / 7);

  return (
    <>
      <div className="page-head">
        <div><h1>Calendar & Content Scheduler</h1><p>Social media post tracking with multi-platform icons & custom day color coding</p></div>
      </div>
      <div className="page-body cal-page-body">
        <div className="cal-container">
          {/* Square Grid Calendar */}
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

            {/* DOW headers */}
            <div className="cal-dow-row">
              {DAYS.map(d => <div key={d} className="cal-dow-cell">{d}</div>)}
            </div>

            {/* Day 1:1 Square Cells */}
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

                // Collect all social platforms scheduled for this day
                const dayPlatforms = [...new Set(evs.flatMap(e => e.platforms || []))];
                // Check if any event has a custom color accent
                const topColorEv = evs.find(e => e.color && e.color !== 'blue') || evs[0];
                const dayAccent = topColorEv ? COLOR_MAP[topColorEv.color] || COLOR_MAP.blue : null;

                return (
                  <div key={i}
                    className={`cal-cell${isToday ? ' cal-cell--today' : ''}${isSel ? ' cal-cell--sel' : ''}`}
                    style={dayAccent ? { borderTop: `3px solid ${dayAccent.hex}` } : {}}
                    onClick={() => setSel(isSel ? null : cell.day)}>
                    
                    <div className="cal-cell-head">
                      <span className={`cal-cell-num${isToday ? ' cal-cell-num--today' : ''}`}>{cell.day}</span>
                      {evs.length > 0 && <span className="text-xs text-muted" style={{ fontWeight:600 }}>{evs.length} ev</span>}
                    </div>

                    <div className="cal-cell-events">
                      {evs.slice(0, 2).map(ev => {
                        const c = COLOR_MAP[ev.color] || COLOR_MAP.blue;
                        return (
                          <div key={ev._id} className="cal-chip" style={{ background: c.bg, color: c.text, borderLeft: `2px solid ${c.border}` }}>
                            {ev.image && <span title="Has picture">🖼️</span>}
                            {ev.time && <span className="cal-chip-time">{ev.time}</span>}
                            <span className="cal-chip-title">{ev.title}</span>
                          </div>
                        );
                      })}
                      {evs.length > 2 && <div className="cal-chip-overflow">+{evs.length - 2} more</div>}
                    </div>

                    {/* Social Media Post Platform Icons Row */}
                    {dayPlatforms.length > 0 && (
                      <div className="cal-cell-platforms">
                        {dayPlatforms.map(pId => {
                          const p = PLATFORMS.find(x => x.id === pId);
                          if (!p) return null;
                          return (
                            <span key={pId} className={`platform-icon-btn ${p.badgeClass}`} title={p.label}>
                              {p.icon}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Side Details Panel */}
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
                    {selEvents.length} event/post{selEvents.length !== 1 ? 's' : ''}
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
                  <p>Pick a date to view events & scheduled posts</p>
                </div>
              )}
              {sel && selEvents.length === 0 && (
                <div className="cal-sp-empty">
                  <div className="cal-sp-empty-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                  </div>
                  <p>No posts or events on this day</p>
                  <button className="cal-sp-add-first" onClick={() => openAdd(selDate)}>Schedule a post</button>
                </div>
              )}
              {selEvents.map(ev => {
                const c = COLOR_MAP[ev.color] || COLOR_MAP.blue;
                return (
                  <div key={ev._id} className="cal-ev-card" style={{ borderLeftColor: c.hex }}>
                    <div className="cal-ev-head">
                      <div className="cal-ev-dot" style={{ background: c.hex }}></div>
                      <span className="cal-ev-title">{ev.title}</span>
                    </div>

                    {/* Image Preview */}
                    {ev.image && (
                      <img src={ev.image.startsWith('data:') || ev.image.startsWith('http') ? ev.image : `/uploads/${ev.image}`} alt={ev.title} className="cal-ev-img" />
                    )}

                    {/* Social Media Platform Icons */}
                    {(ev.platforms||[]).length > 0 && (
                      <div style={{ display:'flex', gap:6, marginTop:8, alignItems:'center' }}>
                        <span className="text-xs text-muted" style={{ fontWeight:600 }}>Platforms:</span>
                        {ev.platforms.map(pId => {
                          const p = PLATFORMS.find(x => x.id === pId);
                          if (!p) return null;
                          return (
                            <span key={pId} className={`platform-icon-btn ${p.badgeClass}`} title={p.label}>
                              {p.icon}
                            </span>
                          );
                        })}
                      </div>
                    )}

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
                      <label className="cal-ev-action-btn" title="Add picture">
                        📸 {ev.image ? 'Change Photo' : 'Add Photo'}
                        <input type="file" accept="image/*" style={{ display:'none' }}
                          onChange={e => { if (e.target.files[0]) handleDirectUpload(ev._id, e.target.files[0]); }} />
                      </label>
                      <button className="cal-ev-action-btn" onClick={() => openEdit(ev)}>
                        ✏️ Edit
                      </button>
                      <button className="cal-ev-action-btn cal-ev-action-btn--danger" onClick={() => del(ev._id)}>
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Event / Post' : 'Add Event / Post'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div className="form-group"><label>Title *</label><input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="Post or event title" /></div>
        
        {/* Social Platforms Selector */}
        <div className="form-group">
          <label>Target Social Platforms (Multiple Allowed)</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
            {PLATFORMS.map(p => {
              const sel = form.platforms.includes(p.id);
              return (
                <button type="button" key={p.id}
                  className={`btn btn-sm ${sel ? 'btn-primary' : 'btn-secondary'}`}
                  style={sel ? { background: p.badgeClass==='platform-linkedin'?'#0a66c2':p.badgeClass==='platform-facebook'?'#1877f2':'#18181b', borderColor: 'transparent' } : {}}
                  onClick={() => togglePlatform(p.id)}>
                  {p.icon} {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Color Coding Picker */}
        <div className="form-group">
          <label>Color Code (Event & Calendar Day Accent)</label>
          <div className="color-picker-row">
            {COLORS.map(c => (
              <div key={c.id}
                className={`color-dot-opt${form.color === c.id ? ' selected' : ''}`}
                style={{ background: c.hex }}
                title={c.id}
                onClick={() => setForm(f=>({...f, color: c.id}))} />
            ))}
          </div>
        </div>

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
          <div className="form-group"><label>Status</label>
            <select value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))}>
              <option value="scheduled">Scheduled</option><option value="done">Done</option><option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="form-group"><label>Event Picture</label>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0] || null)} />
        </div>

        <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Post caption or notes..." /></div>
      </Modal>
    </>
  );
}
