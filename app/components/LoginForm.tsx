'use client';

import { useState } from 'react';

interface LoginFormProps {
  onOtpSent: (email: string, devOtp?: string) => void;
  onRegister?: () => void;
  onTry?: () => void;
}

export default function LoginForm({ onOtpSent, onRegister, onTry }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      onOtpSent(email, data.devOtp);
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = `
    w-full px-4 py-3 rounded-xl text-sm
    bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-neutral-600
    text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500
    outline-none
    focus:border-purple-400 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-900/30
    transition-all
  `;

  return (
    <div className="w-full max-w-md">
      <div
        className="
          bg-white/80 dark:bg-[#1e1b2e]/90 backdrop-blur-xl
          rounded-3xl
          border border-neutral-200 dark:border-purple-800/30
          shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)]
          p-10
        "
      >
        <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">Welcome back</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8">
          Enter your email to receive a login code
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className={inputClass}
            />
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="
              w-full py-4 rounded-2xl text-sm font-semibold
              text-white
              transition-all duration-200
              hover:shadow-lg hover:scale-[1.02]
              active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
            "
            style={{ backgroundColor: '#7C3AED' }}
          >
            {loading ? 'Sending code...' : 'Continue'}
          </button>
        </form>

        {onTry && (
          <div className="mt-5">
            <div className="relative flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
              <span className="text-xs text-neutral-400 whitespace-nowrap">或者</span>
              <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
            </div>
            <button
              type="button"
              onClick={onTry}
              className="
                w-full py-3.5 rounded-2xl text-sm font-semibold
                border-2 border-purple-200 dark:border-purple-700/50
                text-purple-600 dark:text-purple-400
                hover:bg-purple-50 dark:hover:bg-purple-900/20
                hover:border-purple-400 dark:hover:border-purple-500
                active:scale-[0.98]
                transition-all duration-200
                flex items-center justify-center gap-2
              "
            >
              <span>✨</span>
              先体验一下，再决定
            </button>
          </div>
        )}

        {onRegister && (
          <div className="mt-6 text-center">
            <span className="text-sm text-neutral-400">Don&apos;t have an account? </span>
            <button
              type="button"
              onClick={onRegister}
              className="text-sm text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium transition-colors"
            >
              Register
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
