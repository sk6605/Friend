import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/db';
import { getStripe } from '@/app/lib/stripe';

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
    const session = await getStripe().billingPortal.sessions.create({
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
