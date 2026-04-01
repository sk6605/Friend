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
            description: 'Begin your journey with Lumi',
            features: JSON.stringify([
              '20 Enlightening messages per day',
              'Smart AI Companion (GPT-4o-mini)',
              '2 File uploads per message (10MB/file)',
              'Basic Document & Analysis',
              'Daily Mindfulness Challenges',
              'Real-time Weather & Care Alerts',
              'Crisis Safety Protection',
            ]),
          },
          {
            name: 'pro',
            displayName: 'Pro',
            price: 29,
            yearlyPrice: 304.24,
            dailyMessageLimit: -1,
            maxFileUploads: 20,
            maxFileSizeMB: 100,
            memoryEnabled: true,
            priorityResponse: true,
            customAiPersonality: false,
            advancedAnalytics: true,
            stripePriceMonthly: 'price_1THHyKA7TElDOFCIqWQ6BiNp',
            stripePriceYearly: 'price_1THI1vA7TElDOFCIdYLboDHz',
            description: 'Unlock deep insights and memory',
            features: JSON.stringify([
              '✨ Unlimited Conversation Flow',
              '🧠 Perpetual AI Memory & Recall',
              '📎 20 File uploads (Large 100MB units)',
              '📊 Advanced Mood & Pattern Analytics',
              '📈 Weekly Growth & Insight Reports',
              '⚡ Priority Response Speed',
              '🎯 Custom Personalized Challenges',
              '🌍 Full Multi-language Support',
            ]),
          },
          {
            name: 'premium',
            displayName: 'Premium',
            price: 89,
            yearlyPrice: 939.84,
            dailyMessageLimit: -1,
            maxFileUploads: 50,
            maxFileSizeMB: 250,
            memoryEnabled: true,
            priorityResponse: true,
            customAiPersonality: true,
            advancedAnalytics: true,
            stripePriceMonthly: 'price_1THHyrA7TElDOFCI0MhihrAH',
            stripePriceYearly: 'price_1THI3PA7TElDOFCIFfYlGPqT',
            description: 'The ultimate intimate AI experience',
            features: JSON.stringify([
              '👑 Everything in Pro, and more',
              '🎭 Fully Bespoke AI Personalities',
              '📂 50 File uploads (Pro-grade 250MB)',
              '❤️ Proactive Emotional Care Check-ins',
              '🔬 Deep-dive Monthly Growth Science',
              '🛠️ Early Access to Experimental Features',
              '🌟 Exclusive Premium Avatar Badge',
              '💎 VIP Dedicated Support Access',
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
