'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// 全局声明声明以接管 OneSignal 在浏览器 window 对象中的注入
declare global {
  interface Window {
    OneSignal: any;
    OneSignalDeferred: any[];
    _oneSignalReady: boolean;
  }
}

/**
 * 内部工具：安全获取 OneSignal 操作句柄（并确保其注入完毕且就绪）
 */
function getOneSignal(): any | null {
  if (typeof window !== 'undefined' && window._oneSignalReady && window.OneSignal) {
    return window.OneSignal;
  }
  return null;
}

/**
 * 组件：推送通知设置面板 (NotificationSettings)
 * 作用：管理用户的“主动关怀”推送开关。涉及 OneSignal 浏览器端权限请求与后端数据库状态同步。
 * 核心逻辑：只有 Pro/Premium 用户才有权开启。开启后服务器才会通过 Cron Jab 每日晨间定期推送。
 */
export default function NotificationSettings({ userId }: { userId: string }) {
  const [isSubscribed, setIsSubscribed] = useState(false); // 本地缓存的推送订阅状态
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [plan, setPlan] = useState<'free' | 'pro' | 'premium'>('free'); // 用户当前的计费计划
  const [error, setError] = useState('');

  // 初始化拉取：从数据库同步用户的真实订阅权重与其在系统中登记的推送意愿
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch(`/api/users/${userId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.subscription?.plan?.name) {
            setPlan(data.subscription.plan.name);
          }
          // 以数据库里的标记作为“事实来源”，因为即使浏览器取消了权限，DB 没关则 Cron 仍会尝试投件
          setIsSubscribed(data.pushSubscription === 'onesignal');
        }
      } catch (err) {
        console.error('Failed to fetch user state', err);
      } finally {
        setLoading(false);
      }
    };
    fetchState();
  }, [userId]);

  /**
   * 行为处理器：状态反转（开启或关闭通知）
   */
  const handleToggle = useCallback(async () => {
    // 免费版用户拦截器：禁止点击，引导升级
    if (plan === 'free') return;
    setToggling(true);
    setError('');

    try {
      if (isSubscribed) {
        // ─── 关闭流程 ───
        // 1. 先斩后奏：立刻切断数据库里的关联（由于 Cron 会读取这个标记，这样最快生效）
        await fetch('/api/notifications/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        setIsSubscribed(false);

        // 2. 善后处理：要求 OneSignal 客户端层级退订
        const os = getOneSignal();
        if (os) {
          try { await os.User.PushSubscription.optOut(); } catch { /* ignore */ }
        }
      } else {
        // ─── 开启流程 ───
        // 1. 客户端握手：调起浏览器原生的请求权限弹窗
        const os = getOneSignal();
        if (os) {
          try {
            await os.login(userId); // 建立用户识别映射
            const granted = await os.Notifications.requestPermission();
            if (!granted) {
              setError('Notification permission denied. Please enable it in your browser settings.');
              setToggling(false);
              return;
            }
          } catch {
            // 如果 OneSignal 模块故障（如被广告拦截插件杀掉），仍尝试执行 DB 更新作为容错方案
          }
        }

        // 2. 远端记录：在数据库贴上标签，表示该用户正式进入“主动推送照顾”名单
        const res = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Failed to enable notifications');
          setToggling(false);
          return;
        }

        setIsSubscribed(true);
      }
    } catch (err) {
      console.error('Toggle notification failed:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setToggling(false);
    }
  }, [isSubscribed, plan, userId]);

  const isLocked = plan === 'free'; // 用于锁定按钮的交互视觉

  return (
    <div className="p-4 bg-white/5 rounded-xl border border-purple-500/20 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
          {/* 小闹钟图标 */}
          <svg className={`w-4 h-4 ${isLocked ? 'text-neutral-400' : 'text-purple-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          Proactive Notifications
          {/* 付费墙标识 */}
          {isLocked && (
            <span className="ml-2 inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
              PRO
            </span>
          )}
        </h3>

        {/* iOS 风格的滑动开关 */}
        <button
          title="Toggle notifications"
          onClick={handleToggle}
          disabled={loading || toggling || isLocked}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            ${isSubscribed ? 'bg-purple-600' : 'bg-neutral-200 dark:bg-neutral-700'}
            ${(loading || toggling || isLocked) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
              ${isSubscribed ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
      </div>

      {/* 说明案文：动态切换（启用或禁用时的不同收益描述） */}
      <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
        {isSubscribed
          ? 'You will receive daily morning greetings and weather reminders even when the app is closed.'
          : 'Enable to receive daily morning messages and weather alerts via push notifications.'
        }
      </div>

      {/* 报错反馈槽 */}
      {error && (
        <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mb-2">{error}</div>
      )}

      {/* 诱导升级版块（仅向免费用户展示） */}
      {isLocked && !loading && (
        <div className="mt-3 text-xs bg-amber-500/5 dark:bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
          <span className="text-amber-700 dark:text-amber-400/90 block mb-1">Unlock proactive care and weather alerts.</span>
          <Link href="/subscription" className="text-amber-600 dark:text-amber-300 font-medium hover:underline">
            Upgrade to Pro or Premium &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
