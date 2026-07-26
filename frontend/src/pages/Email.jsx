import { useEffect, useState } from 'react';
import { templatesApi, clientsApi } from '../api';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

const TOKENS = ['{{name}}','{{company}}','{{email}}','{{phone}}','{{project}}'];
const EMPTY_TPL = { name:'', subject:'', body:'' };

function substitute(text, client) {
  if (!client) return text;
  return text
    .replace(/\{\{name\}\}/g, client.name || '')
    .replace(/\{\{company\}\}/g, client.company || '')
    .replace(/\{\{email\}\}/g, client.email || '')
    .replace(/\{\{phone\}\}/g, client.phone || '')
    .replace(/\{\{project\}\}/g, client.project || '');
}

export default function Email() {
  const [templates, setTemplates] = useState([]);
  const [clients, setClients]     = useState([]);
  const [selTpl, setSelTpl]       = useState(null);
  const [selClient, setSelClient] = useState('');
  const [modal, setModal]         = useState(false);
  const [form, setForm]           = useState(EMPTY_TPL);
  const [editing, setEditing]     = useState(null);
  const toast = useToast();

  async function load() {
    const [t, c] = await Promise.all([templatesApi.list(), clientsApi.list()]);
    setTemplates(t.data);
    setClients(c.data);
    if (!selTpl && t.data.length > 0) setSelTpl(t.data[0]);
  }
  useEffect(() => { load(); }, []);

  function openAdd()  { setForm(EMPTY_TPL); setEditing(null); setModal(true); }
  function openEdit() { if(!selTpl) return; setForm({name:selTpl.name,subject:selTpl.subject,body:selTpl.body}); setEditing(selTpl._id); setModal(true); }

  async function save() {
    if (!form.name.trim()) return toast('Name required', 'error');
    try {
      if (editing) { const r = await templatesApi.update(editing, form); setSelTpl(r.data); }
      else         { const r = await templatesApi.create(form); setSelTpl(r.data); }
      toast('Saved', 'success'); setModal(false); load();
    } catch { toast('Error', 'error'); }
  }

  async function del() {
    if (!selTpl || !confirm('Delete template?')) return;
    await templatesApi.delete(selTpl._id);
    setSelTpl(null); toast('Deleted', 'success'); load();
  }

  function insertToken(token) {
    setForm(f => ({ ...f, body: f.body + token }));
  }

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

  return (
    <>
      <div className="page-head">
        <div><h1>Email Automation</h1><p>Templates with client variable substitution</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ New Template</button>
      </div>
      <div className="page-body">
        <div className="email-layout">
          {/* Template list */}
          <div>
            <div className="section-title">Templates</div>
            <div className="tpl-list">
              {templates.map(t => (
                <div key={t._id} className={`tpl-item${selTpl?._id===t._id?' active':''}`} onClick={() => setSelTpl(t)}>
                  <div className="tpl-name">{t.name}</div>
                  <div className="tpl-sub">{t.subject}</div>
                </div>
              ))}
              {templates.length === 0 && <p className="text-sm text-muted">No templates yet.</p>}
            </div>
          </div>

          {/* Composer */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Client selector */}
            <div className="card">
              <div className="section-title" style={{ marginBottom:10 }}>Client Variables</div>
              <div className="form-row" style={{ marginBottom:10 }}>
                <div className="form-group">
                  <label>Select Client to Fill Variables</label>
                  <select value={selClient} onChange={e => setSelClient(e.target.value)}>
                    <option value="">— Choose client —</option>
                    {clients.map(c => <option key={c._id} value={c._id}>{c.name} — {c.company}</option>)}
                  </select>
                </div>
              </div>
              <div className="section-title" style={{ fontSize:11, marginBottom:6 }}>Available Tokens (click to copy into editor)</div>
              <div className="token-pills">
                {TOKENS.map(t => <button key={t} className="token-pill" onClick={() => insertToken(t)}>{t}</button>)}
              </div>
            </div>

            {selTpl ? (
              <div className="card">
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                  <div style={{ fontWeight:650, fontSize:14 }}>{selTpl.name}</div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button className="btn btn-sm btn-secondary" onClick={openEdit}>Edit Template</button>
                    <button className="btn btn-sm btn-danger" onClick={del}>Delete</button>
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom:12 }}>
                  <label>Subject Preview</label>
                  <div className="preview-box" style={{ minHeight:'auto', padding:'8px 12px', fontSize:13 }}>{subjectPreview || selTpl.subject}</div>
                </div>
                <div className="form-group" style={{ marginBottom:14 }}>
                  <label>Body Preview</label>
                  <div className="preview-box">{preview}</div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-primary" onClick={copyBody}>📋 Copy Body</button>
                  {client && <a href={mailtoLink} className="btn btn-secondary">✉️ Open in Mail</a>}
                </div>
              </div>
            ) : (
              <div className="empty"><div className="empty-ico">✉️</div><p>Select a template to preview</p></div>
            )}
          </div>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Template' : 'New Template'} large
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div className="form-group"><label>Template Name</label><input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Project Proposal" /></div>
        <div className="form-group"><label>Subject Line</label><input value={form.subject} onChange={e => setForm(f=>({...f,subject:e.target.value}))} placeholder="Use {{name}}, {{company}}, etc." /></div>
        <div className="form-group">
          <label>Body</label>
          <div className="token-pills" style={{ marginBottom:6 }}>
            {TOKENS.map(t => <button key={t} className="token-pill" onClick={() => setForm(f=>({...f,body:f.body+t}))}>{t}</button>)}
          </div>
          <textarea rows={10} value={form.body} onChange={e => setForm(f=>({...f,body:e.target.value}))} placeholder="Write your email body. Use tokens like {{name}} for personalisation." />
        </div>
      </Modal>
    </>
  );
}
