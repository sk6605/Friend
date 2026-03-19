# Stripe Payment Gateway & Cron Reminder Enhancements

**Date:** 2026-03-19
**Status:** Draft

---

## 1. Stripe Checkout Integration (Sandbox)

### Overview

Add Stripe as the payment gateway for the existing Free/Pro/Premium subscription plans. Uses Stripe Checkout (hosted payment page) for PCI-compliant card collection and Stripe Customer Portal for billing management.

### Flow

1. User visits `/subscription` → sees existing plan cards
2. Clicks "Subscribe" → POST to `/api/subscription/checkout` → creates Stripe Checkout Session
3. User redirected to Stripe's hosted checkout page (sandbox/test mode)
4. After payment → redirected to `/subscription?success=true`
5. Stripe sends webhook → `/api/subscription/webhook` updates Subscription record in DB
6. "Manage Billing" button → POST to `/api/subscription/portal` → redirects to Stripe Customer Portal

### Stripe Product/Price Setup

Prices are created in Stripe Dashboard (sandbox) matching existing plan pricing:

| Plan | Monthly | Yearly |
|------|---------|--------|
| Pro | $9.99/mo | $99.99/yr |
| Premium | $19.99/mo | $199.99/yr |

Free plan requires no Stripe integration — it's the default.

Each Plan record in the database will store a `stripePriceMonthly` and `stripePriceYearly` field containing the Stripe Price ID (e.g. `price_xxx`).

### Schema Changes

**User model** — add:
- `stripeCustomerId String?` — Stripe Customer ID, created on first checkout

**Plan model** — add:
- `stripePriceMonthly String?` — Stripe Price ID for monthly billing
- `stripePriceYearly String?` — Stripe Price ID for yearly billing

**Subscription model** — add index:
- `@@index([externalId])` — for efficient webhook lookups by Stripe subscription ID

### New API Routes

#### `POST /api/subscription/checkout`

**Request:** `{ userId, planId, interval: 'monthly' | 'yearly' }`

**Logic:**
1. Validate user and plan exist
2. Get or create Stripe Customer (store `stripeCustomerId` on User)
3. Look up the correct Stripe Price ID from Plan (`stripePriceMonthly` or `stripePriceYearly`)
4. Create Stripe Checkout Session with:
   - `mode: 'subscription'`
   - `customer: stripeCustomerId`
   - `line_items: [{ price: stripePriceId, quantity: 1 }]`
   - `success_url: /subscription?success=true`
   - `cancel_url: /subscription?cancelled=true`
   - `metadata: { userId, planId, interval }`
5. Return `{ url: session.url }` for redirect

#### `POST /api/subscription/webhook`

**Raw body parsing** required. In Next.js App Router, read the raw body via `await req.text()` (not `req.json()`), then pass to `stripe.webhooks.constructEvent(rawBody, sig, secret)`. Must use `export const runtime = 'nodejs'` (not edge).

**Events handled:**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create/update Subscription: status=active, store `session.subscription` as `externalId` (Stripe subscription ID), set billing period |
| `invoice.paid` | Renew: update currentPeriodStart/End on Subscription |
| `invoice.payment_failed` | Set Subscription status to `past_due` |
| `customer.subscription.updated` | Sync plan changes: extract new price ID from `subscription.items.data[0].price.id`, reverse-lookup Plan by `stripePriceMonthly` or `stripePriceYearly`, update `Subscription.planId` |
| `customer.subscription.deleted` | Set Subscription status to `cancelled`, record cancelledAt |

**Webhook verification:** Uses `STRIPE_WEBHOOK_SECRET` to verify event signatures.

#### `POST /api/subscription/portal`

**Request:** `{ userId }`

**Logic:**
1. Look up user's `stripeCustomerId`
2. Create Stripe Billing Portal Session with `return_url: /subscription`
3. Return `{ url: session.url }` for redirect

### Modified Files

#### `app/subscription/page.tsx`

- "Subscribe" button → calls `/api/subscription/checkout` → redirects to `session.url`
- Add "Manage Billing" button (visible when user has active subscription) → calls `/api/subscription/portal`
- Handle `?success=true` and `?cancelled=true` query params with toast messages
- Remove the "preview mode" footer note

#### `app/api/subscription/subscribe/route.ts`

- Keep as fallback for Free plan downgrades (no Stripe needed)
- Paid plan subscriptions now go through Stripe Checkout
- Remove direct cancellation of paid plans from `DELETE /api/subscription/status` — paid plan cancellations go through Stripe Customer Portal only (prevents DB/Stripe state mismatch)

### New Files

- `app/lib/stripe.ts` — Stripe client singleton using `STRIPE_SECRET_KEY`
- `app/api/subscription/checkout/route.ts`
- `app/api/subscription/webhook/route.ts`
- `app/api/subscription/portal/route.ts`

### Environment Variables

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Note: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is not needed since we use server-side Checkout Session redirect (not client-side Stripe.js).

### Sandbox Testing

- Use Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC
- Webhook testing via Stripe CLI: `stripe listen --forward-to localhost:3000/api/subscription/webhook`

---

## 2. Cron Reminder Enhancements

### Overview

Enhance the daily morning cron job to generate 4 AI-powered, personalized notifications per user, scheduled throughout the day. All messages are generated in a single cron run at 7 AM MYT and delivered at their scheduled times.

### Cron Schedule

- **Vercel cron:** `0 23 * * *` UTC = **7:00 AM MYT** (UTC+8)
- Configured in `vercel.json`
- Runs once daily, processes all eligible Pro/Premium users with a city set

### Notification Schedule

| Time (MYT) | Type | Content |
|-------------|------|---------|
| 7:00 AM | `morning_alert` | Today's weather with temperature, humidity, rain times |
| 12:00 PM | `lunch_reminder` | AI-generated personal lunch reminder |
| 6:00 PM | `evening_checkin` | AI-generated personal evening check-in |
| 9:00 PM | `evening_weather` | AI-generated tomorrow's weather forecast & preparation advice |

### Morning Alert Enhancement (7 AM)

**Current:** AI-generated weather message mentioning rain or sunny conditions.

**Enhanced:** The AI prompt now explicitly includes:
- Current **temperature** (°C)
- Current **humidity** (%)
- **Rain forecast** with approximate times (e.g. "Rain expected around 2-4 PM")
- Whether to bring an umbrella

**Data source:** `fetchForecast()` → `detectRainToday()` already provides rain periods with times. We pass the full weather data (temp, humidity, rain periods) into the AI prompt.

### Lunch Reminder (12 PM) — NEW AI-Generated

**Current:** Static "Time to eat well" message.

**New:** GPT-generated personal message with context:
- User's nickname (if available)
- Current weather conditions
- Day of week
- Tone: warm, caring friend reminding you to take a break and eat

**AI Prompt context:**
```
You are a caring best friend. Generate a short, warm lunch reminder for {nickname}.
Today is {dayOfWeek}. Weather: {weatherSummary}.
Be personal, human, and casual. Use their name. 1-2 sentences max.
```

**Fallback:** Pre-written warm messages if AI fails.

### Evening Check-in (6 PM) — NEW AI-Generated

**Current:** Static "How was your day?" message.

**New:** GPT-generated personal evening message with context:
- User's nickname
- Today's weather recap
- Tone: warm wind-down, genuine curiosity about their day

**AI Prompt context:**
```
You are a caring best friend. Generate a short, warm evening check-in for {nickname}.
Today's weather was {weatherSummary}.
Be personal and genuine. Ask about their day naturally. 1-2 sentences max.
```

**Fallback:** Pre-written warm messages if AI fails.

### Tomorrow's Weather (9 PM) — NEW

**New notification type:** `evening_weather`

**Content:** AI-generated message about tomorrow's weather forecast:
- Tomorrow's expected temperature range (high/low)
- Rain probability and expected times
- Practical advice: bring umbrella, wear layers, sunscreen, etc.

**Data source:** `fetchForecast()` returns 5-day/3-hour data. Filter for tomorrow's date entries to get:
- Min/max temperature
- Rain periods (same logic as `detectRainToday()` but for tomorrow)
- General conditions

**AI Prompt context:**
```
You are a caring best friend. Generate a short evening message for {nickname} about tomorrow's weather.
Tomorrow's forecast: {tomorrowSummary}. Temp range: {min}°C - {max}°C.
Rain expected: {yes/no, times if yes}.
Give practical, warm advice about what to prepare. 1-2 sentences max.
```

**Fallback:** Simple forecast summary if AI fails.

### New Helper Function: `detectRainTomorrow()`

Similar to existing `detectRainToday()` but filters forecast entries for the next calendar day (in user's local timezone). Returns:
- `willRain: boolean`
- `rainPeriods: Array<{ time: string, description: string, probability: number }>`
- `tempMin: number`
- `tempMax: number`
- `summary: string`

### OneSignal Push Scheduling

Each notification uses the `sendAfter` parameter in `sendPushNotification()` to deliver at the correct time:
- Morning: immediate
- Lunch: `sendAfter` = 12:00 MYT
- Evening: `sendAfter` = 18:00 MYT
- 9 PM: `sendAfter` = 21:00 MYT

### Modified Files

- `vercel.json` — Add/update cron: `0 23 * * *`
- `app/lib/cron/runDailyMorningAlert.ts` — Major rewrite:
  - Remove 15-minute polling logic
  - Single execution generates all 4 notifications per user
  - Enhanced AI prompts for each time slot
  - New tomorrow forecast logic
- `app/lib/weather.ts` — Add `detectRainTomorrow()` and `getTomorrowForecastSummary()` functions
- `app/api/cron/morning-alert/route.ts` — Ensure route exists and calls updated function

### Notification Model

Add `evening_weather` to the notification types used. No schema change needed since `type` is a String field.

---

## 3. Dependencies & Package Changes

### New npm packages:
- `stripe` — Stripe Node.js SDK

### Existing packages used:
- `openai` — For AI-generated reminder messages (already installed)
- `node-cron` — For local dev scheduling (already installed)

---

## 4. Error Handling

### Stripe
- Checkout creation failure → return error to user, don't create subscription
- Webhook signature verification failure → return 400, log warning
- Payment failure → set subscription to `past_due`, user sees downgrade notice

### Cron Reminders
- Weather API failure → skip weather-dependent messages, create basic greeting
- AI generation failure → use pre-written fallback messages
- Individual user failure → log error, continue processing other users (existing pattern)

---

## 5. Security Considerations

- Stripe webhook signature verification using `STRIPE_WEBHOOK_SECRET`
- Raw body parsing for webhook route (required by Stripe)
- No card data touches our server (Stripe Checkout handles PCI)
- Cron endpoint protected by `key` query parameter matching `CRON_SECRET` (existing pattern used in vercel.json)
- Stripe secret key never exposed to client (server-side only)

---

## 6. Migration Notes

### Existing Subscribers

Users with existing Subscription records (created via the old direct-subscribe flow) will have `paymentProvider: null` and `externalId: null`. These are handled as follows:
- They retain their current plan until expiry
- The "Manage Billing" button is hidden for users without `stripeCustomerId`
- They see the normal "Subscribe" button to re-subscribe via Stripe when ready

### Deduplication

All 4 notification types (`morning_alert`, `lunch_reminder`, `evening_checkin`, `evening_weather`) use deduplication guards — check for existing notification of the same type created today before creating a new one. This prevents duplicates if the cron is triggered manually or re-run.
