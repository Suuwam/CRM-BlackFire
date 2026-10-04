import { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import api, { fetcher } from '../api';

function isNotifiable(a) {
  return a.targetType === 'milestone' || a.targetType === 'feedback' || isEmailActivity(a);
}

function isEmailActivity(a) {
  const s = (a.summary || '').toLowerCase();
  const ac = (a.action || '').toLowerCase();
  const t = (a.type || '').toLowerCase();
  return t === 'email' || ac.includes('email') || s.includes('email') || s.includes('sent mail') || s.includes('bulk mail');
}

const isNative = () => !!window.Capacitor?.isNativePlatform?.();
const NATIVE_SEEN = 'crm_native_notif_seen';
const NATIVE_ON = 'crm_native_notif_on';   // the Alerts switch in the app ('off' = muted)
const NATIVE_ASKED = 'crm_native_notif_asked';
const getLocal = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const setLocal = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const localNotifications = () => import('@capacitor/local-notifications').then(m => m.LocalNotifications);

// Android app: show the system "Allow notifications?" prompt once, on the first launch.
// Android keeps the answer, and we never prompt again on our own; the Alerts switch can.
export async function askPhonePermissionOnce() {
  if (!isNative() || getLocal(NATIVE_ASKED)) return;
  setLocal(NATIVE_ASKED, '1');
  const LN = await localNotifications();
  const { display } = await LN.checkPermissions();
  if (display !== 'granted' && display !== 'denied') await LN.requestPermissions();
}

// In the mobile app, turn each new alert into a phone notification. Uses the same
// 60s activity poll as the bell, so it fires while the app is open or recently backgrounded.
// ponytail: no FCM push — a fully closed app shows nothing until reopened. Add Firebase
// push if alerts must arrive with the app killed.
async function notifyPhone(items) {
  if (!isNative()) return;
  const seen = Number(getLocal(NATIVE_SEEN) || 0);
  if (!seen) { setLocal(NATIVE_SEEN, String(Date.now())); return; } // first run: no backlog flood
  const fresh = items.filter(a => new Date(a.createdAt).getTime() > seen);
  if (!fresh.length) return;
  setLocal(NATIVE_SEEN, String(Math.max(...fresh.map(a => new Date(a.createdAt).getTime()))));
  if (getLocal(NATIVE_ON) === 'off') return;
  const LN = await localNotifications();
  if ((await LN.checkPermissions()).display !== 'granted') return; // never prompt from a background poll
  await LN.schedule({
    notifications: fresh.slice(0, 5).map((a, i) => ({
      id: (Date.now() % 1e9) + i,
      title: a.targetType === 'feedback' ? `New feedback · ${a.actorName}` : a.targetType === 'milestone' ? 'Milestone update' : 'Blackfire CRM',
      body: a.summary || `${a.actorName} ${a.action}`,
    })),
  });
}

// Web Push for the browser / iPhone home-screen app (the Android app uses notifyPhone above).
// iOS only offers PushManager once the CRM is added to the home screen.
const webPushSupported = () => !isNative()
  && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function b64ToBytes(b64) {
  const raw = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

const pushSub = () => navigator.serviceWorker.ready.then(r => r.pushManager.getSubscription());

// Each returns the switch's new state: 'on' | 'off' | 'blocked' | 'unsupported'.
const alerts = {
  async read() {
    if (isNative()) {
      const { display } = await (await localNotifications()).checkPermissions();
      if (display === 'denied') return 'blocked';
      return display === 'granted' && getLocal(NATIVE_ON) !== 'off' ? 'on' : 'off';
    }
    if (!webPushSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'blocked';
    const sub = await pushSub();
    if (sub) api.post('/push/subscribe', sub.toJSON()).catch(() => {}); // re-link after a login switch
    return sub && Notification.permission === 'granted' ? 'on' : 'off';
  },
  async turnOn() {
    if (isNative()) {
      const { display } = await (await localNotifications()).requestPermissions();
      if (display !== 'granted') return 'blocked';
      setLocal(NATIVE_ON, 'on');
      return 'on';
    }
    if ((await Notification.requestPermission()) !== 'granted') return Notification.permission === 'denied' ? 'blocked' : 'off';
    const reg = await navigator.serviceWorker.ready;
    const { data } = await api.get('/push/key');
    const sub = await reg.pushManager.getSubscription()
      || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(data.publicKey) });
    await api.post('/push/subscribe', sub.toJSON());
    return 'on';
  },
  async turnOff() {
    if (isNative()) { setLocal(NATIVE_ON, 'off'); return 'off'; }
    const sub = await pushSub();
    if (sub) {
      await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe();
    }
    return 'off';
  },
};

const HINT = {
  blocked: 'Notifications are blocked. Allow them in your phone or browser settings.',
  unsupported: 'On iPhone, add the CRM to your Home Screen first (Share → Add to Home Screen).',
};

function AlertsSwitch() {
  const [state, setState] = useState('checking');
  useEffect(() => { alerts.read().then(setState, () => setState('off')); }, []);
  const on = state === 'on';
  const disabled = state === 'checking' || state === 'busy' || state === 'unsupported';
  async function flip() {
    if (state === 'blocked') return;
    setState('busy');
    try { setState(await (on ? alerts.turnOff() : alerts.turnOn())); }
    catch { setState(await alerts.read().catch(() => 'off')); }
  }
  return (
    <label className="alert-switch" title={HINT[state] || (on ? 'Turn notifications off' : 'Turn notifications on')}>
      <span>Notifications</span>
      <button type="button" role="switch" aria-checked={on} disabled={disabled || state === 'blocked'}
        className={`switch${on ? ' on' : ''}`} onClick={flip}>
        <span className="switch-knob" />
      </button>
    </label>
  );
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

  const emailItems = activities.filter(isNotifiable);
  const unread = emailItems.filter(a => new Date(a.createdAt).getTime() > lastSeen).length;

  useEffect(() => { notifyPhone(emailItems).catch(() => {}); }, [activities]); // eslint-disable-line react-hooks/exhaustive-deps

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
        title="Notifications"
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
        <span>Alerts</span>
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
          <div style={{ padding: '10px 12px 8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Alerts</span>
            <AlertsSwitch />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {emailItems.length === 0 && (
              <div style={{ padding: '24px 16px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>Nothing new</div>
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
