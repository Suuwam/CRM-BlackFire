import { useEffect, useState, useRef } from 'react';
import { tasksApi } from '../api';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

const PROJECTS = [
  { id: 'blackfire', label: 'Blackfire AI', color: '#222', dot: '#222', sub: 'Main Project' },
  { id: 'aawazz',   label: 'Aawazz',       color: '#3b5bdb', dot: '#3b5bdb', sub: 'SaaS Product' },
];
const COLUMNS = [
  { id: 'backlog',    label: 'Backlog' },
  { id: 'todo',       label: 'To Do' },
  { id: 'inprogress', label: 'In Progress' },
  { id: 'qa',         label: 'QA / Review' },
  { id: 'done',       label: 'Done' },
];
const EMPTY_TASK = { title:'', description:'', priority:'medium', tags:'', assignee:'', dueDate:'' };

export default function Board() {
  const [project, setProject] = useState('blackfire');
  const [tasks, setTasks]     = useState([]);
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(EMPTY_TASK);
  const [editCol, setEditCol] = useState('backlog');
  const [editing, setEditing] = useState(null);
  const dragId = useRef(null);
  const toast = useToast();

  async function load() { const r = await tasksApi.list(project); setTasks(r.data); }
  useEffect(() => { load(); }, [project]);

  function openAdd(col) { setForm({ ...EMPTY_TASK }); setEditCol(col); setEditing(null); setModal(true); }
  function openEdit(t)  { setForm({ title:t.title, description:t.description, priority:t.priority, tags:(t.tags||[]).join(', '), assignee:t.assignee, dueDate:t.dueDate }); setEditCol(t.column); setEditing(t._id); setModal(true); }

  async function save() {
    if (!form.title.trim()) return toast('Title required', 'error');
    const data = { ...form, tags: form.tags.split(',').map(t=>t.trim()).filter(Boolean), column: editCol, project };
    try {
      if (editing) await tasksApi.update(editing, data);
      else         await tasksApi.create(data);
      toast('Saved', 'success'); setModal(false); load();
    } catch { toast('Error', 'error'); }
  }

  async function del(id) {
    if (!confirm('Delete task?')) return;
    await tasksApi.delete(id); toast('Deleted', 'success'); load();
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
  const proj = PROJECTS.find(p => p.id === project);

  return (
    <>
      <div className="page-head">
        <div><h1>Project Board</h1><p>Trello-style QA and task tracking</p></div>
      </div>
      <div className="page-body">
        {/* Project tabs */}
        <div className="board-tabs">
          {PROJECTS.map(p => (
            <button key={p.id} className={`board-tab${project===p.id?' active':''}`} onClick={() => setProject(p.id)}>
              <span className="proj-dot" style={{ background: project===p.id ? '#fff' : p.dot }} />
              {p.label}
              <span className="text-sm" style={{ opacity:.7, marginLeft:4 }}>{p.sub}</span>
            </button>
          ))}
        </div>

        {/* Kanban board */}
        <div className="kanban">
          {COLUMNS.map(col => {
            const ct = colTasks(col.id);
            return (
              <div key={col.id} className="col">
                <div className="col-head">
                  <span className="col-name">{col.label}</span>
                  <span className="col-count">{ct.length}</span>
                </div>
                <div
                  className={`col-body${dragOver===col.id?' drag-over':''}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(col.id); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => onDrop(col.id)}
                >
                  {ct.map(t => (
                    <div key={t._id} className="k-card" draggable
                      onDragStart={() => onDragStart(t._id)}>
                      <div className="k-card-title">{t.title}</div>
                      {t.description && <div className="k-card-desc">{t.description}</div>}
                      <div className="k-card-foot">
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          <div className="k-card-tags">
                            {(t.tags||[]).map(tg => <span key={tg} className="k-tag">{tg}</span>)}
                          </div>
                          <div style={{ display:'flex', gap:8, fontSize:11 }}>
                            {t.assignee && <span className="text-muted">👤 {t.assignee}</span>}
                            {t.dueDate  && <span className="text-muted">📅 {t.dueDate}</span>}
                          </div>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                          <span className={`text-sm priority-${t.priority}`} style={{ fontWeight:600, textTransform:'capitalize' }}>{t.priority}</span>
                          <div style={{ display:'flex', gap:2 }}>
                            <button className="btn-icon" style={{ fontSize:12, padding:'2px 4px' }} onClick={() => openEdit(t)}>✏️</button>
                            <button className="btn-icon" style={{ fontSize:12, padding:'2px 4px' }} onClick={() => del(t._id)}>🗑</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button className="add-card-btn" onClick={() => openAdd(col.id)}>
                    <span style={{ fontSize:14 }}>+</span> Add card
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Task' : `Add to ${COLUMNS.find(c=>c.id===editCol)?.label}`}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div className="form-group"><label>Title *</label><input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="Task title" /></div>
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
        <div className="form-group"><label>Tags (comma separated)</label><input value={form.tags} onChange={e => setForm(f=>({...f,tags:e.target.value}))} placeholder="bug, feature, design" /></div>
      </Modal>
    </>
  );
}
