import { useState, useRef, useEffect, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { tasksApi, fetcher } from '../api';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

const PROJECTS = [
  { id: 'blackfire', label: 'Blackfire AI', color: '#18181b', dot: '#18181b' },
  { id: 'aawazz',   label: 'Aawazz Product', color: '#2563eb', dot: '#2563eb' },
];
const COLUMNS = [
  { id: 'backlog',    label: 'Backlog' },
  { id: 'todo',       label: 'To Do' },
  { id: 'inprogress', label: 'In Progress' },
  { id: 'qa',         label: 'QA / Review' },
  { id: 'done',       label: 'Done' },
  { id: 'cancelled',  label: 'Cancelled' },
];

const COLORS = [
  { id: 'blue',   hex: '#3b82f6' },
  { id: 'purple', hex: '#8b5cf6' },
  { id: 'pink',   hex: '#ec4899' },
  { id: 'green',  hex: '#10b981' },
  { id: 'amber',  hex: '#f59e0b' },
  { id: 'red',    hex: '#ef4444' },
  { id: 'teal',   hex: '#06b6d4' },
  { id: 'gray',   hex: '#71717a' },
];

const EMPTY_TASK = { title:'', description:'', priority:'medium', color:'blue', tags:'', assignee:'', dueDate:'' };

// --- Draft cache helpers for Board tasks ---
const DRAFT_KEY_PREFIX = 'crm_board_draft_';
function getDraftKey(taskId) { return DRAFT_KEY_PREFIX + (taskId || 'new'); }
function saveDraft(taskId, formData, col) {
  try { sessionStorage.setItem(getDraftKey(taskId), JSON.stringify({ form: formData, col, ts: Date.now() })); } catch {}
}
function loadDraft(taskId) {
  try {
    const raw = sessionStorage.getItem(getDraftKey(taskId));
    if (!raw) return null;
    const d = JSON.parse(raw);
    // Expire drafts older than 24 hours
    if (Date.now() - d.ts > 86400000) { sessionStorage.removeItem(getDraftKey(taskId)); return null; }
    return d;
  } catch { return null; }
}
function clearDraft(taskId) { try { sessionStorage.removeItem(getDraftKey(taskId)); } catch {} }

export default function Board() {
  const [project, setProject] = useState('aawazz');
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(EMPTY_TASK);
  const [editCol, setEditCol] = useState('backlog');
  const [editing, setEditing] = useState(null);
  const [viewingTask, setViewingTask] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const dragId = useRef(null);
  const toast = useToast();

  // SWR: cache tasks per project, revalidate in background
  const swrKey = `/tasks?project=${project}`;
  const { data: tasks = [], isLoading } = useSWR(swrKey, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });

  // Auto-save form to sessionStorage on every change while modal is open
  useEffect(() => {
    if (modal) saveDraft(editing, form, editCol);
  }, [modal, form, editCol, editing]);

  function openAdd(col) {
    const draft = loadDraft(null);
    if (draft && draft.form.title.trim()) {
      setForm(draft.form); setEditCol(draft.col || col); setEditing(null); setImageFile(null); setModal(true);
      toast('Restored unsaved draft', 'info');
    } else {
      setForm({ ...EMPTY_TASK }); setEditCol(col); setEditing(null); setImageFile(null); setModal(true);
    }
  }
  function openEdit(t) {
    const draft = loadDraft(t._id);
    if (draft && draft.form.title.trim()) {
      setForm(draft.form); setEditCol(draft.col || t.column); setEditing(t._id); setImageFile(null); setModal(true);
      toast('Restored unsaved edits', 'info');
    } else {
      setForm({ title:t.title, description:t.description||'', priority:t.priority||'medium', color:t.color||'blue', tags:(t.tags||[]).join(', '), assignee:t.assignee||'', dueDate:t.dueDate||'' }); setEditCol(t.column); setEditing(t._id); setImageFile(null); setModal(true);
    }
  }

  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    if (!form.title.trim()) return toast('Title required', 'error');
    setSaving(true);
    const data = { ...form, tags: form.tags.split(',').map(t=>t.trim()).filter(Boolean), column: editCol, project };
    try {
      let savedTask;
      if (editing) {
        // Optimistic: update local cache immediately
        mutate(swrKey, tasks.map(t => t._id === editing ? { ...t, ...data } : t), false);
        const res = await tasksApi.update(editing, data);
        savedTask = res.data;
      } else {
        const res = await tasksApi.create(data);
        savedTask = res.data;
        // Optimistic: add to cache
        mutate(swrKey, [...tasks, savedTask], false);
      }

      if (imageFile && savedTask?._id) {
        await tasksApi.uploadImage(savedTask._id, imageFile);
      }

      clearDraft(editing); toast('Task saved', 'success'); setModal(false); setImageFile(null);
      mutate(swrKey); // revalidate in background
    } catch (err) { 
      console.error('Task save error:', err); 
      const errMsg = err?.response?.data?.error;
      const safeMsg = typeof errMsg === 'object' ? JSON.stringify(errMsg) : (errMsg || err.message || 'Error saving task');
      toast(safeMsg, 'error'); 
      mutate(swrKey); 
    }
    finally { setSaving(false); }
  }

  async function del(id) {
    // Optimistic: remove from cache immediately
    mutate(swrKey, tasks.filter(t => t._id !== id), false);
    toast('Task deleted', 'info');
    await tasksApi.delete(id);
    mutate(swrKey);
  }

  async function updateTaskColumn(id, col) {
    mutate(swrKey, tasks.map(t => t._id === id ? { ...t, column: col } : t), false);
    toast(col === 'done' ? 'Task marked as done' : 'Task cancelled', 'success');
    try {
      await tasksApi.move(id, col);
      mutate(swrKey);
    } catch {
      toast('Error updating task', 'error');
      mutate(swrKey);
    }
  }

  function markTaskDone(id) { updateTaskColumn(id, 'done'); }
  function cancelTask(id) { updateTaskColumn(id, 'cancelled'); }



  // Drag & Drop
  const [dragOver, setDragOver] = useState(null);

  function onDragStart(id) { dragId.current = id; }
  async function onDrop(col) {
    if (!dragId.current) return;
    const id = dragId.current;
    // Optimistic: move card in cache immediately
    mutate(swrKey, tasks.map(t => t._id === id ? { ...t, column: col } : t), false);
    dragId.current = null;
    setDragOver(null);
    await tasksApi.move(id, col);
    mutate(swrKey);
  }

  function colTasks(col) { return tasks.filter(t => t.column === col); }
  const isAawazz = project === 'aawazz';

  return (
    <>
      <div className="page-head">
        <div><h1>Project Board</h1><p>Task tracking with color coding & cover image attachments</p></div>
      </div>
      <div className={`page-body ${isFullscreen ? 'board-fullscreen' : ''}`}>
        {/* Project tabs */}
        <div className="board-tabs" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', gap: 8 }}>
          {PROJECTS.map(p => (
            <button key={p.id} className={`board-tab${project===p.id?' active':''}`} onClick={() => setProject(p.id)}
              style={project===p.id && p.id==='aawazz' ? { background: '#2563eb', borderColor: '#2563eb' } : {}}>
              {(project === p.id && isLoading) ? (
                <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'authSpin 0.6s linear infinite' }} />
              ) : (
                <span className="proj-dot" style={{ background: project===p.id ? '#fff' : p.dot }} />
              )}
              {p.label}
            </button>
          ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>

        {/* Dedicated Blackfire AI Header Banner */}
        {project === 'blackfire' && (
          <div className="blackfire-banner">
            <div>
              <div className="blackfire-logo-wrap">
                <span className="blackfire-logo-text">
                  <svg className="blackfire-flame-svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 23c-4.97 0-9-3.58-9-8 0-3.08 1.87-6.26 4.36-8.8.44-.45 1.18-.13 1.15.5-.1 1.76.35 3.3 1.49 4.3 1.14 1 2.5 1.5 2.5 3 0 1.1-.9 2-2 2 .55 1.1 1.6 2 3 2s2.45-.9 3-2c-1.1 0-2-.9-2-2 0-1.5 1.36-2 2.5-3 1.14-1 1.59-2.54 1.49-4.3-.03-.63.71-.95 1.15-.5C21.13 8.74 23 11.92 23 15c0 4.42-4.03 8-9 8z"/>
                  </svg>
                  Blackfire AI
                </span>
                <span className="blackfire-badge">Core Engine & AI Platform</span>
              </div>
              <div className="blackfire-slogan">
                Blackfire AI — ignite intelligence, <span className="blackfire-highlight">from concept to launch</span>.
              </div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <span className="text-sm" style={{ opacity:.85, fontWeight:550 }}>Venture & AI Engine</span>
            </div>
          </div>
        )}

        {/* Dedicated Aawazz Header Banner */}
        {isAawazz && (
          <div className="aawazz-banner">
            <div>
              <div className="aawazz-logo-wrap">
                <span className="aawazz-logo-text">
                  aa
                  <svg className="aawazz-wave-svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M 10 50 Q 30 10 50 50 T 90 50" />
                  </svg>
                  wazz
                </span>
                <span className="aawazz-badge">Official SaaS Product</span>
              </div>
              <div className="aawazz-slogan">
                Aawazz — say it your way, <span className="aawazz-highlight">script to sound</span> made for creators.
              </div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <span className="text-sm" style={{ opacity:.85, fontWeight:550 }}>Audio AI Platform</span>
            </div>
          </div>
        )}

        {/* Kanban board */}
        <div className="kanban-wrapper" style={{ position: 'relative', minHeight: '50vh' }}>
          <div className="kanban">
            {COLUMNS.map(col => {
              const ct = colTasks(col.id);
            return (
              <div key={col.id} className="col">
                <div className="col-head">
                  <span className="col-name" style={isAawazz ? { color: '#2563eb' } : {}}>{col.label}</span>
                  <span className="col-count">{ct.length}</span>
                </div>
                <div
                  className={`col-body${dragOver===col.id?' drag-over':''}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(col.id); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => onDrop(col.id)}
                >
                  {ct.map(t => (
                    <div key={t._id} className={`k-card card-color-${t.color || 'blue'}`} draggable
                      onDragStart={() => onDragStart(t._id)} onClick={() => setViewingTask(t)}>

                      {/* Display Task Cover Picture */}
                      {t.image && (
                        <div className="k-card-img-wrap">
                          <img src={t.image.startsWith('data:') || t.image.startsWith('http') ? t.image : `/uploads/${t.image}`} alt={t.title} className="k-card-img" />
                        </div>
                      )}

                      <div>
                        <div className="k-card-title">{t.title}</div>
                        {t.description && <div className="k-card-desc">{t.description}</div>}
                      </div>

                      <div className="k-card-foot" style={{ alignItems: 'flex-start' }}>
                        <div style={{ display:'flex', flexDirection:'column', gap:6, flex:1 }}>
                          <div className="k-card-tags">
                            {(t.tags||[]).map(tg => <span key={tg} className="k-tag" style={isAawazz ? { background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' } : {}}>{tg}</span>)}
                          </div>
                          <div style={{ display:'flex', gap:8, fontSize:11, flexWrap: 'wrap' }}>
                            {t.assignee && <span className="text-muted" style={{ fontWeight: 500 }}>By: {t.assignee}</span>}
                            {t.dueDate  && (
                              <span className="text-muted" style={{ fontWeight: 500, color: t.dueDate < new Date().toISOString().slice(0, 10) && t.column !== 'done' ? '#ef4444' : undefined }}>
                                Due: {t.dueDate} {t.dueDate < new Date().toISOString().slice(0, 10) && t.column !== 'done' && <strong style={{color: '#ef4444'}}>(Overdue)</strong>}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink: 0 }}>
                          <span className={`text-sm priority-${t.priority}`} style={{ fontWeight:600, textTransform:'capitalize' }}>{t.priority}</span>
                        </div>
                      </div>

                      <div className="k-card-actions">
                        {t.column !== 'done' && <button className="k-card-btn k-card-btn--done" onClick={(e) => { e.stopPropagation(); markTaskDone(t._id); }}>Done</button>}
                        {t.column !== 'cancelled' && <button className="k-card-btn k-card-btn--cancel" onClick={(e) => { e.stopPropagation(); cancelTask(t._id); }}>Cancel</button>}
                        <button className="k-card-btn k-card-btn--edit" onClick={(e) => { e.stopPropagation(); openEdit(t); }}>Edit</button>
                        <button className="k-card-btn k-card-btn--delete" onClick={(e) => { e.stopPropagation(); del(t._id); }}>Delete</button>
                      </div>
                    </div>
                  ))}
                  <button className="add-card-btn" onClick={() => openAdd(col.id)} style={isAawazz ? { color: '#2563eb', borderColor: '#93c5fd' } : {}}>
                    <span style={{ fontSize:14 }}>+</span> Add card
                  </button>
                </div>
              </div>
            );
            })}
          </div>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Task' : `Add to ${COLUMNS.find(c=>c.id===editCol)?.label}`}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving} style={isAawazz ? { background: '#2563eb', borderColor: '#2563eb' } : {}}>{saving ? 'Saving...' : 'Save'}</button></>}>
        <div className="form-group"><label>Title *</label><input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="Task title" /></div>
        
        {/* Task Color Coding Selector */}
        <div className="form-group">
          <label>Color Code Accent</label>
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

        <div className="form-group"><label>Description</label><textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Optional details..." /></div>
        <div className="form-row">
          <div className="form-group"><label>Priority</label>
            <select value={form.priority} onChange={e => setForm(f=>({...f,priority:e.target.value}))}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </div>
          <div className="form-group"><label>Column</label>
            <select value={editCol} onChange={e => setEditCol(e.target.value)}>
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Assignee</label><input value={form.assignee} onChange={e => setForm(f=>({...f,assignee:e.target.value}))} placeholder="Who's responsible?" /></div>
          <div className="form-group"><label>Due Date</label><input type="date" value={form.dueDate} onChange={e => setForm(f=>({...f,dueDate:e.target.value}))} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Tags (comma separated)</label><input value={form.tags} onChange={e => setForm(f=>({...f,tags:e.target.value}))} placeholder="bug, feature, audio" /></div>
          <div className="form-group"><label>Card Cover Picture</label><input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0] || null)} /></div>
        </div>
      </Modal>

      <Modal open={!!viewingTask} onClose={() => setViewingTask(null)} title="Task Details" footer={<button className="btn btn-secondary" onClick={() => setViewingTask(null)}>Close</button>}>
        {viewingTask && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {viewingTask.image && (
              <img src={viewingTask.image.startsWith('data:') || viewingTask.image.startsWith('http') ? viewingTask.image : `/uploads/${viewingTask.image}`} alt={viewingTask.title} style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />
            )}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>Title</label>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{viewingTask.title}</div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>Description</label>
              <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{viewingTask.description || 'No description provided.'}</div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>Priority</label>
                <div style={{ fontSize: 13, textTransform: 'capitalize' }} className={`priority-${viewingTask.priority}`}>{viewingTask.priority}</div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>Column</label>
                <div style={{ fontSize: 13 }}>{COLUMNS.find(c => c.id === viewingTask.column)?.label || viewingTask.column}</div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>Assignee</label>
                <div style={{ fontSize: 13 }}>{viewingTask.assignee || 'Unassigned'}</div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>Due Date</label>
                <div style={{ fontSize: 13 }}>{viewingTask.dueDate || 'None'}</div>
              </div>
            </div>
            {viewingTask.tags && viewingTask.tags.length > 0 && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>Tags</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                  {viewingTask.tags.map(tg => <span key={tg} className="k-tag">{tg}</span>)}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
