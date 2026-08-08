import { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import { fetcher } from '../api';

function isEmailActivity(a) {
  const s = (a.summary || '').toLowerCase();
  const ac = (a.action || '').toLowerCase();
  const t = (a.type || '').toLowerCase();
  return t === 'email' || ac.includes('email') || s.includes('email') || s.includes('sent mail') || s.includes('bulk mail');
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(() => {
    try { return parseInt(localStorage.getItem('crm_email_notif_seen') || '0', 10); } catch { return 0; }
  });
  const panelRef = useRef(null);

  const { data: activities = [] } = useSWR('/activity?days=14', fetcher, {
    refreshInterval: 60000,
    revalidateOnFocus: false,
  });

  const emailItems = activities.filter(isEmailActivity);
  const unread = emailItems.filter(a => new Date(a.createdAt).getTime() > lastSeen).length;

  function toggle() {
    if (!open) {
      const now = Date.now();
      setLastSeen(now);
      localStorage.setItem('crm_email_notif_seen', String(now));
    }
    setOpen(o => !o);
  }

  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        onClick={toggle}
        title="Email Notifications"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 12px', borderRadius: 8,
          color: open ? 'var(--text)' : 'var(--text3)',
          fontSize: 12, width: '100%',
          background: open ? 'var(--surface2)' : 'transparent',
          border: open ? '1px solid var(--border)' : '1px solid transparent',
          fontWeight: 500, cursor: 'pointer', transition: 'all 0.18s',
        }}
      >
        <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: -5, right: -7,
              background: '#ef4444', color: '#fff',
              fontSize: 9, fontWeight: 800,
              width: 16, height: 16, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--sidebar-bg)',
            }}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </span>
        <span>Email Alerts</span>
        {unread > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: '#ef444422', color: '#ef4444', borderRadius: 20, padding: '1px 7px' }}>
            {unread} new
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, right: 0,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: '0 -8px 32px rgba(0,0,0,0.14)',
          zIndex: 500, marginBottom: 6, overflow: 'hidden',
          maxHeight: 360, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Email Activity</span>
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>Last 14 days</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {emailItems.length === 0 && (
              <div style={{ padding: '24px 16px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>No email activity found</div>
            )}
            {emailItems.slice(0, 20).map((a, i) => {
              const isNew = new Date(a.createdAt).getTime() > lastSeen;
              return (
                <div key={a._id || i} style={{
                  padding: '10px 14px', borderBottom: '1px solid var(--border)',
                  background: isNew ? 'var(--surface2)' : 'transparent',
                  display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isNew && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />}
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.summary || `${a.actorName} ${a.action}`}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text3)', paddingLeft: isNew ? 12 : 0 }}>
                    {a.actorName} · {new Date(a.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
