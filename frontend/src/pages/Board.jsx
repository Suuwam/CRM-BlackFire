import { useEffect, useState, useRef } from 'react';
import { tasksApi } from '../api';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

const PROJECTS = [
  { id: 'blackfire', label: 'Blackfire AI', color: '#18181b', dot: '#18181b', sub: 'Main Project' },
  { id: 'aawazz',   label: 'Aawazz',       color: '#2563eb', dot: '#2563eb', sub: 'SaaS Product' },
];
const COLUMNS = [
  { id: 'backlog',    label: 'Backlog' },
  { id: 'todo',       label: 'To Do' },
  { id: 'inprogress', label: 'In Progress' },
  { id: 'qa',         label: 'QA / Review' },
  { id: 'done',       label: 'Done' },
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

export default function Board() {
  const [project, setProject] = useState('blackfire');
  const [tasks, setTasks]     = useState([]);
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(EMPTY_TASK);
  const [editCol, setEditCol] = useState('backlog');
  const [editing, setEditing] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const dragId = useRef(null);
  const toast = useToast();

  async function load() { const r = await tasksApi.list(project); setTasks(r.data); }
  useEffect(() => { load(); }, [project]);

  function openAdd(col) { setForm({ ...EMPTY_TASK }); setEditCol(col); setEditing(null); setImageFile(null); setModal(true); }
  function openEdit(t)  { setForm({ title:t.title, description:t.description||'', priority:t.priority||'medium', color:t.color||'blue', tags:(t.tags||[]).join(', '), assignee:t.assignee||'', dueDate:t.dueDate||'' }); setEditCol(t.column); setEditing(t._id); setImageFile(null); setModal(true); }

  async function save() {
    if (!form.title.trim()) return toast('Title required', 'error');
    const data = { ...form, tags: form.tags.split(',').map(t=>t.trim()).filter(Boolean), column: editCol, project };
    try {
      let savedTask;
      if (editing) {
        const res = await tasksApi.update(editing, data);
        savedTask = res.data;
      } else {
        const res = await tasksApi.create(data);
        savedTask = res.data;
      }

      if (imageFile && savedTask?._id) {
        await tasksApi.uploadImage(savedTask._id, imageFile);
      }

      toast('Task saved', 'success'); setModal(false); setImageFile(null); load();
    } catch { toast('Error saving task', 'error'); }
  }

  async function del(id) {
    await tasksApi.delete(id); toast('Task deleted', 'info'); load();
  }

  async function handleCardPhotoUpload(taskId, file) {
    try {
      await tasksApi.uploadImage(taskId, file);
      toast('Card cover uploaded', 'success');
      load();
    } catch { toast('Upload failed', 'error'); }
  }

  // Drag & Drop
  const [dragOver, setDragOver] = useState(null);

  function onDragStart(id) { dragId.current = id; }
  async function onDrop(col) {
    if (!dragId.current) return;
    await tasksApi.move(dragId.current, col);
    dragId.current = null;
    setDragOver(null);
    load();
  }

  function colTasks(col) { return tasks.filter(t => t.column === col); }
  const isAawazz = project === 'aawazz';

  return (
    <>
      <div className="page-head">
        <div><h1>Project Board</h1><p>Task tracking with color coding & cover image attachments</p></div>
      </div>
      <div className="page-body">
        {/* Project tabs */}
        <div className="board-tabs">
          {PROJECTS.map(p => (
            <button key={p.id} className={`board-tab${project===p.id?' active':''}`} onClick={() => setProject(p.id)}
              style={project===p.id && p.id==='aawazz' ? { background: '#2563eb', borderColor: '#2563eb' } : {}}>
              <span className="proj-dot" style={{ background: project===p.id ? '#fff' : p.dot }} />
              {p.label}
              <span className="text-sm" style={{ opacity:.7, marginLeft:4 }}>{p.sub}</span>
            </button>
          ))}
        </div>

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
                      onDragStart={() => onDragStart(t._id)}>

                      {/* Display Task Cover Picture */}
                      {t.image && (
                        <div className="k-card-img-wrap">
                          <img src={`/uploads/${t.image}`} alt={t.title} className="k-card-img" />
                        </div>
                      )}

                      <div className="k-card-title">{t.title}</div>
                      {t.description && <div className="k-card-desc">{t.description}</div>}
                      <div className="k-card-foot">
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          <div className="k-card-tags">
                            {(t.tags||[]).map(tg => <span key={tg} className="k-tag" style={isAawazz ? { background: '#eff6ff', color: '#1d4ed8' } : {}}>{tg}</span>)}
                          </div>
                          <div style={{ display:'flex', gap:8, fontSize:11 }}>
                            {t.assignee && <span className="text-muted">👤 {t.assignee}</span>}
                            {t.dueDate  && <span className="text-muted">📅 {t.dueDate}</span>}
                          </div>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                          <span className={`text-sm priority-${t.priority}`} style={{ fontWeight:600, textTransform:'capitalize' }}>{t.priority}</span>
                          <div style={{ display:'flex', gap:3 }}>
                            <label className="btn-icon" style={{ fontSize:12, padding:'2px 4px', cursor:'pointer' }} title="Upload card image">
                              📷
                              <input type="file" accept="image/*" style={{ display:'none' }}
                                onChange={e => { if (e.target.files[0]) handleCardPhotoUpload(t._id, e.target.files[0]); }} />
                            </label>
                            <button className="btn-icon" style={{ fontSize:12, padding:'2px 4px' }} onClick={() => openEdit(t)}>✏️</button>
                            <button className="btn-icon" style={{ fontSize:12, padding:'2px 4px' }} onClick={() => del(t._id)}>🗑</button>
                          </div>
                        </div>
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

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Task' : `Add to ${COLUMNS.find(c=>c.id===editCol)?.label}`}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} style={isAawazz ? { background: '#2563eb', borderColor: '#2563eb' } : {}}>Save</button></>}>
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
    </>
  );
}
