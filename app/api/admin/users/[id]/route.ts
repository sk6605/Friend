import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminSecret = process.env.ADMIN_SECRET;
  const key =
    req.nextUrl.searchParams.get('key') || req.headers.get('x-admin-key');
  if (adminSecret && key !== adminSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: userId } = await params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        conversations: {
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            summary: true,
            messageCount: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        dailyInsights: {
          orderBy: { date: 'desc' },
          take: 30,
        },
        subscription: {
          include: { plan: true },
        },
      },
    });

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse profile JSON
    let parsedProfile: Record<string, unknown> = {};
    if (user.profile) {
      try {
        parsedProfile = JSON.parse(user.profile);
      } catch {
        parsedProfile = { raw: user.profile };
      }
    }

    // Engagement stats
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const totalMessages = await prisma.message.count({
      where: { conversation: { userId: user.id } },
    });

    const messagesThisWeek = await prisma.message.count({
      where: {
        conversation: { userId: user.id },
        createdAt: { gte: last7d },
      },
    });

    const activeDaysThisMonth = await prisma.dailyInsight.count({
      where: {
        userId: user.id,
        date: { gte: thisMonthStart },
      },
    });

    // Mood history from insights
    const moodHistory = user.dailyInsights.map((i) => ({
      date: i.date,
      mood: i.mood,
      moodScore: i.moodScore,
      topics: i.topics ? JSON.parse(i.topics) : [],
      emotionalState: i.emotionalState,
      summary: i.summary,
      messageCount: i.messageCount,
    }));

    // Aggregate top topics from insights
    const topicCounts: Record<string, number> = {};
    for (const insight of user.dailyInsights) {
      if (insight.topics) {
        const topics: string[] = JSON.parse(insight.topics);
        for (const t of topics) {
          topicCounts[t] = (topicCounts[t] || 0) + 1;
        }
      }
    }
    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([topic, count]) => ({ topic, count }));

    return Response.json({
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      email: user.email,
      age: user.age,
      profilePicture: user.profilePicture,
      ageGroup: user.ageGroup,
      language: user.language,
      aiName: user.aiName,
      memory: user.memory,
      profile: parsedProfile,
      joinedAt: user.createdAt,
      lastActive: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      subscription: user.subscription
        ? {
            plan: user.subscription.plan.displayName,
            planKey: user.subscription.plan.name,
            status: user.subscription.status,
            interval: user.subscription.interval,
            currentPeriodStart: user.subscription.currentPeriodStart,
            currentPeriodEnd: user.subscription.currentPeriodEnd,
            cancelledAt: user.subscription.cancelledAt,
          }
        : null,
      engagement: {
        totalConversations: user.conversations.length,
        totalMessages,
        messagesThisWeek,
        activeDaysThisMonth,
        avgMessagesPerDay:
          totalMessages > 0
            ? Math.round(
                totalMessages /
                  Math.max(
                    1,
                    Math.ceil(
                      (now.getTime() - user.createdAt.getTime()) /
                        (24 * 60 * 60 * 1000)
                    )
                  )
              )
            : 0,
      },
      conversations: user.conversations,
      moodHistory,
      topTopics,
    });
  } catch (error) {
    console.error('Admin user detail error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: `User detail failed: ${msg}` }, { status: 500 });
  }
}
