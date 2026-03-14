'use client';

import { useEffect, useState } from 'react';

/**
 * Offline Page
 * Rendered via Next.js when a navigation occurs while offline.
 * Also served from service worker cache when network is unavailable.
 */
export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // Auto-redirect when back online
  useEffect(() => {
    if (isOnline) {
      const timer = setTimeout(() => {
        window.location.href = '/';
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  const handleRetry = () => {
    setChecking(true);
    setTimeout(() => {
      if (navigator.onLine) {
        window.location.href = '/';
      } else {
        setChecking(false);
      }
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 relative overflow-hidden bg-gradient-to-br from-[#faf8f4] via-[#f5f0e8] to-[#f0ebe0] dark:from-[#0c0a13] dark:via-[#110e1a] dark:to-[#0f0c18]">
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-purple-200/25 dark:bg-purple-700/10 rounded-full blur-3xl animate-[pulse_5s_ease-in-out_infinite]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-200/20 dark:bg-blue-700/8 rounded-full blur-3xl animate-[pulse_7s_ease-in-out_infinite_1s]" />
      </div>

      <div className="relative z-10 text-center max-w-md">
        {/* Animated cloud icon */}
        <div className="relative mb-8 inline-block">
          <div className="w-28 h-28 mx-auto rounded-3xl bg-gradient-to-br from-purple-100 to-pink-50 dark:from-purple-900/40 dark:to-pink-900/20 border border-purple-200/60 dark:border-purple-700/30 flex items-center justify-center shadow-xl shadow-purple-200/30 dark:shadow-purple-900/20">
            {/* Cloud with X */}
            <svg className="w-14 h-14 text-purple-400 dark:text-purple-300" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2}
                d="M18.364 5.636a1 1 0 010 1.414L14.414 11l3.95 3.95a1 1 0 11-1.414 1.414L13 12.414l-3.95 3.95a1 1 0 01-1.414-1.414L11.586 11 7.636 7.05a1 1 0 011.414-1.414L13 9.586l3.95-3.95a1 1 0 011.414 0z"
              />
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} strokeOpacity={0.4}
                d="M6.5 19a4.5 4.5 0 01-.42-8.98A7 7 0 0119.5 12h.5a3 3 0 010 6H6.5z"
              />
            </svg>
          </div>
          {/* Pulsating ring */}
          <div className="absolute inset-0 w-28 h-28 mx-auto rounded-3xl border-2 border-purple-300/40 dark:border-purple-500/20 animate-ping opacity-30" style={{ animationDuration: '3s' }} />
        </div>

        {/* Status indicator */}
        {isOnline ? (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Back online — redirecting...</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 mb-6">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-xs font-medium text-red-500 dark:text-red-400">No connection</span>
          </div>
        )}

        {/* Copy */}
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-800 dark:text-white mb-3">
          You&apos;re Offline
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-base leading-relaxed mb-2">
          It seems your internet connection is taking a break.
        </p>
        <p className="text-neutral-400 dark:text-neutral-500 text-sm mb-10">
          Check your Wi-Fi or mobile data and try again.
        </p>

        {/* Retry button */}
        <button
          onClick={handleRetry}
          disabled={checking || isOnline}
          className="
            group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl
            bg-gradient-to-r from-purple-600 to-pink-500
            hover:from-purple-500 hover:to-pink-400
            text-white font-semibold text-sm
            shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30
            transition-all duration-300 active:scale-[0.97]
            disabled:opacity-60 disabled:cursor-not-allowed
          "
        >
          {checking ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Checking...
            </>
          ) : isOnline ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Connected!
            </>
          ) : (
            <>
              <svg className="w-4 h-4 transition-transform group-hover:rotate-180 duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Try Again
            </>
          )}
        </button>

        {/* Tips */}
        <div className="mt-12 p-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-purple-100/40 dark:border-purple-800/20 backdrop-blur-sm">
          <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-2">Quick fixes</p>
          <ul className="text-xs text-neutral-400 dark:text-neutral-500 space-y-1.5 text-left">
            <li className="flex items-start gap-2">
              <span className="mt-0.5">📶</span>
              <span>Toggle your Wi-Fi or mobile data off and on</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">🔄</span>
              <span>Restart your browser or device</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">📡</span>
              <span>Move closer to your router</span>
            </li>
          </ul>
        </div>

        {/* Footer */}
        <p className="mt-10 text-xs text-neutral-300 dark:text-neutral-600">
          Lumi will reconnect automatically when you&apos;re back online ✨
        </p>
      </div>
    </div>
  );
}
