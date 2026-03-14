import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';

/**
 * GET /api/notifications/subscribe/check?userId=xxx
 * Returns { eligible: boolean } based on whether the user has a pro/premium plan.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ eligible: false }, { status: 400 });
  }

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    const planName = subscription?.plan?.name || 'free';
    const eligible = planName === 'pro' || planName === 'premium';

    return NextResponse.json({ eligible });
  } catch (error) {
    console.error('Error checking push eligibility:', error);
    return NextResponse.json({ eligible: false }, { status: 500 });
  }
}
