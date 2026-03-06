import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/db';

/**
 * Admin analytics endpoint — returns comprehensive anonymized analytics.
 * Auth: requires ADMIN_SECRET query param or header.
 */
export async function GET(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;
  const key = req.nextUrl.searchParams.get('key') || req.headers.get('x-admin-key');
  if (adminSecret && key !== adminSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Total user stats
    const totalUsers = await prisma.user.count();
    const newUsersToday = await prisma.user.count({
      where: { createdAt: { gte: last24h } },
    });
    const newUsersWeek = await prisma.user.count({
      where: { createdAt: { gte: last7d } },
    });

    // Age group distribution
    const ageGroups = await prisma.user.groupBy({
      by: ['ageGroup'],
      _count: { id: true },
    });

    // Active users (users with conversations updated in last 24h)
    const activeUsersToday = await prisma.user.count({
      where: {
        conversations: {
          some: { updatedAt: { gte: last24h } },
        },
      },
    });

    const activeUsersWeek = await prisma.user.count({
      where: {
        conversations: {
          some: { updatedAt: { gte: last7d } },
        },
      },
    });

    // Message stats
    const totalMessages = await prisma.message.count();
    const messagesToday = await prisma.message.count({
      where: { createdAt: { gte: last24h } },
    });
    const messagesWeek = await prisma.message.count({
      where: { createdAt: { gte: last7d } },
    });

    // Conversation stats
    const totalConversations = await prisma.conversation.count();
    const conversationsToday = await prisma.conversation.count({
      where: { createdAt: { gte: last24h } },
    });

    // Average messages per conversation
    const convWithMessages = await prisma.conversation.findMany({
      select: { messageCount: true },
      where: { messageCount: { gt: 0 } },
    });
    const avgMessagesPerConv = convWithMessages.length > 0
      ? Math.round(convWithMessages.reduce((sum, c) => sum + c.messageCount, 0) / convWithMessages.length)
      : 0;

    // --- DailyInsight-based analytics ---

    // Insights generated today
    const insightsToday = await prisma.dailyInsight.count({
      where: { date: { gte: last24h } },
    });

    // Memory health: users with/without memory
    const usersWithMemoryCount = await prisma.user.count({
      where: { memory: { not: null } },
    });

    // Mood distribution (last 7 days)
    const recentInsights = await prisma.dailyInsight.findMany({
      where: { date: { gte: last7d } },
      select: { mood: true, moodScore: true, topics: true, date: true },
    });

    const moodCounts: Record<string, number> = {};
    let totalMoodScore = 0;
    let moodScoreCount = 0;
    for (const insight of recentInsights) {
      if (insight.mood) {
        moodCounts[insight.mood] = (moodCounts[insight.mood] || 0) + 1;
      }
      if (insight.moodScore) {
        totalMoodScore += insight.moodScore;
        moodScoreCount++;
      }
    }

    const moodDistribution = Object.entries(moodCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([mood, count]) => ({
        mood,
        count,
        percentage: recentInsights.length > 0 ? Math.round((count / recentInsights.length) * 100) : 0,
      }));

    const avgMoodScore = moodScoreCount > 0 ? Math.round((totalMoodScore / moodScoreCount) * 10) / 10 : null;

    // Topic trends (last 7 days)
    const topicCounts: Record<string, number> = {};
    for (const insight of recentInsights) {
      if (insight.topics) {
        try {
          const topics: string[] = JSON.parse(insight.topics);
          for (const t of topics) {
            topicCounts[t.toLowerCase()] = (topicCounts[t.toLowerCase()] || 0) + 1;
          }
        } catch { /* skip malformed */ }
      }
    }
    const topicTrends = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([topic, count]) => ({ topic, count }));

    // Daily mood score trend (last 7 days)
    const dailyMoodTrend: { date: string; avgScore: number; count: number }[] = [];
    const insightsByDate: Record<string, number[]> = {};
    for (const insight of recentInsights) {
      const dateKey = insight.date.toISOString().split('T')[0];
      if (!insightsByDate[dateKey]) insightsByDate[dateKey] = [];
      if (insight.moodScore) insightsByDate[dateKey].push(insight.moodScore);
    }
    for (const [date, scores] of Object.entries(insightsByDate).sort()) {
      dailyMoodTrend.push({
        date,
        avgScore: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
        count: scores.length,
      });
    }

    // All users for listing (with IDs for detail drill-down)
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        nickname: true,
        profilePicture: true,
        ageGroup: true,
        language: true,
        aiName: true,
        memory: true,
        profile: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { conversations: true, dailyInsights: true } },
        subscription: {
          select: {
            status: true,
            interval: true,
            plan: { select: { name: true, displayName: true } },
            currentPeriodEnd: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const userList = allUsers.map((user) => ({
      id: user.id,
      nickname: user.nickname,
      profilePicture: user.profilePicture,
      ageGroup: user.ageGroup,
      language: user.language,
      aiName: user.aiName,
      hasMemory: !!user.memory,
      memoryLength: user.memory ? user.memory.length : 0,
      hasProfile: !!user.profile,
      joinedAt: user.createdAt,
      lastActive: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      totalConversations: user._count.conversations,
      totalInsights: user._count.dailyInsights,
      subscription: user.subscription
        ? {
            plan: user.subscription.plan.displayName,
            planKey: user.subscription.plan.name,
            status: user.subscription.status,
            interval: user.subscription.interval,
            expiresAt: user.subscription.currentPeriodEnd,
          }
        : null,
    }));

    // Recent daily insights (for Insights tab)
    const recentDailyInsights = await prisma.dailyInsight.findMany({
      orderBy: { date: 'desc' },
      take: 50,
      include: {
        user: {
          select: { ageGroup: true, id: true },
        },
      },
    });

    const insightsList = recentDailyInsights.map((i, index) => ({
      id: index + 1,
      userId: i.userId,
      userAgeGroup: i.user?.ageGroup || 'unknown',
      date: i.date,
      mood: i.mood,
      moodScore: i.moodScore,
      topics: i.topics ? JSON.parse(i.topics) : [],
      emotionalState: i.emotionalState,
      summary: i.summary,
      messageCount: i.messageCount,
    }));

    // Recent conversation summaries (anonymized)
    const recentSummaries = await prisma.conversation.findMany({
      where: { summary: { not: null } },
      select: {
        summary: true,
        title: true,
        messageCount: true,
        updatedAt: true,
        user: { select: { ageGroup: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    const anonymizedSummaries = recentSummaries.map((conv, index) => ({
      id: index + 1,
      title: conv.title,
      summary: conv.summary,
      messageCount: conv.messageCount,
      updatedAt: conv.updatedAt,
      userAgeGroup: conv.user?.ageGroup || 'unknown',
    }));

    // AI Personalization status
    const personalizationStatus = allUsers.map((user) => {
      let profileFields: string[] = [];
      if (user.profile) {
        try {
          const p = JSON.parse(user.profile);
          profileFields = Object.keys(p).filter((k) => p[k] !== null && p[k] !== undefined && p[k] !== '');
        } catch { /* skip */ }
      }
      return {
        id: user.id,
        ageGroup: user.ageGroup,
        language: user.language,
        aiName: user.aiName,
        hasMemory: !!user.memory,
        memoryWordCount: user.memory ? user.memory.split(/\s+/).length : 0,
        hasProfile: !!user.profile,
        profileFields,
        lastMemoryUpdate: user.updatedAt,
        conversationSummaries: user._count.conversations,
        insightsGenerated: user._count.dailyInsights,
      };
    });

    // ─── Crisis stats ───
    const crisisOpenEvents = await prisma.crisisEvent.count({ where: { status: 'open' } });
    const crisisUsersInSafeMode = await prisma.user.count({ where: { safeMode: true } });
    const crisisEventsToday = await prisma.crisisEvent.count({ where: { createdAt: { gte: last24h } } });
    const crisisEventsThisWeek = await prisma.crisisEvent.count({ where: { createdAt: { gte: last7d } } });

    return Response.json({
      overview: {
        totalUsers,
        newUsersToday,
        newUsersWeek,
        activeUsersToday,
        activeUsersWeek,
        totalConversations,
        conversationsToday,
        totalMessages,
        messagesToday,
        messagesWeek,
        avgMessagesPerConv,
        insightsToday,
        usersWithMemory: usersWithMemoryCount,
        avgMoodScore,
      },
      ageDistribution: ageGroups.map(g => ({
        group: g.ageGroup,
        count: g._count.id,
        percentage: totalUsers > 0 ? Math.round((g._count.id / totalUsers) * 100) : 0,
      })),
      moodDistribution,
      topicTrends,
      dailyMoodTrend,
      userList,
      dailyInsights: insightsList,
      recentConversations: anonymizedSummaries,
      personalizationStatus,
      crisisStats: {
        openEvents: crisisOpenEvents,
        usersInSafeMode: crisisUsersInSafeMode,
        eventsToday: crisisEventsToday,
        eventsThisWeek: crisisEventsThisWeek,
      },
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: `Analytics failed: ${msg}` }, { status: 500 });
  }
}
