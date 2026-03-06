import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/app/lib/db';

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  return new OpenAI({ apiKey });
}

/**
 * GET /api/cron/daily-summary
 * Cron Job: Runs daily (e.g., 12:00 PM) to summarize user activity.
 *
 * Logic:
 * 1. Fetches conversations from the last 24 hours.
 * 2. Uses OpenAI to generate a daily summary and update long-term memory.
 * 3. Extracts structured data (mood, topics) for usage in Growth/Proactive modules.
 * 4. Respects `dataControl` (unless Safe Mode crisis is active).
 *
 * Trigger: External Cron Service
 * Services: OpenAI, Prisma
 */
export async function GET(req: NextRequest) {
  // Simple auth check
  const cronSecret = process.env.CRON_SECRET;
  const key = req.nextUrl.searchParams.get('key');
  if (cronSecret && key !== cronSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      include: {
        conversations: {
          where: {
            updatedAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // last 24h
            },
          },
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    const openai = getOpenAIClient();
    let processedCount = 0;

    for (const user of users) {
      // Skip users with no activity in last 24h
      if (user.conversations.length === 0) continue;

      // Respect dataControl setting — skip users who opted out
      // Exception: users with an open crisis event (riskLevel >= 2) are always processed for safety
      if (!user.dataControl) {
        const hasCriticalCrisis = await prisma.crisisEvent.findFirst({
          where: {
            userId: user.id,
            riskLevel: { gte: 2 },
            status: { in: ['open', 'escalated'] },
          },
        });
        if (!hasCriticalCrisis) {
          console.log(`Skipping user ${user.nickname} (${user.id}) — dataControl disabled`);
          continue;
        }
        console.log(`Processing user ${user.nickname} (${user.id}) despite dataControl=off — active crisis event`);
      }

      const allMessages = user.conversations.flatMap(c =>
        c.messages.map(m => `[${m.role}]: ${m.content}`)
      );

      if (allMessages.length === 0) continue;

      const existingMemory = user.memory || 'No existing memory.';

      // Generate daily analysis
      const res = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `You are a user analysis AI. Analyze today's conversations for user "${user.nickname}" and produce three outputs:

1. DAILY SUMMARY: A brief summary of today's interactions including:
   - Overall mood throughout the day
   - Key topics discussed
   - Important events or facts shared
   - Emotional state changes
   - Any requests or needs expressed

2. UPDATED MEMORY: Merge new insights with existing long-term memory.

3. STRUCTURED DATA: A JSON object with extracted analytics fields.

Existing long-term memory:
${existingMemory}

Rules:
- Keep the memory concise (max 600 words)
- Preserve important old facts, update outdated ones
- Track: communication style, interests, life events, goals, emotional patterns, preferences
- Note recurring themes and behavioral patterns
- Do NOT store sensitive info like passwords
- CONTENT SAFETY FILTER: Do NOT include or reference any unsafe, illegal, or extreme content in the summary or memory. This includes:
  * Self-harm methods or suicidal content
  * Terrorism, extremism, or radicalization content
  * Hate speech, racial slurs, or discriminatory language targeting any group
  * Violence against others, threats, or violent ideation
  * Illegal activities (drug manufacturing, trafficking, exploitation, hacking instructions)
  * Explicit sexual content or child exploitation references
  Skip these messages entirely. Only retain safe, constructive, and approved conversational insights.
- FLAG EXTREME CONTENT: If you encounter messages with extreme speech (terrorism, hate, violence, illegal), note the count in the structured data as "flaggedMessages" (integer count of problematic messages found). Do NOT include the content itself.

Format your response exactly like this:
---DAILY_SUMMARY---
[daily summary here]
---UPDATED_MEMORY---
[updated memory here]
---STRUCTURED_DATA---
{"mood":"<one word mood label e.g. happy/sad/anxious/excited/neutral/stressed/calm/angry/lonely/grateful>","moodScore":<1-10 integer>,"topics":["<topic1>","<topic2>",...],"emotionalState":"<brief 1-2 sentence emotional state description>","flaggedMessages":<integer count of extreme/unsafe messages found, 0 if none>,"triggerEvent":"<what caused the primary emotion today, e.g. 'argument with partner', 'work deadline', 'loneliness', null if unclear>","thinkingPattern":"<dominant cognitive pattern if negative: catastrophizing/all-or-nothing/mind-reading/overgeneralization/personalization/filtering/emotional-reasoning/should-statements, null if none detected>","behavioralResponse":"<how user responded: withdrawal/venting/seeking-advice/avoidance/rumination/problem-solving/social-support/distraction, null if unclear>","emotionIntensity":<1-10 how intensely the emotion was expressed, null if unclear>}`,
          },
          {
            role: 'user',
            content: `Today's conversations (${allMessages.length} messages):\n\n${allMessages.join('\n')}`,
          },
        ],
      });

      const output = res.choices[0]?.message?.content || '';

      // Parse the three sections
      const summaryMatch = output.match(/---DAILY_SUMMARY---\s*([\s\S]*?)---UPDATED_MEMORY---/);
      const memoryMatch = output.match(/---UPDATED_MEMORY---\s*([\s\S]*?)(?:---STRUCTURED_DATA---|$)/);
      const structuredMatch = output.match(/---STRUCTURED_DATA---\s*([\s\S]*)/);

      const dailySummary = summaryMatch?.[1]?.trim() || '';
      const updatedMemory = memoryMatch?.[1]?.trim() || '';

      // Parse structured data
      let structured: { mood?: string; moodScore?: number; topics?: string[]; emotionalState?: string; triggerEvent?: string; thinkingPattern?: string; behavioralResponse?: string; emotionIntensity?: number } = {};
      if (structuredMatch?.[1]) {
        try {
          const jsonStr = structuredMatch[1].trim().replace(/```json?\s*|\s*```/g, '');
          structured = JSON.parse(jsonStr);
        } catch {
          console.warn(`Failed to parse structured data for user ${user.id}`);
        }
      }

      if (updatedMemory) {
        await prisma.user.update({
          where: { id: user.id },
          data: { memory: updatedMemory },
        });
      }

      // Store daily insight
      await prisma.dailyInsight.create({
        data: {
          userId: user.id,
          summary: dailySummary || null,
          mood: structured.mood || null,
          moodScore: structured.moodScore ? Math.min(10, Math.max(1, structured.moodScore)) : null,
          topics: structured.topics ? JSON.stringify(structured.topics) : null,
          emotionalState: structured.emotionalState || null,
          messageCount: allMessages.length,
          triggerEvent: structured.triggerEvent || null,
          thinkingPattern: structured.thinkingPattern || null,
          behavioralResponse: structured.behavioralResponse || null,
          emotionIntensity: structured.emotionIntensity ? Math.min(10, Math.max(1, structured.emotionIntensity)) : null,
        },
      });

      // Update conversation summaries for conversations that don't have one yet
      for (const conv of user.conversations) {
        if (!conv.summary && conv.messages.length > 0) {
          const convMessages = conv.messages.map(m => `[${m.role}]: ${m.content}`).join('\n');
          const summaryRes = await openai.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages: [
              { role: 'system', content: 'Summarize this conversation in 2-3 sentences.' },
              { role: 'user', content: convMessages },
            ],
          });
          const summary = summaryRes.choices[0]?.message?.content || '';
          if (summary) {
            await prisma.conversation.update({
              where: { id: conv.id },
              data: { summary },
            });
          }
        }
      }

      processedCount++;
      console.log(`Daily summary processed for user: ${user.nickname} (${user.id})`);
    }

    return Response.json({
      ok: true,
      processedUsers: processedCount,
      totalUsers: users.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Daily summary cron error:', error);
    return Response.json(
      { error: 'Daily summary failed' },
      { status: 500 }
    );
  }
}
