import { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    OneSignal: any;
    OneSignalDeferred: any[];
    _oneSignalReady: boolean;
  }
}

function waitForOneSignal(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') { reject('SSR'); return; }
    if (window._oneSignalReady && window.OneSignal) {
      resolve(window.OneSignal);
      return;
    }
    const timeout = setTimeout(() => reject('OneSignal timeout'), 10000);
    window.addEventListener('onesignal-ready', () => {
      clearTimeout(timeout);
      resolve(window.OneSignal);
    }, { once: true });
  });
}

export function usePushNotifications(userId: string) {
  const [isSubscribed, setIsSubscribed] = useState(false);

  const subscribe = useCallback(async () => {
    if (!userId) return;
    try {
      const os = await waitForOneSignal();
      await os.login(userId);
      const granted = await os.Notifications.requestPermission();
      if (granted) {
        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        setIsSubscribed(true);
      }
    } catch (err) {
      console.error('Subscribe failed:', err);
    }
  }, [userId]);

  const unsubscribe = useCallback(async () => {
    try {
      const os = await waitForOneSignal();
      await os.User.PushSubscription.optOut();
      setIsSubscribed(false);
      await fetch('/api/notifications/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
    } catch (err) {
      console.error('Unsubscribe failed:', err);
    }
  }, [userId]);

  // Auto-subscribe eligible users on mount
  useEffect(() => {
    if (!userId) return;

    const autoSubscribe = async () => {
      try {
        const os = await waitForOneSignal();
        await os.login(userId);

        // Check if already opted in
        const optedIn = !!os.User?.PushSubscription?.optedIn;
        if (optedIn) {
          setIsSubscribed(true);
          return;
        }

        // Check if user has a pro/premium plan (eligible for push)
        const res = await fetch(`/api/notifications/subscribe/check?userId=${userId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.eligible) return;

        // Auto-request permission and subscribe
        const granted = await os.Notifications.requestPermission();
        if (granted) {
          await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });
          setIsSubscribed(true);
        }
      } catch {
        // silently fail — OneSignal may not load in all environments
      }
    };

    autoSubscribe();
  }, [userId]);

  return { isSubscribed, subscribe, unsubscribe };
}

