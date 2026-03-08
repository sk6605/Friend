'use client';

import { usePushNotifications } from '@/app/hooks/usePushNotifications';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function NotificationSettings({ userId }: { userId: string }) {
    const { isSubscribed, subscribe, unsubscribe } = usePushNotifications(userId);
    const [loading, setLoading] = useState(true);
    const [plan, setPlan] = useState<'free' | 'pro' | 'premium'>('free');

    useEffect(() => {
        const fetchPlan = async () => {
            try {
                const res = await fetch(`/api/users/${userId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.subscription?.plan?.name) {
                        setPlan(data.subscription.plan.name);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch user plan", err);
            } finally {
                setLoading(false);
            }
        };
        fetchPlan();
    }, [userId]);

    const handleToggle = async () => {
        if (plan === 'free') return;
        setLoading(true);
        if (isSubscribed) {
            await unsubscribe();
        } else {
            await subscribe();
        }
        setLoading(false);
    };
    const isLocked = plan === 'free';

    return (
        <div className="p-4 bg-white/5 rounded-xl border border-purple-500/20 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
                    <svg className={`w-4 h-4 ${isLocked ? 'text-neutral-400' : 'text-purple-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    Proactive Notifications
                    {isLocked && (
                        <span className="ml-2 inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            PRO
                        </span>
                    )}
                </h3>
                <button
                    title="Toggle notifications"
                    onClick={handleToggle}
                    disabled={loading || isLocked}
                    className={`
                        relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                        ${isSubscribed ? 'bg-purple-600' : 'bg-neutral-200 dark:bg-neutral-700'}
                        ${(loading || isLocked) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
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

            <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                Receive daily "Good morning" messages and schedule reminders even when the app is closed.
            </div>

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
