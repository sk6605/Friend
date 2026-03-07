import { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    OneSignal: any;
    OneSignalDeferred: any[];
    _oneSignalReady: boolean;
  }
}

function waitForOneSignal(): Promise<any> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return;
    if (window._oneSignalReady && window.OneSignal) {
      resolve(window.OneSignal);
      return;
    }
    window.addEventListener('onesignal-ready', () => resolve(window.OneSignal), { once: true });
  });
}

export function usePushNotifications(userId: string) {
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    waitForOneSignal().then(async (os) => {
      await os.login(userId);
      setIsSubscribed(!!os.User.PushSubscription.optedIn);
    }).catch(() => {});
  }, [userId]);

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

  return { isSubscribed, subscribe, unsubscribe };
}
