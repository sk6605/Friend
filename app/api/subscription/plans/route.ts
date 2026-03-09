import { prisma } from '@/app/lib/db';

/**
 * GET /api/subscription/plans
 * Returns all active subscription plans from the database.
 * Seeds default plans (Free, Pro, Premium) if none exist.
 *
 * Services: Prisma
 */
export async function GET() {
  try {
    let plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });

    // Seed default plans if none exist
    if (plans.length === 0) {
      await prisma.plan.createMany({
        data: [
          {
            name: 'free',
            displayName: 'Free',
            price: 0,
            yearlyPrice: 0,
            dailyMessageLimit: 20,
            maxFileUploads: 2,
            maxFileSizeMB: 10,
            memoryEnabled: false,
            priorityResponse: false,
            customAiPersonality: false,
            advancedAnalytics: false,
            description: 'Get started with Lumi',
            features: JSON.stringify([
              '20 messages per day',
              '2 file uploads per message (10MB)',
              'Basic AI companion',
              'Multi-language support (6 languages)',
              'Daily challenges',
              'Crisis safety protection',
            ]),
          },
          {
            name: 'pro',
            displayName: 'Pro',
            price: 9.99,
            yearlyPrice: 99.99,
            dailyMessageLimit: -1,
            maxFileUploads: 5,
            maxFileSizeMB: 50,
            memoryEnabled: true,
            priorityResponse: true,
            customAiPersonality: false,
            advancedAnalytics: true,
            description: 'For power users who want more',
            features: JSON.stringify([
              'Unlimited messages',
              '5 file uploads per message (50MB)',
              'AI long-term memory & recall',
              'Mood & emotion analytics',
              'Personalized daily challenges',
              'AI learning guide mode',
              'Growth reports & interventions',
              'Multi-language support (6 languages)',
            ]),
          },
          {
            name: 'premium',
            displayName: 'Premium',
            price: 19.99,
            yearlyPrice: 199.99,
            dailyMessageLimit: -1,
            maxFileUploads: 10,
            maxFileSizeMB: 100,
            memoryEnabled: true,
            priorityResponse: true,
            customAiPersonality: true,
            advancedAnalytics: true,
            description: 'The ultimate AI companion experience',
            features: JSON.stringify([
              'Everything in Pro',
              '10 file uploads per message (100MB)',
              'AI personality customization (5 styles)',
              'Proactive care check-ins',
              'Advanced emotional growth insights',
              '3-day, 7-day, 15-day & monthly reports',
              'Priority responses',
              'Early access to new features',
            ]),
          },
        ],
      });

      plans = await prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { price: 'asc' },
      });
    }

    return Response.json({
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        displayName: p.displayName,
        price: p.price,
        yearlyPrice: p.yearlyPrice,
        currency: p.currency,
        description: p.description,
        features: p.features ? JSON.parse(p.features) : [],
        limits: {
          dailyMessageLimit: p.dailyMessageLimit,
          maxFileUploads: p.maxFileUploads,
          maxFileSizeMB: p.maxFileSizeMB,
          memoryEnabled: p.memoryEnabled,
          priorityResponse: p.priorityResponse,
          customAiPersonality: p.customAiPersonality,
          advancedAnalytics: p.advancedAnalytics,
        },
      })),
    });
  } catch (error) {
    console.error('Get plans error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: `Failed to fetch plans: ${msg}` }, { status: 500 });
  }
}
