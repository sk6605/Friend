'use client';

import { useEffect, useState } from 'react';

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

const TYPE_STYLES: Record<string, {
  icon: string;
  gradient: string;
  border: string;
  shadow: string;
  iconBg: string;
  accent: string;
}> = {
  rain_alert: {
    icon: '🌧️',
    gradient: 'from-blue-500/10 via-cyan-500/5 to-transparent dark:from-blue-900/30 dark:via-cyan-900/20 dark:to-transparent',
    border: 'border-blue-200/60 dark:border-blue-700/40',
    shadow: 'shadow-blue-500/15 dark:shadow-blue-500/10',
    iconBg: 'bg-blue-100 dark:bg-blue-900/50',
    accent: 'text-blue-600 dark:text-blue-400',
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

export default function NotificationToast({ notifications, onDismiss, onRead }: NotificationToastProps) {
  const [visible, setVisible] = useState<string[]>([]);
  const [exiting, setExiting] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unread = notifications.filter(n => !n.read).map(n => n.id);
    setVisible(prev => {
      const newIds = unread.filter(id => !prev.includes(id));
      return [...prev.filter(id => unread.includes(id)), ...newIds];
    });
  }, [notifications]);

  // Auto-mark as read after 8 seconds
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
        .slice(0, 3)
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
              {/* Gradient accent bar */}
              <div className={`absolute inset-0 bg-gradient-to-r ${style.gradient} pointer-events-none`} />
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.iconBg}`} />

              <div className="relative p-4 pl-5">
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${style.iconBg} flex items-center justify-center text-lg shadow-sm`}>
                    {style.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-bold ${style.accent}`}>
                      {notif.title}
                    </h4>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed whitespace-pre-line line-clamp-4">
                      {notif.message}
                    </p>
                  </div>

                  {/* Dismiss */}
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

                {/* Progress bar (auto-dismiss timer) */}
                {!notif.read && (
                  <div className="mt-3 h-0.5 bg-neutral-200/50 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full opacity-60`}
                      style={{
                        background: notif.type === 'rain_alert' ? 'linear-gradient(to right, #3b82f6, #06b6d4)'
                          : notif.type === 'proactive_care' ? 'linear-gradient(to right, #a855f7, #ec4899)'
                            : notif.type === 'growth_nudge' ? 'linear-gradient(to right, #10b981, #34d399)'
                              : 'linear-gradient(to right, #6b7280, #9ca3af)',
                        animation: 'shrink-bar 8s linear forwards',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

      {/* CSS animation for progress bar */}
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
