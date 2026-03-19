'use client';

import { useState, useEffect } from 'react';

interface PlanData {
  id: string;
  name: string;
  displayName: string;
  price: number;
  yearlyPrice: number;
  currency: string;
  description: string;
  features: string[];
  limits: {
    dailyMessageLimit: number;
    maxFileUploads: number;
    maxFileSizeMB: number;
    memoryEnabled: boolean;
    priorityResponse: boolean;
    customAiPersonality: boolean;
    advancedAnalytics: boolean;
  };
}

interface CurrentSub {
  subscribed: boolean;
  plan: string;
  planDisplayName: string;
  status?: string;
  interval?: string;
  currentPeriodEnd?: string;
  paymentProvider?: string;
  stripeCustomerId?: string;
}

const PLAN_ICONS: Record<string, string> = {
  free: '\u{1F31F}',
  pro: '\u{1F680}',
  premium: '\u{1F451}',
};

const PLAN_COLORS: Record<string, { border: string; bg: string; btn: string; badge: string }> = {
  free: {
    border: 'border-slate-700',
    bg: 'bg-slate-900',
    btn: 'bg-slate-700 hover:bg-slate-600',
    badge: 'bg-slate-500/20 text-slate-400',
  },
  pro: {
    border: 'border-purple-500/50',
    bg: 'bg-slate-900',
    btn: 'bg-purple-600 hover:bg-purple-700',
    badge: 'bg-purple-500/20 text-purple-400',
  },
  premium: {
    border: 'border-amber-500/50',
    bg: 'bg-slate-900',
    btn: 'bg-amber-600 hover:bg-amber-700',
    badge: 'bg-amber-500/20 text-amber-400',
  },
};

/**
 * Page: Subscription
 *
 * Logic:
 * 1. Fetches available plans from `/api/subscription/plans`.
 * 2. Fetches user's current status from `/api/subscription/status`.
 * 3. Displays Plan Cards with Monthly/Yearly toggle.
 * 4. Handles Subscribe/Cancel actions via API calls.
 * 5. Shows benefit cards explanation.
 */
export default function SubscriptionPage() {
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [currentSub, setCurrentSub] = useState<CurrentSub | null>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setMessage({ type: 'success', text: 'Subscription activated successfully! \u{1F389}' });
      window.history.replaceState({}, '', '/subscription');
    } else if (params.get('cancelled') === 'true') {
      setMessage({ type: 'error', text: 'Checkout was cancelled. You can try again anytime.' });
      window.history.replaceState({}, '', '/subscription');
    }
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [plansRes, statusRes] = await Promise.all([
        fetch('/api/subscription/plans'),
        userId ? fetch(`/api/subscription/status?userId=${userId}`) : null,
      ]);

      if (plansRes.ok) {
        const data = await plansRes.json();
        setPlans(data.plans);
      }

      if (statusRes?.ok) {
        setCurrentSub(await statusRes.json());
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }

  async function handleSubscribe(planId: string, planName: string) {
    if (!userId) {
      setMessage({ type: 'error', text: 'Please log in first to subscribe.' });
      return;
    }

    // Find the plan to check if it's free
    const plan = plans.find(p => p.id === planId);

    setSubscribing(planId);
    setMessage(null);

    try {
      if (plan && plan.price === 0) {
        // Free plan — use direct subscribe
        const res = await fetch('/api/subscription/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, planId, interval: billingInterval }),
        });
        const data = await res.json();
        if (res.ok) {
          setMessage({ type: 'success', text: `Switched to ${planName}!` });
          await fetchData();
        } else {
          setMessage({ type: 'error', text: data.error || 'Failed' });
        }
      } else {
        // Paid plan — redirect to Stripe Checkout
        const res = await fetch('/api/subscription/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, planId, interval: billingInterval }),
        });
        const data = await res.json();
        if (res.ok && data.url) {
          window.location.assign(data.url);
          return; // Don't clear subscribing state — page is redirecting
        } else {
          setMessage({ type: 'error', text: data.error || 'Checkout failed' });
        }
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    }

    setSubscribing(null);
  }

  async function handleCancel() {
    if (!userId) return;
    setMessage(null);

    try {
      const res = await fetch(`/api/subscription/status?userId=${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Subscription cancelled. You can still use it until the current period ends.' });
        await fetchData();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Cancellation failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    }
  }

  async function handleManageBilling() {
    if (!userId) return;
    try {
      const res = await fetch('/api/subscription/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.assign(data.url);
      } else {
        setMessage({ type: 'error', text: data.error || 'Could not open billing portal' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading plans...</div>
      </div>
    );
  }

  const yearlySavings = (monthly: number, yearly: number) => {
    if (monthly === 0) return 0;
    return Math.round(((monthly * 12 - yearly) / (monthly * 12)) * 100);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-purple-400 text-xl">{'\u{2728}'}</span>
            <h1 className="text-lg font-bold">Choose Your Plan</h1>
          </div>
          <a
            href="/"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm transition-colors border border-slate-700"
          >
            Back to Chat
          </a>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Hero */}
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">
            Unlock the Full Power of <span className="text-purple-400">Lumi</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Choose a plan that fits your needs. Upgrade anytime for a better experience.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <span className={`text-sm ${billingInterval === 'monthly' ? 'text-white font-medium' : 'text-slate-500'}`}>Monthly</span>
          <button
            title="Toggle billing interval"
            onClick={() => setBillingInterval(prev => prev === 'monthly' ? 'yearly' : 'monthly')}
            className="relative w-14 h-7 rounded-full bg-slate-800 border border-slate-700 transition-colors"
          >
            <div className={`absolute top-0.5 w-6 h-6 rounded-full transition-all duration-200 ${billingInterval === 'yearly' ? 'left-7 bg-purple-500' : 'left-0.5 bg-slate-500'
              }`} />
          </button>
          <span className={`text-sm ${billingInterval === 'yearly' ? 'text-white font-medium' : 'text-slate-500'}`}>
            Yearly
            <span className="ml-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">Save up to 17%</span>
          </span>
        </div>

        {/* Current subscription info */}
        {currentSub && currentSub.subscribed && (
          <div className="mb-8 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
            <p className="text-sm text-purple-300">
              You&apos;re currently on the <strong className="text-purple-200">{currentSub.planDisplayName}</strong> plan
              {currentSub.interval && ` (${currentSub.interval})`}
              {currentSub.currentPeriodEnd && ` — renews ${new Date(currentSub.currentPeriodEnd).toLocaleDateString()}`}
            </p>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className={`mb-8 p-4 rounded-xl text-center text-sm ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
            : 'bg-red-500/10 border border-red-500/20 text-red-300'
            }`}>
            {message.text}
          </div>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const colors = PLAN_COLORS[plan.name] || PLAN_COLORS.free;
            const isCurrentPlan = currentSub?.plan === plan.name && currentSub.subscribed;
            const price = billingInterval === 'yearly' ? plan.yearlyPrice : plan.price;
            const savings = yearlySavings(plan.price, plan.yearlyPrice);
            const isPopular = plan.name === 'pro';

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 ${colors.border} ${colors.bg} p-6 flex flex-col ${isPopular ? 'ring-2 ring-purple-500/30' : ''
                  }`}
              >
                {/* Popular badge */}
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-purple-600 text-xs font-bold text-white">
                    MOST POPULAR
                  </div>
                )}

                {/* Plan header */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{PLAN_ICONS[plan.name] || '\u{2B50}'}</span>
                    <h3 className="text-xl font-bold">{plan.displayName}</h3>
                  </div>
                  <p className="text-sm text-slate-400">{plan.description}</p>
                </div>

                {/* Price */}
                <div className="mb-6">
                  {plan.price === 0 ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">Free</span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm text-slate-400">$</span>
                        <span className="text-4xl font-bold">{price.toFixed(2)}</span>
                        <span className="text-sm text-slate-400">/{billingInterval === 'yearly' ? 'year' : 'month'}</span>
                      </div>
                      {billingInterval === 'yearly' && savings > 0 && (
                        <p className="text-xs text-emerald-400 mt-1">Save {savings}% vs monthly</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-emerald-400 mt-0.5">{'\u2713'}</span>
                      <span className="text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                {isCurrentPlan ? (
                  <div className="space-y-2">
                    <button disabled className="w-full py-3 rounded-xl bg-slate-700 text-slate-400 font-medium text-sm cursor-not-allowed">
                      Current Plan
                    </button>
                    {plan.name !== 'free' && currentSub?.stripeCustomerId && (
                      <button
                        onClick={handleManageBilling}
                        className="w-full py-2 rounded-xl text-purple-400 hover:text-purple-300 text-xs transition-colors"
                      >
                        Manage Billing
                      </button>
                    )}
                    {plan.name !== 'free' && !currentSub?.stripeCustomerId && (
                      <button
                        onClick={handleCancel}
                        className="w-full py-2 rounded-xl text-red-400 hover:text-red-300 text-xs transition-colors"
                      >
                        Cancel Subscription
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan.id, plan.displayName)}
                    disabled={subscribing === plan.id}
                    className={`w-full py-3 rounded-xl ${colors.btn} text-white font-medium text-sm transition-colors disabled:opacity-50`}
                  >
                    {subscribing === plan.id
                      ? 'Processing...'
                      : plan.price === 0
                        ? 'Get Started'
                        : `Subscribe to ${plan.displayName}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* FAQ / Benefits */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h3 className="text-2xl font-bold text-center mb-8">Why Subscribe? {'\u{1F914}'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <BenefitCard
              icon={'\u{1F9E0}'}
              title="AI Memory & Recall"
              description="Your AI remembers your interests, life events, and past conversations — every chat feels personal."
            />
            <BenefitCard
              icon={'\u{1F3AF}'}
              title="Personalized Challenges"
              description="AI-generated daily challenges tailored to your interests, mood, and goals — not generic tasks."
            />
            <BenefitCard
              icon={'\u{1F4CA}'}
              title="Emotional Growth Insights"
              description="Track mood trends, triggers, thinking patterns, and emotional intensity across 3-day to monthly views."
            />
            <BenefitCard
              icon={'\u{1F3AD}'}
              title="AI Personality Styles"
              description="Choose from 5 AI personalities — Gentle Soul, Witty Buddy, Wise Mentor, Chill Companion, or balanced default."
            />
            <BenefitCard
              icon={'\u{1F49C}'}
              title="Proactive Care"
              description="AI checks in on you when it senses you might need support — like a friend who notices when you're down."
            />
            <BenefitCard
              icon={'\u{1F4CE}'}
              title="File & Document Analysis"
              description="Upload PDFs, documents, and images for AI-powered analysis with key insights and suggestions."
            />
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-12 text-center text-xs text-slate-600">
          <p>Cancel anytime. Your subscription remains active until the end of the billing period.</p>
          <p className="mt-1">Payments securely processed by Stripe.</p>
        </div>
      </div>
    </div>
  );
}

function BenefitCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <h4 className="font-semibold text-white">{title}</h4>
      </div>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}
