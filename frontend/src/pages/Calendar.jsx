import { useState, useMemo, useRef, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { eventsApi, clientsApi, fetcher } from '../api';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import SocialIcon, { PLATFORMS } from '../components/SocialIcon';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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

// --- Draft cache helpers for Calendar events ---
const CAL_DRAFT_PREFIX = 'crm_cal_draft_';
function getCalDraftKey(id) { return CAL_DRAFT_PREFIX + (id || 'new'); }
function saveCalDraft(id, formData) {
  try { sessionStorage.setItem(getCalDraftKey(id), JSON.stringify({ form: formData, ts: Date.now() })); } catch {}
}
function loadCalDraft(id) {
  try {
    const raw = sessionStorage.getItem(getCalDraftKey(id));
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (Date.now() - d.ts > 86400000) { sessionStorage.removeItem(getCalDraftKey(id)); return null; }
    return d;
  } catch { return null; }
}
function clearCalDraft(id) { try { sessionStorage.removeItem(getCalDraftKey(id)); } catch {} }

export default function Calendar() {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [sel, setSel]     = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState(EMPTY_EV);
  const [editing, setEditing] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const fileInputRef = useRef(null);
  const toast = useToast();

  const pad = String(month + 1).padStart(2, '0');
  const eventsKey = `/events?month=${year}-${pad}`;
  const { data: events = [] } = useSWR(eventsKey, fetcher, { keepPreviousData: true, revalidateOnFocus: false });
  const { data: clients = [] } = useSWR('/clients', fetcher, { revalidateOnFocus: false });

  // Auto-save form to sessionStorage while modal is open
  useEffect(() => {
    if (modal) saveCalDraft(editing, form);
  }, [modal, form, editing]);

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
    const draft = loadCalDraft(null);
    if (draft && draft.form.title.trim()) {
      setForm(draft.form); setEditing(null); setImageFile(null); setModal(true);
      toast('Restored unsaved draft', 'info');
    } else {
      setForm({ ...EMPTY_EV, date: dateS });
      setEditing(null);
      setImageFile(null);
      setModal(true);
    }
  }
  function openEdit(ev) {
    const draft = loadCalDraft(ev._id);
    if (draft && draft.form.title.trim()) {
      setForm(draft.form); setEditing(ev._id); setImageFile(null); setModal(true);
      toast('Restored unsaved edits', 'info');
    } else {
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
  }

  function togglePlatform(pId) {
    setForm(f => {
      const exists = f.platforms.includes(pId);
      const updated = exists ? f.platforms.filter(x => x !== pId) : [...f.platforms, pId];
      return { ...f, platforms: updated };
    });
  }

  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    if (!form.title.trim() || !form.date) return toast('Title and date required', 'error');
    setSaving(true);
    try {
      const payload = { ...form, clientId: form.clientId || null };
      let savedEv;
      if (editing) {
        mutate(eventsKey, events.map(e => e._id === editing ? { ...e, ...payload } : e), false);
        const res = await eventsApi.update(editing, payload);
        savedEv = res.data;
      } else {
        const res = await eventsApi.create(payload);
        savedEv = res.data;
        mutate(eventsKey, [...events, savedEv], false);
      }

      if (imageFile && savedEv?._id) {
        await eventsApi.uploadImage(savedEv._id, imageFile);
      }

      clearCalDraft(editing);
      toast('Event saved', 'success');
      setModal(false);
      setImageFile(null);
      mutate(eventsKey);
    } catch (err) {
      console.error(err);
      toast('Error saving event', 'error');
      mutate(eventsKey);
    } finally {
      setSaving(false);
    }
  }

  async function del(id) {
    mutate(eventsKey, events.filter(e => e._id !== id), false);
    toast('Event deleted', 'info');
    await eventsApi.delete(id);
    mutate(eventsKey);
  }

  async function changeEventStatus(id, newStatus) {
    mutate(eventsKey, events.map(e => e._id === id ? { ...e, status: newStatus } : e), false);
    toast(`Event marked as ${newStatus}`, 'success');
    try {
      await eventsApi.update(id, { status: newStatus });
      mutate(eventsKey);
    } catch {
      toast('Failed to update status', 'error');
      mutate(eventsKey);
    }
  }

  async function handleDirectUpload(eventId, file) {
    try {
      await eventsApi.uploadImage(eventId, file);
      toast('Picture added', 'success');
      mutate(eventsKey);
    } catch { toast('Upload failed', 'error'); }
  }

  const selEvents = sel ? eventsFor(sel) : [];
  const selDate   = sel ? dateStr(sel) : '';

  const weekRows = Math.ceil(cells.length / 7);

  return (
    <>
      <div className="page-head">
        <div><h1>Calendar & Content Scheduler</h1><p>Social media post tracking with vector SVG platform logos & custom day color coding</p></div>
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
                            {ev.image && <span title="Has picture"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></span>}
                            {ev.time && <span className="cal-chip-time">{ev.time}</span>}
                            <span className="cal-chip-title">{ev.title}</span>
                          </div>
                        );
                      })}
                      {evs.length > 2 && <div className="cal-chip-overflow">+{evs.length - 2} more</div>}
                    </div>

                    {/* Social Media SVG Vector Platforms Row */}
                    {dayPlatforms.length > 0 && (
                      <div className="cal-cell-platforms">
                        {dayPlatforms.map(pId => {
                          const p = PLATFORMS.find(x => x.id === pId);
                          if (!p) return null;
                          return (
                            <span key={pId} className={`platform-icon-btn platform-${pId}`} title={p.label}>
                              <SocialIcon id={pId} size={12} />
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

                    {/* SVG Vector Social Media Platform Icons */}
                    {(ev.platforms||[]).length > 0 && (
                      <div style={{ display:'flex', gap:6, marginTop:8, alignItems:'center' }}>
                        <span className="text-xs text-muted" style={{ fontWeight:600 }}>Platforms:</span>
                        {ev.platforms.map(pId => {
                          const p = PLATFORMS.find(x => x.id === pId);
                          if (!p) return null;
                          return (
                            <span key={pId} className={`platform-icon-btn platform-${pId}`} title={p.label}>
                              <SocialIcon id={pId} size={12} />
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
                      <span className={`cal-ev-status ${ev.status === 'done' ? 'status-done' : ev.status === 'cancelled' ? 'status-cancelled' : ''}`} style={ev.status === 'scheduled' ? { background: c.bg, color: c.text } : {}}>{ev.status}</span>
                      {ev.date < todayStr && ev.status !== 'done' && ev.status !== 'cancelled' && (
                        <span className="cal-ev-status" style={{ background: '#fef2f2', color: '#991b1b', marginLeft: 6, border: '1px solid #f87171' }}>Overdue</span>
                      )}
                    </div>

                    {ev.notes && <div className="cal-ev-notes">{ev.notes}</div>}

                    <div className="cal-ev-actions" style={{ display: 'flex', flexWrap: 'nowrap', gap: 4, width: '100%', overflowX: 'auto', paddingBottom: 2 }}>
                      {ev.status !== 'done' && (
                        <button className="cal-ev-action-btn" onClick={() => changeEventStatus(ev._id, 'done')} style={{ fontSize: 11, padding: '4px 8px', background: '#d1fae5', color: '#065f46', borderColor: '#a7f3d0' }}>Mark Done</button>
                      )}
                      {ev.status !== 'cancelled' && (
                        <button className="cal-ev-action-btn" onClick={() => changeEventStatus(ev._id, 'cancelled')} style={{ fontSize: 11, padding: '4px 8px', background: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }}>Cancel</button>
                      )}
                      <button className="cal-ev-action-btn" onClick={() => openEdit(ev)} style={{ fontSize: 11, padding: '4px 8px', background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}>
                        Edit
                      </button>
                      <button className="cal-ev-action-btn" onClick={() => del(ev._id)} style={{ fontSize: 11, padding: '4px 8px', background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}>
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

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Event / Post' : 'Add Event / Post'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></>}>
        <div className="form-group"><label>Title *</label><input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="Post or event title" /></div>
        
        {/* Social Platforms Selector with Vector SVG Icons */}
        <div className="form-group">
          <label>Target Social Platforms (Multiple Allowed)</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:6 }}>
            {PLATFORMS.map(p => {
              const sel = form.platforms.includes(p.id);
              return (
                <button type="button" key={p.id}
                  className={`btn btn-sm ${sel ? 'btn-primary' : 'btn-secondary'}`}
                  style={sel ? { background: p.id==='linkedin'?'#0a66c2':p.id==='facebook'?'#1877f2':p.id==='instagram'?'#dc2743':'#18181b', borderColor: 'transparent', display:'flex', alignItems:'center', gap:6 } : { display:'flex', alignItems:'center', gap:6 }}
                  onClick={() => togglePlatform(p.id)}>
                  <SocialIcon id={p.id} size={14} />
                  <span>{p.label}</span>
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
              <option value="">No client</option>
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
