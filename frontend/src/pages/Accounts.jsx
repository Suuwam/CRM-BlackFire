import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { usersApi, fetcher } from '../api';
import Modal from '../components/Modal';
import AccountPanel, { AccountAvatar } from '../components/AccountPanel';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';

const EMPTY = { name: '', username: '', email: '', password: '', role: 'member', active: true };

export default function Accounts() {
  const { user } = useAuth();
  const toast = useToast();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [panel, setPanel] = useState({ open: false, account: null, kind: 'admin' });

  // Fetch users and applications
  const { data: users = [] } = useSWR('/users', fetcher, { revalidateOnFocus: false });
  const { data: applications = [] } = useSWR('/users/applications', fetcher, { revalidateOnFocus: false });

  if (user?.role !== 'admin') {
    return (
      <div className="page-head">
        <div><h1>Accounts</h1><p>Admin access only.</p></div>
      </div>
    );
  }

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setModal(true);
  }

  function openEdit(account) {
    setEditing(account._id);
    setForm({
      name: account.name,
      username: account.username,
      email: account.email,
      password: '',
      role: account.role,
      active: account.active,
    });
    setModal(true);
  }

  async function save() {
    if (!form.name.trim() || !form.username.trim() || !form.email.trim()) {
      toast('Name, username, and email are required', 'error');
      return;
    }

    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;

      if (editing) {
        await usersApi.update(editing, payload);
        toast('Account updated', 'success');
      } else {
        if (!payload.password) {
          toast('Password is required for new accounts', 'error');
          return;
        }
        await usersApi.create(payload);
        toast('Account created', 'success');
      }

      setModal(false);
      mutate('/users');
    } catch (error) {
      toast(error?.response?.data?.error || 'Failed to save account', 'error');
    }
  }

  async function remove(id) {
    try {
      await usersApi.delete(id);
      toast('Account removed', 'info');
      mutate('/users');
    } catch (error) {
      toast(error?.response?.data?.error || 'Failed to remove account', 'error');
    }
  }

  async function handleApprove(appId) {
    try {
      await usersApi.approveApplication(appId);
      toast('Application approved successfully', 'success');
      mutate('/users');
      mutate('/users/applications');
    } catch (error) {
      toast(error?.response?.data?.error || 'Failed to approve application', 'error');
    }
  }

  async function handleApproveAll() {
    try {
      const res = await usersApi.approveAllApplications();
      toast(`Approved all ${res.data?.count || ''} account requests`, 'success');
      mutate('/users');
      mutate('/users/applications');
    } catch (error) {
      toast(error?.response?.data?.error || 'Failed to approve all applications', 'error');
    }
  }

  async function handleReject(appId) {
    try {
      await usersApi.rejectApplication(appId);
      toast('Application rejected', 'info');
      mutate('/users');
      mutate('/users/applications');
    } catch (error) {
      toast(error?.response?.data?.error || 'Failed to reject application', 'error');
    }
  }

  const pendingApps = applications.filter(a => a.status === 'pending' || a.status === 'rejected');

  return (
    <>
      <div className="page-head">
        <div><h1>Accounts</h1><p>Manage access and roles across sessions.</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Account</button>
      </div>

      <div className="page-body">
        {/* Account Requests Section */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div className="section-title" style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Account Requests ({pendingApps.length})
            </div>
            {pendingApps.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                style={{ background: '#16a34a', borderColor: '#16a34a', color: '#fff', fontSize: '12px', padding: '4px 12px' }}
                onClick={handleApproveAll}
              >
                ✓ Approve All ({pendingApps.length})
              </button>
            )}
          </div>
          {pendingApps.length === 0 ? (
            <div className="card empty" style={{ padding: '32px', textAlign: 'center', background: 'var(--surface)', color: 'var(--text3)' }}>
              <div className="empty-ico" style={{ fontSize: '24px', marginBottom: '8px' }}>✓</div>
              No pending registration requests.
            </div>
          ) : (
            <div className="accounts-grid">
              {pendingApps.map(app => (
                <div className="account-card" key={app._id} style={{ borderLeft: app.status === 'rejected' ? '4px solid #ef4444' : '4px solid var(--accent)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div className="account-top">
                      <div className="account-top-left">
                        <AccountAvatar
                          name={app.name}
                          size={36}
                          onClick={() => setPanel({ open: true, account: app, kind: 'application' })}
                          title="Account, email & information"
                        />
                        <div>
                          <div className="account-name">{app.name}</div>
                          <div className="account-meta" style={{ fontSize: '12px', marginTop: '4px' }}>
                            @{app.username} · {app.email}
                          </div>
                        </div>
                      </div>
                      <span className={`tag ${app.status === 'rejected' ? 'tag-gray' : 'tag-amber'}`} style={{ textTransform: 'uppercase', fontSize: '10px' }}>
                        {app.status}
                      </span>
                    </div>

                    {app.note && (
                      <div style={{ marginTop: '12px', padding: '8px 12px', background: 'var(--surface2)', borderRadius: 'var(--r-sm)', fontSize: '12px', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                        <strong>Note:</strong> {app.note}
                      </div>
                    )}
                  </div>

                  <div className="client-foot" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="text-sm text-muted" style={{ fontSize: '11px' }}>Applied {new Date(app.createdAt).toLocaleDateString()}</div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" className="btn btn-sm btn-primary" style={{ background: '#16a34a', borderColor: '#16a34a', color: '#fff' }} onClick={() => handleApprove(app._id)}>Approve</button>
                      {app.status !== 'rejected' && (
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => handleReject(app._id)}>Reject</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="divider" style={{ margin: '32px 0' }}></div>

        {/* Registered Users Section */}
        <div>
          <div className="section-title" style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
            Active Accounts ({users.length})
          </div>
          {users.length === 0 ? (
            <div className="card empty" style={{ padding: '32px', textAlign: 'center' }}>
              No registered accounts found.
            </div>
          ) : (
            <div className="accounts-grid">
              {users.map(account => (
                <div className="account-card" key={account._id}>
                  <div className="account-top">
                    <div className="account-top-left">
                      <AccountAvatar
                        name={account.name}
                        size={36}
                        onClick={() => setPanel({
                          open: true,
                          account,
                          kind: String(account._id) === String(user?._id) ? 'self' : 'admin',
                        })}
                        title="Account, email & password"
                      />
                      <div>
                        <div className="account-name">{account.name}</div>
                        <div className="account-meta">{account.username} · {account.email}</div>
                      </div>
                    </div>
                    <span className={`tag ${account.role === 'admin' ? 'tag-amber' : 'tag-gray'}`} style={{ textTransform: 'uppercase', fontSize: '10px' }}>{account.role}</span>
                  </div>
                  <div className="account-state" style={{ marginTop: '12px', fontSize: '12px', color: account.active ? '#16a34a' : 'var(--text3)' }}>
                    ● {account.active ? 'Active' : 'Disabled'}
                  </div>
                  <div className="client-foot" style={{ marginTop: 16 }}>
                    <div className="text-sm text-muted">Created {new Date(account.createdAt).toLocaleDateString()}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(account)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => remove(account._id)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AccountPanel
        open={panel.open}
        onClose={() => setPanel({ open: false, account: null, kind: 'admin' })}
        account={panel.account}
        kind={panel.kind}
        onUpdated={() => {
          mutate('/users');
          mutate('/users/applications');
        }}
      />

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Edit Account' : 'Add Account'}
        large
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>{editing ? 'Update' : 'Create'}</button>
          </>
        )}
      >
        <div className="form-row">
          <div className="form-group"><label>Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="form-group"><label>Username</label><input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div className="form-group"><label>Password {editing ? '(leave blank to keep)' : ''}</label><input type="password" autoComplete="new-password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Role</label><select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}><option value="member">Member</option><option value="admin">Admin</option></select></div>
          <div className="form-group"><label>Status</label><select value={form.active ? 'active' : 'disabled'} onChange={e => setForm(f => ({ ...f, active: e.target.value === 'active' }))}><option value="active">Active</option><option value="disabled">Disabled</option></select></div>
        </div>
      </Modal>
    </>
  );
}