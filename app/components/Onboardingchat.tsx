'use client';

import { useState } from 'react';
import Link from 'next/link';

type Step =
  | 'welcome'
  | 'ask_name'
  | 'ask_age'
  | 'ask_email'
  | 'ask_interests'
  | 'ask_ai_name'
  | 'get_ai_name'
  | 'creating'
  | 'done';

const STEPS: Step[] = [
  'welcome',
  'ask_name',
  'ask_age',
  'ask_email',
  'ask_interests',
  'ask_ai_name',
];

const STEP_META: Record<string, { icon: string; title: string; subtitle: string }> = {
  welcome: { icon: '👋', title: 'Welcome!', subtitle: "Let's get you started" },
  ask_name: { icon: '✨', title: "What's your name?", subtitle: "We'd love to know what to call you" },
  ask_age: { icon: '🎂', title: 'How old are you?', subtitle: 'This helps personalise the experience' },
  ask_email: { icon: '📧', title: "What's your email?", subtitle: "You'll use this to sign in" },
  ask_interests: { icon: '🎯', title: 'Your interests', subtitle: 'What are you passionate about?' },
  ask_ai_name: { icon: '🤖', title: 'Name your AI', subtitle: 'Would you like to give me a custom name?' },
  get_ai_name: { icon: '💜', title: 'Choose a name', subtitle: "What would you like to call me?" },
};

/**
 * Component: OnboardingChat
 * A step-by-step guided flow for new user registration.
 *
 * Steps:
 * 1. Welcome & Name.
 * 2. Age (for content safety).
 * 3. Email (existence check).
 * 4. Interests (for AI personalization).
 * 5. AI Name customization.
 *
 * Output: Calls `onFinish(userId)` upon successful creation.
 */
export default function OnboardingChat({
  onFinish,
  onBack,
}: {
  onFinish: (userId?: string) => void;
  onBack?: () => void;
}) {
  const [step, setStep] = useState<Step>('welcome');
  const [data, setData] = useState<Record<string, unknown>>({ language: 'en' });
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);



  const progress = (() => {
    const idx = STEPS.indexOf(step as Step);
    if (step === 'get_ai_name') return 100;
    if (step === 'creating' || step === 'done') return 100;
    if (idx < 0) return 100;
    return Math.round(((idx) / STEPS.length) * 100);
  })();

  const meta = STEP_META[step] || STEP_META.welcome;

  const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const ageGroup = (age: number) => {
    if (age < 13) return 'child';
    if (age < 18) return 'teen';
    return 'adult';
  };

  const createUser = async (d: Record<string, unknown>): Promise<string> => {
    const res = await fetch('/api/onboarding/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create account');
    }
    const responseData = await res.json();
    return responseData.id;
  };

  const finishAccount = async (d: Record<string, unknown>) => {
    if (!agreedToTerms) {
      setError('You must agree to the Privacy Policy and Terms of Service to continue.');
      return;
    }
    setStep('creating');
    try {
      const userId = await createUser(d);
      setStep('done');
      setTimeout(() => onFinish(userId), 1800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      if (msg.includes('already registered')) {
        setStep('done');
        setTimeout(() => onFinish(), 1500);
      } else {
        setError(msg);
        setStep('ask_interests');
      }
    }
  };



  // ─── Main Form Handler ───
  /**
   * handleSubmit()
   * State machine handler for form progression.
   * - Validates input based on `step`.
   * - Calls APIs (check-email, send-otp).
   * - Transitions to next step.
   */
  const handleSubmit = async () => {
    const val = inputValue.trim();
    setError('');
    const d = { ...data };

    switch (step) {
      case 'ask_name':
        if (!val) { setError('Please enter your name'); return; }
        d.username = val;
        d.nickname = val;
        setData(d);
        setInputValue('');
        setStep('ask_age');
        break;

      case 'ask_age': {
        const age = Number(val);
        if (isNaN(age) || age < 1 || age > 150) {
          setError('Please enter a valid age');
          return;
        }
        d.age = age;
        d.ageGroup = ageGroup(age);
        setData(d);
        setInputValue('');
        setStep('ask_email');
        break;
      }

      case 'ask_email':
        if (!isEmail(val)) { setError('Please enter a valid email'); return; }
        setLoading(true);
        try {
          // Check if email already registered
          const checkRes = await fetch('/api/onboarding/check-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: val }),
          });
          const checkResult = await checkRes.json();
          if (checkResult.exists) {
            setError('This email is already registered. Please use a different email.');
            setLoading(false);
            return;
          }
          d.email = val;
          setData(d);
          setInputValue('');
          setStep('ask_interests');
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Could not verify email';
          setError(msg);
        } finally {
          setLoading(false);
        }
        break;

      case 'ask_interests':
        if (!val) { setError('Tell us something you enjoy!'); return; }
        d.interests = val;
        setData(d);
        setInputValue('');
        setStep('ask_ai_name');
        break;

      case 'get_ai_name':
        if (!val) { setError('Please enter a name'); return; }
        d.aiName = val;
        setData(d);
        setInputValue('');
        finishAccount(d);
        break;
    }
  };

  const handleSkipAge = () => {
    const d = { ...data, age: null, ageGroup: 'adult' };
    setData(d);
    setError('');
    setInputValue('');
    setStep('ask_email');
  };

  const handleAiNameYes = () => {
    setError('');
    setInputValue('');
    setStep('get_ai_name');
  };

  const handleAiNameNo = () => {
    const d = { ...data, aiName: 'Lumi' };
    setData(d);
    finishAccount(d);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Loading state
  if (step === 'creating') {
    return (
      <div className="w-full max-w-md flex flex-col items-center justify-center gap-6 py-20">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-[3px] border-purple-200 dark:border-purple-800 border-t-purple-600 dark:border-t-purple-400 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl">✨</span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">Creating your account...</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Setting everything up for you</p>
        </div>
      </div>
    );
  }

  // Done state
  if (step === 'done') {
    return (
      <div className="w-full max-w-md flex flex-col items-center justify-center gap-6 py-20">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">You&apos;re all set!</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Redirecting you to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="
      w-full max-w-md
      bg-white/70 dark:bg-[#1a1726]/80 backdrop-blur-xl
      rounded-3xl
      border border-purple-100/50 dark:border-purple-800/30
      shadow-[0_8px_40px_rgba(124,58,237,0.1)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)]
      overflow-hidden
    ">
      {/* Progress bar */}
      <div className="h-1 bg-purple-100/60 dark:bg-purple-900/30">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-violet-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Card body */}
      <div className="px-8 pt-8 pb-6">
        {/* Back button */}
        {onBack && step === 'welcome' && (
          <button
            onClick={onBack}
            className="mb-4 text-sm text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to login
          </button>
        )}

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-violet-100 dark:from-purple-900/40 dark:to-violet-900/40 flex items-center justify-center shadow-sm">
            <span className="text-3xl">{meta.icon}</span>
          </div>
        </div>

        {/* Title & subtitle */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100">{meta.title}</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{meta.subtitle}</p>
        </div>

        {/* Welcome step */}
        {step === 'welcome' && (
          <div className="space-y-3">
            <p className="text-center text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
              I&apos;m your personal AI companion. Let&apos;s set up your account in just a few quick steps.
            </p>
            <button
              onClick={() => setStep('ask_name')}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold text-sm shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              Get Started
            </button>
          </div>
        )}


        {/* Text input steps */}
        {['ask_name', 'ask_age', 'ask_email', 'ask_interests', 'get_ai_name'].includes(step) && (
          <div className="space-y-3">
            <div>
              <input
                type={step === 'ask_email' ? 'email' : 'text'}
                value={inputValue}
                onChange={e => { setInputValue(e.target.value); setError(''); }}
                onKeyDown={handleKeyDown}
                placeholder={
                  step === 'ask_name' ? 'Enter your name...' :
                    step === 'ask_age' ? 'e.g. 25' :
                      step === 'ask_email' ? 'you@example.com' :
                        step === 'ask_interests' ? 'e.g. music, tech, cooking...' :
                          step === 'get_ai_name' ? 'e.g. Luna, Buddy, Nova...' : ''
                }
                autoFocus
                className="w-full px-4 py-3.5 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-200/80 dark:border-purple-800/30 text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-400 transition-all"
              />
              {error && (
                <p className="mt-2 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </p>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold text-sm shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? 'Checking...' : 'Continue'}
            </button>

            {step === 'ask_age' && (
              <button
                onClick={handleSkipAge}
                className="w-full py-2 text-sm text-neutral-400 dark:text-neutral-500 hover:text-purple-500 dark:hover:text-purple-400 transition-colors"
              >
                Skip this step
              </button>
            )}

            {step === 'get_ai_name' && (
              <button
                onClick={() => { setStep('ask_ai_name'); setInputValue(''); setError(''); }}
                className="w-full py-2 text-sm text-neutral-400 dark:text-neutral-500 hover:text-purple-500 dark:hover:text-purple-400 transition-colors"
              >
                Go back
              </button>
            )}
          </div>
        )}

        {/* AI name decision step — two buttons */}
        {step === 'ask_ai_name' && (
          <div className="space-y-3">
            {/* Privacy & Terms consent */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-200/60 dark:border-purple-800/20 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => { setAgreedToTerms(e.target.checked); setError(''); }}
                className="mt-0.5 w-4 h-4 rounded border-neutral-300 dark:border-purple-700 text-purple-600 focus:ring-purple-500 accent-purple-600"
              />
              <span className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                I have read and agree to the{' '}
                <Link href="/privacy" target="_blank" className="text-purple-500 hover:text-purple-600 underline underline-offset-2">Privacy Policy</Link>
                {' '}and{' '}
                <Link href="/terms" target="_blank" className="text-purple-500 hover:text-purple-600 underline underline-offset-2">Terms of Service</Link>
              </span>
            </label>

            {error && (
              <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </p>
            )}

            <button
              onClick={handleAiNameYes}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold text-sm shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Yes, let me name you!
            </button>
            <button
              onClick={handleAiNameNo}
              className="w-full py-3.5 rounded-xl bg-neutral-100 dark:bg-white/5 border border-neutral-200/80 dark:border-purple-800/30 text-neutral-600 dark:text-neutral-300 font-medium text-sm hover:bg-neutral-150 dark:hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              No, keep &quot;Lumi&quot;
            </button>
          </div>
        )}
      </div>

      {/* Step dots */}
      <div className="flex items-center justify-center gap-1.5 pb-6">
        {STEPS.map((s, i) => {
          const currentIdx = step === 'get_ai_name' ? STEPS.length : STEPS.indexOf(step as Step);
          return (
            <div
              key={s}
              className={`rounded-full transition-all duration-300 ${i === currentIdx
                ? 'w-6 h-2 bg-purple-500'
                : i < currentIdx
                  ? 'w-2 h-2 bg-purple-300 dark:bg-purple-600'
                  : 'w-2 h-2 bg-neutral-200 dark:bg-neutral-700'
                }`}
            />
          );
        })}
      </div>
    </div>
  );
}
