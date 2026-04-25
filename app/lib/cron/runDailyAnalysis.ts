import OpenAI from 'openai';
import { prisma } from '@/app/lib/db';

function getOpenAIClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');
    return new OpenAI({ apiKey });
}

export async function runDailyAnalysis() {
    const users = await prisma.user.findMany({
        include: {
            conversations: {
                where: {
                    updatedAt: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
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
    const results: { userId: string; nickname: string; messageCount: number; mood?: string }[] = [];

    for (const user of users) {
        if (user.conversations.length === 0) continue;

        const allMessages = user.conversations.flatMap((c) =>
            c.messages.map((m) => `[${m.role}]: ${m.content}`)
        );

        if (allMessages.length === 0) continue;

        const existingMemory = user.memory || 'No existing memory.';

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

Format your response exactly like this:
---DAILY_SUMMARY---
[daily summary here]
---UPDATED_MEMORY---
[updated memory here]
---STRUCTURED_DATA---
{"mood":"<one word from: happy, excited, grateful, calm, neutral, stressed, anxious, sad, angry, lonely>","moodScore":<1-10>,"topics":["<topic1>","<topic2>",...],"emotionalState":"<brief description>"}`,
                },
                {
                    role: 'user',
                    content: `Today's conversations (${allMessages.length} messages):\n\n${allMessages.join('\n')}`,
                },
            ],
        });

        const output = res.choices[0]?.message?.content || '';

        const summaryMatch = output.match(
            /---DAILY_SUMMARY---\s*([\s\S]*?)---UPDATED_MEMORY---/
        );
        const memoryMatch = output.match(
            /---UPDATED_MEMORY---\s*([\s\S]*?)(?:---STRUCTURED_DATA---|$)/
        );
        const structuredMatch = output.match(
            /---STRUCTURED_DATA---\s*([\s\S]*)/
        );

        const dailySummary = summaryMatch?.[1]?.trim() || '';
        const updatedMemory = memoryMatch?.[1]?.trim() || '';

        let structured: {
            mood?: string;
            moodScore?: number;
            topics?: string[];
            emotionalState?: string;
        } = {};
        if (structuredMatch?.[1]) {
            try {
                const jsonStr = structuredMatch[1]
                    .trim()
                    .replace(/```json?\s*|\s*```/g, '');
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

        await prisma.dailyInsight.create({
            data: {
                userId: user.id,
                summary: dailySummary || null,
                mood: structured.mood || null,
                moodScore: structured.moodScore
                    ? Math.min(10, Math.max(1, structured.moodScore))
                    : null,
                topics: structured.topics
                    ? JSON.stringify(structured.topics)
                    : null,
                emotionalState: structured.emotionalState || null,
                messageCount: allMessages.length,
            },
        });

        // Generate conversation summaries for those without one
        for (const conv of user.conversations) {
            if (!conv.summary && conv.messages.length > 0) {
                const convMessages = conv.messages
                    .map((m) => `[${m.role}]: ${m.content}`)
                    .join('\n');
                const summaryRes = await openai.chat.completions.create({
                    model: 'gpt-4.1-mini',
                    messages: [
                        {
                            role: 'system',
                            content: 'Summarize this conversation in 2-3 sentences.',
                        },
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

        results.push({
            userId: user.id,
            nickname: user.nickname,
            messageCount: allMessages.length,
            mood: structured.mood,
        });
        processedCount++;
        console.log(
            `Daily analysis processed for user: ${user.nickname} (${user.id})`
        );
    }

    return {
        ok: true,
        processedUsers: processedCount,
        totalUsers: users.length,
        results,
        timestamp: new Date().toISOString(),
    };
}
