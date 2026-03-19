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
