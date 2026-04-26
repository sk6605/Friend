import { prisma } from '@/app/lib/db';
import { NextRequest } from 'next/server';
import OpenAI from 'openai';

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  return new OpenAI({ apiKey });
}

/**
 * 接口：/api/insights
 * 作用：智能心理健康分析引擎。
 * 
 * 核心流程：
 * 1. 【数据采集】：从数据库拉取指定时间段（3天/7天/月度）的 DailyInsight 记录。
 * 2. 【硬性聚合】：通过 aggregateInsights 函数绘制情绪分布柱状图、心情曲线图、高频话题词云。
 * 3. 【AI 语义挖掘】：深度分析用户的思维模式（如：是否属于非黑即白、过度概括等认知失真）。
 * 4. 【行动建议】：调用 GPT-4 针对当下的心理状态生成个性化的“干预方案”（Interventions），如认知练习或行为改善建议。
 */

// ─── 类型定义 ───

interface EmotionItem {
  mood: string;        // 情绪名称 (如 Happy, Anxious)
  percentage: number;  // 占比
  count: number;       // 出现天数
  topTriggers: string[]; // 该情绪最常见的诱因
  topTopics: string[];   // 该情绪下最常聊的话题
}

interface AggregatedData {
  emotionBreakdown: EmotionItem[]; // 情绪分布
  moodCurve: { date: string; moodScore: number; mood: string }[]; // 心情走势
  triggers: { name: string; count: number }[]; // 频率诱因
  patterns: { name: string; count: number }[]; // 思维模式统计
  topics: { name: string; count: number }[];   // 热门话题
  dayOfWeek: { day: string; avgMood: number; count: number }[]; // 周期性波动
  summary: {
    avgMood: number | null; // 平均表现
    trend: 'improving' | 'stable' | 'declining'; // 发展趋势
    totalMessages: number;
    totalDays: number;
    topTrigger: string | null;
    topPattern: string | null;
  };
  naturalInsights: string[]; // AI 生成的文字洞察
  interventions: { type: 'cognitive' | 'behavioral' | 'support'; title: string; description: string; reason: string }[]; // AI 生成的干预方案
}

// ─── Shared aggregation helper ───

interface InsightRow {
  date: Date;
  mood: string | null;
  moodScore: number | null;
  topics: string | null;
  emotionalState: string | null;
  triggerEvent: string | null;
  thinkingPattern: string | null;
  behavioralResponse: string | null;
  emotionIntensity: number | null;
  messageCount: number;
}

/**
 * 函数：数据聚合器 (aggregateInsights)
 * 作用：将原始的 DailyInsight 数组转换为前端图表所需的聚合形式。
 */
function aggregateInsights(insights: InsightRow[]): AggregatedData {
  // 1. 统计情绪分布 (情绪名称 -> 频次/诱因/话题)
  const moodGroups: Record<string, { count: number; triggers: Set<string>; topics: Set<string> }> = {};
  for (const i of insights) {
    if (!i.mood) continue;
    const key = i.mood.toLowerCase();
    if (!moodGroups[key]) moodGroups[key] = { count: 0, triggers: new Set(), topics: new Set() };
    moodGroups[key].count++;
    if (i.triggerEvent) moodGroups[key].triggers.add(i.triggerEvent);
    if (i.topics) {
      try {
        const arr = JSON.parse(i.topics) as string[];
        for (const t of arr) moodGroups[key].topics.add(t);
      } catch { /* skip */ }
    }
  }
  const totalWithMood = insights.filter(i => i.mood).length || 1;
  const emotionBreakdown: EmotionItem[] = Object.entries(moodGroups)
    .map(([mood, g]) => ({
      mood,
      percentage: Math.round((g.count / totalWithMood) * 100),
      count: g.count,
      topTriggers: [...g.triggers].slice(0, 3),
      topTopics: [...g.topics].slice(0, 3),
    }))
    .sort((a, b) => b.count - a.count);

  // 2. 构造心情趋势曲线
  const moodCurve = insights
    .filter(i => i.moodScore !== null)
    .map(i => ({
      date: i.date.toISOString().slice(0, 10),
      moodScore: i.moodScore!,
      mood: i.mood || '',
    }));

  // 3. 计算高频诱因排行榜
  const triggerCounts: Record<string, number> = {};
  for (const i of insights) {
    if (i.triggerEvent) {
      const key = i.triggerEvent.toLowerCase().trim();
      triggerCounts[key] = (triggerCounts[key] || 0) + 1;
    }
  }
  const triggers = Object.entries(triggerCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 4. 分析思维模式频率 (如：认知失真类别)
  const patternCounts: Record<string, number> = {};
  for (const i of insights) {
    if (i.thinkingPattern) {
      const key = i.thinkingPattern.toLowerCase().trim();
      patternCounts[key] = (patternCounts[key] || 0) + 1;
    }
  }
  const patterns = Object.entries(patternCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // 5. 关键词话题汇总
  const topicCounts: Record<string, number> = {};
  for (const i of insights) {
    if (i.topics) {
      try {
        const arr = JSON.parse(i.topics) as string[];
        for (const t of arr) {
          const key = t.toLowerCase().trim();
          topicCounts[key] = (topicCounts[key] || 0) + 1;
        }
      } catch { /* skip */ }
    }
  }
  const topics = Object.entries(topicCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 6. 生成核心统计摘要及趋势判断 (改善/稳定/下滑)
  const scoredInsights = insights.filter(i => i.moodScore !== null);
  const avgMood = scoredInsights.length > 0
    ? Math.round(scoredInsights.reduce((a, b) => a + b.moodScore!, 0) / scoredInsights.length * 10) / 10
    : null;
  const totalMessages = insights.reduce((a, b) => a + (b.messageCount || 0), 0);

  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (scoredInsights.length >= 4) {
    const mid = Math.floor(scoredInsights.length / 2);
    const firstHalf = scoredInsights.slice(0, mid);
    const secondHalf = scoredInsights.slice(mid);
    const avgFirst = firstHalf.reduce((a, b) => a + b.moodScore!, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b.moodScore!, 0) / secondHalf.length;
    const diff = avgSecond - avgFirst;
    if (diff > 0.5) trend = 'improving';
    else if (diff < -0.5) trend = 'declining';
  }

  // 7. 周内周期性分析 (周一至周日哪天心情最好)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayGroups: Record<string, { total: number; count: number }> = {};
  for (const d of dayNames) dayGroups[d] = { total: 0, count: 0 };
  for (const i of insights) {
    if (i.moodScore !== null) {
      const dayName = dayNames[i.date.getDay()];
      dayGroups[dayName].total += i.moodScore;
      dayGroups[dayName].count++;
    }
  }
  const dayOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => ({
    day: d,
    avgMood: dayGroups[d].count > 0 ? Math.round(dayGroups[d].total / dayGroups[d].count * 10) / 10 : 0,
    count: dayGroups[d].count,
  }));

  return {
    emotionBreakdown,
    moodCurve,
    triggers,
    patterns,
    topics,
    dayOfWeek,
    summary: {
      avgMood,
      trend,
      totalMessages,
      totalDays: insights.length,
      topTrigger: triggers[0]?.name || null,
      topPattern: patterns[0]?.name || null,
    },
    naturalInsights: [],
    interventions: [],
  };
}

/**
 * Generate natural-language insights and growth interventions using GPT.
 * Only called for multi-day views (3-day, 7-day, 15-day, monthly).
 */
/**
 * 函数：AI 语义化分析 (generateNaturalInsights)
 * 作用：调用 GPT 模型，对聚合后的硬性数据进行“翻译”，输出可读的成长建议。
 * 备注：仅在查看 3天/7天/月度报表时触发，以保证有足够的样本量。
 */
async function generateNaturalInsights(data: AggregatedData): Promise<{ insights: string[]; interventions: AggregatedData['interventions'] }> {
  try {
    const openai = getOpenAIClient();

    const prompt = `Analyze this emotional data and generate insights + growth recommendations.

Data:
- Avg mood: ${data.summary.avgMood?.toFixed(1) || 'N/A'}/10 (trend: ${data.summary.trend})
- Top emotions: ${data.emotionBreakdown.slice(0, 4).map(e => `${e.mood} (${e.percentage}%)`).join(', ') || 'N/A'}
- Top triggers: ${data.triggers.slice(0, 4).map(t => `${t.name} (${t.count}x)`).join(', ') || 'none detected'}
- Thinking patterns: ${data.patterns.slice(0, 3).map(p => `${p.name} (${p.count}x)`).join(', ') || 'none detected'}
- Day-of-week moods: ${data.dayOfWeek.filter(d => d.count > 0).map(d => `${d.day}: ${d.avgMood}`).join(', ') || 'N/A'}
- Topics: ${data.topics.slice(0, 5).map(t => t.name).join(', ') || 'N/A'}
- Total days: ${data.summary.totalDays}, Total messages: ${data.summary.totalMessages}

Return JSON only:
{
  "insights": ["insight 1", "insight 2", "insight 3"],
  "interventions": [
    {"type": "cognitive|behavioral|support", "title": "short title", "description": "1-2 sentence actionable advice", "reason": "brief explanation of what triggered this"}
  ]
}

Rules:
- Generate 2-4 insights that are specific, data-driven observations (not generic advice)
- Use conversational tone: "Your mood dips on Wednesdays" not "The user's mood decreases"
- Include percentage or numerical references when possible
- For interventions: only generate 1-3, only when patterns suggest they'd help
- cognitive = mindset/thinking exercises, behavioral = action challenges, support = seek help suggestions
- If data is limited (< 3 days), keep insights brief and skip interventions`;

    const res = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Generate insights and interventions based on the data above.' },
      ],
    });

    const raw = res.choices[0]?.message?.content || '';
    const cleaned = raw.replace(/```json?\s*|\s*```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      insights: parsed.insights || [],
      interventions: parsed.interventions || [],
    };
  } catch (err) {
    console.error('Failed to generate natural insights:', err);
    return { insights: [], interventions: [] };
  }
}

// ─── Main handler ───

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  const tab = req.nextUrl.searchParams.get('tab') || 'meta';

  if (!userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    // ─── META 分支：获取统计范围的元数据 ───
    if (tab === 'meta') {
      const first = await prisma.dailyInsight.findFirst({
        where: { userId },
        orderBy: { date: 'asc' },
        select: { date: true },
      });
      const totalDays = await prisma.dailyInsight.count({ where: { userId } });
      return Response.json({
        totalDays,
        firstDate: first?.date.toISOString().slice(0, 10) || null,
      });
    }

    // ─── DAILY 分支：获取单日详细报告（包含实时数据） ───
    if (tab === 'daily') {
      // 1. 状态检查：数据脱敏或账号封禁时禁用
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { dataControl: true, restricted: true },
      });
      if (user && (!user.dataControl || user.restricted)) {
        return Response.json({
          tab: 'daily',
          disabled: true,
          reason: user.restricted ? 'account_restricted' : 'data_control_off',
        });
      }

      // 2. 构建可选日期列表 (有历史记录的天数 + 今天)
      const allInsights = await prisma.dailyInsight.findMany({
        where: { userId },
        select: { date: true },
        orderBy: { date: 'desc' },
      });
      const availableDates = [...new Set(allInsights.map(i => i.date.toISOString().slice(0, 10)))];

      // Use client's local date if provided, otherwise fallback to server date
      const clientToday = req.nextUrl.searchParams.get('today');
      const now = new Date();
      const todayStr = clientToday || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const todayStart = new Date(todayStr);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStr);
      todayEnd.setHours(23, 59, 59, 999);

      const todayMsgCount = await prisma.message.count({
        where: {
          conversation: { userId },
          createdAt: { gte: todayStart, lte: todayEnd },
        },
      });
      if (todayMsgCount > 0 && !availableDates.includes(todayStr)) {
        availableDates.unshift(todayStr);
      }

      const dateParam = req.nextUrl.searchParams.get('date');
      const selectedDate = dateParam || todayStr;
      const selStart = new Date(selectedDate);
      selStart.setHours(0, 0, 0, 0);
      const selEnd = new Date(selectedDate);
      selEnd.setHours(23, 59, 59, 999);
      const isToday = selectedDate === todayStr;

      // 3. 按小时聚合消息活跃度 (Hourly Activity)
      const dayMessages = await prisma.message.findMany({
        where: {
          conversation: { userId },
          createdAt: { gte: selStart, lte: selEnd },
        },
        select: { role: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });

      const hourlyData: { hour: number; label: string; userMessages: number; aiMessages: number; total: number }[] = [];
      for (let h = 0; h < 24; h++) {
        const msgs = dayMessages.filter(m => m.createdAt.getHours() === h);
        const userMsgs = msgs.filter(m => m.role === 'user').length;
        const aiMsgs = msgs.filter(m => m.role === 'assistant').length;
        hourlyData.push({
          hour: h,
          label: `${String(h).padStart(2, '0')}:00`,
          userMessages: userMsgs,
          aiMessages: aiMsgs,
          total: userMsgs + aiMsgs,
        });
      }

      // 4. 实时数据与历史存档的并集处理
      if (isToday) {
        // 如果查询的是今天，尝试从最新消息中提取分析结果
        const todayConvMessages = await prisma.message.findMany({
          where: {
            conversation: { userId },
            createdAt: { gte: selStart, lte: selEnd },
            role: 'user',
          },
          select: { content: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        });

        const totalAllMsgs = dayMessages.length;
        const activeHours = hourlyData.filter(h => h.total > 0);

        // 如果 Cron 任务已经生成了今日的初步总结，则展示该存档数据
        const existingInsight = await prisma.dailyInsight.findFirst({
          where: { userId, date: { gte: selStart, lte: selEnd } },
          orderBy: { date: 'desc' },
        });

        let insightData = null;
        if (existingInsight) {
          let parsedTopics: string[] = [];
          if (existingInsight.topics) {
            try { parsedTopics = JSON.parse(existingInsight.topics); } catch { /* skip */ }
          }
          insightData = {
            mood: existingInsight.mood,
            moodScore: existingInsight.moodScore,
            emotionIntensity: existingInsight.emotionIntensity,
            triggerEvent: existingInsight.triggerEvent,
            thinkingPattern: existingInsight.thinkingPattern,
            behavioralResponse: existingInsight.behavioralResponse,
            topics: parsedTopics,
            emotionalState: existingInsight.emotionalState,
            summary: existingInsight.summary,
          };
        }

        return Response.json({
          tab: 'daily',
          hasData: totalAllMsgs > 0,
          disabled: false,
          isRealTime: true, // 标记为实时视图
          selectedDate,
          availableDates,
          hourlyData,
          realTime: {
            totalMessages: totalAllMsgs,
            userMessages: todayConvMessages.length,
            peakHour: activeHours.length > 0 ? activeHours.reduce((a, b) => a.total > b.total ? a : b).label : null,
          },
          insight: insightData,
        });
      }

      // 历史档案处理
      const insight = await prisma.dailyInsight.findFirst({
        where: { userId, date: { gte: selStart, lte: selEnd } },
        orderBy: { date: 'desc' },
      });

      if (!insight) {
        return Response.json({
          tab: 'daily',
          hasData: false,
          disabled: false,
          isRealTime: false,
          selectedDate,
          availableDates,
          hourlyData,
          insight: null,
        });
      }

      let parsedTopics: string[] = [];
      if (insight.topics) {
        try { parsedTopics = JSON.parse(insight.topics); } catch { /* skip */ }
      }

      return Response.json({
        tab: 'daily',
        hasData: true,
        selectedDate,
        availableDates,
        hourlyData,
        insight: {
          mood: insight.mood,
          moodScore: insight.moodScore,
          emotionIntensity: insight.emotionIntensity,
          triggerEvent: insight.triggerEvent,
          thinkingPattern: insight.thinkingPattern,
          behavioralResponse: insight.behavioralResponse,
          topics: parsedTopics,
          emotionalState: insight.emotionalState,
          summary: insight.summary,
          messageCount: insight.messageCount,
        },
      });
    }

    // ─── 3DAY 分支：过去三天的局部聚合分析 ───
    if (tab === '3day') {
      const endDate = new Date();
      const startDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      const insights = await prisma.dailyInsight.findMany({
        where: { userId, date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'asc' },
      });

      if (insights.length === 0) {
        return Response.json({ tab: '3day', available: false, daysUntilAvailable: 1 });
      }

      const data = aggregateInsights(insights);
      const { insights: naturalInsights, interventions } = await generateNaturalInsights(data);
      data.naturalInsights = naturalInsights;
      data.interventions = interventions;

      return Response.json({
        tab: '3day',
        available: true,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        data,
      });
    }

    // ─── WEEKLY 分支：周度报告，支持按周索引切换 ───
    if (tab === 'weekly') {
      const totalDays = await prisma.dailyInsight.count({ where: { userId } });
      if (totalDays < 7) {
        return Response.json({
          tab: 'weekly',
          available: false,
          daysUntilAvailable: 7 - totalDays,
        });
      }

      const first = await prisma.dailyInsight.findFirst({
        where: { userId },
        orderBy: { date: 'asc' },
        select: { date: true },
      });
      if (!first) {
        return Response.json({ tab: 'weekly', available: false, daysUntilAvailable: 7 });
      }

      const firstDate = new Date(first.date);
      firstDate.setHours(0, 0, 0, 0);
      const now = new Date();
      now.setHours(23, 59, 59, 999);

      const elapsed = Math.floor((now.getTime() - firstDate.getTime()) / (24 * 60 * 60 * 1000));
      const totalWeeks = Math.max(1, Math.ceil(elapsed / 7));

      const availableWeeks: { index: number; label: string; startDate: string; endDate: string }[] = [];
      for (let w = 0; w < totalWeeks; w++) {
        const weekStart = new Date(firstDate.getTime() + w * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
        if (weekEnd > now) weekEnd.setTime(now.getTime());
        availableWeeks.push({
          index: w,
          label: `${weekStart.toISOString().slice(5, 10)} — ${weekEnd.toISOString().slice(5, 10)}`,
          startDate: weekStart.toISOString().slice(0, 10),
          endDate: weekEnd.toISOString().slice(0, 10),
        });
      }
      availableWeeks.reverse();

      const weekIndex = parseInt(req.nextUrl.searchParams.get('weekIndex') || '0');
      const selected = availableWeeks[weekIndex] || availableWeeks[0];

      const weekStartDate = new Date(selected.startDate);
      const weekEndDate = new Date(selected.endDate);
      weekEndDate.setHours(23, 59, 59, 999);

      const insights = await prisma.dailyInsight.findMany({
        where: {
          userId,
          date: { gte: weekStartDate, lte: weekEndDate },
        },
        orderBy: { date: 'asc' },
      });

      const data = aggregateInsights(insights);
      const { insights: naturalInsights, interventions } = await generateNaturalInsights(data);
      data.naturalInsights = naturalInsights;
      data.interventions = interventions;

      return Response.json({
        tab: 'weekly',
        available: true,
        availableWeeks,
        selectedWeek: selected,
        data,
      });
    }

    // ─── 15-DAY 分支：半月度趋势分析 ───
    if (tab === '15day') {
      const totalDays = await prisma.dailyInsight.count({ where: { userId } });
      if (totalDays < 15) {
        return Response.json({
          tab: '15day',
          available: false,
          daysUntilAvailable: 15 - totalDays,
        });
      }

      const first = await prisma.dailyInsight.findFirst({
        where: { userId },
        orderBy: { date: 'asc' },
        select: { date: true },
      });

      const startParam = req.nextUrl.searchParams.get('startDate');
      const endParam = req.nextUrl.searchParams.get('endDate');

      let startDate: Date;
      let endDate: Date;

      if (startParam && endParam) {
        startDate = new Date(startParam);
        endDate = new Date(endParam);
      } else {
        endDate = new Date();
        startDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      }
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      const insights = await prisma.dailyInsight.findMany({
        where: {
          userId,
          date: { gte: startDate, lte: endDate },
        },
        orderBy: { date: 'asc' },
      });

      const data = aggregateInsights(insights);
      const { insights: naturalInsights, interventions } = await generateNaturalInsights(data);
      data.naturalInsights = naturalInsights;
      data.interventions = interventions;

      return Response.json({
        tab: '15day',
        available: true,
        earliestDate: first?.date.toISOString().slice(0, 10) || null,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        data,
      });
    }

    // ─── MONTHLY 分支：月度报告，支持跨月份选择 ───
    if (tab === 'monthly') {
      const allInsights = await prisma.dailyInsight.findMany({
        where: { userId },
        select: { date: true },
        orderBy: { date: 'asc' },
      });

      const monthSet = new Set<string>();
      for (const i of allInsights) monthSet.add(i.date.toISOString().slice(0, 7));
      const availableMonths = [...monthSet].sort().reverse().map(m => {
        const [y, mo] = m.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return { value: m, label: `${monthNames[parseInt(mo) - 1]} ${y}` };
      });

      if (availableMonths.length === 0) return Response.json({ tab: 'monthly', availableMonths: [], selectedMonth: null, data: null });

      const monthParam = req.nextUrl.searchParams.get('month') || availableMonths[0].value;
      const [year, month] = monthParam.split('-').map(Number);
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

      const insights = await prisma.dailyInsight.findMany({
        where: {
          userId,
          date: { gte: monthStart, lte: monthEnd },
        },
        orderBy: { date: 'asc' },
      });

      const data = aggregateInsights(insights);
      const { insights: naturalInsights, interventions } = await generateNaturalInsights(data);
      data.naturalInsights = naturalInsights;
      data.interventions = interventions;

      return Response.json({
        tab: 'monthly',
        availableMonths,
        selectedMonth: monthParam,
        data,
      });
    }

    return Response.json({ error: 'Invalid tab parameter' }, { status: 400 });
  } catch (error) {
    console.error('Insights API error:', error);
    return Response.json({ error: 'Failed to load insights' }, { status: 500 });
  }
}
