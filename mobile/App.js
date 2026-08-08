import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, SafeAreaView, StatusBar,
  RefreshControl, Platform, AppState
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, tasksApi, clientsApi, activityApi } from './src/api';

// ─── Notification Handler (foreground) ────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const BG_TASK = 'BLACKFIRE_NOTIFY_TASK';
const LAST_CHECKED_KEY = '@blackfire_last_checked';
const UNREAD_COUNT_KEY = '@blackfire_unread_count';

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function fireNotif(title, body) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}

// ─── Background Task ──────────────────────────────────────────────────────────
TaskManager.defineTask(BG_TASK, async () => {
  try {
    const lastChecked = await AsyncStorage.getItem(LAST_CHECKED_KEY);
    const since = lastChecked || new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const res = await activityApi.listSince(since);
    const items = Array.isArray(res.data) ? res.data : [];

    if (items.length > 0) {
      await AsyncStorage.setItem(LAST_CHECKED_KEY, new Date().toISOString());

      let unread = parseInt(await AsyncStorage.getItem(UNREAD_COUNT_KEY) || '0', 10);
      unread += items.length;
      await AsyncStorage.setItem(UNREAD_COUNT_KEY, String(unread));
      await Notifications.setBadgeCountAsync(unread);

      for (const act of items) {
        await fireNotif('Blackfire CRM', act.summary || 'New activity logged');
      }
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ─── Register Background Fetch ────────────────────────────────────────────────
async function registerBgFetch() {
  try {
    await BackgroundFetch.registerTaskAsync(BG_TASK, {
      minimumInterval: 30,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch {}
}

// ─── Request Notification Permission ─────────────────────────────────────────
async function requestNotifPermission() {
  if (!Device.isDevice) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [activities, setActivities] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [project, setProject] = useState('blackfire');

  const appState = useRef(AppState.currentState);
  const pollRef = useRef(null);

  useEffect(() => { checkSession(); }, []);

  // Foreground polling when app is visible
  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && appState.current !== 'active') {
        pollNewActivities();
      }
      appState.current = next;
    });
    pollRef.current = setInterval(pollNewActivities, 30000);
    return () => {
      sub.remove();
      clearInterval(pollRef.current);
    };
  }, [user]);

  async function checkSession() {
    try {
      const res = await authApi.me();
      if (res.data?.user) {
        setUser(res.data.user);
        loadData(project);
        await setupNotifications();
      }
    } catch { setUser(null); }
    finally { setLoading(false); }
  }

  async function setupNotifications() {
    const granted = await requestNotifPermission();
    if (!granted) return;
    await registerBgFetch();
    // Init lastChecked if not set
    const existing = await AsyncStorage.getItem(LAST_CHECKED_KEY);
    if (!existing) {
      await AsyncStorage.setItem(LAST_CHECKED_KEY, new Date().toISOString());
    }
    const uc = parseInt(await AsyncStorage.getItem(UNREAD_COUNT_KEY) || '0', 10);
    setUnreadCount(uc);
  }

  async function pollNewActivities() {
    try {
      const lastChecked = await AsyncStorage.getItem(LAST_CHECKED_KEY);
      const since = lastChecked || new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const res = await activityApi.listSince(since);
      const items = Array.isArray(res.data) ? res.data : [];

      if (items.length > 0) {
        const now = new Date().toISOString();
        await AsyncStorage.setItem(LAST_CHECKED_KEY, now);

        // Fire local notifications
        for (const act of items) {
          await fireNotif('Blackfire CRM', act.summary || 'New activity logged');
        }

        // Update in-app notification list
        setNotifications(prev => [...items, ...prev].slice(0, 100));
        const newUnread = unreadCount + items.length;
        setUnreadCount(newUnread);
        await AsyncStorage.setItem(UNREAD_COUNT_KEY, String(newUnread));
        await Notifications.setBadgeCountAsync(newUnread);
      }
    } catch {}
  }

  async function clearUnread() {
    setUnreadCount(0);
    await AsyncStorage.setItem(UNREAD_COUNT_KEY, '0');
    await Notifications.setBadgeCountAsync(0);
  }

  async function loadData(proj = project) {
    setRefreshing(true);
    try {
      const [tRes, cRes, aRes] = await Promise.all([
        tasksApi.list(proj).catch(() => ({ data: [] })),
        clientsApi.list().catch(() => ({ data: [] })),
        activityApi.list(30).catch(() => ({ data: [] })),
      ]);
      setTasks(tRes.data || []);
      setClients(cRes.data || []);
      setActivities(aRes.data || []);
      setNotifications((aRes.data || []).slice(0, 50));
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  }

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      setAuthError('Please enter username and password'); return;
    }
    setAuthError(''); setAuthLoading(true);
    try {
      const res = await authApi.login({ username: username.trim(), password });
      if (res.data?.user?._id) {
        await AsyncStorage.setItem('@blackfire_session_user_id', res.data.user._id);
      }
      setUser(res.data.user);
      loadData(project);
      await setupNotifications();
    } catch (e) {
      setAuthError(e?.response?.data?.error || 'Login failed. Check credentials.');
    } finally { setAuthLoading(false); }
  }

  async function handleLogout() {
    try { await authApi.logout(); } catch {}
    clearInterval(pollRef.current);
    await BackgroundFetch.unregisterTaskAsync(BG_TASK).catch(() => {});
    await AsyncStorage.removeItem(LAST_CHECKED_KEY);
    await AsyncStorage.removeItem(UNREAD_COUNT_KEY);
    await AsyncStorage.removeItem('@blackfire_session_user_id');
    setUser(null); setUnreadCount(0); setNotifications([]);
  }

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.loadingText}>Initializing Blackfire CRM...</Text>
      </View>
    );
  }

  // ─── Login ──────────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.authBox}>
          <Text style={styles.sigil}>🔥</Text>
          <Text style={styles.brandTitle}>BLACKFIRE AI</Text>
          <Text style={styles.brandSub}>MOBILE CRM GATEWAY</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>USERNAME</Text>
            <TextInput style={styles.input} placeholder="Enter username" placeholderTextColor="#555"
              value={username} onChangeText={setUsername} autoCapitalize="none" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput style={styles.input} placeholder="Enter password" placeholderTextColor="#555"
              secureTextEntry value={password} onChangeText={setPassword} />
          </View>
          {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={authLoading}>
            {authLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.loginBtnText}>IGNITE SESSION</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main App ───────────────────────────────────────────────────────────────
  const doneCount = tasks.filter(t => t.column === 'done').length;
  const inProgressCount = tasks.filter(t => t.column === 'inprogress').length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Blackfire CRM</Text>
          <Text style={styles.headerUser}>@{user.username}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Exit</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(project)} tintColor="#fff" />}>

        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionHeader}>Overview & Metrics</Text>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { borderColor: '#3b82f6' }]}>
                <Text style={styles.statNumber}>{tasks.length}</Text>
                <Text style={styles.statLabel}>Total Tasks</Text>
              </View>
              <View style={[styles.statCard, { borderColor: '#f59e0b' }]}>
                <Text style={styles.statNumber}>{inProgressCount}</Text>
                <Text style={styles.statLabel}>In Progress</Text>
              </View>
              <View style={[styles.statCard, { borderColor: '#10b981' }]}>
                <Text style={styles.statNumber}>{doneCount}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
            </View>

            <Text style={styles.sectionHeader}>Active Project</Text>
            <View style={styles.projectSwitchRow}>
              <TouchableOpacity style={[styles.projBtn, project === 'blackfire' && styles.projBtnActive]}
                onPress={() => { setProject('blackfire'); loadData('blackfire'); }}>
                <Text style={styles.projBtnText}>🔥 Blackfire AI</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.projBtn, project === 'aawazz' && styles.projBtnActiveBlue]}
                onPress={() => { setProject('aawazz'); loadData('aawazz'); }}>
                <Text style={styles.projBtnText}>🌊 Aawazz</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionHeader}>Recent System Backlog</Text>
            {activities.slice(0, 5).map((act, i) => (
              <View key={act._id || i} style={styles.activityCard}>
                <Text style={styles.activityActor}>{act.actorName || 'System'}</Text>
                <Text style={styles.activitySummary}>{act.summary}</Text>
                <Text style={styles.activityDate}>{new Date(act.createdAt).toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}

        {/* BOARD */}
        {activeTab === 'board' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionHeader}>Tasks ({project === 'blackfire' ? 'Blackfire AI' : 'Aawazz'})</Text>
            {['inprogress', 'todo', 'backlog', 'done'].map(col => {
              const colTasks = tasks.filter(t => t.column === col);
              return (
                <View key={col} style={styles.colSection}>
                  <Text style={styles.colTitle}>{col.toUpperCase()} ({colTasks.length})</Text>
                  {colTasks.length === 0
                    ? <Text style={styles.emptyText}>No tasks in this stage</Text>
                    : colTasks.map(t => (
                      <View key={t._id} style={styles.taskCard}>
                        <Text style={styles.taskTitle}>{t.title}</Text>
                        {t.description ? <Text style={styles.taskDesc}>{t.description}</Text> : null}
                        <View style={styles.taskFooter}>
                          <Text style={styles.taskMeta}>
                            To: {t.assignees?.map(a => a.name).join(', ') || t.assigneeName || 'Unassigned'}
                          </Text>
                          <Text style={[styles.priorityBadge, styles[`priority_${t.priority}`]]}>{t.priority}</Text>
                        </View>
                      </View>
                    ))
                  }
                </View>
              );
            })}
          </View>
        )}

        {/* CLIENTS */}
        {activeTab === 'clients' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionHeader}>Clients ({clients.length})</Text>
            {clients.map(c => (
              <View key={c._id} style={styles.clientCard}>
                <Text style={styles.clientName}>{c.name}</Text>
                <Text style={styles.clientCompany}>{c.company || 'Individual Client'}</Text>
                <Text style={styles.clientEmail}>✉️ {c.email || 'No email'}</Text>
                {c.phone ? <Text style={styles.clientEmail}>📞 {c.phone}</Text> : null}
              </View>
            ))}
            {clients.length === 0 && <Text style={styles.emptyText}>No clients recorded</Text>}
          </View>
        )}

        {/* ACTIVITY LOG */}
        {activeTab === 'activity' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionHeader}>Activity Log (Last 30 Days)</Text>
            {activities.map((act, i) => (
              <View key={act._id || i} style={styles.activityCard}>
                <Text style={styles.activityActor}>{act.actorName || 'System'}</Text>
                <Text style={styles.activitySummary}>{act.summary}</Text>
                <Text style={styles.activityDate}>{new Date(act.createdAt).toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}

        {/* NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <View style={styles.tabContent}>
            <View style={styles.notifHeader}>
              <Text style={styles.sectionHeader}>Notifications</Text>
              {unreadCount > 0 && (
                <TouchableOpacity style={styles.clearBtn} onPress={clearUnread}>
                  <Text style={styles.clearBtnText}>Mark all read</Text>
                </TouchableOpacity>
              )}
            </View>
            {notifications.length === 0
              ? <Text style={styles.emptyText}>No notifications yet. CRM activity will appear here.</Text>
              : notifications.map((act, i) => (
                <View key={act._id || i} style={styles.notifCard}>
                  <View style={styles.notifRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notifTitle}>CRM Activity</Text>
                      <Text style={styles.notifBody}>{act.summary}</Text>
                      <Text style={styles.notifMeta}>
                        {act.actorName || 'System'} · {new Date(act.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            }
          </View>
        )}
      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.navBar}>
        {[
          { key: 'dashboard', icon: '📊', label: 'Overview' },
          { key: 'board',     icon: '📋', label: 'Board' },
          { key: 'clients',   icon: '👥', label: 'Clients' },
          { key: 'activity',  icon: '📜', label: 'Log' },
          { key: 'notifications', icon: '🔔', label: 'Alerts' },
        ].map(tab => (
          <TouchableOpacity key={tab.key} style={styles.navItem}
            onPress={() => { setActiveTab(tab.key); if (tab.key === 'notifications') clearUnread(); }}>
            <View style={styles.navIconWrap}>
              <Text style={[styles.navIcon, activeTab === tab.key && styles.navIconActive]}>{tab.icon}</Text>
              {tab.key === 'notifications' && unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.navLabel, activeTab === tab.key && styles.navLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  centerContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#888', marginTop: 12, fontSize: 14 },
  authBox: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  sigil: { fontSize: 44, textAlign: 'center', marginBottom: 8 },
  brandTitle: { color: '#ffffff', fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: 3 },
  brandSub: { color: '#666666', fontSize: 11, textAlign: 'center', letterSpacing: 4, marginBottom: 36 },
  inputGroup: { marginBottom: 16 },
  label: { color: '#888', fontSize: 10, letterSpacing: 2, marginBottom: 6 },
  input: { backgroundColor: '#111111', borderColor: '#222222', borderWidth: 1, borderRadius: 8,
    color: '#ffffff', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  errorText: { color: '#ef4444', fontSize: 12, marginBottom: 12 },
  loginBtn: { backgroundColor: '#ffffff', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  loginBtnText: { color: '#000000', fontWeight: '800', letterSpacing: 2, fontSize: 13 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  headerUser: { color: '#666', fontSize: 11 },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#1a1a1a', borderRadius: 6 },
  logoutBtnText: { color: '#aaa', fontSize: 12 },

  content: { flex: 1 },
  tabContent: { padding: 16 },
  sectionHeader: { color: '#ffffff', fontSize: 15, fontWeight: '700', marginTop: 12, marginBottom: 10 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  statCard: { flex: 1, backgroundColor: '#0c0c0c', borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  statNumber: { color: '#fff', fontSize: 20, fontWeight: '800' },
  statLabel: { color: '#777', fontSize: 10, marginTop: 2 },

  projectSwitchRow: { flexDirection: 'row', gap: 10 },
  projBtn: { flex: 1, paddingVertical: 10, backgroundColor: '#111', borderRadius: 8,
    alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  projBtnActive: { backgroundColor: '#18181b', borderColor: '#ffffff' },
  projBtnActiveBlue: { backgroundColor: '#1e3a8a', borderColor: '#3b82f6' },
  projBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  colSection: { marginBottom: 16 },
  colTitle: { color: '#666', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  taskCard: { backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#222',
    borderRadius: 8, padding: 12, marginBottom: 8 },
  taskTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  taskDesc: { color: '#888', fontSize: 12, marginTop: 4 },
  taskFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  taskMeta: { color: '#555', fontSize: 11 },
  priorityBadge: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  priority_high: { color: '#ef4444' },
  priority_medium: { color: '#f59e0b' },
  priority_low: { color: '#10b981' },

  clientCard: { backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#222',
    borderRadius: 8, padding: 12, marginBottom: 8 },
  clientName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  clientCompany: { color: '#777', fontSize: 12, marginTop: 2 },
  clientEmail: { color: '#555', fontSize: 12, marginTop: 6 },

  activityCard: { backgroundColor: '#0a0a0a', borderRadius: 6, padding: 10,
    marginBottom: 6, borderLeftWidth: 3, borderLeftColor: '#3b82f6' },
  activityActor: { color: '#fff', fontSize: 12, fontWeight: '700' },
  activitySummary: { color: '#aaa', fontSize: 12, marginTop: 2 },
  activityDate: { color: '#444', fontSize: 10, marginTop: 4 },

  // Notifications tab
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#1a1a1a', borderRadius: 6 },
  clearBtnText: { color: '#888', fontSize: 11 },
  notifCard: { borderRadius: 8, padding: 12, marginBottom: 8, borderLeftWidth: 3, backgroundColor: '#0a0a0a', borderLeftColor: '#3b82f6' },
  notifRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  notifTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  notifBody: { color: '#aaa', fontSize: 12, marginTop: 2 },
  notifMeta: { color: '#444', fontSize: 10, marginTop: 4 },

  emptyText: { color: '#444', fontSize: 12, fontStyle: 'italic' },

  navBar: { flexDirection: 'row', backgroundColor: '#050505',
    borderTopWidth: 1, borderTopColor: '#1a1a1a', paddingVertical: 8 },
  navItem: { flex: 1, alignItems: 'center' },
  navIconWrap: { position: 'relative' },
  navIcon: { fontSize: 18, opacity: 0.5 },
  navIconActive: { opacity: 1 },
  navLabel: { color: '#555', fontSize: 10, marginTop: 2 },
  navLabelActive: { color: '#fff', fontWeight: '700' },
  badge: { position: 'absolute', top: -4, right: -8, backgroundColor: '#ef4444',
    borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
