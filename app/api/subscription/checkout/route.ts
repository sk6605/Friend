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
