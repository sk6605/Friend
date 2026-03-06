import OpenAI from 'openai';
import { prisma } from '@/app/lib/db';

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  return new OpenAI({ apiKey });
}

export async function runGrowthCheck(): Promise<{ processedUsers: number; totalUsers: number }> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: {
      dataControl: true,
      dailyInsights: {
        some: { date: { gte: sevenDaysAgo } },
      },
    },
    include: {
      dailyInsights: {
        where: { date: { gte: sevenDaysAgo } },
        orderBy: { date: 'asc' },
      },
    },
  });

  const openai = getOpenAIClient();
  let processedCount = 0;

  for (const user of users) {
    if (user.dailyInsights.length < 3) continue;

    const insights = user.dailyInsights;
    const moodScores = insights.filter(i => i.moodScore !== null).map(i => i.moodScore!);
    const avgMood = moodScores.length > 0
      ? Math.round(moodScores.reduce((a, b) => a + b, 0) / moodScores.length * 10) / 10
      : null;

    let moodTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (moodScores.length >= 4) {
      const mid = Math.floor(moodScores.length / 2);
      const firstAvg = moodScores.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
      const secondAvg = moodScores.slice(mid).reduce((a, b) => a + b, 0) / (moodScores.length - mid);
      const diff = secondAvg - firstAvg;
      if (diff > 0.5) moodTrend = 'improving';
      else if (diff < -0.5) moodTrend = 'declining';
    }

    const triggers = insights.map(i => i.triggerEvent).filter(Boolean) as string[];
    const patterns = insights.map(i => i.thinkingPattern).filter(Boolean) as string[];
    const intensities = insights.filter(i => i.emotionIntensity !== null).map(i => i.emotionIntensity!);
    const avgIntensity = intensities.length > 0
      ? Math.round(intensities.reduce((a, b) => a + b, 0) / intensities.length * 10) / 10
      : null;

    const triggerCounts: Record<string, number> = {};
    for (const t of triggers) triggerCounts[t.toLowerCase()] = (triggerCounts[t.toLowerCase()] || 0) + 1;
    const patternCounts: Record<string, number> = {};
    for (const p of patterns) patternCounts[p.toLowerCase()] = (patternCounts[p.toLowerCase()] || 0) + 1;

    const topTriggers = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topPatterns = Object.entries(patternCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const needsIntervention = moodTrend === 'declining'
      || (avgMood !== null && avgMood <= 4)
      || topPatterns.length >= 2
      || (avgIntensity !== null && avgIntensity >= 7);

    if (!needsIntervention) continue;

    const interventionRes = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `You are a supportive mental health assistant. Based on a user's weekly emotional data, generate 2-3 brief, actionable growth interventions.

Categories of interventions:
1. Cognitive exercise — a specific thought reframing technique for their pattern
2. Behavioral challenge — a small daily action they can try
3. Support suggestion — a resource or practice (journaling prompt, breathing exercise, etc.)

Be warm, specific, and practical. Reference their actual patterns/triggers. Keep each intervention to 2-3 sentences.

Return JSON: {"interventions": [{"type": "cognitive|behavioral|support", "title": "<short title>", "description": "<2-3 sentences>"}], "summary": "<1 sentence overall assessment>"}`,
        },
        {
          role: 'user',
          content: `User: ${user.nickname}
Weekly mood trend: ${moodTrend} (avg: ${avgMood}/10)
Average emotion intensity: ${avgIntensity}/10
Top triggers: ${topTriggers.map(([t, c]) => `${t} (${c}x)`).join(', ') || 'none identified'}
Thinking patterns: ${topPatterns.map(([p, c]) => `${p} (${c}x)`).join(', ') || 'none detected'}
Recent moods: ${insights.map(i => `${i.date.toISOString().slice(0, 10)}: ${i.mood || 'unknown'} (${i.moodScore || '?'}/10)`).join(', ')}`,
        },
      ],
    });

    const output = interventionRes.choices[0]?.message?.content || '';
    let parsed: { interventions?: { type: string; title: string; description: string }[]; summary?: string } = {};
    try {
      parsed = JSON.parse(output.replace(/```json?\s*|\s*```/g, '').trim());
    } catch {
      console.warn(`Failed to parse growth intervention for user ${user.id}`);
      continue;
    }

    await prisma.growthReport.create({
      data: {
        userId: user.id,
        period: 'weekly',
        startDate: sevenDaysAgo,
        endDate: new Date(),
        avgMoodScore: avgMood,
        moodTrend,
        topTriggers: JSON.stringify(topTriggers.map(([t]) => t)),
        topPatterns: JSON.stringify(topPatterns.map(([p]) => p)),
        riskAssessment: (avgMood !== null && avgMood <= 3) ? 'elevated' : (avgMood !== null && avgMood <= 5) ? 'moderate' : 'low',
        recommendations: JSON.stringify(parsed.interventions || []),
        summary: parsed.summary || null,
      },
    });

    const nudgeContent = parsed.interventions?.[0]
      ? `${parsed.interventions[0].title}: ${parsed.interventions[0].description}`
      : parsed.summary || 'Your weekly growth report is ready.';

    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'growth_nudge',
        title: 'Weekly Growth Insight',
        message: nudgeContent,
      },
    });

    processedCount++;
    console.log(`Growth check processed for user: ${user.nickname} (${user.id}) — trend: ${moodTrend}, avgMood: ${avgMood}`);
  }

  return { processedUsers: processedCount, totalUsers: users.length };
}
