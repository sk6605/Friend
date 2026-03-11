'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ThreeDayTab from './insights/ThreeDayTab';
import WeeklyTab from './insights/WeeklyTab';
import FifteenDayTab from './insights/FifteenDayTab';
import MonthlyTab from './insights/MonthlyTab';
import { useUserInfo } from '@/app/lib/useUserInfo';

type Tab = '3day' | 'weekly' | '15day' | 'monthly';

interface TabDef {
  key: Tab;
  label: string;
  minDays: number;
}

const TABS: TabDef[] = [
  { key: '3day', label: '3-Day', minDays: 1 },
  { key: 'weekly', label: '7-Day', minDays: 7 },
  { key: '15day', label: '15-Day', minDays: 15 },
  { key: 'monthly', label: 'Monthly', minDays: 1 },
];

export default function InsightsPage({ userId }: { userId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('3day');
  const [meta, setMeta] = useState<{ totalDays: number; firstDate: string | null } | null>(null);
  const { userInfo } = useUserInfo(userId);

  useEffect(() => {
    fetch(`/api/insights?userId=${userId}&tab=meta`)
      .then(r => r.json())
      .then(setMeta)
      .catch(() => { });
  }, [userId]);

  const totalDays = meta?.totalDays || 0;
  const planName = userInfo?.subscription?.plan?.name || 'free';
  const isPremium = planName === 'pro' || planName === 'premium';

  if (!userInfo) return null; // Wait for info to load

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-100 dark:from-[#0f0d1a] dark:via-[#1a1528] dark:to-[#0f0d1a] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-purple-100 dark:border-purple-500/20 p-8 rounded-3xl shadow-xl">
          <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/40 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 text-transparent bg-clip-text mb-4">
            AI Emotional Analytics
          </h2>
          
          <p className="text-neutral-600 dark:text-neutral-300 mb-6 leading-relaxed">
            Discover a deeper understanding of yourself. Upgrading to <span className="font-semibold text-purple-600 dark:text-purple-400">Pro</span> or <span className="font-semibold text-indigo-600 dark:text-indigo-400">Premium</span> unlocks personalized daily summaries, emotion tracking, hidden pattern detection, and cognitive insight analytics compiled by {userInfo.aiName || 'your AI'}.
          </p>

          <Link href="/subscription" className="w-full inline-block bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 mb-4">
            Upgrade to Unlock Insights ✦
          </Link>
          
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors">
            Return to Chat
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-100 dark:from-[#0f0d1a] dark:via-[#1a1528] dark:to-[#0f0d1a]">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 dark:bg-[#1e1b2e]/80 border-b border-purple-100 dark:border-purple-900/30">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-lg font-bold text-neutral-800 dark:text-neutral-100">Insights</h1>
            </div>
            {meta && (
              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                {totalDays} day{totalDays !== 1 ? 's' : ''} of data
              </span>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 bg-neutral-100 dark:bg-white/5 rounded-xl p-1">
            {TABS.map(t => {
              const locked = totalDays < t.minDays && t.key !== '3day' && t.key !== 'monthly';
              return (
                <button
                  key={t.key}
                  onClick={() => !locked && setActiveTab(t.key)}
                  disabled={locked}
                  className={`
                    flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all relative
                    ${activeTab === t.key
                      ? 'bg-purple-600 text-white shadow-sm'
                      : locked
                        ? 'text-neutral-300 dark:text-neutral-600 cursor-not-allowed'
                        : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                    }
                  `}
                >
                  {t.label}
                  {locked && (
                    <svg className="w-3 h-3 inline-block ml-1 -mt-0.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {activeTab === '3day' && <ThreeDayTab userId={userId} />}
        {activeTab === 'weekly' && <WeeklyTab userId={userId} totalDays={totalDays} />}
        {activeTab === '15day' && <FifteenDayTab userId={userId} totalDays={totalDays} />}
        {activeTab === 'monthly' && <MonthlyTab userId={userId} />}
      </main>
    </div>
  );
}
