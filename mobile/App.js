import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  FlatList,
  RefreshControl
} from 'react-native';
import { authApi, tasksApi, clientsApi, activityApi } from './src/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'board', 'clients', 'activity'

  // Auth state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Data state
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [activities, setActivities] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [project, setProject] = useState('blackfire'); // 'blackfire' | 'aawazz'

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const res = await authApi.me();
      if (res.data?.user) {
        setUser(res.data.user);
        loadData(project);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
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
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      setAuthError('Please enter username and password');
      return;
    }
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await authApi.login({ username: username.trim(), password });
      setUser(res.data.user);
      loadData(project);
    } catch (e) {
      setAuthError(e?.response?.data?.error || 'Login failed. Check credentials.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch (e) {}
    setUser(null);
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.loadingText}>Initializing Blackfire CRM...</Text>
      </View>
    );
  }

  // --- LOGIN SCREEN ---
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
            <TextInput
              style={styles.input}
              placeholder="Enter username"
              placeholderTextColor="#555"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor="#555"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {authError ? <Text style={styles.errorText}>{authError}</Text> : null}

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={authLoading}>
            {authLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.loginBtnText}>IGNITE SESSION</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- MAIN APP ---
  const doneCount = tasks.filter(t => t.column === 'done').length;
  const inProgressCount = tasks.filter(t => t.column === 'inprogress').length;
  const backlogCount = tasks.filter(t => t.column === 'backlog' || t.column === 'todo').length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Blackfire CRM</Text>
          <Text style={styles.headerUser}>User: {user.name} (@{user.username})</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Exit</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(project)} tintColor="#fff" />}
      >
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

            {/* Project Switcher */}
            <Text style={styles.sectionHeader}>Active Project</Text>
            <View style={styles.projectSwitchRow}>
              <TouchableOpacity
                style={[styles.projBtn, project === 'blackfire' && styles.projBtnActive]}
                onPress={() => { setProject('blackfire'); loadData('blackfire'); }}
              >
                <Text style={styles.projBtnText}>🔥 Blackfire AI</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.projBtn, project === 'aawazz' && styles.projBtnActiveBlue]}
                onPress={() => { setProject('aawazz'); loadData('aawazz'); }}
              >
                <Text style={styles.projBtnText}>🌊 Aawazz</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Activity */}
            <Text style={styles.sectionHeader}>Recent System Backlog</Text>
            {activities.slice(0, 5).map((act, i) => (
              <View key={act._id || i} style={styles.activityItem}>
                <Text style={styles.activityText}>• {act.summary || act.action}</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'board' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionHeader}>
              Tasks ({project === 'blackfire' ? 'Blackfire AI' : 'Aawazz'})
            </Text>

            {['inprogress', 'todo', 'backlog', 'done'].map(col => {
              const colTasks = tasks.filter(t => t.column === col);
              return (
                <View key={col} style={styles.colSection}>
                  <Text style={styles.colTitle}>
                    {col.toUpperCase()} ({colTasks.length})
                  </Text>
                  {colTasks.length === 0 ? (
                    <Text style={styles.emptyText}>No tasks in this stage</Text>
                  ) : (
                    colTasks.map(t => (
                      <View key={t._id} style={styles.taskCard}>
                        <Text style={styles.taskTitle}>{t.title}</Text>
                        {t.description ? <Text style={styles.taskDesc}>{t.description}</Text> : null}
                        <View style={styles.taskFooter}>
                          <Text style={styles.taskMeta}>
                            To: {t.assignees?.map(a => a.name).join(', ') || t.assigneeName || 'Unassigned'}
                          </Text>
                          <Text style={[styles.priorityBadge, styles[`priority_${t.priority}`]]}>
                            {t.priority}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              );
            })}
          </View>
        )}

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
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('dashboard')}>
          <Text style={[styles.navIcon, activeTab === 'dashboard' && styles.navIconActive]}>📊</Text>
          <Text style={[styles.navLabel, activeTab === 'dashboard' && styles.navLabelActive]}>Overview</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('board')}>
          <Text style={[styles.navIcon, activeTab === 'board' && styles.navIconActive]}>📋</Text>
          <Text style={[styles.navLabel, activeTab === 'board' && styles.navLabelActive]}>Board</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('clients')}>
          <Text style={[styles.navIcon, activeTab === 'clients' && styles.navIconActive]}>👥</Text>
          <Text style={[styles.navLabel, activeTab === 'clients' && styles.navLabelActive]}>Clients</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('activity')}>
          <Text style={[styles.navIcon, activeTab === 'activity' && styles.navIconActive]}>📜</Text>
          <Text style={[styles.navLabel, activeTab === 'activity' && styles.navLabelActive]}>Log</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
    fontSize: 14,
  },
  authBox: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  sigil: {
    fontSize: 44,
    textAlign: 'center',
    marginBottom: 8,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 3,
  },
  brandSub: {
    color: '#666666',
    fontSize: 11,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 36,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#888',
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#111111',
    borderColor: '#222222',
    borderWidth: 1,
    borderRadius: 8,
    color: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginBottom: 12,
  },
  loginBtn: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  loginBtnText: {
    color: '#000000',
    fontWeight: '800',
    letterSpacing: 2,
    fontSize: 13,
  },

  // Main Layout
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  headerUser: {
    color: '#666',
    fontSize: 11,
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
  },
  logoutBtnText: {
    color: '#aaa',
    fontSize: 12,
  },

  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  sectionHeader: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 10,
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#0c0c0c',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: '#777',
    fontSize: 10,
    marginTop: 2,
  },

  projectSwitchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  projBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#111',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
  },
  projBtnActive: {
    backgroundColor: '#18181b',
    borderColor: '#ffffff',
  },
  projBtnActiveBlue: {
    backgroundColor: '#1e3a8a',
    borderColor: '#3b82f6',
  },
  projBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },

  activityItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  activityText: {
    color: '#aaa',
    fontSize: 12,
  },

  // Board
  colSection: {
    marginBottom: 16,
  },
  colTitle: {
    color: '#666',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  taskCard: {
    backgroundColor: '#0d0d0d',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  taskTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  taskDesc: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  taskMeta: {
    color: '#555',
    fontSize: 11,
  },
  priorityBadge: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  priority_high: { color: '#ef4444' },
  priority_medium: { color: '#f59e0b' },
  priority_low: { color: '#10b981' },

  // Clients
  clientCard: {
    backgroundColor: '#0d0d0d',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  clientName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  clientCompany: {
    color: '#777',
    fontSize: 12,
    marginTop: 2,
  },
  clientEmail: {
    color: '#555',
    fontSize: 12,
    marginTop: 6,
  },

  // Activity Log
  activityCard: {
    backgroundColor: '#0a0a0a',
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  activityActor: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  activitySummary: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 2,
  },
  activityDate: {
    color: '#444',
    fontSize: 10,
    marginTop: 4,
  },

  emptyText: {
    color: '#444',
    fontSize: 12,
    fontStyle: 'italic',
  },

  // Bottom Navigation Bar
  navBar: {
    flexDirection: 'row',
    backgroundColor: '#050505',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    paddingVertical: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 18,
    opacity: 0.5,
  },
  navIconActive: {
    opacity: 1,
  },
  navLabel: {
    color: '#555',
    fontSize: 10,
    marginTop: 2,
  },
  navLabelActive: {
    color: '#fff',
    fontWeight: '700',
  },
});
