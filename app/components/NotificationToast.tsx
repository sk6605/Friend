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

export default function NotificationToast({ notifications, onDismiss, onRead }: NotificationToastProps) {
  const [visible, setVisible] = useState<string[]>([]);

  useEffect(() => {
    const unread = notifications.filter(n => !n.read).map(n => n.id);
    setVisible(prev => {
      const newIds = unread.filter(id => !prev.includes(id));
      return [...prev.filter(id => unread.includes(id)), ...newIds];
    });
  }, [notifications]);

  // Auto-mark as read after 5 seconds
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const id of visible) {
      const notif = notifications.find(n => n.id === id);
      if (notif && !notif.read) {
        timers.push(setTimeout(() => onRead(id), 5000));
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [visible, notifications, onRead]);

  if (visible.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[60] space-y-2 max-w-sm">
      {notifications
        .filter(n => visible.includes(n.id))
        .slice(0, 3)
        .map(notif => (
          <div
            key={notif.id}
            className={`
              bg-white/95 dark:bg-[#1e1b2e]/95 backdrop-blur-lg
              rounded-2xl shadow-lg p-4 animate-slide-in
              ${notif.type === 'growth_nudge'
                ? 'border border-emerald-300 dark:border-emerald-700/50 shadow-emerald-500/10'
                : 'border border-purple-200 dark:border-purple-700/50 shadow-purple-500/10'
              }
            `}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">
                {notif.type === 'rain_alert' ? '🌧️' : notif.type === 'growth_nudge' ? '🌱' : '📅'}
              </span>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                  {notif.title}
                </h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2">
                  {notif.message}
                </p>
              </div>
              <button
                onClick={() => {
                  onDismiss(notif.id);
                  setVisible(prev => prev.filter(id => id !== notif.id));
                }}
                className="text-neutral-300 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-400 transition-colors"
                aria-label="Dismiss notification"
                title="Dismiss notification"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}
