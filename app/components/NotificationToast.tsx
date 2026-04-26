'use client';

import { useEffect, useState } from 'react';

/**
 * 接口属性定义 (NotificationToastProps)
 * notifications: 包含 id, 类别, 标题, 消息内容及阅读状态的数组
 * onDismiss: 点击关闭按钮或倒计时结束后的回调
 * onRead: 消息展示一段时间后自动标记为已读的回调
 */
interface NotificationToastProps {
  notifications: {
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
  }[];
  onDismiss: (id: string) => void;
  onRead: (id: string) => void;
}

/**
 * 常量定义 (TYPE_STYLES)
 * 针对不同类型的通知（如晨间提醒、下雨预报、午餐建议等）定义专属的 Emoji、渐变底色和主题色彩。
 */
const TYPE_STYLES: Record<string, {
  icon: string;
  gradient: string;
  border: string;
  shadow: string;
  iconBg: string;
  accent: string;
}> = {
  morning_alert: {
    icon: '🌅',
    gradient: 'from-amber-500/10 via-orange-500/5 to-transparent dark:from-amber-900/30 dark:via-orange-900/20 dark:to-transparent',
    border: 'border-amber-200/60 dark:border-amber-700/40',
    shadow: 'shadow-amber-500/15 dark:shadow-amber-500/10',
    iconBg: 'bg-amber-100 dark:bg-amber-900/50',
    accent: 'text-amber-600 dark:text-amber-400',
  },
  rain_alert: {
    icon: '🌧️',
    gradient: 'from-blue-500/10 via-cyan-500/5 to-transparent dark:from-blue-900/30 dark:via-cyan-900/20 dark:to-transparent',
    border: 'border-blue-200/60 dark:border-blue-700/40',
    shadow: 'shadow-blue-500/15 dark:shadow-blue-500/10',
    iconBg: 'bg-blue-100 dark:bg-blue-900/50',
    accent: 'text-blue-600 dark:text-blue-400',
  },
  lunch_reminder: {
    icon: '🍽️',
    gradient: 'from-orange-500/10 via-yellow-500/5 to-transparent dark:from-orange-900/30 dark:via-yellow-900/20 dark:to-transparent',
    border: 'border-orange-200/60 dark:border-orange-700/40',
    shadow: 'shadow-orange-500/15 dark:shadow-orange-500/10',
    iconBg: 'bg-orange-100 dark:bg-orange-900/50',
    accent: 'text-orange-600 dark:text-orange-400',
  },
  evening_checkin: {
    icon: '🌇',
    gradient: 'from-indigo-500/10 via-violet-500/5 to-transparent dark:from-indigo-900/30 dark:via-violet-900/20 dark:to-transparent',
    border: 'border-indigo-200/60 dark:border-indigo-700/40',
    shadow: 'shadow-indigo-500/15 dark:shadow-indigo-500/10',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/50',
    accent: 'text-indigo-600 dark:text-indigo-400',
  },
  proactive_care: {
    icon: '💜',
    gradient: 'from-purple-500/10 via-pink-500/5 to-transparent dark:from-purple-900/30 dark:via-pink-900/20 dark:to-transparent',
    border: 'border-purple-200/60 dark:border-purple-700/40',
    shadow: 'shadow-purple-500/15 dark:shadow-purple-500/10',
    iconBg: 'bg-purple-100 dark:bg-purple-900/50',
    accent: 'text-purple-600 dark:text-purple-400',
  },
  growth_nudge: {
    icon: '🌱',
    gradient: 'from-emerald-500/10 via-green-500/5 to-transparent dark:from-emerald-900/30 dark:via-green-900/20 dark:to-transparent',
    border: 'border-emerald-200/60 dark:border-emerald-700/40',
    shadow: 'shadow-emerald-500/15 dark:shadow-emerald-500/10',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
    accent: 'text-emerald-600 dark:text-emerald-400',
  },
};

const DEFAULT_STYLE = {
  icon: '🔔',
  gradient: 'from-neutral-500/10 via-neutral-300/5 to-transparent dark:from-neutral-800/30 dark:via-neutral-700/20 dark:to-transparent',
  border: 'border-neutral-200/60 dark:border-neutral-700/40',
  shadow: 'shadow-neutral-500/10',
  iconBg: 'bg-neutral-100 dark:bg-neutral-800/50',
  accent: 'text-neutral-600 dark:text-neutral-400',
};

/**
 * 组件：NotificationToast (全局通知浮窗)
 * 作用：在页面右上方弹出精美的悬浮通知，通常由 AI 后台的主动关怀、天气预警等触发。
 * 设计：采用玻璃拟态 (Backdrop-blur) 及 渐变边框效果，支持自动标记已读和手动关闭。
 */
export default function NotificationToast({ notifications, onDismiss, onRead }: NotificationToastProps) {
  const [visible, setVisible] = useState<string[]>([]);
  const [exiting, setExiting] = useState<Set<string>>(new Set());

  // 同步逻辑：确保列表始终按顺序渲染当前未读的所有通知
  useEffect(() => {
    const unread = notifications.filter(n => !n.read).map(n => n.id);
    setVisible(prev => {
      const newIds = unread.filter(id => !prev.includes(id));
      return [...prev.filter(id => unread.includes(id)), ...newIds];
    });
  }, [notifications]);

  // 自动化逻辑：展示 8 秒后，若用户无操作，则通过回调将其标记为“已读”，从而触发后续的移除逻辑
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const id of visible) {
      const notif = notifications.find(n => n.id === id);
      if (notif && !notif.read) {
        timers.push(setTimeout(() => onRead(id), 8000));
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [visible, notifications, onRead]);

  /**
   * 手动移除处理
   * 包含一个 300ms 的“淡出”动画缓冲期，然后再执行父组件的移除状态操作。
   */
  const handleDismiss = (id: string) => {
    setExiting(prev => new Set(prev).add(id));
    setTimeout(() => {
      onDismiss(id);
      setVisible(prev => prev.filter(v => v !== id));
      setExiting(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 300);
  };

  if (visible.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[60] space-y-3 max-w-sm w-full pointer-events-none">
      {notifications
        .filter(n => visible.includes(n.id))
        .slice(0, 3) // 同时最多只展示 3 个通知，防止占满视口
        .map(notif => {
          const style = TYPE_STYLES[notif.type] || DEFAULT_STYLE;
          const isExiting = exiting.has(notif.id);

          return (
            <div
              key={notif.id}
              className={`
                pointer-events-auto
                relative overflow-hidden
                bg-white/95 dark:bg-[#1a1730]/95 backdrop-blur-xl
                rounded-2xl shadow-xl ${style.shadow}
                border ${style.border}
                transition-all duration-300 ease-out
                ${isExiting
                  ? 'opacity-0 translate-x-8 scale-95'
                  : 'opacity-100 translate-x-0 scale-100 animate-slide-in'
                }
              `}
            >
              {/* 背景装饰：左侧单边强调条及细微的背景渐变 */}
              <div className={`absolute inset-0 bg-gradient-to-r ${style.gradient} pointer-events-none`} />
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.iconBg}`} />

              <div className="relative p-4 pl-5">
                <div className="flex items-start gap-3">
                  {/* 类型图标 */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${style.iconBg} flex items-center justify-center text-lg shadow-sm`}>
                    {style.icon}
                  </div>

                  {/* 核心内容区：标题使用主题强调色，内容支持多行展示 */}
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-bold ${style.accent}`}>
                      {notif.title}
                    </h4>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed whitespace-pre-line line-clamp-4">
                      {notif.message}
                    </p>
                  </div>

                  {/* 关闭按钮 (Dismiss) */}
                  <button
                    onClick={() => handleDismiss(notif.id)}
                    className="flex-shrink-0 p-1 rounded-lg text-neutral-300 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5 transition-all"
                    aria-label="Dismiss notification"
                    title="Dismiss notification"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* 倒计时进度条 (仅对未读消息显示) */}
                {!notif.read && (
                  <div className="mt-3 h-0.5 bg-neutral-200/50 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full opacity-60`}
                      style={{
                        background: notif.type === 'rain_alert' ? 'linear-gradient(to right, #3b82f6, #06b6d4)'
                          : notif.type === 'proactive_care' ? 'linear-gradient(to right, #a855f7, #ec4899)'
                            : notif.type === 'growth_nudge' ? 'linear-gradient(to right, #10b981, #34d399)'
                              : 'linear-gradient(to right, #6b7280, #9ca3af)',
                        animation: 'shrink-bar 8s linear forwards', // 8 秒倒计时动画
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

      {/* 内联动画声明：负责进度条缩减和入场滑入效果 */}
      <style>{`
        @keyframes shrink-bar {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(100px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
