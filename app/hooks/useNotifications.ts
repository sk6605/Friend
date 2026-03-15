'use client';

import { useState, useEffect, useCallback } from 'react';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: string;
  read: boolean;
  dismissed: boolean;
  createdAt: string;
}

export function useNotifications(userId: string | null, pollInterval = 60000) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/notifications/check?userId=${userId}`);
      if (res.ok) {
        const data: AppNotification[] = await res.json();
        setNotifications(data);
      }
    } catch {
      // silently fail
    }
  }, [userId]);

  // Poll on interval
  useEffect(() => {
    if (!userId) return;
    fetchNotifications();
    const timer = setInterval(fetchNotifications, pollInterval);
    return () => clearInterval(timer);
  }, [userId, pollInterval, fetchNotifications]);

  const dismissNotification = useCallback(async (notificationId: string) => {
    try {
      await fetch('/api/notifications/check', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, action: 'dismiss' }),
      });
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch { /* ignore */ }
  }, []);

  const markRead = useCallback(async (notificationId: string) => {
    try {
      await fetch('/api/notifications/check', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, action: 'read' }),
      });
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch { /* ignore */ }
  }, []);

  return { notifications, dismissNotification, markRead, refetch: fetchNotifications };
}
