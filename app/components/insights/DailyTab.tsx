'use client';

import { useState, useEffect, useCallback } from 'react';
import DailyRowChart from './DailyRowChart';

interface HourlyData {
  hour: number;
  label: string;
  userMessages: number;
  aiMessages: number;
  total: number;
}

interface DailyInsight {
  mood: string | null;
  moodScore: number | null;
  emotionIntensity: number | null;
  triggerEvent: string | null;
  thinkingPattern: string | null;
  behavioralResponse: string | null;
  topics: string[];
  emotionalState: string | null;
  summary: string | null;
  messageCount?: number;
  date?: string;
}

interface RealTimeStats {
  totalMessages: number;
  userMessages: number;
  conversations: number;
  activeHours: number;
  activePeriod: string | null;
  peakHour: string | null;
}

interface DailyResponse {
  tab: 'daily';
  hasData: boolean;
  disabled?: boolean;
  reason?: string;
  isRealTime?: boolean;
  selectedDate: string;
  availableDates: string[];
  hourlyData: HourlyData[];
  realTime?: RealTimeStats;
  insight: DailyInsight | null;
}

export default function DailyTab({ userId }: { userId: string }) {
  const [data, setData] = useState<DailyResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (date?: string) => {
    setLoading(true);
    try {
      const n = new Date();
      const clientToday = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
      const dateParam = date ? `&date=${date}` : '';
      const res = await fetch(`/api/insights?userId=${userId}&tab=daily${dateParam}&today=${clientToday}`);
      const json = await res.json();
      setData(json);
      if (json.selectedDate && !date) setSelectedDate(json.selectedDate);
    } catch { /* ignore */ }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    fetchData(date);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-7 h-7 border-3 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Disabled state
  if (data?.disabled) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-neutral-700 dark:text-neutral-300 mb-2">Analysis Disabled</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xs mx-auto">
          {data.reason === 'account_restricted'
            ? 'Your account is currently restricted. Analysis is temporarily unavailable.'
            : 'Data control is turned off. Enable it in Settings to see daily analysis.'
          }
        </p>
      </div>
    );
  }

  const availableDates = data?.availableDates || [];
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isToday = (selectedDate || todayStr) === todayStr;
  const hourlyData = data?.hourlyData || [];

  return (
    <div className="space-y-4">
      {/* Date selector bar */}
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 shrink-0">
          {isToday ? 'Today' : selectedDate}
        </h3>
        {isToday && data?.isRealTime && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            LIVE
          </span>
        )}
        <div className="ml-auto">
          <select
            title="Select date"
            value={selectedDate || todayStr}
            onChange={(e) => handleDateChange(e.target.value)}
            className="
              px-3 py-1.5 rounded-xl text-xs font-medium
              bg-neutral-50 dark:bg-[#2a2440]
              border border-neutral-200 dark:border-neutral-600
              text-neutral-800 dark:text-neutral-100
              outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-900/30
              transition-all appearance-none cursor-pointer pr-7
            "
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: 'right 0.4rem center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '1.1em 1.1em',
            }}
          >
            {availableDates.map(d => (
              <option key={d} value={d} className="bg-white dark:bg-[#2a2440]">
                {d === todayStr ? `${d} (Today)` : d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* No data state */}
      {!data?.hasData && (
        <div className="text-center py-12">
          <div className="text-3xl mb-3">📝</div>
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">No data for this date</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {isToday ? 'Start chatting to see real-time analysis here.' : 'No conversations were recorded on this date.'}
          </p>
        </div>
      )}

      {data?.hasData && (
        <>
          {/* ─── Sentiment Analysis (primary focus) ─── */}

          {/* Mood hero */}
          {data.insight && (
            <>
              <div className="rounded-2xl bg-white/80 dark:bg-white/5 border border-purple-100 dark:border-purple-800/30 p-5 text-center">
                <div className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 capitalize mb-1">
                  {data.insight.mood || 'Analyzing...'}
                </div>
                {data.insight.moodScore !== null && (
                  <div className="flex items-center justify-center gap-4 mt-3">
                    <div className="relative w-16 h-16">
                      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" strokeWidth="5" className="text-neutral-100 dark:text-white/5" />
                        <circle
                          cx="32" cy="32" r="27" fill="none" strokeWidth="5"
                          strokeLinecap="round"
                          className="text-purple-500"
                          stroke="currentColor"
                          strokeDasharray={`${(data.insight.moodScore / 10) * 169.6} 169.6`}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-base font-bold text-neutral-800 dark:text-neutral-100">
                        {data.insight.moodScore}
                      </span>
                    </div>
                    <div className="text-left text-sm">
                      <div className="text-neutral-600 dark:text-neutral-300">Mood: {data.insight.moodScore}/10</div>
                      {data.insight.emotionIntensity !== null && (
                        <div className="text-neutral-500 dark:text-neutral-400 text-xs mt-0.5">
                          Intensity: {data.insight.emotionIntensity}/10
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Emotional state */}
              {data.insight.emotionalState && (
                <div className="rounded-2xl bg-white/80 dark:bg-white/5 border border-purple-100 dark:border-purple-800/30 p-5">
                  <h4 className="text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-2">Emotional State</h4>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{data.insight.emotionalState}</p>
                </div>
              )}

              {/* Detail cards (trigger, thinking pattern, behavioral response) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.insight.triggerEvent && (
                  <DetailCard icon="⚡" label="Trigger Event" value={data.insight.triggerEvent} />
                )}
                {data.insight.thinkingPattern && (
                  <DetailCard icon="🧠" label="Thinking Pattern" value={data.insight.thinkingPattern.replace(/-/g, ' ')} />
                )}
                {data.insight.behavioralResponse && (
                  <DetailCard icon="💬" label="Behavioral Response" value={data.insight.behavioralResponse.replace(/-/g, ' ')} />
                )}
                {data.insight.messageCount !== undefined && !isToday && (
                  <DetailCard icon="📊" label="Messages" value={`${data.insight.messageCount} messages`} />
                )}
              </div>

              {/* Summary */}
              {data.insight.summary && (
                <div className="rounded-2xl bg-white/80 dark:bg-white/5 border border-purple-100 dark:border-purple-800/30 p-5">
                  <h4 className="text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-2">Daily Summary</h4>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line">{data.insight.summary}</p>
                </div>
              )}

              {/* Topics */}
              {data.insight.topics && data.insight.topics.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {data.insight.topics.map((t: string) => (
                    <span
                      key={t}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Today but no cron insight yet */}
          {isToday && !data.insight && data.hasData && (
            <div className="rounded-2xl bg-purple-50 dark:bg-purple-900/15 border border-purple-200 dark:border-purple-800/30 p-5 text-center">
              <p className="text-sm text-purple-700 dark:text-purple-300">
                Mood analysis will be available after midnight when the daily summary runs.
                <br />
                <span className="text-xs text-purple-500 dark:text-purple-400">Activity data below updates in real-time.</span>
              </p>
            </div>
          )}

          {/* ─── Activity section (secondary, collapsible) ─── */}
          <details className="group rounded-2xl bg-white/80 dark:bg-white/5 border border-purple-100 dark:border-purple-800/30 overflow-hidden">
            <summary className="px-5 py-3 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors flex items-center justify-between">
              <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Activity Details
              </h4>
              <svg className="w-4 h-4 text-neutral-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="px-5 pb-5 space-y-4">
              {/* Real-time stats (today only) */}
              {isToday && data.realTime && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <MiniStat label="Messages" value={String(data.realTime.totalMessages)} />
                  <MiniStat label="Conversations" value={String(data.realTime.conversations)} />
                  <MiniStat label="Active Hours" value={String(data.realTime.activeHours)} />
                  <MiniStat label="Peak Hour" value={data.realTime.peakHour || '—'} />
                </div>
              )}

              {/* Hourly activity chart */}
              <div>
                <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-3 uppercase tracking-wider">
                  24-Hour Activity
                </h4>
                <DailyRowChart data={hourlyData} />
              </div>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/80 dark:bg-white/5 border border-purple-100 dark:border-purple-800/30 px-3 py-2.5 text-center">
      <div className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-base font-bold text-neutral-800 dark:text-neutral-100">{value}</div>
    </div>
  );
}

function DetailCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/80 dark:bg-white/5 border border-purple-100 dark:border-purple-800/30 p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">{icon}</span>
        <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">{label}</span>
      </div>
      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200 capitalize">{value}</p>
    </div>
  );
}
