import { useEffect, useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { templatesApi, emailApi, fetcher } from '../api';
import Modal from '../components/Modal';
import { AccountAvatar } from '../components/Avatar';
import { useToast } from '../components/Toast';

const TOKENS = ['{{name}}', '{{email}}', '{{username}}', '{{role}}'];
const EMPTY_TPL = { name: '', subject: '', body: '' };
const DRAFT_KEY = id => `crm_email_draft_${id || 'new'}`;

function saveDraft(id, form) {
  try { sessionStorage.setItem(DRAFT_KEY(id), JSON.stringify({ form, ts: Date.now() })); } catch {}
}
function loadDraft(id) {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY(id));
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (Date.now() - d.ts > 86400000) { sessionStorage.removeItem(DRAFT_KEY(id)); return null; }
    return d;
  } catch { return null; }
}
function clearDraft(id) { try { sessionStorage.removeItem(DRAFT_KEY(id)); } catch {} }

function substitute(text, employee) {
  if (!employee || !text) return text || '';
  return text
    .replace(/\{\{name\}\}/g, employee.name || '')
    .replace(/\{\{email\}\}/g, employee.email || '')
    .replace(/\{\{username\}\}/g, employee.username || '')
    .replace(/\{\{role\}\}/g, employee.role || '');
}

export default function Email() {
  const [selTpl, setSelTpl] = useState(null);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_TPL);
  const [editing, setEditing] = useState(null);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState(null);
  const toast = useToast();

  const { data: templates = [] } = useSWR('/templates', fetcher, {
    revalidateOnFocus: false,
    onSuccess: data => { if (!selTpl && data.length) setSelTpl(data[0]); },
  });
  const { data: users = [] } = useSWR('/users', fetcher, { revalidateOnFocus: false });

  const employees = useMemo(() => users
    .filter(u => u.active !== false)
    .filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()) || (u.email || '').includes(search.toLowerCase())),
  [users, search]);

  useEffect(() => { if (modal) saveDraft(editing, form); }, [modal, form, editing]);

  function openAdd() {
    const draft = loadDraft(null);
    setForm(draft?.form?.name?.trim() ? draft.form : EMPTY_TPL);
    setEditing(null); setModal(true);
    if (draft?.form?.name?.trim()) toast('Restored unsaved draft', 'info');
  }

  function openEdit() {
    if (!selTpl) return;
    const draft = loadDraft(selTpl._id);
    setForm(draft?.form?.name?.trim() ? draft.form : { name: selTpl.name, subject: selTpl.subject, body: selTpl.body });
    setEditing(selTpl._id); setModal(true);
  }

  async function save() {
    if (!form.name.trim()) return toast('Name required', 'error');
    try {
      const res = editing ? await templatesApi.update(editing, form) : await templatesApi.create(form);
      setSelTpl(res.data);
      clearDraft(editing);
      toast('Template saved', 'success');
      setModal(false);
      mutate('/templates');
    } catch { toast('Error saving template', 'error'); }
  }

  async function del() {
    if (!selTpl) return;
    mutate('/templates', templates.filter(t => t._id !== selTpl._id), false);
    const id = selTpl._id;
    setSelTpl(null);
    toast('Template deleted', 'info');
    await templatesApi.delete(id);
    mutate('/templates');
  }

  function toggle(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const recipients = employees.filter(e => selected.includes(e._id));
  const previewFor = recipients[0] || employees[0] || null;
  const subjectPreview = selTpl ? substitute(selTpl.subject, previewFor) : '';
  const bodyPreview = selTpl ? substitute(selTpl.body, previewFor) : '';

  async function handleSend() {
    if (!selTpl) return toast('Select a template first', 'error');
    if (!selected.length) return toast('Select at least one employee', 'error');
    setSending(true);
    setResults(null);
    try {
      const res = await emailApi.send({ employeeIds: selected, subject: selTpl.subject, body: selTpl.body });
      setResults(res.data);
      toast(`Sent ${res.data.sent} · Failed ${res.data.failed}`, res.data.failed === 0 ? 'success' : 'info');
    } catch (e) {
      toast(e?.response?.data?.error || 'Send failed', 'error');
    } finally { setSending(false); }
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Email</h1><p>Employee directory and templates with variable substitution</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ New Template</button>
      </div>

      <div className="page-body">
        <div className="email-layout">
          <div className="email-col">
            <div className="section-title">Templates</div>
            <div className="tpl-list">
              {templates.map(t => (
                <div key={t._id} className={`tpl-item${selTpl?._id === t._id ? ' active' : ''}`} onClick={() => setSelTpl(t)}>
                  <div className="tpl-name">{t.name}</div>
                  <div className="tpl-sub">{t.subject}</div>
                </div>
              ))}
              {templates.length === 0 && <p className="text-sm text-muted">No templates yet.</p>}
            </div>

            <div className="section-title" style={{ marginTop: 20 }}>
              Employees
              <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto', fontSize: 11 }}
                onClick={() => setSelected(selected.length === employees.length ? [] : employees.map(e => e._id))}>
                {selected.length === employees.length && employees.length ? 'Clear' : 'Select all'}
              </button>
            </div>
            <div className="search" style={{ marginBottom: 8 }}>
              <span className="search-ico">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="emp-list">
              {employees.map(e => (
                <label key={e._id} className={`emp-item${selected.includes(e._id) ? ' on' : ''}`}>
                  <input type="checkbox" checked={selected.includes(e._id)} onChange={() => toggle(e._id)} />
                  <AccountAvatar name={e.name} photo={e.photo} size={30} />
                  <div style={{ minWidth: 0 }}>
                    <div className="emp-name">{e.name}</div>
                    <div className="emp-mail">{e.email || <span style={{ color: '#ef4444' }}>No email</span>}</div>
                  </div>
                  <span className="emp-role">{e.role}</span>
                </label>
              ))}
              {employees.length === 0 && <p className="text-sm text-muted">No employees found.</p>}
            </div>
          </div>

          <div className="email-composer">
            {selTpl ? (
              <div className="card">
                <div className="composer-head">
                  <div>
                    <div className="composer-title">{selTpl.name}</div>
                    <div className="text-sm text-muted">
                      {recipients.length ? `${recipients.length} recipient${recipients.length > 1 ? 's' : ''} selected` : 'Select employees on the left'}
                      {previewFor && ` · preview as ${previewFor.name}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm btn-secondary" onClick={openEdit}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={del}>Delete</button>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label>Subject</label>
                  <div className="preview-box" style={{ minHeight: 'auto', padding: '8px 12px', fontSize: 13 }}>{subjectPreview || selTpl.subject}</div>
                </div>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label>Body</label>
                  <div className="preview-box">{bodyPreview}</div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => { navigator.clipboard.writeText(bodyPreview); toast('Copied to clipboard', 'success'); }}>Copy body</button>
                  <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={handleSend} disabled={sending || !selected.length}>
                    {sending ? 'Sending…' : selected.length ? `Send to ${selected.length} employee${selected.length > 1 ? 's' : ''}` : 'Select employees'}
                  </button>
                </div>

                {results && (
                  <div className="send-results">
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>{results.sent} sent · {results.failed} failed</div>
                    {results.results.map((r, i) => (
                      <div key={i} className="send-result-row">
                        <span>{r.name}</span>
                        <span style={{ color: r.status === 'sent' ? '#16a34a' : r.status === 'failed' ? '#ef4444' : 'var(--text3)', fontWeight: 600 }}>{r.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="empty">
                <div className="empty-ico">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                </div>
                <p>Select or create a template to start</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Template' : 'New Template'} large
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div className="form-group"><label>Template Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Weekly standup" /></div>
        <div className="form-group"><label>Subject Line</label><input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Use {{name}}, {{role}}, etc." /></div>
        <div className="form-group">
          <label>Body</label>
          <div className="token-pills" style={{ marginBottom: 6 }}>
            {TOKENS.map(t => <button key={t} className="token-pill" onClick={() => setForm(f => ({ ...f, body: f.body + t }))}>{t}</button>)}
          </div>
          <textarea rows={10} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Write your email. Use tokens like {{name}} for personalisation." />
        </div>
      </Modal>
    </>
  );
}
