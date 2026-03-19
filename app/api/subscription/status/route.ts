import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/db';

/**
 * GET /api/subscription/status?userId=xxx
 * Returns the user's current subscription status, plan details, and usage limits.
 *
 * Logic:
 * 1. Checks for active subscription in DB.
 * 2. If none/expired, returns Free tier defaults.
 * 3. If active, returns Plan details and Usage Limits.
 *
 * Services: Prisma
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: {
        plan: true,
      },
    });

    if (!subscription) {
      return Response.json({
        subscribed: false,
        plan: 'free',
        planDisplayName: 'Free',
        stripeCustomerId: null,
        paymentProvider: null,
        limits: {
          dailyMessageLimit: 20,
          maxFileUploads: 2,
          maxFileSizeMB: 10,
          memoryEnabled: false,
          priorityResponse: false,
          customAiPersonality: false,
          advancedAnalytics: false,
        },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    // Check if subscription has expired
    const isExpired = new Date() > new Date(subscription.currentPeriodEnd);
    const effectiveStatus = isExpired ? 'expired' : subscription.status;

    return Response.json({
      subscribed: effectiveStatus === 'active',
      plan: subscription.plan.name,
      planDisplayName: subscription.plan.displayName,
      status: effectiveStatus,
      interval: subscription.interval,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelledAt: subscription.cancelledAt,
      stripeCustomerId: user?.stripeCustomerId || null,
      paymentProvider: subscription.paymentProvider,
      limits: {
        dailyMessageLimit: subscription.plan.dailyMessageLimit,
        maxFileUploads: subscription.plan.maxFileUploads,
        maxFileSizeMB: subscription.plan.maxFileSizeMB,
        memoryEnabled: subscription.plan.memoryEnabled,
        priorityResponse: subscription.plan.priorityResponse,
        customAiPersonality: subscription.plan.customAiPersonality,
        advancedAnalytics: subscription.plan.advancedAnalytics,
      },
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: `Status check failed: ${msg}` }, { status: 500 });
  }
}

/**
 * DELETE /api/subscription/status?userId=xxx
 * Cancel a user's subscription.
 */
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
