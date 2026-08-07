import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { templatesApi, clientsApi, emailApi, fetcher } from '../api';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

const TOKENS = ['{{name}}','{{company}}','{{email}}','{{phone}}','{{project}}'];
const EMPTY_TPL = { name:'', subject:'', body:'' };

const EMAIL_DRAFT_PREFIX = 'crm_email_draft_';
function getEmailDraftKey(id) { return EMAIL_DRAFT_PREFIX + (id || 'new'); }
function saveEmailDraft(id, formData) {
  try { sessionStorage.setItem(getEmailDraftKey(id), JSON.stringify({ form: formData, ts: Date.now() })); } catch {}
}
function loadEmailDraft(id) {
  try {
    const raw = sessionStorage.getItem(getEmailDraftKey(id));
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (Date.now() - d.ts > 86400000) { sessionStorage.removeItem(getEmailDraftKey(id)); return null; }
    return d;
  } catch { return null; }
}
function clearEmailDraft(id) { try { sessionStorage.removeItem(getEmailDraftKey(id)); } catch {} }

function substitute(text, client) {
  if (!client) return text;
  return text
    .replace(/\{\{name\}\}/g,    client.name    || '')
    .replace(/\{\{company\}\}/g, client.company || '')
    .replace(/\{\{email\}\}/g,   client.email   || '')
    .replace(/\{\{phone\}\}/g,   client.phone   || '')
    .replace(/\{\{project\}\}/g, client.project || '');
}

export default function Email() {
  const [selTpl,       setSelTpl]       = useState(null);
  const [selClient,    setSelClient]    = useState('');
  const [modal,        setModal]        = useState(false);
  const [form,         setForm]         = useState(EMPTY_TPL);
  const [editing,      setEditing]      = useState(null);
  const [bulkOpen,     setBulkOpen]     = useState(false);
  const [bulkSelected, setBulkSelected] = useState([]);
  const [sending,      setSending]      = useState(false);
  const [bulkSending,  setBulkSending]  = useState(false);
  const [bulkResults,  setBulkResults]  = useState(null);
  const toast = useToast();

  const { data: templates = [] } = useSWR('/templates', fetcher, {
    revalidateOnFocus: false,
    onSuccess: (data) => { if (!selTpl && data.length > 0) setSelTpl(data[0]); }
  });
  const { data: clients = [] } = useSWR('/clients', fetcher, { revalidateOnFocus: false });

  useEffect(() => {
    if (modal) saveEmailDraft(editing, form);
  }, [modal, form, editing]);

  function openAdd() {
    const draft = loadEmailDraft(null);
    if (draft?.form?.name?.trim()) {
      setForm(draft.form); setEditing(null); setModal(true);
      toast('Restored unsaved draft', 'info');
    } else {
      setForm(EMPTY_TPL); setEditing(null); setModal(true);
    }
  }
  function openEdit() {
    if (!selTpl) return;
    const draft = loadEmailDraft(selTpl._id);
    if (draft?.form?.name?.trim()) {
      setForm(draft.form); setEditing(selTpl._id); setModal(true);
      toast('Restored unsaved edits', 'info');
    } else {
      setForm({ name: selTpl.name, subject: selTpl.subject, body: selTpl.body });
      setEditing(selTpl._id); setModal(true);
    }
  }

  async function save() {
    if (!form.name.trim()) return toast('Name required', 'error');
    try {
      if (editing) {
        const r = await templatesApi.update(editing, form);
        setSelTpl(r.data);
      } else {
        const r = await templatesApi.create(form);
        setSelTpl(r.data);
      }
      clearEmailDraft(editing);
      toast('Saved', 'success'); setModal(false);
      mutate('/templates');
    } catch { toast('Error saving template', 'error'); }
  }

  async function del() {
    if (!selTpl) return;
    mutate('/templates', templates.filter(t => t._id !== selTpl._id), false);
    setSelTpl(null);
    toast('Template deleted', 'info');
    await templatesApi.delete(selTpl._id);
    mutate('/templates');
  }

  function insertToken(token) { setForm(f => ({ ...f, body: f.body + token })); }

  const client = clients.find(c => c._id === selClient) || null;
  const preview = selTpl ? substitute(selTpl.body, client) : '';
  const subjectPreview = selTpl ? substitute(selTpl.subject, client) : '';
  const mailtoLink = client && selTpl
    ? `mailto:${client.email}?subject=${encodeURIComponent(subjectPreview)}&body=${encodeURIComponent(preview)}`
    : '#';

  function copyBody() {
    navigator.clipboard.writeText(preview);
    toast('Copied to clipboard', 'success');
  }

  // Direct send via SMTP
  async function handleSend() {
    if (!selTpl || !client) return toast('Select a template and client first', 'error');
    if (!client.email) return toast('Selected client has no email address', 'error');
    setSending(true);
    try {
      await emailApi.send({ clientId: client._id, subject: selTpl.subject, body: selTpl.body });
      toast(`Email sent to ${client.name} (${client.email})`, 'success');
    } catch (e) {
      toast(e?.response?.data?.error || 'Failed to send email', 'error');
    } finally { setSending(false); }
  }

  // Bulk send
  function toggleBulkClient(id) {
    setBulkSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handleBulkSend() {
    if (!selTpl) return toast('Select a template first', 'error');
    if (!bulkSelected.length) return toast('Select at least one client', 'error');
    setBulkSending(true);
    setBulkResults(null);
    try {
      const res = await emailApi.bulk({ clientIds: bulkSelected, subject: selTpl.subject, body: selTpl.body });
      setBulkResults(res.data);
      toast(`Sent ${res.data.sent} · Failed ${res.data.failed}`, res.data.failed === 0 ? 'success' : 'info');
    } catch (e) {
      toast(e?.response?.data?.error || 'Bulk send failed', 'error');
    } finally { setBulkSending(false); }
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Email Automation</h1><p>Templates with client variable substitution</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => { setBulkOpen(true); setBulkResults(null); setBulkSelected([]); }}>Bulk Send</button>
          <button className="btn btn-primary" onClick={openAdd}>+ New Template</button>
        </div>
      </div>

      <div className="page-body">
        <div className="email-layout">
          {/* Template list */}
          <div>
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
          </div>

          {/* Composer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Client selector */}
            <div className="card">
              <div className="section-title" style={{ marginBottom: 10 }}>Client Variables</div>
              <div className="form-row" style={{ marginBottom: 10 }}>
                <div className="form-group">
                  <label>Select Client to Fill Variables</label>
                  <select value={selClient} onChange={e => setSelClient(e.target.value)}>
                    <option value="">Choose client</option>
                    {clients.map(c => <option key={c._id} value={c._id}>{c.name} ({c.company})</option>)}
                  </select>
                </div>
              </div>
              <div className="section-title" style={{ fontSize: 11, marginBottom: 6 }}>Available Tokens (click to insert into editor)</div>
              <div className="token-pills">
                {TOKENS.map(t => <button key={t} className="token-pill" onClick={() => insertToken(t)}>{t}</button>)}
              </div>
            </div>

            {selTpl ? (
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontWeight: 650, fontSize: 14 }}>{selTpl.name}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm btn-secondary" onClick={openEdit}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={del}>Delete</button>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label>Subject Preview</label>
                  <div className="preview-box" style={{ minHeight: 'auto', padding: '8px 12px', fontSize: 13 }}>
                    {subjectPreview || selTpl.subject}
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label>Body Preview</label>
                  <div className="preview-box">{preview}</div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-sm btn-secondary" onClick={copyBody}>📋 Copy Body</button>
                  {client && <a href={mailtoLink} className="btn btn-sm btn-secondary">✉️ Open in Mail Client</a>}
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={handleSend}
                    disabled={sending || !client}
                    title={!client ? 'Select a client first' : `Send to ${client.email}`}
                    style={{ marginLeft: 'auto' }}
                  >
                    {sending ? 'Sending…' : `🚀 Send${client ? ` to ${client.name}` : ''}`}
                  </button>
                </div>
              </div>
            ) : (
              <div className="empty"><div className="empty-ico">✉️</div><p>Select a template to preview</p></div>
            )}
          </div>
        </div>
      </div>

      {/* Template editor modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Template' : 'New Template'} large
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div className="form-group"><label>Template Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Project Proposal" /></div>
        <div className="form-group"><label>Subject Line</label><input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Use {{name}}, {{company}}, etc." /></div>
        <div className="form-group">
          <label>Body</label>
          <div className="token-pills" style={{ marginBottom: 6 }}>
            {TOKENS.map(t => <button key={t} className="token-pill" onClick={() => setForm(f => ({ ...f, body: f.body + t }))}>{t}</button>)}
          </div>
          <textarea rows={10} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Write your email body. Use tokens like {{name}} for personalisation." />
        </div>
      </Modal>

      {/* Bulk Send modal */}
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Bulk Send" large
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setBulkOpen(false)}>Close</button>
            <button className="btn btn-primary" onClick={handleBulkSend} disabled={bulkSending || !bulkSelected.length || !selTpl}>
              {bulkSending ? 'Sending…' : `Send to ${bulkSelected.length} client${bulkSelected.length !== 1 ? 's' : ''}`}
            </button>
          </>
        }
      >
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label>Template to send</label>
          <select value={selTpl?._id || ''} onChange={e => setSelTpl(templates.find(t => t._id === e.target.value) || null)}>
            <option value="">Select template</option>
            {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </div>

        <div className="section-title" style={{ marginBottom: 8 }}>
          Select Recipients
          <button className="btn btn-sm btn-ghost" style={{ marginLeft: 8, fontSize: 11 }}
            onClick={() => setBulkSelected(bulkSelected.length === clients.length ? [] : clients.map(c => c._id))}>
            {bulkSelected.length === clients.length ? 'Deselect all' : 'Select all'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
          {clients.map(c => (
            <label key={c._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: bulkSelected.includes(c._id) ? 'var(--surface2)' : 'transparent', cursor: 'pointer', transition: 'background 0.15s' }}>
              <input type="checkbox" checked={bulkSelected.includes(c._id)} onChange={() => toggleBulkClient(c._id)} style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.email || <span style={{ color: '#ef4444' }}>No email — will be skipped</span>}</div>
              </div>
            </label>
          ))}
        </div>

        {bulkResults && (
          <div style={{ marginTop: 16, padding: '12px', background: 'var(--surface2)', borderRadius: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Results: {bulkResults.sent} sent · {bulkResults.failed} failed</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {bulkResults.results.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>{r.name}</span>
                  <span style={{ color: r.status === 'sent' ? '#16a34a' : r.status === 'failed' ? '#ef4444' : 'var(--text3)', fontWeight: 600, textTransform: 'capitalize' }}>{r.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
