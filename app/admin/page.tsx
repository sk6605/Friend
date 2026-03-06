'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────

interface Overview {
  totalUsers: number;
  newUsersToday: number;
  newUsersWeek: number;
  activeUsersToday: number;
  activeUsersWeek: number;
  totalConversations: number;
  conversationsToday: number;
  totalMessages: number;
  messagesToday: number;
  messagesWeek: number;
  avgMessagesPerConv: number;
  insightsToday: number;
  usersWithMemory: number;
  avgMoodScore: number | null;
}

interface MoodEntry { mood: string; count: number; percentage: number }
interface TopicEntry { topic: string; count: number }
interface MoodTrendEntry { date: string; avgScore: number; count: number }
interface AgeEntry { group: string; count: number; percentage: number }

interface UserListItem {
  id: string;
  nickname: string;
  profilePicture: string | null;
  ageGroup: string;
  language: string;
  aiName: string;
  hasMemory: boolean;
  memoryLength: number;
  hasProfile: boolean;
  joinedAt: string;
  lastActive: string;
  lastLoginAt: string | null;
  totalConversations: number;
  totalInsights: number;
  subscription: {
    plan: string;
    planKey: string;
    status: string;
    interval: string;
    expiresAt: string;
  } | null;
}

interface InsightItem {
  id: number;
  userId: string;
  userAgeGroup: string;
  date: string;
  mood: string | null;
  moodScore: number | null;
  topics: string[];
  emotionalState: string | null;
  summary: string | null;
  messageCount: number;
}

interface ConvSummary {
  id: number;
  title: string;
  summary: string;
  messageCount: number;
  updatedAt: string;
  userAgeGroup: string;
}

interface PersonalizationItem {
  id: string;
  ageGroup: string;
  language: string;
  aiName: string;
  hasMemory: boolean;
  memoryWordCount: number;
  hasProfile: boolean;
  profileFields: string[];
  lastMemoryUpdate: string;
  conversationSummaries: number;
  insightsGenerated: number;
}

interface UserDetail {
  id: string;
  username: string;
  nickname: string;
  email: string;
  passwordHash: string;
  age: number | null;
  profilePicture: string | null;
  ageGroup: string;
  language: string;
  aiName: string;
  memory: string | null;
  profile: Record<string, unknown>;
  joinedAt: string;
  lastActive: string;
  lastLoginAt: string | null;
  subscription: {
    plan: string;
    planKey: string;
    status: string;
    interval: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelledAt: string | null;
  } | null;
  engagement: {
    totalConversations: number;
    totalMessages: number;
    messagesThisWeek: number;
    activeDaysThisMonth: number;
    avgMessagesPerDay: number;
  };
  conversations: {
    id: string;
    title: string;
    summary: string | null;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
  }[];
  moodHistory: {
    date: string;
    mood: string | null;
    moodScore: number | null;
    topics: string[];
    emotionalState: string | null;
    summary: string | null;
    messageCount: number;
  }[];
  topTopics: { topic: string; count: number }[];
}

interface Analytics {
  overview: Overview;
  ageDistribution: AgeEntry[];
  moodDistribution: MoodEntry[];
  topicTrends: TopicEntry[];
  dailyMoodTrend: MoodTrendEntry[];
  userList: UserListItem[];
  dailyInsights: InsightItem[];
  recentConversations: ConvSummary[];
  personalizationStatus: PersonalizationItem[];
  generatedAt: string;
}

type TabKey = 'overview' | 'users' | 'insights' | 'personalization' | 'crisis';

interface CrisisEvent {
  id: string;
  userId: string;
  conversationId: string | null;
  riskLevel: number;
  triggerContent: string;
  classificationReason: string | null;
  keywords: string[];
  status: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  notes: string | null;
  createdAt: string;
  user: { id: string; nickname: string; ageGroup: string; email: string } | null;
}

interface CrisisStats {
  openEvents: number;
  usersInSafeMode: number;
  eventsToday: number;
  eventsThisWeek: number;
}

interface SafeModeUser {
  id: string;
  nickname: string;
  ageGroup: string;
  email: string;
  safeModeAt: string | null;
}

// ── Mood helpers ───────────────────────────────────────────────

const MOOD_EMOJI: Record<string, string> = {
  happy: '\u{1F60A}', excited: '\u{1F929}', grateful: '\u{1F60C}', calm: '\u{1F60C}',
  neutral: '\u{1F610}', stressed: '\u{1F616}', anxious: '\u{1F630}',
  sad: '\u{1F622}', angry: '\u{1F621}', lonely: '\u{1F614}',
};
const MOOD_COLOR: Record<string, string> = {
  happy: 'bg-amber-500/20 text-amber-400', excited: 'bg-orange-500/20 text-orange-400',
  grateful: 'bg-emerald-500/20 text-emerald-400', calm: 'bg-teal-500/20 text-teal-400',
  neutral: 'bg-slate-500/20 text-slate-400', stressed: 'bg-red-500/20 text-red-400',
  anxious: 'bg-yellow-500/20 text-yellow-400', sad: 'bg-blue-500/20 text-blue-400',
  angry: 'bg-rose-500/20 text-rose-400', lonely: 'bg-indigo-500/20 text-indigo-400',
};
const AGE_BADGE = (g: string) =>
  g === 'child' ? 'bg-amber-500/20 text-amber-400' :
  g === 'teen' ? 'bg-blue-500/20 text-blue-400' :
  'bg-purple-500/20 text-purple-400';

// ── Main component ─────────────────────────────────────────────

export default function AdminDashboard() {
  const [adminKey, setAdminKey] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // User detail panel
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);

  // Trigger analysis
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  // Crisis data
  const [crisisEvents, setCrisisEvents] = useState<CrisisEvent[]>([]);
  const [crisisStats, setCrisisStats] = useState<CrisisStats>({ openEvents: 0, usersInSafeMode: 0, eventsToday: 0, eventsThisWeek: 0 });
  const [safeModeUsers, setSafeModeUsers] = useState<SafeModeUser[]>([]);
  const [crisisFilter, setCrisisFilter] = useState<string>('open');

  const fetchAnalytics = useCallback(async (key: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/analytics?key=${encodeURIComponent(key)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 401) throw new Error('Invalid admin key');
        throw new Error(errData.error || `Server error (${res.status})`);
      }
      setData(await res.json());
      setAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminKey.trim()) fetchAnalytics(adminKey.trim());
  };

  const refresh = useCallback(() => {
    if (adminKey) fetchAnalytics(adminKey);
  }, [adminKey, fetchAnalytics]);

  useEffect(() => {
    if (!authenticated) return;
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [authenticated, refresh]);

  // Fetch user detail
  const openUserDetail = async (userId: string) => {
    setSelectedUserId(userId);
    setUserDetail(null);
    setUserDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}?key=${encodeURIComponent(adminKey)}`);
      if (res.ok) setUserDetail(await res.json());
    } catch { /* ignore */ }
    setUserDetailLoading(false);
  };

  // Trigger analysis
  const triggerAnalysis = async () => {
    setTriggerLoading(true);
    setTriggerResult(null);
    try {
      const res = await fetch(`/api/admin/trigger-analysis?key=${encodeURIComponent(adminKey)}`, { method: 'POST' });
      const result = await res.json();
      if (res.ok) {
        setTriggerResult(`Processed ${result.processedUsers}/${result.totalUsers} users`);
        refresh();
      } else {
        setTriggerResult(`Error: ${result.error}`);
      }
    } catch {
      setTriggerResult('Network error');
    }
    setTriggerLoading(false);
  };

  // Fetch crisis data
  const fetchCrisisData = useCallback(async (statusFilter?: string) => {
    try {
      const params = new URLSearchParams({ key: adminKey });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/admin/crisis?${params}`);
      if (res.ok) {
        const d = await res.json();
        setCrisisEvents(d.events || []);
        setCrisisStats(d.stats || { openEvents: 0, usersInSafeMode: 0, eventsToday: 0, eventsThisWeek: 0 });
        setSafeModeUsers(d.safeModeUsers || []);
      }
    } catch { /* ignore */ }
  }, [adminKey]);

  // Fetch crisis data when tab is active
  useEffect(() => {
    if (activeTab === 'crisis' && authenticated) {
      fetchCrisisData(crisisFilter);
    }
  }, [activeTab, authenticated, crisisFilter, fetchCrisisData]);

  // Crisis actions
  const handleCrisisAction = async (action: string, payload: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/admin/crisis?key=${encodeURIComponent(adminKey)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      if (res.ok) fetchCrisisData(crisisFilter);
    } catch { /* ignore */ }
  };

  // ── Login screen ──

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-xl">
            <div className="text-center mb-6">
              <div className="text-2xl mb-2">&#128202;</div>
              <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-slate-500 text-sm mt-1">Friend AI Analytics</p>
            </div>
            <input
              type="password"
              value={adminKey}
              onChange={e => setAdminKey(e.target.value)}
              placeholder="Enter admin key..."
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 mb-4"
            />
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <button
              type="submit"
              disabled={loading || !adminKey.trim()}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm transition-colors disabled:opacity-40"
            >
              {loading ? 'Authenticating...' : 'Access Dashboard'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (!data) return null;

  const { overview, ageDistribution, moodDistribution, topicTrends, dailyMoodTrend, userList, dailyInsights, recentConversations, personalizationStatus } = data;

  const TABS: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'users', label: 'Users' },
    { key: 'insights', label: 'Insights' },
    { key: 'personalization', label: 'AI Personalization' },
    { key: 'crisis', label: 'Crisis Safety', badge: crisisStats.openEvents },
  ];

  // ── Dashboard ──

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-purple-400 text-xl">&#128202;</span>
            <h1 className="text-lg font-bold">Friend AI — Admin</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-xs hidden sm:block">
              {new Date(data.generatedAt).toLocaleString()}
            </span>
            <button
              onClick={refresh}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm transition-colors border border-slate-700"
            >
              {loading ? '...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Stat cards row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <StatCard label="Total Users" value={overview.totalUsers} sub={`+${overview.newUsersToday} today`} />
          <StatCard label="Active Today" value={overview.activeUsersToday} sub={`${overview.activeUsersWeek} this week`} />
          <StatCard label="Messages" value={overview.totalMessages} sub={`+${overview.messagesToday} today`} />
          <StatCard label="Conversations" value={overview.totalConversations} sub={`Avg ${overview.avgMessagesPerConv} msgs`} />
          <StatCard
            label="Avg Mood"
            value={overview.avgMoodScore !== null ? `${overview.avgMoodScore}/10` : '—'}
            sub={`${overview.insightsToday} insights today`}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-900 rounded-xl p-1 w-fit border border-slate-800 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white leading-none">{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ─── TAB: Overview ─── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Age distribution + Mood distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Age distribution */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                <h2 className="text-sm font-semibold text-slate-300 mb-4">Age Distribution</h2>
                <div className="space-y-3">
                  {ageDistribution.map(ag => (
                    <div key={ag.group}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-300 capitalize">{ag.group}</span>
                        <span className="text-slate-400">{ag.count} ({ag.percentage}%)</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${ag.percentage}%`,
                            backgroundColor: ag.group === 'child' ? '#f59e0b' : ag.group === 'teen' ? '#3b82f6' : '#8b5cf6',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {ageDistribution.length === 0 && (
                    <p className="text-slate-500 text-sm">No users yet</p>
                  )}
                </div>
              </div>

              {/* Mood distribution */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                <h2 className="text-sm font-semibold text-slate-300 mb-4">Mood Distribution (7 days)</h2>
                <div className="space-y-2">
                  {moodDistribution.map(m => (
                    <div key={m.mood} className="flex items-center gap-3">
                      <span className="text-lg w-6 text-center">{MOOD_EMOJI[m.mood] || '\u{2B50}'}</span>
                      <span className="text-sm text-slate-300 w-20 capitalize">{m.mood}</span>
                      <div className="flex-1 bg-slate-800 rounded-full h-2">
                        <div className="h-2 rounded-full bg-purple-500 transition-all duration-500" style={{ width: `${m.percentage}%` }} />
                      </div>
                      <span className="text-xs text-slate-400 w-14 text-right">{m.count} ({m.percentage}%)</span>
                    </div>
                  ))}
                  {moodDistribution.length === 0 && (
                    <p className="text-slate-500 text-sm">No mood data yet. Run the daily analysis to populate.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Mood trend + Topic trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily mood trend */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                <h2 className="text-sm font-semibold text-slate-300 mb-4">Mood Score Trend (7 days)</h2>
                {dailyMoodTrend.length > 0 ? (
                  <div className="space-y-2">
                    {dailyMoodTrend.map(d => (
                      <div key={d.date} className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 w-20">{d.date.slice(5)}</span>
                        <div className="flex-1 bg-slate-800 rounded-full h-3">
                          <div
                            className="h-3 rounded-full transition-all duration-500"
                            style={{
                              width: `${(d.avgScore / 10) * 100}%`,
                              backgroundColor: d.avgScore >= 7 ? '#10b981' : d.avgScore >= 4 ? '#f59e0b' : '#ef4444',
                            }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-white w-10 text-right">{d.avgScore}</span>
                        <span className="text-xs text-slate-500 w-8">n={d.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">No trend data yet</p>
                )}
              </div>

              {/* Topic trends */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                <h2 className="text-sm font-semibold text-slate-300 mb-4">Trending Topics (7 days)</h2>
                {topicTrends.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {topicTrends.map(t => (
                      <span
                        key={t.topic}
                        className="px-3 py-1.5 rounded-full bg-purple-500/15 text-purple-300 text-xs font-medium border border-purple-500/20"
                      >
                        {t.topic} <span className="text-purple-400/60 ml-1">({t.count})</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">No topics yet</p>
                )}
              </div>
            </div>

            {/* Activity stats + Memory health */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                <h2 className="text-sm font-semibold text-slate-300 mb-4">Activity This Week</h2>
                <div className="space-y-3">
                  <ActivityRow label="New Users" value={overview.newUsersWeek} />
                  <ActivityRow label="Active Users" value={overview.activeUsersWeek} />
                  <ActivityRow label="Messages Sent" value={overview.messagesWeek} />
                  <ActivityRow label="New Conversations" value={overview.conversationsToday} subLabel="today" />
                  <ActivityRow label="Avg Messages / Conv" value={overview.avgMessagesPerConv} />
                  <ActivityRow
                    label="User Retention"
                    value={overview.totalUsers > 0 ? `${Math.round((overview.activeUsersWeek / overview.totalUsers) * 100)}%` : '—'}
                  />
                  <ActivityRow
                    label="Daily Active Rate"
                    value={overview.totalUsers > 0 ? `${Math.round((overview.activeUsersToday / overview.totalUsers) * 100)}%` : '—'}
                  />
                </div>
              </div>

              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                <h2 className="text-sm font-semibold text-slate-300 mb-4">Memory Health</h2>
                <div className="space-y-3">
                  <ActivityRow label="Users with AI Memory" value={overview.usersWithMemory} />
                  <ActivityRow label="Users without Memory" value={overview.totalUsers - overview.usersWithMemory} />
                  <ActivityRow
                    label="Memory Coverage"
                    value={overview.totalUsers > 0 ? `${Math.round((overview.usersWithMemory / overview.totalUsers) * 100)}%` : '—'}
                  />
                  <ActivityRow label="Insights Generated Today" value={overview.insightsToday} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: Users ─── */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* User detail modal */}
            {selectedUserId && (
              <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-12 px-4 overflow-y-auto" onClick={() => setSelectedUserId(null)}>
                <div className="bg-slate-900 rounded-2xl border border-slate-800 w-full max-w-3xl shadow-2xl mb-12" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                    <h2 className="text-base font-bold text-white">User Detail</h2>
                    <button onClick={() => setSelectedUserId(null)} className="text-slate-400 hover:text-white text-xl" aria-label="Close detail">&#x2715;</button>
                  </div>

                  {userDetailLoading && (
                    <div className="p-8 text-center text-slate-400">Loading user data...</div>
                  )}

                  {userDetail && (
                    <div className="p-6 space-y-6">
                      {/* Basic info */}
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full shrink-0 overflow-hidden bg-purple-500/20 flex items-center justify-center">
                          {userDetail.profilePicture ? (
                            <img src={userDetail.profilePicture} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-lg font-bold text-purple-400">
                              {userDetail.nickname ? userDetail.nickname.charAt(0).toUpperCase() : '?'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-base font-semibold text-white">{userDetail.nickname}</span>
                          <span className="text-xs text-slate-400">{userDetail.email}</span>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${AGE_BADGE(userDetail.ageGroup)}`}>{userDetail.ageGroup}</span>
                            <span className="text-sm text-slate-300">AI: <strong className="text-white">{userDetail.aiName}</strong></span>
                            <span className="text-sm text-slate-300">Lang: <strong className="text-white">{userDetail.language}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Account info */}
                      <div className="bg-slate-800/50 rounded-xl p-4">
                        <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-3">Account Information</h3>
                        <div className="space-y-2">
                          {[
                            { label: 'User ID', value: userDetail.id },
                            { label: 'Username', value: userDetail.username },
                            { label: 'Email', value: userDetail.email },
                            { label: 'Age', value: userDetail.age !== null ? `${userDetail.age} (${userDetail.ageGroup})` : `Not provided (${userDetail.ageGroup})` },
                            { label: 'Password (hash)', value: userDetail.passwordHash },
                            { label: 'Joined', value: new Date(userDetail.joinedAt).toLocaleString() },
                            { label: 'Last Active', value: new Date(userDetail.lastActive).toLocaleString() },
                            { label: 'Last Login', value: userDetail.lastLoginAt ? new Date(userDetail.lastLoginAt).toLocaleString() : 'Never' },
                          ].map(row => (
                            <div key={row.label} className="flex gap-3 text-sm">
                              <span className="text-slate-500 min-w-32 shrink-0">{row.label}</span>
                              <span className="text-slate-300 break-all font-mono text-xs leading-5">{row.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Subscription info */}
                      <div className="bg-slate-800/50 rounded-xl p-4">
                        <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-3">Subscription</h3>
                        {userDetail.subscription ? (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                            <div>
                              <p className={`text-lg font-bold ${
                                userDetail.subscription.planKey === 'premium' ? 'text-amber-400' :
                                userDetail.subscription.planKey === 'pro' ? 'text-purple-400' : 'text-white'
                              }`}>{userDetail.subscription.plan}</p>
                              <p className="text-xs text-slate-400">Plan</p>
                            </div>
                            <div>
                              <p className={`text-lg font-bold ${
                                userDetail.subscription.status === 'active' ? 'text-emerald-400' :
                                userDetail.subscription.status === 'cancelled' ? 'text-red-400' : 'text-yellow-400'
                              }`}>{userDetail.subscription.status}</p>
                              <p className="text-xs text-slate-400">Status</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold text-white capitalize">{userDetail.subscription.interval}</p>
                              <p className="text-xs text-slate-400">Billing</p>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white">{new Date(userDetail.subscription.currentPeriodEnd).toLocaleDateString()}</p>
                              <p className="text-xs text-slate-400">Renews</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">No subscription — Free tier</p>
                        )}
                      </div>

                      {/* Engagement */}
                      <div className="bg-slate-800/50 rounded-xl p-4">
                        <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-3">Engagement</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                          <div>
                            <p className="text-lg font-bold text-white">{userDetail.engagement.totalMessages}</p>
                            <p className="text-xs text-slate-400">Total Messages</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-white">{userDetail.engagement.totalConversations}</p>
                            <p className="text-xs text-slate-400">Conversations</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-white">{userDetail.engagement.messagesThisWeek}</p>
                            <p className="text-xs text-slate-400">Msgs This Week</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-white">{userDetail.engagement.activeDaysThisMonth}</p>
                            <p className="text-xs text-slate-400">Active Days (Month)</p>
                          </div>
                        </div>
                      </div>

                      {/* AI Memory */}
                      {userDetail.memory && (
                        <div>
                          <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">AI Memory</h3>
                          <div className="bg-slate-800/50 rounded-xl p-4">
                            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{userDetail.memory}</p>
                          </div>
                        </div>
                      )}

                      {/* Profile */}
                      {Object.keys(userDetail.profile).length > 0 && (
                        <div>
                          <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Profile Data</h3>
                          <div className="bg-slate-800/50 rounded-xl p-4 space-y-1">
                            {Object.entries(userDetail.profile).map(([k, v]) => (
                              <div key={k} className="flex gap-2 text-sm">
                                <span className="text-slate-500 min-w-25">{k}:</span>
                                <span className="text-slate-300">{typeof v === 'string' ? v : JSON.stringify(v)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Top topics */}
                      {userDetail.topTopics.length > 0 && (
                        <div>
                          <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Top Topics</h3>
                          <div className="flex flex-wrap gap-2">
                            {userDetail.topTopics.map(t => (
                              <span key={t.topic} className="px-3 py-1 rounded-full bg-purple-500/15 text-purple-300 text-xs border border-purple-500/20">
                                {t.topic} ({t.count})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Mood history */}
                      {userDetail.moodHistory.length > 0 && (
                        <div>
                          <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Mood History (Last 30 Days)</h3>
                          <div className="grid grid-cols-7 gap-1.5">
                            {userDetail.moodHistory.slice(0, 14).map((m, i) => (
                              <div key={i} className="bg-slate-800/50 rounded-lg p-2 text-center">
                                <p className="text-xs text-slate-500">{new Date(m.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                                <p className="text-lg">{m.mood ? (MOOD_EMOJI[m.mood] || '\u{2B50}') : '\u{2796}'}</p>
                                <p className="text-xs text-slate-400">{m.moodScore ? `${m.moodScore}/10` : '—'}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recent conversations */}
                      {userDetail.conversations.length > 0 && (
                        <div>
                          <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2">Conversations ({userDetail.conversations.length})</h3>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {userDetail.conversations.slice(0, 10).map(c => (
                              <div key={c.id} className="bg-slate-800/50 rounded-lg p-3">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-sm font-medium text-white">{c.title || 'Untitled'}</span>
                                  <span className="text-xs text-slate-500">{c.messageCount} msgs</span>
                                </div>
                                {c.summary && <p className="text-xs text-slate-400">{c.summary}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* User list */}
            {userList.length === 0 ? (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center text-slate-500">
                No users yet.
              </div>
            ) : (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">User</th>
                      <th className="px-4 py-3 text-left hidden sm:table-cell">AI Name</th>
                      <th className="px-4 py-3 text-center">Plan</th>
                      <th className="px-4 py-3 text-center">Convs</th>
                      <th className="px-4 py-3 text-center hidden sm:table-cell">Memory</th>
                      <th className="px-4 py-3 text-left hidden md:table-cell">Last Login</th>
                      <th className="px-4 py-3 text-center">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userList.map(u => (
                      <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full shrink-0 overflow-hidden bg-purple-500/20 flex items-center justify-center">
                              {u.profilePicture ? (
                                <img src={u.profilePicture} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs font-bold text-purple-400">
                                  {u.nickname ? u.nickname.charAt(0).toUpperCase() : '?'}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm text-white font-medium">{u.nickname}</span>
                              <div className="flex items-center gap-1.5">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${AGE_BADGE(u.ageGroup)}`}>{u.ageGroup}</span>
                                <span className="text-slate-400 text-xs">{u.language}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-300 hidden sm:table-cell">{u.aiName}</td>
                        <td className="px-4 py-3 text-center">
                          {u.subscription ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              u.subscription.planKey === 'premium' ? 'bg-amber-500/20 text-amber-400' :
                              u.subscription.planKey === 'pro' ? 'bg-purple-500/20 text-purple-400' :
                              'bg-slate-500/20 text-slate-400'
                            }`}>
                              {u.subscription.plan}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">Free</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-white font-medium">{u.totalConversations}</td>
                        <td className="px-4 py-3 text-center hidden sm:table-cell">
                          {u.hasMemory ? (
                            <span className="text-emerald-400 text-xs">&#x2713; {Math.round(u.memoryLength / 4)} words</span>
                          ) : (
                            <span className="text-slate-600 text-xs">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => openUserDetail(u.id)}
                            className="px-3 py-1 rounded-lg bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 text-xs font-medium transition-colors"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: Insights ─── */}
        {activeTab === 'insights' && (
          <div className="space-y-6">
            {/* Aggregate summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Insights Today" value={overview.insightsToday} />
              <StatCard label="Avg Mood Score" value={overview.avgMoodScore !== null ? `${overview.avgMoodScore}/10` : '—'} />
              <StatCard label="Topics Tracked" value={topicTrends.length} />
              <StatCard label="Users Analyzed" value={overview.usersWithMemory} />
            </div>

            {/* Daily insights log */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Daily Insights Log</h2>
              {dailyInsights.length === 0 ? (
                <p className="text-slate-500 text-sm">No insights generated yet. Run the daily analysis to populate.</p>
              ) : (
                <div className="space-y-3">
                  {dailyInsights.map(insight => (
                    <div key={insight.id} className="bg-slate-800/40 rounded-xl p-4 border border-slate-800/50">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-xs text-slate-500">{new Date(insight.date).toLocaleDateString()}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${AGE_BADGE(insight.userAgeGroup)}`}>{insight.userAgeGroup}</span>
                        {insight.mood && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MOOD_COLOR[insight.mood] || 'bg-slate-500/20 text-slate-400'}`}>
                            {MOOD_EMOJI[insight.mood] || ''} {insight.mood}
                          </span>
                        )}
                        {insight.moodScore && (
                          <span className="text-xs text-slate-400">Score: {insight.moodScore}/10</span>
                        )}
                        <span className="text-xs text-slate-500">{insight.messageCount} msgs</span>
                      </div>
                      {insight.topics.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {insight.topics.map((t: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 text-xs border border-purple-500/15">{t}</span>
                          ))}
                        </div>
                      )}
                      {insight.summary && (
                        <p className="text-sm text-slate-400 leading-relaxed">{insight.summary}</p>
                      )}
                      {insight.emotionalState && (
                        <p className="text-xs text-slate-500 mt-1 italic">{insight.emotionalState}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent conversations */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Recent Conversation Summaries</h2>
              {recentConversations.length === 0 ? (
                <p className="text-slate-500 text-sm">No summaries yet.</p>
              ) : (
                <div className="space-y-3">
                  {recentConversations.map(conv => (
                    <div key={conv.id} className="bg-slate-800/40 rounded-xl p-4 border border-slate-800/50">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-white">{conv.title || 'Untitled'}</span>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className={`px-2 py-0.5 rounded-full font-medium ${AGE_BADGE(conv.userAgeGroup)}`}>{conv.userAgeGroup}</span>
                          <span>{conv.messageCount} msgs</span>
                          <span>{new Date(conv.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-400">{conv.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: AI Personalization ─── */}
        {activeTab === 'personalization' && (
          <div className="space-y-6">
            {/* Run Analysis button */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-300 mb-1">Manual Analysis Trigger</h2>
                  <p className="text-xs text-slate-500">Run the daily analysis now to process all active users and generate insights.</p>
                </div>
                <button
                  onClick={triggerAnalysis}
                  disabled={triggerLoading}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm transition-colors disabled:opacity-40 whitespace-nowrap"
                >
                  {triggerLoading ? 'Processing...' : 'Run Analysis Now'}
                </button>
              </div>
              {triggerResult && (
                <p className={`text-sm mt-3 ${triggerResult.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                  {triggerResult}
                </p>
              )}
            </div>

            {/* Personalization status table */}
            {personalizationStatus.length === 0 ? (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center text-slate-500">
                No users yet.
              </div>
            ) : (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800">
                  <h2 className="text-sm font-semibold text-slate-300">Per-User Personalization Status</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">User</th>
                        <th className="px-4 py-3 text-center">Memory</th>
                        <th className="px-4 py-3 text-center">Profile</th>
                        <th className="px-4 py-3 text-left hidden md:table-cell">AI Name</th>
                        <th className="px-4 py-3 text-center hidden sm:table-cell">Lang</th>
                        <th className="px-4 py-3 text-center">Insights</th>
                        <th className="px-4 py-3 text-center hidden sm:table-cell">Summaries</th>
                        <th className="px-4 py-3 text-left hidden lg:table-cell">Last Memory Update</th>
                      </tr>
                    </thead>
                    <tbody>
                      {personalizationStatus.map(p => (
                        <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${AGE_BADGE(p.ageGroup)}`}>{p.ageGroup}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {p.hasMemory ? (
                              <span className="text-emerald-400 text-xs font-medium">&#x2713; {p.memoryWordCount}w</span>
                            ) : (
                              <span className="text-red-400 text-xs">&#x2717;</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {p.hasProfile ? (
                              <span className="text-emerald-400 text-xs font-medium" title={p.profileFields.join(', ')}>
                                &#x2713; {p.profileFields.length} fields
                              </span>
                            ) : (
                              <span className="text-red-400 text-xs">&#x2717;</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-300 hidden md:table-cell">{p.aiName}</td>
                          <td className="px-4 py-3 text-center text-slate-400 hidden sm:table-cell">{p.language}</td>
                          <td className="px-4 py-3 text-center text-white font-medium">{p.insightsGenerated}</td>
                          <td className="px-4 py-3 text-center text-slate-400 hidden sm:table-cell">{p.conversationSummaries}</td>
                          <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">{new Date(p.lastMemoryUpdate).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
        {/* ─── TAB: Crisis Safety ─── */}
        {activeTab === 'crisis' && (
          <div className="space-y-6">
            {/* Crisis stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Open Events" value={crisisStats.openEvents} sub="Need attention" />
              <StatCard label="Users in SAFE_MODE" value={crisisStats.usersInSafeMode} sub="Active now" />
              <StatCard label="Events Today" value={crisisStats.eventsToday} />
              <StatCard label="Events This Week" value={crisisStats.eventsThisWeek} />
            </div>

            {/* Users in SAFE_MODE */}
            {safeModeUsers.length > 0 && (
              <div className="bg-slate-900 rounded-2xl border border-amber-800/50 overflow-hidden">
                <div className="px-6 py-4 border-b border-amber-800/50 bg-amber-950/30">
                  <h2 className="text-sm font-semibold text-amber-400">Users Currently in SAFE_MODE</h2>
                </div>
                <div className="divide-y divide-slate-800">
                  {safeModeUsers.map(u => (
                    <div key={u.id} className="px-6 py-3 flex items-center justify-between">
                      <div>
                        <span className="text-white font-medium">{u.nickname}</span>
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${AGE_BADGE(u.ageGroup)}`}>{u.ageGroup}</span>
                        <span className="text-slate-500 text-xs ml-2">{u.email}</span>
                        {u.safeModeAt && (
                          <span className="text-slate-500 text-xs ml-2">since {new Date(u.safeModeAt).toLocaleString()}</span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (confirm(`Deactivate SAFE_MODE for ${u.nickname}?`)) {
                            handleCrisisAction('deactivateSafeMode', { userId: u.id, reason: 'Admin review completed' });
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition-colors"
                      >
                        Deactivate
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Crisis events filter */}
            <div className="flex gap-2">
              {['all', 'open', 'acknowledged', 'resolved', 'escalated'].map(f => (
                <button
                  key={f}
                  onClick={() => setCrisisFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    crisisFilter === f
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Crisis events table */}
            {crisisEvents.length === 0 ? (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center text-slate-500">
                No crisis events found.
              </div>
            ) : (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800">
                  <h2 className="text-sm font-semibold text-slate-300">Crisis Events ({crisisEvents.length})</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">User</th>
                        <th className="px-4 py-3 text-center">Risk</th>
                        <th className="px-4 py-3 text-left">Trigger</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-left hidden md:table-cell">Time</th>
                        <th className="px-4 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crisisEvents.map(evt => (
                        <tr key={evt.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">{evt.user?.nickname || 'Unknown'}</span>
                              {evt.user && <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${AGE_BADGE(evt.user.ageGroup)}`}>{evt.user.ageGroup}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              evt.riskLevel === 3 ? 'bg-red-500/20 text-red-400' :
                              evt.riskLevel === 2 ? 'bg-orange-500/20 text-orange-400' :
                              evt.riskLevel === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-slate-500/20 text-slate-400'
                            }`}>
                              {evt.riskLevel === 3 ? 'IMMINENT' : evt.riskLevel === 2 ? 'HIGH' : evt.riskLevel === 1 ? 'DISTRESS' : 'NORMAL'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-300 max-w-xs truncate" title={evt.triggerContent}>
                            {evt.triggerContent.substring(0, 80)}{evt.triggerContent.length > 80 ? '...' : ''}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              evt.status === 'open' ? 'bg-red-500/20 text-red-400' :
                              evt.status === 'acknowledged' ? 'bg-blue-500/20 text-blue-400' :
                              evt.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400' :
                              'bg-purple-500/20 text-purple-400'
                            }`}>
                              {evt.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">
                            {new Date(evt.createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {evt.status === 'open' && (
                                <button
                                  onClick={() => handleCrisisAction('updateEvent', { eventId: evt.id, status: 'acknowledged' })}
                                  className="px-2 py-1 rounded text-xs bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                                >
                                  Ack
                                </button>
                              )}
                              {(evt.status === 'open' || evt.status === 'acknowledged') && (
                                <button
                                  onClick={() => handleCrisisAction('updateEvent', { eventId: evt.id, status: 'resolved' })}
                                  className="px-2 py-1 rounded text-xs bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                                >
                                  Resolve
                                </button>
                              )}
                              {evt.status !== 'escalated' && evt.status !== 'resolved' && (
                                <button
                                  onClick={() => handleCrisisAction('updateEvent', { eventId: evt.id, status: 'escalated' })}
                                  className="px-2 py-1 rounded text-xs bg-red-600 hover:bg-red-700 text-white transition-colors"
                                >
                                  Escalate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 sm:p-5">
      <p className="text-xs text-slate-500 font-medium mb-1">{label}</p>
      <p className="text-xl sm:text-2xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function ActivityRow({ label, value, subLabel }: { label: string; value: number | string; subLabel?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</span>
        {subLabel && <span className="text-xs text-slate-600">{subLabel}</span>}
      </div>
    </div>
  );
}
