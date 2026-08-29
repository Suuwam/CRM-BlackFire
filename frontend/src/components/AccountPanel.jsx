import { useEffect, useState } from 'react';
import Modal from './Modal';
import { authApi, usersApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';

const PALETTE = ['#18181b', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#059669', '#0891b2', '#4f46e5'];

export function avatarColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initialsOf(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

export function AccountAvatar({ name, size = 32, onClick, title, className = '' }) {
  const style = {
    width: size,
    height: size,
    fontSize: Math.max(10, Math.round(size * 0.36)),
    background: avatarColor(name),
  };
  const content = initialsOf(name);
  if (onClick) {
    return (
      <button
        type="button"
        className={`account-avatar ${className}`.trim()}
        style={style}
        onClick={onClick}
        title={title || 'Account'}
        aria-label={title || 'Open account'}
      >
        {content}
      </button>
    );
  }
  return (
    <span className={`account-avatar ${className}`.trim()} style={style} title={title || name}>
      {content}
    </span>
  );
}

export default function AccountPanel({ open, onClose, account, kind = 'self', onUpdated }) {
  const toast = useToast();
  const { user: sessionUser, setUser } = useAuth();
  const [tab, setTab] = useState('account');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    role: 'member',
    active: true,
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const isApplication = kind === 'application';
  const isSelf = kind === 'self';
  const canEdit = !isApplication;

  useEffect(() => {
    if (!open || !account) return;
    setTab('account');
    setForm({
      name: account.name || '',
      username: account.username || '',
      email: account.email || '',
      role: account.role || 'member',
      active: account.active !== false,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  }, [open, account]);

  if (!account) return null;

  function persistSession(nextUser) {
    if (!nextUser) return;
    if (sessionUser && String(sessionUser._id) === String(nextUser._id)) {
      setUser(nextUser);
      sessionStorage.setItem('crm_session_user', JSON.stringify(nextUser));
      localStorage.setItem('crm_session_user', JSON.stringify(nextUser));
    }
  }

  async function saveAccount() {
    if (!form.name.trim()) {
      toast('Name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (isSelf) {
        const res = await authApi.updateMe({ name: form.name.trim() });
        persistSession(res.data.user);
        toast('Account information updated', 'success');
      } else {
        const res = await usersApi.update(account._id, {
          name: form.name.trim(),
          username: form.username.trim(),
          email: account.email,
          role: form.role,
          active: form.active,
        });
        persistSession(res.data);
        toast('Account information updated', 'success');
      }
      onUpdated?.();
    } catch (error) {
      toast(error?.response?.data?.error || 'Failed to update account', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveEmail() {
    if (!form.email.trim()) {
      toast('Email is required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (isSelf) {
        const res = await authApi.updateMe({ name: form.name.trim() || account.name, email: form.email.trim() });
        persistSession(res.data.user);
        toast('Email updated', 'success');
      } else {
        const res = await usersApi.update(account._id, {
          name: account.name,
          username: account.username,
          email: form.email.trim(),
          role: account.role,
          active: account.active,
        });
        persistSession(res.data);
        toast('Email updated', 'success');
      }
      onUpdated?.();
    } catch (error) {
      toast(error?.response?.data?.error || 'Failed to update email', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function savePassword() {
    if (!form.newPassword) {
      toast('Enter a new password', 'error');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast('Passwords do not match', 'error');
      return;
    }
    if (isSelf && !form.currentPassword) {
      toast('Current password is required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (isSelf) {
        const res = await authApi.updateMe({
          name: account.name,
          email: account.email,
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        });
        persistSession(res.data.user);
        toast('Password updated', 'success');
      } else {
        await usersApi.update(account._id, {
          name: account.name,
          username: account.username,
          email: account.email,
          role: account.role,
          active: account.active,
          password: form.newPassword,
        });
        toast('Password reset', 'success');
      }
      setForm(f => ({ ...f, currentPassword: '', newPassword: '', confirmPassword: '' }));
      onUpdated?.();
    } catch (error) {
      toast(error?.response?.data?.error || 'Failed to update password', 'error');
    } finally {
      setSaving(false);
    }
  }

  const tabs = [
    { id: 'account', label: 'Account' },
    { id: 'email', label: 'Email' },
    ...(!isApplication ? [{ id: 'password', label: isSelf ? 'Password' : 'Reset password' }] : []),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isSelf ? 'My account' : isApplication ? 'Application' : 'Account'}
      footer={(
        <>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          {canEdit && tab === 'account' && (
            <button className="btn btn-primary" disabled={saving} onClick={saveAccount}>
              {saving ? 'Saving…' : 'Save account'}
            </button>
          )}
          {canEdit && tab === 'email' && (
            <button className="btn btn-primary" disabled={saving} onClick={saveEmail}>
              {saving ? 'Saving…' : 'Save email'}
            </button>
          )}
          {canEdit && tab === 'password' && (
            <button className="btn btn-primary" disabled={saving} onClick={savePassword}>
              {saving ? 'Saving…' : isSelf ? 'Update password' : 'Reset password'}
            </button>
          )}
        </>
      )}
    >
      <div className="account-panel-head">
        <AccountAvatar name={account.name} size={44} />
        <div style={{ minWidth: 0 }}>
          <div className="account-panel-name">{account.name}</div>
          <div className="account-panel-meta">
            @{account.username}
            {account.role ? ` · ${account.role}` : account.status ? ` · ${account.status}` : ''}
          </div>
        </div>
      </div>

      <div className="account-panel-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            className={`account-panel-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'account' && (
        <div className="account-panel-section">
          <div className="form-group">
            <label>Name</label>
            <input
              value={form.name}
              disabled={!canEdit}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Username</label>
            <input
              value={form.username}
              disabled={isSelf || isApplication}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            />
          </div>
          {isApplication ? (
            <>
              <div className="form-group">
                <label>Status</label>
                <input value={account.status || 'pending'} disabled />
              </div>
              {account.note && (
                <div className="form-group">
                  <label>Note</label>
                  <textarea value={account.note} disabled />
                </div>
              )}
            </>
          ) : (
            <div className="form-row">
              <div className="form-group">
                <label>Role</label>
                {isSelf ? (
                  <input value={form.role} disabled style={{ textTransform: 'capitalize' }} />
                ) : (
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                )}
              </div>
              <div className="form-group">
                <label>Status</label>
                {isSelf ? (
                  <input value={form.active ? 'Active' : 'Disabled'} disabled />
                ) : (
                  <select
                    value={form.active ? 'active' : 'disabled'}
                    onChange={e => setForm(f => ({ ...f, active: e.target.value === 'active' }))}
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                )}
              </div>
            </div>
          )}
          {account.createdAt && (
            <div className="text-sm text-muted">
              Created {new Date(account.createdAt).toLocaleDateString()}
            </div>
          )}
        </div>
      )}

      {tab === 'email' && (
        <div className="account-panel-section">
          <div className="form-group">
            <label>Email address</label>
            <input
              type="email"
              value={form.email}
              disabled={!canEdit}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <p className="text-sm text-muted">
            {isApplication
              ? 'This is the email submitted with the account request.'
              : 'Used for notifications and account recovery.'}
          </p>
        </div>
      )}

      {tab === 'password' && !isApplication && (
        <div className="account-panel-section">
          {isSelf && (
            <div className="form-group">
              <label>Current password</label>
              <input
                type="password"
                autoComplete="current-password"
                value={form.currentPassword}
                onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
              />
            </div>
          )}
          <div className="form-group">
            <label>{isSelf ? 'New password' : 'Set new password'}</label>
            <input
              type="password"
              autoComplete="new-password"
              value={form.newPassword}
              onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Confirm password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
            />
          </div>
          <p className="text-sm text-muted">
            {isSelf
              ? 'Use at least 8 characters with a letter and a number.'
              : 'This immediately replaces the current password for this account.'}
          </p>
        </div>
      )}
    </Modal>
  );
}
