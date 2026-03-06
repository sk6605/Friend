'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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
  const [permissionGranted, setPermissionGranted] = useState(false);
  const shownBrowserNotifs = useRef<Set<string>>(new Set());

  // Request browser notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        setPermissionGranted(true);
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(perm => {
          setPermissionGranted(perm === 'granted');
        });
      }
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/notifications/check?userId=${userId}`);
      if (res.ok) {
        const data: AppNotification[] = await res.json();
        setNotifications(data);

        // Show browser notifications for new unread items
        if (permissionGranted) {
          for (const notif of data) {
            if (!notif.read && !shownBrowserNotifs.current.has(notif.id)) {
              shownBrowserNotifs.current.add(notif.id);
              new Notification(notif.title, {
                body: notif.message,
                icon: '/favicon.ico',
                tag: notif.id,
              });
            }
          }
        }
      }
    } catch {
      // silently fail
    }
  }, [userId, permissionGranted]);

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
