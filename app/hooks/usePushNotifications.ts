import { useState, useEffect } from 'react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function usePushNotifications(userId: string) {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && userId) {
            // Register SW
            navigator.serviceWorker.register('/sw.js')
                .then(reg => {
                    setRegistration(reg);
                    reg.pushManager.getSubscription().then(sub => {
                        if (sub) {
                            setSubscription(sub);
                            setIsSubscribed(true);
                            // Optimistically update DB in case it's out of sync?
                            // Or just assume it's fine.
                        }
                    });
                })
                .catch(err => console.error('SW registration failed:', err));
        }
    }, [userId]);

    const subscribe = async () => {
        if (!registration || !VAPID_PUBLIC_KEY) {
            console.error("No SW registration or VAPID key");
            return;
        }

        try {
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });

            setSubscription(sub);
            setIsSubscribed(true);

            // Send to backend
            await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, subscription: sub }),
            });

            console.log('Subscribed successfully');
        } catch (error) {
            console.error('Failed to subscribe:', error);
        }
    };

    const unsubscribe = async () => {
        if (!subscription) return;
        try {
            await subscription.unsubscribe();
            setSubscription(null);
            setIsSubscribed(false);

            // Notify backend (optional, but good practice)
            // await fetch('/api/notifications/unsubscribe', ...)
        } catch (err) {
            console.error("Error unsubscribing", err);
        }
    };

    return { isSubscribed, subscribe, unsubscribe };
}
