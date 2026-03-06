'use client';

import { usePushNotifications } from '@/app/hooks/usePushNotifications';
import { useState } from 'react';

export default function NotificationSettings({ userId }: { userId: string }) {
    const { isSubscribed, subscribe, unsubscribe } = usePushNotifications(userId);
    const [loading, setLoading] = useState(false);
    const [testSent, setTestSent] = useState(false);

    const handleToggle = async () => {
        setLoading(true);
        if (isSubscribed) {
            await unsubscribe();
        } else {
            await subscribe();
        }
        setLoading(false);
    };

    const sendTest = async () => {
        setLoading(true);
        try {
            await fetch('/api/notifications/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            setTestSent(true);
            setTimeout(() => setTestSent(false), 3000);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 bg-white/5 rounded-xl border border-purple-500/20">
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Proactive Notifications
            </h3>

            <div className="flex items-center justify-between">
                <div className="text-xs text-neutral-500 dark:text-neutral-400 max-w-[70%]">
                    Receive daily &quot;Good morning&quot; messages and schedule reminders even when the app is closed.
                </div>

                <button
                    title="Toggle notifications"
                    onClick={handleToggle}
                    disabled={loading}
                    className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            ${isSubscribed ? 'bg-purple-600' : 'bg-neutral-200 dark:bg-neutral-700'}
            ${loading ? 'opacity-50 cursor-not-allowed' : ''}
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

            {isSubscribed && (
                <div className="mt-4 pt-4 border-t border-white/10">
                    <button
                        onClick={sendTest}
                        disabled={loading}
                        className="text-xs text-purple-400 hover:text-purple-300 underline"
                    >
                        {testSent ? "Test Sent! Check notifications." : "Send Test Notification"}
                    </button>
                </div>
            )}
        </div>
    );
}
