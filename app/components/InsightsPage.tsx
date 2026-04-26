'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ThreeDayTab from './insights/ThreeDayTab';
import WeeklyTab from './insights/WeeklyTab';
import FifteenDayTab from './insights/FifteenDayTab';
import MonthlyTab from './insights/MonthlyTab';
import { useUserInfo } from '@/app/lib/useUserInfo';

type Tab = '3day' | 'weekly' | '15day' | 'monthly';

// 定义每一组数据看板的最短活跃天数要求锁
interface TabDef {
  key: Tab;
  label: string;
  minDays: number;
}

const TABS: TabDef[] = [
  { key: '3day', label: '3-Day', minDays: 1 }, // 放水：3天报告1天就能看（体验）
  { key: 'weekly', label: '7-Day', minDays: 7 }, // 门槛：连续使用7天解锁周度数据
  { key: '15day', label: '15-Day', minDays: 15 },
  { key: 'monthly', label: 'Monthly', minDays: 1 },
];

/**
 * 组件：情绪与心理数据大盘 (Insights Page)
 * 作用：这是一个非常核心的变现漏斗与价值展现区域。用户可以通过 AI 的量化图表了解自己的心理走势。
 * 金融门限：这整个系统是 Paywall（付费墙）护城河的一部分。非 Premium 会员只能看见推销遮罩页。
 */
export default function InsightsPage({ userId }: { userId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('3day');
  const [meta, setMeta] = useState<{ totalDays: number; firstDate: string | null } | null>(null);
  const { userInfo } = useUserInfo(userId);

  // 初始化：向后台请求用户的全局活跃元数据（包含一共打卡了多少天？）
  useEffect(() => {
    fetch(`/api/insights?userId=${userId}&tab=meta`)
      .then(r => r.json())
      .then(setMeta)
      .catch(() => { });
  }, [userId]);

  const totalDays = meta?.totalDays || 0;
  // 会员等级判定器：任何包含了 pro / premium 返回字的计费订阅都被允许放行
  const planName = userInfo?.subscription?.plan?.name || 'free';
  const isPremium = planName === 'pro' || planName === 'premium';

  if (!userInfo) return null; // Wait for info to load (阻塞闪屏白块)

  // ─── 拦截器视图 (Paywall View) ───
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

  // ─── 正式系统大厅视图 (Premium Dashboard View) ───
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-100 dark:from-[#0f0d1a] dark:via-[#1a1528] dark:to-[#0f0d1a]">
      {/* Header：包含了返回钮和总计录音天数大字报 */}
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

          {/* Tab bar：多维度时间轴的导航栏 */}
          <div className="flex gap-1 bg-neutral-100 dark:bg-white/5 rounded-xl p-1">
            {TABS.map(t => {
              // 时间锁算法：如果是新用户还没存够某一个跨度所需的语料，该按钮上锁禁用
              const locked = totalDays < t.minDays && t.key !== '3day' && t.key !== 'monthly';
              return (
                <button
                  key={t.key}
                  onClick={() => !locked && setActiveTab(t.key)}
                  disabled={locked}
                  className={`
                    flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all relative
                    ${activeTab === t.key
                      ? 'bg-purple-600 text-white shadow-sm' // 激活态高亮紫底
                      : locked
                        ? 'text-neutral-300 dark:text-neutral-600 cursor-not-allowed' // 无权访问态灰斑
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

      {/* Main 面板区域：利用 Router 单页模式按需渲染下面层级的庞大图表引擎组件 */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {activeTab === '3day' && <ThreeDayTab userId={userId} />}
        {activeTab === 'weekly' && <WeeklyTab userId={userId} totalDays={totalDays} />}
        {activeTab === '15day' && <FifteenDayTab userId={userId} totalDays={totalDays} />}
        {activeTab === 'monthly' && <MonthlyTab userId={userId} />}
      </main>
    </div>
  );
}
