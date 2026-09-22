import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import useSWR, { mutate } from 'swr';
import { tasksApi, boardsApi, fetcher } from '../api';
import { moveTo, resolveColumnIds } from './boardColumns';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';

// Starting stages for a brand new board. Every board is a row in the DB from here on —
// there are no built-in boards and no per-board styling.
const NEW_BOARD_COLUMNS = [
  { id: 'backlog',    label: 'Backlog' },
  { id: 'todo',       label: 'To Do' },
  { id: 'inprogress', label: 'In Progress' },
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

const EMPTY_TASK = { title:'', description:'', priority:'medium', color:'blue', tags:'', dueDate:'', assignees:[] };

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
    if (Date.now() - d.ts > 86400000) { sessionStorage.removeItem(getDraftKey(taskId)); return null; }
    return d;
  } catch { return null; }
}
function clearDraft(taskId) { try { sessionStorage.removeItem(getDraftKey(taskId)); } catch {} }

export default function Board() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [project, setProject] = useState(searchParams.get('project') || '');
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(EMPTY_TASK);
  const [editCol, setEditCol] = useState('backlog');
  const [editing, setEditing] = useState(null);
  const [viewingTask, setViewingTask] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [detailComments, setDetailComments] = useState([]);
  const dragId = useRef(null);
  const tabsRef = useRef(null);
  const stagesRef = useRef(null);
  const dragMoved = useRef(false);
  const endDrag = useRef(null);
  const [tabOrder, setTabOrder] = useState(null);   // ids mid-drag, null when settled
  const [draggingId, setDraggingId] = useState(null);
  const toast = useToast();

  const { data: boards = [], isLoading: boardsLoading } = useSWR('/boards', fetcher, { revalidateOnFocus: false });
  // While a tab is being dragged the strip renders the previewed order instead.
  const orderedBoards = tabOrder
    ? tabOrder.map(id => boards.find(b => b._id === id)).filter(Boolean)
    : boards;
  const activeProject = boards.find(p => p._id === project) || null;
  const columns = activeProject?.columns || [];
  const hasColumn = id => columns.some(c => c.id === id);

  // Land on the first board, or on ?project= when another page linked here.
  useEffect(() => {
    if (!boards.length) return;
    if (!boards.some(b => b._id === project)) setProject(boards[0]._id);
  }, [boards, project]);

  function selectProject(id) {
    setProject(id);
    setSearchParams(prev => { prev.set('project', id); return prev; }, { replace: true });
  }

  // Board design settings state
  const [designModal, setDesignModal] = useState(false);
  const [designBoard, setDesignBoard] = useState({ id: '', label: '', color: 'blue', columns: [] });
  const [boardSaving, setBoardSaving] = useState(false);

  const swrKey = project ? `/tasks?project=${project}` : null;
  const { data: tasks = [], isLoading } = useSWR(swrKey, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });
  const { data: users = [] } = useSWR('/users', fetcher, { revalidateOnFocus: false });

  // Auto-save form to sessionStorage on every change while modal is open
  useEffect(() => {
    if (modal) saveDraft(editing, form, editCol);
  }, [modal, form, editCol, editing]);

  // Adjust default editCol when columns change
  useEffect(() => {
    if (columns.length > 0) {
      setEditCol(columns[0].id);
    }
  }, [project]);

  // Exit fullscreen on ESC
  useEffect(() => {
    if (!isFullscreen) return;
    function handleKey(e) {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isFullscreen]);

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
    const hasCol = columns.some(c => c.id === t.column);
    const targetCol = hasCol ? t.column : (columns[0]?.id || 'backlog');
    if (draft?.form?.title?.trim()) {
      setForm(draft.form); setEditCol(draft.col || targetCol); setEditing(t._id); setImageFile(null); setModal(true);
      toast('Restored unsaved edits', 'info');
    } else {
      let assignees = t.assignees?.length ? t.assignees : [];
      if (!assignees.length && (t.assigneeName || t.assignee)) {
        assignees = [{ userId: t.assigneeId || null, name: t.assigneeName || t.assignee || '', email: t.assigneeEmail || '' }];
      }
      setForm({
        title: t.title,
        description: t.description || '',
        priority: t.priority || 'medium',
        color: t.color || 'blue',
        tags: (t.tags || []).join(', '),
        dueDate: t.dueDate || '',
        assignees,
      }); setEditCol(targetCol); setEditing(t._id); setImageFile(null); setModal(true);
    }
  }

  function openViewTask(t) {
    setViewingTask(t);
    setDetailComments(t.comments || []);
    setCommentText('');
  }

  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    if (!form.title.trim()) return toast('Title required', 'error');
    setSaving(true);
    const firstAssignee = form.assignees?.[0] || null;
    const data = {
      ...form,
      assignee:      firstAssignee?.name  || '',
      assigneeId:    firstAssignee?.userId || null,
      assigneeName:  firstAssignee?.name  || '',
      assigneeEmail: firstAssignee?.email || '',
      assignees: form.assignees || [],
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      column: editCol,
      project,
    };
    try {
      let savedTask;
      if (editing) {
        mutate(swrKey, tasks.map(t => t._id === editing ? { ...t, ...data } : t), false);
        const res = await tasksApi.update(editing, data);
        savedTask = res.data;
      } else {
        const res = await tasksApi.create(data);
        savedTask = res.data;
        mutate(swrKey, [...tasks, savedTask], false);
      }
      if (imageFile && savedTask?._id) await tasksApi.uploadImage(savedTask._id, imageFile);
      clearDraft(editing); toast('Task saved', 'success'); setModal(false); setImageFile(null);
      mutate(swrKey);
    } catch (err) {
      const errMsg = err?.response?.data?.error;
      const safeMsg = typeof errMsg === 'object' ? JSON.stringify(errMsg) : (errMsg || err.message || 'Error saving task');
      toast(safeMsg, 'error');
      mutate(swrKey);
    } finally { setSaving(false); }
  }

  async function del(id) {
    mutate(swrKey, tasks.filter(t => t._id !== id), false);
    toast('Task deleted', 'info');
    await tasksApi.delete(id);
    mutate(swrKey);
  }

  async function updateTaskColumn(id, col) {
    mutate(swrKey, tasks.map(t => t._id === id ? { ...t, column: col } : t), false);
    toast(col === 'done' ? 'Task marked as done' : 'Task updated', 'success');
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
    mutate(swrKey, tasks.map(t => t._id === id ? { ...t, column: col } : t), false);
    dragId.current = null;
    setDragOver(null);
    await tasksApi.move(id, col);
    mutate(swrKey);
  }

  // Board design actions — every board is editable, including the two seeded ones.
  function openAddBoard() {
    setDesignBoard({ id: '', label: '', color: 'blue', columns: NEW_BOARD_COLUMNS.map(c => ({ ...c })) });
    setDesignModal(true);
  }

  function openEditBoard(boardId) {
    const b = boards.find(p => p._id === boardId);
    if (!b) return;
    setDesignBoard({
      id: b._id,
      label: b.label,
      color: COLORS.find(c => c.hex === b.color)?.id || 'blue',
      columns: (b.columns || []).map(c => ({ ...c })),
    });
    setDesignModal(true);
  }

  async function saveBoard() {
    if (boardSaving) return;
    if (!designBoard.label.trim()) return toast('Board name required', 'error');
    if (!designBoard.columns.length) return toast('At least one stage is required', 'error');
    if (designBoard.columns.some(c => !c.label.trim())) return toast('Every stage needs a name', 'error');

    const saved = boards.find(b => b._id === designBoard.id);
    const payload = {
      label: designBoard.label.trim(),
      color: COLORS.find(c => c.id === designBoard.color)?.hex || '#3b82f6',
      columns: resolveColumnIds(designBoard.columns, saved?.columns || []),
    };
    setBoardSaving(true);
    try {
      if (designBoard.id) {
        await boardsApi.update(designBoard.id, payload);
        toast('Board layout updated', 'success');
      } else {
        const res = await boardsApi.create(payload);
        toast('Board created', 'success');
        selectProject(res.data._id);
      }
      await mutate('/boards');
      mutate(swrKey);
      setDesignModal(false);
    } catch (err) {
      toast(err?.response?.data?.error || 'Could not save board', 'error');
    } finally { setBoardSaving(false); }
  }

  async function deleteBoard(boardId) {
    if (!window.confirm('Delete this board? Its tasks stay in the database but will no longer be visible here.')) return;
    try {
      await boardsApi.delete(boardId);
      const rest = await mutate('/boards');
      setDesignModal(false);
      if (rest?.length) selectProject(rest[0]._id);
      toast('Board deleted', 'success');
    } catch (err) {
      toast(err?.response?.data?.error || 'Could not delete board', 'error');
    }
  }

  // Drag to reorder: board tabs (left/right, order saved on the server so everyone sees the
  // same one) and the stages in Design Layout (up/down, local to the draft).
  //
  // Pointer events rather than HTML5 drag-and-drop: dragstart/drop never fire from a
  // touch, and this has to work in the Capacitor app as well as on a desktop.
  function startReorder(e, id, { axis, container, ids, onPreview, onSettle }) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const at = ev => (axis === 'x' ? ev.clientX : ev.clientY);
    const start = at(e);
    let order = ids;
    let moved = false;

    function onMove(ev) {
      // Ignore the few pixels of travel in an ordinary click.
      if (!moved) {
        if (Math.abs(at(ev) - start) < 6) return;
        moved = true;
        setDraggingId(id);
      }

      const over = [...(container()?.querySelectorAll('[data-drag-id]') || [])]
        .find(el => {
          const r = el.getBoundingClientRect();
          return axis === 'x'
            ? at(ev) >= r.left && at(ev) <= r.right
            : at(ev) >= r.top  && at(ev) <= r.bottom;
        });
      if (!over) return;

      const next = moveTo(order, id, over.dataset.dragId);
      if (next === order) return;
      order = next;
      onPreview(order);
    }

    function onUp() {
      endDrag.current?.();
      endDrag.current = null;
      setDraggingId(null);

      // Never travelled far enough to be a drag — let the click select the board.
      if (!moved) return;
      dragMoved.current = true;
      setTimeout(() => { dragMoved.current = false; }, 0);
      onSettle(order);
    }

    endDrag.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  async function saveBoardOrder(ids) {
    if (ids.join() === boards.map(b => b._id).join()) { setTabOrder(null); return; }
    try {
      const res = await boardsApi.reorder(ids);
      mutate('/boards', res.data, false);
    } catch {
      toast('Could not reorder boards', 'error');
    } finally {
      setTabOrder(null);   // fall back to whatever the server says
    }
  }

  useEffect(() => () => endDrag.current?.(), []);

  function handleColumnNameChange(index, newName) {
    setDesignBoard(prev => {
      const cols = [...prev.columns];
      cols[index] = { ...cols[index], label: newName };
      return { ...prev, columns: cols };
    });
  }

  function addColumnToDesign() {
    setDesignBoard(prev => {
      return {
        ...prev,
        columns: [...prev.columns, { id: `draft_${Date.now()}_${prev.columns.length}`, label: 'New Stage' }]
      };
    });
  }

  function removeColumnFromDesign(index) {
    setDesignBoard(prev => {
      const cols = prev.columns.filter((_, idx) => idx !== index);
      return { ...prev, columns: cols };
    });
  }

  // Screenshot pasted into the description becomes the card cover — it uploads with the save,
  // same path as picking the file by hand.
  function pasteImage(e) {
    const file = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    setImageFile(file);
    toast('Image attached as card cover', 'info');
  }

  function colTasks(col) { return tasks.filter(t => t.column === col); }
  const getAssigneeLabel = (task) => task.assigneeName || task.assignee || 'Unassigned';
  const getAssignedByLabel = (task) => task.assignedByName || 'System';

  return (
    <>
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div><h1>Project Board</h1><p>Task tracking with color coding & cover image attachments</p></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {activeProject && (
            <button className="btn btn-secondary btn-sm" onClick={() => openEditBoard(project)}>
              Design Layout
            </button>
          )}
          <button className="btn btn-secondary btn-sm board-fullscreen-btn" onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </div>
      <div className={`page-body ${isFullscreen ? 'board-fullscreen' : ''}`}>
        {isFullscreen && (
          <button className="board-exit-fullscreen-btn" onClick={() => setIsFullscreen(false)} title="Exit Fullscreen (Esc)">
            ✕
          </button>
        )}
        {/* Project tabs */}
        <div ref={tabsRef} className="board-tabs" style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', overflowX: 'auto', marginBottom: 12 }}>
          {orderedBoards.map(p => (
            <button
              key={p._id}
              data-drag-id={p._id}
              className={`board-tab${project===p._id?' active':''}${draggingId===p._id?' board-tab--dragging':''}`}
              title="Drag left or right to reorder"
              onPointerDown={e => startReorder(e, p._id, {
                axis: 'x',
                container: () => tabsRef.current,
                ids: boards.map(b => b._id),
                onPreview: setTabOrder,
                onSettle: saveBoardOrder,
              })}
              onClick={() => {
                // Suppress the click the browser fires at the end of a drag.
                if (dragMoved.current) return;
                selectProject(p._id);
              }}
              style={project===p._id ? { background: p.color, borderColor: p.color, color: '#fff' } : {}}>
              {(project === p._id && isLoading) ? (
                <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'authSpin 0.6s linear infinite' }} />
              ) : (
                <span className="proj-dot" style={{ background: project===p._id ? '#fff' : p.color }} />
              )}
              {p.label}
            </button>
          ))}
          <button className="board-tab" onClick={openAddBoard}
            style={{
              padding: '6px 12px', background: 'var(--surface2)', border: '1px dashed var(--border)',
              borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 12.5, fontWeight: 550, color: 'var(--text2)'
            }}>
            <span>+</span> Add Board
          </button>
        </div>

        {/* Board header — same markup for every board, accent comes from the board itself */}
        {activeProject && (
          <div className="board-banner" style={{ background: activeProject.color }}>
            <div>
              <div className="board-banner-title">{activeProject.label}</div>
              <div className="board-banner-sub">{columns.length} stage{columns.length === 1 ? '' : 's'} · {tasks.length} task{tasks.length === 1 ? '' : 's'}</div>
            </div>
          </div>
        )}

        {/* Kanban board */}
        <div className="kanban-wrapper" style={{ position: 'relative', minHeight: '50vh' }}>
          {!boardsLoading && !boards.length && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)', fontSize: 13 }}>
              No boards yet. Use <strong>+ Add Board</strong> above to create one.
            </div>
          )}
          <div className="kanban">
            {columns.map(col => {
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
                    <div key={t._id} className={`k-card card-color-${t.color || 'blue'}`} draggable
                      onDragStart={() => onDragStart(t._id)} onClick={() => openViewTask(t)}>

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
                            {(t.tags||[]).map(tg => <span key={tg} className="k-tag">{tg}</span>)}
                          </div>
                          <div style={{ display:'flex', gap:8, fontSize:11, flexWrap: 'wrap' }}>
                            <span className="text-muted" style={{ fontWeight: 500 }}>By: {getAssignedByLabel(t)}</span>
                            <span className="text-muted" style={{ fontWeight: 500 }}>
                              To: {(t.assignees?.length ? t.assignees.map(a => a.name).join(', ') : (t.assigneeName || t.assignee || 'Unassigned'))}
                            </span>
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
                        {hasColumn('done') && t.column !== 'done' && <button className="k-card-btn k-card-btn--done" onClick={(e) => { e.stopPropagation(); markTaskDone(t._id); }}>Done</button>}
                        {hasColumn('cancelled') && t.column !== 'cancelled' && <button className="k-card-btn k-card-btn--cancel" onClick={(e) => { e.stopPropagation(); cancelTask(t._id); }}>Cancel</button>}
                        <button className="k-card-btn k-card-btn--edit" onClick={(e) => { e.stopPropagation(); openEdit(t); }}>Edit</button>
                        <button className="k-card-btn k-card-btn--delete" onClick={(e) => { e.stopPropagation(); del(t._id); }}>Delete</button>
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
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Task' : `Add to ${columns.find(c=>c.id===editCol)?.label || 'Stage'}`}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></>}>
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

        <div className="form-group"><label>Description</label><textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} onPaste={pasteImage} placeholder="Optional details... (paste an image to attach it as the cover)" /></div>
        <div className="form-row">
          <div className="form-group"><label>Priority</label>
            <select value={form.priority} onChange={e => setForm(f=>({...f,priority:e.target.value}))}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </div>
          <div className="form-group"><label>Column</label>
            <select value={editCol} onChange={e => setEditCol(e.target.value)}>
              {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        </div>
        {/* Multi-assignee picker with search */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ margin: 0 }}>Assign to (select multiple)</label>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
              {users.length} account{users.length !== 1 ? 's' : ''}
            </span>
          </div>
          <input 
            type="text" 
            placeholder="Search accounts by name or email..." 
            value={assigneeSearch} 
            onChange={e => setAssigneeSearch(e.target.value)}
            style={{ marginBottom: 8, padding: '6px 10px', fontSize: 12 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
            {users
              .filter(u => 
                (u.name || '').toLowerCase().includes(assigneeSearch.toLowerCase()) ||
                (u.email || '').toLowerCase().includes(assigneeSearch.toLowerCase()) ||
                (u.username || '').toLowerCase().includes(assigneeSearch.toLowerCase())
              )
              .map(u => {
                const isChecked = (form.assignees || []).some(a => String(a.userId) === String(u._id));
                return (
                  <label key={u._id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '4px 0' }}>
                    <input type="checkbox" style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
                      checked={isChecked}
                      onChange={() => {
                        setForm(f => {
                          const existing = f.assignees || [];
                          if (isChecked) return { ...f, assignees: existing.filter(a => String(a.userId) !== String(u._id)) };
                          return { ...f, assignees: [...existing, { userId: u._id, name: u.name, email: u.email }] };
                        });
                      }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{u.email}</div>
                    </div>
                  </label>
                );
              })}
            {users.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>No accounts found</div>}
          </div>
          {(form.assignees || []).length > 0 && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>
              Selected ({form.assignees.length}): {form.assignees.map(a => a.name).join(', ')}
            </div>
          )}
        </div>
        <div className="form-row">
          <div className="form-group"><label>Tags (comma separated)</label><input value={form.tags} onChange={e => setForm(f=>({...f,tags:e.target.value}))} placeholder="bug, feature, audio" /></div>
          <div className="form-group"><label>Due Date</label><input type="date" value={form.dueDate} onChange={e => setForm(f=>({...f,dueDate:e.target.value}))} /></div>
        </div>
        <div className="form-group"><label>Card Cover Picture</label><input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0] || null)} />
          {imageFile && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{imageFile.name || 'Pasted image'} — uploads on save <button className="btn btn-secondary btn-sm" style={{ padding: '2px 6px', fontSize: 10, marginLeft: 6 }} onClick={() => setImageFile(null)}>Clear</button></div>}</div>
      </Modal>

      <Modal open={!!viewingTask} onClose={() => { setViewingTask(null); setDetailComments([]); setCommentText(''); }} title="Task Details" footer={<button className="btn btn-secondary" onClick={() => { setViewingTask(null); setDetailComments([]); setCommentText(''); }}>Close</button>}>
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
                <div style={{ fontSize: 13 }}>{columns.find(c => c.id === viewingTask.column)?.label || viewingTask.column}</div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>Assignees</label>
                <div style={{ fontSize: 13 }}>
                  {viewingTask.assignees?.length
                    ? viewingTask.assignees.map(a => a.name).join(', ')
                    : (viewingTask.assigneeName || viewingTask.assignee || 'Unassigned')}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>Assigned By</label>
                <div style={{ fontSize: 13 }}>{viewingTask.assignedByName || 'System'}</div>
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

            {/* Discussion Thread */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Discussion ({detailComments.length})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', marginBottom: 10, padding: '2px 0' }}>
                {detailComments.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', padding: '10px 0', textAlign: 'center' }}>No comments yet. Start the discussion below.</div>
                )}
                {detailComments.map((c, i) => (
                  <div key={c._id || i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text2)', flexShrink: 0 }}>
                      {(c.authorName || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{c.authorName || 'Unknown'}</span>
                        <span style={{ fontSize: 10, color: 'var(--text3)' }}>{new Date(c.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        {user?._id && (String(user._id) === String(c.authorId) || user.role === 'admin') && (
                          <button
                            onClick={async () => {
                              try {
                                await tasksApi.deleteComment(viewingTask._id, c._id);
                                setDetailComments(prev => prev.filter(cm => cm._id !== c._id));
                                mutate(swrKey);
                              } catch { toast('Failed to delete comment', 'error'); }
                            }}
                            style={{ marginLeft: 'auto', fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', opacity: 0.7 }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{c.text}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  rows={2}
                  style={{ flex: 1, resize: 'none', fontSize: 13, borderRadius: 8, padding: '8px 10px', minHeight: 60 }}
                  onKeyDown={async e => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      if (!commentText.trim() || commentSaving) return;
                      setCommentSaving(true);
                      try {
                        const res = await tasksApi.addComment(viewingTask._id, commentText);
                        setDetailComments(prev => [...prev, res.data]);
                        setCommentText('');
                        mutate(swrKey);
                      } catch { toast('Failed to post comment', 'error'); }
                      finally { setCommentSaving(false); }
                    }
                  }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!commentText.trim() || commentSaving}
                  onClick={async () => {
                    if (!commentText.trim() || commentSaving) return;
                    setCommentSaving(true);
                    try {
                      const res = await tasksApi.addComment(viewingTask._id, commentText);
                      setDetailComments(prev => [...prev, res.data]);
                      setCommentText('');
                      mutate(swrKey);
                    } catch { toast('Failed to post comment', 'error'); }
                    finally { setCommentSaving(false); }
                  }}
                  style={{ alignSelf: 'flex-end', height: 36 }}
                >
                  {commentSaving ? '...' : 'Post'}
                </button>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Ctrl+Enter to post</div>
            </div>
          </div>
        )}
      </Modal>

      {/* Board Design Modal */}
      <Modal open={designModal} onClose={() => setDesignModal(false)} title={designBoard.id ? 'Edit Board Layout' : 'Create New Board'}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            {designBoard.id && boards.length > 1 ? (
              <button className="btn btn-danger" onClick={() => deleteBoard(designBoard.id)}>Delete Board</button>
            ) : <div />}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setDesignModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveBoard} disabled={boardSaving}>{boardSaving ? 'Saving...' : 'Save Board'}</button>
            </div>
          </div>
        }
      >
        <div className="form-group">
          <label>Board Name *</label>
          <input value={designBoard.label} onChange={e => setDesignBoard(b => ({ ...b, label: e.target.value }))} placeholder="e.g. Design Team, Marketing" />
        </div>

        <div className="form-group">
          <label>Accent Color</label>
          <div className="color-picker-row">
            {COLORS.map(c => (
              <div key={c.id}
                className={`color-dot-opt${designBoard.color === c.id ? ' selected' : ''}`}
                style={{ background: c.hex }}
                title={c.id}
                onClick={() => setDesignBoard(b => ({ ...b, color: c.id }))} />
            ))}
          </div>
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ margin: 0 }}>Columns / Stages</label>
            <button className="btn btn-secondary btn-sm" onClick={addColumnToDesign} style={{ padding: '4px 10px', fontSize: 11.5 }}>+ Add Stage</button>
          </div>
          <div ref={stagesRef} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: '10px' }}>
            {designBoard.columns.map((col, idx) => (
              <div key={col.id} data-drag-id={col.id}
                style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: draggingId === col.id ? 0.6 : 1 }}>
                <span title="Drag to reorder"
                  style={{ cursor: 'grab', touchAction: 'none', userSelect: 'none', color: 'var(--text3)', fontSize: 14, padding: '0 2px' }}
                  onPointerDown={e => startReorder(e, col.id, {
                    axis: 'y',
                    container: () => stagesRef.current,
                    ids: designBoard.columns.map(c => c.id),
                    onPreview: ids => setDesignBoard(b => ({ ...b, columns: ids.map(i => b.columns.find(c => c.id === i)) })),
                    onSettle: () => {},   // saved with the rest of the board
                  })}>⋮⋮</span>
                <input value={col.label} onChange={e => handleColumnNameChange(idx, e.target.value)} placeholder="Stage Name" style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} />
                <button className="btn btn-danger btn-sm" onClick={() => removeColumnFromDesign(idx)} disabled={designBoard.columns.length <= 1} style={{ padding: '4px 8px', fontSize: 11 }}>Remove</button>
              </div>
            ))}
            {designBoard.columns.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '12px 0' }}>No stages defined. Click "+ Add Stage" above.</div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
