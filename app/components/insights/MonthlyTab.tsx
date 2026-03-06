'use client';

import { useState, useEffect, useCallback } from 'react';
import EmotionBreakdown from './EmotionBreakdown';
import InsightBanner from './InsightBanner';
import DayOfWeekHeatmap from './DayOfWeekHeatmap';
import TriggerPieChart from './TriggerPieChart';
import GrowthCard from './GrowthCard';
import PeriodSelector from './PeriodSelector';
import MoodChart from '../MoodChart';
import PatternCard from '../PatternCard';

interface AggregatedData {
  emotionBreakdown: { mood: string; percentage: number; count: number; topTriggers: string[]; topTopics: string[] }[];
  moodCurve: { date: string; moodScore: number; mood: string }[];
  triggers: { name: string; count: number }[];
  patterns: { name: string; count: number }[];
  topics: { name: string; count: number }[];
  dayOfWeek: { day: string; avgMood: number; count: number }[];
  summary: { avgMood: number | null; trend: string; totalMessages: number; totalDays: number; topTrigger: string | null; topPattern: string | null };
  naturalInsights: string[];
  interventions: { type: 'cognitive' | 'behavioral' | 'support'; title: string; description: string; reason: string }[];
}

export default function MonthlyTab({ userId }: { userId: string }) {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [months, setMonths] = useState<{ value: string; label: string }[]>([]);
  const [data, setData] = useState<AggregatedData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const monthParam = selectedMonth ? `&month=${selectedMonth}` : '';
      const res = await fetch(`/api/insights?userId=${userId}&tab=monthly${monthParam}`);
      const json = await res.json();
      setMonths(json.availableMonths || []);
      if (json.selectedMonth && !selectedMonth) setSelectedMonth(json.selectedMonth);
      setData(json.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [userId, selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading && !data) {
    return <div className="flex items-center justify-center h-48"><div className="w-7 h-7 border-3 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (months.length === 0 || !data) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-4">📅</div>
        <h3 className="text-base font-semibold text-neutral-700 dark:text-neutral-300 mb-2">No monthly data yet</h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Monthly analysis will appear once you have chat data for at least one month.
        </p>
      </div>
    );
  }

  const trendIcon = data.summary.trend === 'improving' ? '↗' : data.summary.trend === 'declining' ? '↘' : '→';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Monthly Analysis</h3>
        {months.length > 1 && (
          <PeriodSelector options={months} selected={selectedMonth} onChange={setSelectedMonth} label="Month" />
        )}
      </div>

      {/* Natural language insights */}
      <InsightBanner insights={data.naturalInsights} />

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Avg Mood" value={data.summary.avgMood?.toFixed(1) || '—'} sub={`/10 ${trendIcon}`} />
        <StatCard label="Messages" value={String(data.summary.totalMessages)} sub="total" />
        <StatCard label="Days" value={String(data.summary.totalDays)} sub="recorded" />
      </div>

      {/* Day-of-week heatmap */}
      {data.dayOfWeek.some(d => d.count > 0) && (
        <Section title="Mood by Day of Week">
          <DayOfWeekHeatmap data={data.dayOfWeek} />
        </Section>
      )}

      {/* Emotion breakdown */}
      <Section title="Emotion Distribution">
        <EmotionBreakdown data={data.emotionBreakdown} />
      </Section>

      {/* Mood chart */}
      <Section title="Mood Over Time">
        <MoodChart data={data.moodCurve} />
      </Section>

      {/* Trigger source breakdown */}
      {data.triggers.length > 0 && (
        <Section title="Trigger Sources">
          <TriggerPieChart data={data.triggers} />
        </Section>
      )}

      {/* Patterns */}
      {data.patterns.length > 0 && (
        <Section title="Thinking Patterns">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.patterns.map(p => (
              <PatternCard key={p.name} name={p.name} count={p.count} maxCount={data.patterns[0].count} />
            ))}
          </div>
        </Section>
      )}

      {/* Topics */}
      {data.topics.length > 0 && (
        <Section title="Topics">
          <div className="flex flex-wrap gap-2">
            {data.topics.map(t => (
              <span key={t.name} className="px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                {t.name} ({t.count})
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Growth interventions */}
      <GrowthCard interventions={data.interventions} />
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-white/80 dark:bg-white/5 border border-purple-100 dark:border-purple-800/30 p-3 text-center">
      <div className="text-xs text-neutral-400 dark:text-neutral-500 mb-0.5">{label}</div>
      <div className="text-lg font-bold text-neutral-800 dark:text-neutral-100">
        {value}<span className="text-xs font-normal text-neutral-400 ml-1">{sub}</span>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/80 dark:bg-white/5 border border-purple-100 dark:border-purple-800/30 p-5">
      <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-4">{title}</h4>
      {children}
    </div>
  );
}
