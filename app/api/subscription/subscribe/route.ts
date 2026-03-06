import { prisma } from '@/app/lib/db';

/**
 * POST /api/subscription/subscribe
 * Create or update a user's subscription.
 *
 * Logic:
 * 1. Validates Plan and User existence.
 * 2. Calculates billing period (Monthly/Yearly).
 * 3. Upserts Subscription record (simulating successful payment).
 *
 * Services: Prisma
 */
export async function POST(req: Request) {
  try {
    const { userId, planId, interval = 'monthly' } = await req.json();

    if (!userId || !planId) {
      return Response.json({ error: 'userId and planId are required' }, { status: 400 });
    }

    // Validate plan exists
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      return Response.json({ error: 'Invalid or inactive plan' }, { status: 400 });
    }

    // Validate user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Calculate billing period
    const now = new Date();
    const periodEnd = new Date(now);
    if (interval === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Upsert subscription (one per user)
    const subscription = await prisma.subscription.upsert({
      where: { userId },
      update: {
        planId,
        interval,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelledAt: null,
      },
      create: {
        userId,
        planId,
        interval,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      include: { plan: true },
    });

    return Response.json({
      ok: true,
      subscription: {
        id: subscription.id,
        plan: subscription.plan.displayName,
        planKey: subscription.plan.name,
        status: subscription.status,
        interval: subscription.interval,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: `Subscription failed: ${msg}` }, { status: 500 });
  }
}
