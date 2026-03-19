# Stripe Payment Gateway & Cron Reminder Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Stripe Checkout (sandbox) for subscription payments and enhance daily cron to generate 4 AI-powered personalized notifications (morning weather, lunch, evening, 9 PM tomorrow forecast).

**Architecture:** Stripe Checkout hosted pages handle payment collection; webhooks sync subscription state to DB. A single daily cron at 7 AM MYT generates all 4 scheduled notifications per user using GPT-4o-mini, with `scheduledFor` timestamps for timed delivery.

**Tech Stack:** Next.js 16 App Router, Stripe Node SDK, Prisma (MySQL), OpenAI GPT-4o-mini, OpenWeatherMap API, OneSignal push

---

## File Structure

### New Files
| File | Responsibility |
|------|----------------|
| `app/lib/stripe.ts` | Stripe client singleton |
| `app/api/subscription/checkout/route.ts` | Create Stripe Checkout Session |
| `app/api/subscription/webhook/route.ts` | Handle Stripe webhook events |
| `app/api/subscription/portal/route.ts` | Create Stripe Customer Portal session |

### Modified Files
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add `stripeCustomerId` to User, `stripePriceMonthly`/`stripePriceYearly` to Plan, index on Subscription.externalId |
| `app/subscription/page.tsx` | Stripe Checkout redirect, Manage Billing button, success/cancelled handling |
| `app/api/subscription/status/route.ts` | Block direct DELETE for paid Stripe plans |
| `app/lib/weather.ts` | Export `ForecastEntry`, add `detectRainTomorrow()` (includes summary in return value — no separate `getTomorrowForecastSummary()` needed) |
| `app/lib/cron/runDailyMorningAlert.ts` | Rewrite: 4 AI notifications, enhanced weather data, deduplication. Note: `departureTime`-based scheduling is intentionally removed — cron now runs once at 7 AM and generates fixed-time notifications |

---

## Task 1: Install Stripe SDK & Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma:11-64` (User model), `prisma/schema.prisma:256-281` (Plan model), `prisma/schema.prisma:283-309` (Subscription model)
- Modify: `package.json`

- [ ] **Step 1: Install stripe package**

```bash
npm install stripe
```

- [ ] **Step 2: Add `stripeCustomerId` to User model**

In `prisma/schema.prisma`, add after `pushSubscription` field (line 27):

```prisma
  stripeCustomerId String?  // Stripe Customer ID
```

- [ ] **Step 3: Add Stripe price fields to Plan model**

In `prisma/schema.prisma`, add after `advancedAnalytics` field (line 271):

```prisma
  stripePriceMonthly String?  // Stripe Price ID for monthly billing
  stripePriceYearly  String?  // Stripe Price ID for yearly billing
```

- [ ] **Step 4: Add index on Subscription.externalId**

In `prisma/schema.prisma`, add after the existing `@@index([status])` (line 308):

```prisma
  @@index([externalId])
```

- [ ] **Step 5: Push schema changes**

```bash
npx prisma db push
npx prisma generate
```

Expected: Schema changes applied, Prisma client regenerated.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma package.json package-lock.json
git commit -m "feat: add Stripe fields to schema and install stripe SDK"
```

---

## Task 2: Create Stripe Client Singleton

**Files:**
- Create: `app/lib/stripe.ts`

- [ ] **Step 1: Create the Stripe client file**

```typescript
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
```

Note: Omitting `apiVersion` uses the SDK's built-in default, which is always compatible with the installed version.

- [ ] **Step 2: Commit**

```bash
git add app/lib/stripe.ts
git commit -m "feat: add Stripe client singleton"
```

---

## Task 3: Create Checkout Session API Route

**Files:**
- Create: `app/api/subscription/checkout/route.ts`

- [ ] **Step 1: Create the checkout route**

```typescript
import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/db';
import { stripe } from '@/app/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const { userId, planId, interval = 'monthly' } = await req.json();

    if (!userId || !planId) {
      return Response.json({ error: 'userId and planId are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      return Response.json({ error: 'Invalid or inactive plan' }, { status: 400 });
    }

    if (plan.name === 'free') {
      return Response.json({ error: 'Free plan does not require payment' }, { status: 400 });
    }

    const stripePriceId = interval === 'yearly' ? plan.stripePriceYearly : plan.stripePriceMonthly;
    if (!stripePriceId) {
      return Response.json({ error: 'Stripe price not configured for this plan' }, { status: 400 });
    }

    // Get or create Stripe Customer
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.nickname || user.username,
        metadata: { userId: user.id },
      });
      stripeCustomerId = customer.id;
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId },
      });
    }

    // Create Checkout Session
    const origin = req.headers.get('origin') || req.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: `${origin}/subscription?success=true`,
      cancel_url: `${origin}/subscription?cancelled=true`,
      metadata: { userId, planId, interval },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: `Checkout failed: ${msg}` }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/subscription/checkout/route.ts
git commit -m "feat: add Stripe Checkout session API route"
```

---

## Task 4: Create Webhook API Route

**Files:**
- Create: `app/api/subscription/webhook/route.ts`

- [ ] **Step 1: Create the webhook route**

```typescript
import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/db';
import { stripe } from '@/app/lib/stripe';
import Stripe from 'stripe';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { userId, planId, interval } = session.metadata || {};
        if (!userId || !planId) break;

        const stripeSubscriptionId = session.subscription as string;

        // Fetch the Stripe subscription to get period dates
        const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);

        await prisma.subscription.upsert({
          where: { userId },
          update: {
            planId,
            interval: interval || 'monthly',
            status: 'active',
            paymentProvider: 'stripe',
            externalId: stripeSubscriptionId,
            currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
            cancelledAt: null,
          },
          create: {
            userId,
            planId,
            interval: interval || 'monthly',
            status: 'active',
            paymentProvider: 'stripe',
            externalId: stripeSubscriptionId,
            currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          },
        });
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) break;

        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);

        await prisma.subscription.updateMany({
          where: { externalId: subscriptionId },
          data: {
            status: 'active',
            currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          },
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) break;

        await prisma.subscription.updateMany({
          where: { externalId: subscriptionId },
          data: { status: 'past_due' },
        });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const newPriceId = subscription.items.data[0]?.price?.id;
        if (!newPriceId) break;

        // Reverse-lookup plan by Stripe price ID
        const plan = await prisma.plan.findFirst({
          where: {
            OR: [
              { stripePriceMonthly: newPriceId },
              { stripePriceYearly: newPriceId },
            ],
          },
        });

        const statusMap: Record<string, string> = {
          active: 'active',
          past_due: 'past_due',
          canceled: 'cancelled',
          unpaid: 'past_due',
        };
        const updateData: Record<string, unknown> = {
          status: statusMap[subscription.status] || 'active',
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        };

        if (plan) {
          updateData.planId = plan.id;
          updateData.interval = plan.stripePriceYearly === newPriceId ? 'yearly' : 'monthly';
        }

        await prisma.subscription.updateMany({
          where: { externalId: subscription.id },
          data: updateData,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        await prisma.subscription.updateMany({
          where: { externalId: subscription.id },
          data: {
            status: 'cancelled',
            cancelledAt: new Date(),
          },
        });
        break;
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return Response.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/subscription/webhook/route.ts
git commit -m "feat: add Stripe webhook handler for subscription lifecycle"
```

---

## Task 5: Create Customer Portal API Route

**Files:**
- Create: `app/api/subscription/portal/route.ts`

- [ ] **Step 1: Create the portal route**

```typescript
import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/db';
import { stripe } from '@/app/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.stripeCustomerId) {
      return Response.json({ error: 'No Stripe customer found' }, { status: 400 });
    }

    const origin = req.headers.get('origin') || req.nextUrl.origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${origin}/subscription`,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Portal error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: `Portal creation failed: ${msg}` }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/subscription/portal/route.ts
git commit -m "feat: add Stripe Customer Portal API route"
```

---

## Task 6: Update Subscription Status Route (Block Direct Cancel for Stripe)

**Files:**
- Modify: `app/api/subscription/status/route.ts:81-111`

- [ ] **Step 1: Update DELETE handler to block Stripe cancellations**

Replace the entire DELETE function with:

```typescript
export async function DELETE(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return Response.json({ error: 'No active subscription found' }, { status: 404 });
    }

    // Stripe-managed subscriptions must be cancelled via Customer Portal
    if (subscription.paymentProvider === 'stripe' && subscription.externalId) {
      return Response.json({
        error: 'Please use the Manage Billing portal to cancel your Stripe subscription',
      }, { status: 400 });
    }

    await prisma.subscription.update({
      where: { userId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
      },
    });

    return Response.json({ ok: true, message: 'Subscription cancelled' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: `Cancellation failed: ${msg}` }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/subscription/status/route.ts
git commit -m "feat: block direct cancel for Stripe-managed subscriptions"
```

---

## Task 7: Update Subscription Page for Stripe Checkout

**Files:**
- Modify: `app/subscription/page.tsx`

- [ ] **Step 1: Add `stripeCustomerId` to the CurrentSub interface**

After line 31 (`currentPeriodEnd?: string;`), add:

```typescript
  paymentProvider?: string;
  stripeCustomerId?: string;
```

- [ ] **Step 2: Update `handleSubscribe` to use Stripe Checkout for paid plans**

Replace the `handleSubscribe` function (lines 107-135) with:

```typescript
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
          window.location.href = data.url;
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
```

- [ ] **Step 3: Add `handleManageBilling` function**

Add after the `handleCancel` function (after line 153):

```typescript
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
        window.location.href = data.url;
      } else {
        setMessage({ type: 'error', text: data.error || 'Could not open billing portal' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    }
  }
```

- [ ] **Step 4: Handle success/cancelled query params**

Add to the `useEffect` (after line 83, inside the existing useEffect or as a new one):

```typescript
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
```

- [ ] **Step 5: Update CTA buttons to show "Manage Billing" for Stripe subscribers**

Replace the CTA button section (lines 296-323) — the `{isCurrentPlan ? ... : ...}` block inside the plan card — with:

```tsx
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
```

- [ ] **Step 6: Update footer note**

Replace the footer note (lines 366-369):

```tsx
        <div className="mt-12 text-center text-xs text-slate-600">
          <p>Cancel anytime. Your subscription remains active until the end of the billing period.</p>
          <p className="mt-1">Payments securely processed by Stripe.</p>
        </div>
```

- [ ] **Step 7: Update the subscription status API to return stripeCustomerId**

In `app/api/subscription/status/route.ts`, in the GET handler's response (line 51-69), add `stripeCustomerId` by first fetching the user. Add before the return statement:

```typescript
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });
```

Then add to the response object (after `cancelledAt`):

```typescript
      stripeCustomerId: user?.stripeCustomerId || null,
      paymentProvider: subscription.paymentProvider,
```

Also update the non-subscribed response to include:

```typescript
        stripeCustomerId: null,
        paymentProvider: null,
```

- [ ] **Step 8: Commit**

```bash
git add app/subscription/page.tsx app/api/subscription/status/route.ts
git commit -m "feat: integrate Stripe Checkout into subscription page"
```

---

## Task 8: Add `detectRainTomorrow()` and `getTomorrowForecastSummary()` to Weather Utils

**Files:**
- Modify: `app/lib/weather.ts`

- [ ] **Step 1: Add the `TomorrowForecast` interface and `detectRainTomorrow` function**

First, export the existing `ForecastEntry` interface. Change line 151 of `app/lib/weather.ts` from `interface ForecastEntry` to `export interface ForecastEntry`.

Then add at the end of `app/lib/weather.ts`:

```typescript
export interface TomorrowForecast {
  willRain: boolean;
  rainPeriods: { time: string; description: string; probability: number }[];
  tempMin: number;
  tempMax: number;
  humidity: number;
  summary: string;
}

export function detectRainTomorrow(forecast: ForecastEntry[], timezoneOffset = 0): TomorrowForecast {
  const nowMs = Date.now() + timezoneOffset * 1000;
  const localDate = new Date(nowMs);
  // Get tomorrow's date string
  localDate.setUTCDate(localDate.getUTCDate() + 1);
  const tomorrowStr = localDate.toISOString().slice(0, 10);

  const tomorrowEntries = forecast.filter(entry => {
    const entryLocalMs = entry.dt * 1000 + timezoneOffset * 1000;
    const entryLocalDate = new Date(entryLocalMs);
    return entryLocalDate.toISOString().slice(0, 10) === tomorrowStr;
  });

  if (tomorrowEntries.length === 0) {
    return { willRain: false, rainPeriods: [], tempMin: 0, tempMax: 0, humidity: 0, summary: 'No forecast data available' };
  }

  const temps = tomorrowEntries.map(e => e.main.temp);
  const humidities = tomorrowEntries.map(e => e.main.humidity);
  const tempMin = Math.round(Math.min(...temps));
  const tempMax = Math.round(Math.max(...temps));
  const avgHumidity = Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length);

  const rainPeriods = tomorrowEntries
    .filter(entry => {
      const weatherMain = entry.weather[0]?.main?.toLowerCase() || '';
      return (
        weatherMain === 'rain' ||
        weatherMain === 'drizzle' ||
        weatherMain === 'thunderstorm' ||
        entry.pop > 0.5
      );
    })
    .map(entry => {
      const entryLocalMs = entry.dt * 1000 + timezoneOffset * 1000;
      const entryLocalDate = new Date(entryLocalMs);
      const hours = entryLocalDate.getUTCHours().toString().padStart(2, '0');
      const minutes = entryLocalDate.getUTCMinutes().toString().padStart(2, '0');
      return {
        time: `${hours}:${minutes}`,
        description: entry.weather[0]?.description || 'rain',
        probability: Math.round(entry.pop * 100),
      };
    });

  // Build summary
  const mainConditions = tomorrowEntries.map(e => e.weather[0]?.main || '').filter(Boolean);
  const conditionCounts: Record<string, number> = {};
  mainConditions.forEach(c => { conditionCounts[c] = (conditionCounts[c] || 0) + 1; });
  const dominantCondition = Object.entries(conditionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Clear';

  const summary = `${dominantCondition}, ${tempMin}-${tempMax}°C, humidity ${avgHumidity}%${rainPeriods.length > 0 ? `, rain at ${rainPeriods.map(r => r.time).join(', ')}` : ''}`;

  return {
    willRain: rainPeriods.length > 0,
    rainPeriods,
    tempMin,
    tempMax,
    humidity: avgHumidity,
    summary,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/weather.ts
git commit -m "feat: add detectRainTomorrow() for tomorrow weather forecasting"
```

---

## Task 9: Rewrite Morning Alert Cron to Generate 4 AI Notifications

**Files:**
- Modify: `app/lib/cron/runDailyMorningAlert.ts` (full rewrite)

- [ ] **Step 1: Rewrite `runDailyMorningAlert.ts`**

Replace the entire file content with:

```typescript
import { prisma } from '@/app/lib/db';
import { fetchWeather, fetchForecast, detectRainToday, detectRainTomorrow } from '@/app/lib/weather';
import { sendPushNotification } from '@/app/lib/onesignal';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─── AI Message Generators ──────────────────────────────────────

function getLangName(lang: string): string {
  const map: Record<string, string> = {
    zh: 'Simplified Chinese', es: 'Spanish', ja: 'Japanese',
    ko: 'Korean', ms: 'Malay', en: 'English',
  };
  return map[lang] || 'English';
}

async function generateMorningMessage(
  city: string,
  temp: number,
  humidity: number,
  isRainy: boolean,
  rainPeriods: string,
  language: string,
  nickname: string
): Promise<string> {
  const langName = getLangName(language);
  const weatherDetail = `Current temperature: ${temp}°C, humidity: ${humidity}%.`;
  const rainDetail = isRainy
    ? `Today's forecast shows rain at: ${rainPeriods}. You MUST mention the specific time(s) and remind them to bring an umbrella.`
    : 'No rain expected today. It will be mostly sunny or cloudy. Suggest sunscreen or staying hydrated.';

  const prompt = `You are ${nickname}'s warm, caring best friend. ${nickname} lives in ${city}.
${weatherDetail}
${rainDetail}
Write a short, heartfelt morning push notification (max 100 chars).
Include the temperature and humidity naturally in your message.
${isRainy ? 'MUST include specific rain times.' : ''}
Tone: deeply loved, warm, personal — like a message from someone who truly cares.
Respond ONLY in ${langName}. No quotes, no extra text.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.8,
      max_tokens: 150,
    });
    return completion.choices[0].message?.content?.trim() || getMorningFallback(nickname, city, temp, humidity, isRainy, language);
  } catch {
    return getMorningFallback(nickname, city, temp, humidity, isRainy, language);
  }
}

function getMorningFallback(nickname: string, city: string, temp: number, humidity: number, isRainy: boolean, lang: string): string {
  if (lang === 'zh') {
    return isRainy
      ? `早安 ${nickname}💕 ${city}今天${temp}°C，湿度${humidity}%，会下雨，记得带伞哦~`
      : `早安 ${nickname}☀️ ${city}今天${temp}°C，湿度${humidity}%，天气不错，记得防晒！`;
  }
  return isRainy
    ? `Good morning ${nickname}💕 ${city} is ${temp}°C, ${humidity}% humidity today. Rain expected — grab your umbrella!`
    : `Good morning ${nickname}☀️ ${city} is ${temp}°C, ${humidity}% humidity. Beautiful day — stay hydrated!`;
}

async function generateLunchMessage(nickname: string, language: string, weatherSummary: string, dayOfWeek: string): Promise<string> {
  const langName = getLangName(language);
  const prompt = `You are ${nickname}'s caring best friend. Write a short, warm lunch reminder (max 80 chars).
Today is ${dayOfWeek}. Weather: ${weatherSummary}.
Be personal, human, casual. Use their name naturally. Make them feel cared for.
Remind them to eat well and take a proper break. Sound like a real person texting, not an AI.
Respond ONLY in ${langName}. No quotes, no extra text.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.9,
      max_tokens: 100,
    });
    return completion.choices[0].message?.content?.trim() || getLunchFallback(nickname, language);
  } catch {
    return getLunchFallback(nickname, language);
  }
}

function getLunchFallback(nickname: string, lang: string): string {
  if (lang === 'zh') return `${nickname}💕 该吃午饭啦！好好吃饭，下午才有力气哦~`;
  return `Hey ${nickname}💕 Time for lunch! Eat something yummy and recharge~`;
}

async function generateEveningMessage(nickname: string, language: string, weatherSummary: string): Promise<string> {
  const langName = getLangName(language);
  const prompt = `You are ${nickname}'s caring best friend. Write a short, warm evening check-in (max 80 chars).
Today's weather was: ${weatherSummary}.
Be personal and genuine. Ask how their day went naturally. Sound like a real friend texting.
Make them feel appreciated. Don't be generic or robotic.
Respond ONLY in ${langName}. No quotes, no extra text.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.9,
      max_tokens: 100,
    });
    return completion.choices[0].message?.content?.trim() || getEveningFallback(nickname, language);
  } catch {
    return getEveningFallback(nickname, language);
  }
}

function getEveningFallback(nickname: string, lang: string): string {
  if (lang === 'zh') return `${nickname}🌟 辛苦一天了！今天过得怎么样？你真的很棒哦~`;
  return `Hey ${nickname}🌟 Another day done! How was your day? You did amazing~`;
}

async function generateTomorrowWeatherMessage(
  nickname: string,
  language: string,
  tomorrowSummary: string,
  tempMin: number,
  tempMax: number,
  willRain: boolean,
  rainTimes: string
): Promise<string> {
  const langName = getLangName(language);
  const rainInfo = willRain ? `Rain expected at: ${rainTimes}. Remind them to prepare an umbrella.` : 'No rain expected — should be clear.';

  const prompt = `You are ${nickname}'s caring best friend. Write a short evening message about TOMORROW's weather (max 100 chars).
Tomorrow's forecast: ${tomorrowSummary}. Temp range: ${tempMin}°C - ${tempMax}°C.
${rainInfo}
Give practical, warm advice about what to prepare for tomorrow. Sound like a real person who cares.
Respond ONLY in ${langName}. No quotes, no extra text.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.8,
      max_tokens: 150,
    });
    return completion.choices[0].message?.content?.trim() || getTomorrowFallback(nickname, tempMin, tempMax, willRain, language);
  } catch {
    return getTomorrowFallback(nickname, tempMin, tempMax, willRain, language);
  }
}

function getTomorrowFallback(nickname: string, tempMin: number, tempMax: number, willRain: boolean, lang: string): string {
  if (lang === 'zh') {
    return willRain
      ? `${nickname}🌙 明天${tempMin}-${tempMax}°C，会下雨，记得准备雨伞哦~晚安！`
      : `${nickname}🌙 明天${tempMin}-${tempMax}°C，天气不错~早点休息，晚安！`;
  }
  return willRain
    ? `${nickname}🌙 Tomorrow: ${tempMin}-${tempMax}°C with rain — prep your umbrella! Good night~`
    : `${nickname}🌙 Tomorrow: ${tempMin}-${tempMax}°C, looking clear! Rest well, good night~`;
}

// ─── Title Generators ──────────────────────────────────────

function getMorningTitle(lang: string, nickname: string, isRainy: boolean): string {
  const titles: Record<string, { rain: string; sun: string }> = {
    en: { rain: `🌧️ Good morning, ${nickname}`, sun: `☀️ Good morning, ${nickname}` },
    zh: { rain: `🌧️ 早安，${nickname}`, sun: `☀️ 早安，${nickname}` },
    es: { rain: `🌧️ Buenos días, ${nickname}`, sun: `☀️ Buenos días, ${nickname}` },
    ja: { rain: `🌧️ おはよう、${nickname}`, sun: `☀️ おはよう、${nickname}` },
    ko: { rain: `🌧️ 좋은 아침, ${nickname}`, sun: `☀️ 좋은 아침, ${nickname}` },
    ms: { rain: `🌧️ Selamat pagi, ${nickname}`, sun: `☀️ Selamat pagi, ${nickname}` },
  };
  const set = titles[lang] || titles['en'];
  return isRainy ? set.rain : set.sun;
}

function getLunchTitle(lang: string, nickname: string): string {
  const titles: Record<string, string> = {
    en: `🍽️ Lunch time, ${nickname}!`,
    zh: `🍽️ ${nickname}，午餐时间到啦！`,
    es: `🍽️ ¡Hora de comer, ${nickname}!`,
    ja: `🍽️ ${nickname}、ランチタイムだよ！`,
    ko: `🍽️ ${nickname}, 점심 시간이야!`,
    ms: `🍽️ Masa makan tengah hari, ${nickname}!`,
  };
  return titles[lang] || titles['en'];
}

function getEveningTitle(lang: string, nickname: string): string {
  const titles: Record<string, string> = {
    en: `🌇 End of the day, ${nickname}`,
    zh: `🌇 ${nickname}，辛苦一天了`,
    es: `🌇 Fin del día, ${nickname}`,
    ja: `🌇 ${nickname}、お疲れ様`,
    ko: `🌇 ${nickname}, 오늘 하루 수고했어`,
    ms: `🌇 Tamat hari bekerja, ${nickname}`,
  };
  return titles[lang] || titles['en'];
}

function getTomorrowTitle(lang: string, nickname: string): string {
  const titles: Record<string, string> = {
    en: `🌙 Tomorrow's weather, ${nickname}`,
    zh: `🌙 ${nickname}，明天天气预报`,
    es: `🌙 Clima de mañana, ${nickname}`,
    ja: `🌙 ${nickname}、明日の天気`,
    ko: `🌙 ${nickname}, 내일 날씨`,
    ms: `🌙 Cuaca esok, ${nickname}`,
  };
  return titles[lang] || titles['en'];
}

// ─── Deduplication Helper ──────────────────────────────────────

async function hasNotificationToday(userId: string, type: string, todayStartUTC: Date): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type,
      createdAt: { gte: todayStartUTC },
    },
  });
  return !!existing;
}

// ─── Main Cron Function ──────────────────────────────────────

export async function runDailyMorningAlert(): Promise<{ alertsSent: number; usersChecked: number }> {
  const users = await prisma.user.findMany({
    where: {
      city: { not: null },
      subscription: {
        plan: {
          name: { in: ['pro', 'premium'] },
        },
      },
    },
    select: {
      id: true,
      city: true,
      nickname: true,
      language: true,
      pushSubscription: true,
    },
  });

  let alertCount = 0;

  for (const user of users) {
    if (!user.city) continue;

    try {
      // Fetch weather data
      const [weatherData, forecastData] = await Promise.all([
        fetchWeather(user.city),
        fetchForecast(user.city),
      ]);

      if (!forecastData) {
        console.warn(`No forecast data for ${user.city}, skipping user ${user.id}`);
        continue;
      }

      const { list: forecastList, timezone } = forecastData;
      const lang = user.language || 'en';
      const nickname = user.nickname || 'My friend';

      // Calculate user's local "today" start in UTC
      const userLocalTimeMs = Date.now() + timezone * 1000;
      const userDate = new Date(userLocalTimeMs);
      userDate.setUTCHours(0, 0, 0, 0);
      const todayStartUTC = new Date(userDate.getTime() - timezone * 1000);

      // Check dedup for morning_alert (skip ALL if morning already sent)
      if (await hasNotificationToday(user.id, 'morning_alert', todayStartUTC)) {
        continue;
      }

      // ─── Today's weather data ───
      const rainInfo = detectRainToday(forecastList, timezone);
      const rainSummary = rainInfo.rainPeriods.map(p => `${p.time} (${p.probability}% chance, ${p.description})`).join(', ');

      // Use forecast data as fallback if current weather fails
      const temp = weatherData?.temp ?? Math.round(forecastList[0]?.main?.temp ?? 0);
      const humidity = weatherData?.humidity ?? Math.round(forecastList[0]?.main?.humidity ?? 0);
      const weatherSummary = weatherData
        ? `${weatherData.description}, ${temp}°C, humidity ${humidity}%`
        : `${temp}°C, humidity ${humidity}%`;

      // ─── Tomorrow's forecast ───
      const tomorrowInfo = detectRainTomorrow(forecastList, timezone);
      const tomorrowRainTimes = tomorrowInfo.rainPeriods.map(p => p.time).join(', ');

      // Day of week for lunch message
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayOfWeek = days[userDate.getUTCDay()];

      // ─── Generate all 4 AI messages ───
      const [morningBody, lunchBody, eveningBody, tomorrowBody] = await Promise.all([
        generateMorningMessage(user.city, temp, humidity, rainInfo.willRain, rainSummary, lang, nickname),
        generateLunchMessage(nickname, lang, weatherSummary, dayOfWeek),
        generateEveningMessage(nickname, lang, weatherSummary),
        generateTomorrowWeatherMessage(nickname, lang, tomorrowInfo.summary, tomorrowInfo.tempMin, tomorrowInfo.tempMax, tomorrowInfo.willRain, tomorrowRainTimes),
      ]);

      // ─── Titles ───
      const morningTitle = getMorningTitle(lang, nickname, rainInfo.willRain);
      const lunchTitle = getLunchTitle(lang, nickname);
      const eveningTitle = getEveningTitle(lang, nickname);
      const tomorrowTitle = getTomorrowTitle(lang, nickname);

      // ─── Schedule times (user local → UTC) ───
      const lunchLocalMs = userDate.getTime() + 12 * 60 * 60 * 1000;
      const lunchUtcDate = new Date(lunchLocalMs - timezone * 1000);

      const eveningLocalMs = userDate.getTime() + 18 * 60 * 60 * 1000;
      const eveningUtcDate = new Date(eveningLocalMs - timezone * 1000);

      const nightLocalMs = userDate.getTime() + 21 * 60 * 60 * 1000;
      const nightUtcDate = new Date(nightLocalMs - timezone * 1000);

      // ─── Create all 4 notifications ───
      await prisma.notification.createMany({
        data: [
          {
            userId: user.id,
            type: 'morning_alert',
            title: morningTitle,
            message: morningBody,
            data: JSON.stringify({ city: user.city, rain: rainInfo.willRain, temp, humidity }),
          },
          {
            userId: user.id,
            type: 'lunch_reminder',
            title: lunchTitle,
            message: lunchBody,
            scheduledFor: lunchUtcDate,
          },
          {
            userId: user.id,
            type: 'evening_checkin',
            title: eveningTitle,
            message: eveningBody,
            scheduledFor: eveningUtcDate,
          },
          {
            userId: user.id,
            type: 'evening_weather',
            title: tomorrowTitle,
            message: tomorrowBody,
            scheduledFor: nightUtcDate,
            data: JSON.stringify({ tomorrow: tomorrowInfo }),
          },
        ],
      });

      // ─── OneSignal push notifications ───
      if (user.pushSubscription === 'onesignal') {
        try {
          await Promise.all([
            sendPushNotification([user.id], morningTitle, morningBody, '/chat'),
            sendPushNotification([user.id], lunchTitle, lunchBody, '/chat', lunchUtcDate),
            sendPushNotification([user.id], eveningTitle, eveningBody, '/chat', eveningUtcDate),
            sendPushNotification([user.id], tomorrowTitle, tomorrowBody, '/chat', nightUtcDate),
          ]);
        } catch (pushErr) {
          console.warn(`Push notification failed for user ${user.id}:`, pushErr);
        }
      }

      alertCount++;
      console.log(`4 notifications generated for ${nickname} (${user.id}) — city: ${user.city}`);
    } catch (err) {
      console.error(`Morning alert failed for user ${user.id}:`, err);
    }
  }

  return { alertsSent: alertCount, usersChecked: users.length };
}
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/cron/runDailyMorningAlert.ts
git commit -m "feat: rewrite morning cron to generate 4 AI-powered notifications with enhanced weather data"
```

---

## Task 10: Verify Build & Final Commit

**Files:** (none — verification only)

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Fix any lint/build errors**

If errors, fix them and re-run.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve lint and build issues"
```
