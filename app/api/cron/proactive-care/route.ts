import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import webpush from 'web-push';
import { prisma } from '@/app/lib/db';
import { getPersonaDefinition } from '@/app/lib/ai/personaPrompts';

function getOpenAIClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');
    return new OpenAI({ apiKey });
}

// Initialize web-push
const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

if (publicVapidKey && privateVapidKey) {
    webpush.setVapidDetails(
        'mailto:admin@friendai.com',
        publicVapidKey,
        privateVapidKey
    );
}

/**
 * GET /api/cron/proactive-care
 * Cron Job: Runs every 6 hours to detect distress signals.
 *
 * Logic:
 * 1. Checks for triggers: Declining mood (3 days), High Intensity, Inactivity, Recurring Triggers.
 * 2. If triggered, generates a warm, persona-based check-in message via OpenAI.
 * 3. Sends Push Notification via WebPush.
 *
 * Trigger: External Cron Service
 * Services: OpenAI, Prisma, WebPush
 */
export async function GET(req: NextRequest) {
    const cronSecret = process.env.CRON_SECRET;
    const key = req.nextUrl.searchParams.get('key');
    if (cronSecret && key !== cronSecret) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Find users with push notifications enabled and data control on
        const users = await prisma.user.findMany({
            where: {
                dataControl: true,
                pushSubscription: { not: null },
                // Only check users we haven't messaged in the last 24h
                OR: [
                    { lastProactiveCareAt: null },
                    { lastProactiveCareAt: { lt: oneDayAgo } },
                ],
            },
            include: {
                dailyInsights: {
                    where: { date: { gte: sevenDaysAgo } },
                    orderBy: { date: 'desc' },
                    take: 7,
                },
                conversations: {
                    orderBy: { updatedAt: 'desc' },
                    take: 1,
                    select: { updatedAt: true },
                },
            },
        });

        const openai = getOpenAIClient();
        let sentCount = 0;

        for (const user of users) {
            // ─── Determine trigger conditions ───
            const triggers: string[] = [];
            const insights = user.dailyInsights;

            // 1. Mood declining 3+ days
            const recentMoods = insights
                .filter(i => i.moodScore !== null)
                .map(i => i.moodScore!);
            if (recentMoods.length >= 3) {
                const isDecline = recentMoods.every((score, idx) => {
                    if (idx === 0) return true;
                    return score <= recentMoods[idx - 1]; // sorted desc by date
                });
                if (isDecline && recentMoods[0] <= 5) {
                    triggers.push(`mood_declining: mood has dropped to ${recentMoods[0]}/10 over ${recentMoods.length} days`);
                }
            }

            // 2. High emotion intensity in recent insight
            const latestInsight = insights[0];
            if (latestInsight?.emotionIntensity && latestInsight.emotionIntensity >= 8) {
                triggers.push(`high_intensity: emotion intensity at ${latestInsight.emotionIntensity}/10 — ${latestInsight.emotionalState || 'intense emotions'}`);
            }

            // 3. No activity for 3+ days
            const lastActive = user.conversations[0]?.updatedAt;
            if (!lastActive || lastActive < threeDaysAgo) {
                const daysSince = lastActive
                    ? Math.floor((now.getTime() - lastActive.getTime()) / (24 * 60 * 60 * 1000))
                    : 'many';
                triggers.push(`inactivity: no conversations for ${daysSince} days`);
            }

            // 4. Recurring negative trigger
            const triggerEvents = insights
                .map(i => i.triggerEvent)
                .filter(Boolean) as string[];
            const triggerCounts: Record<string, number> = {};
            for (const t of triggerEvents) {
                const key = t.toLowerCase();
                triggerCounts[key] = (triggerCounts[key] || 0) + 1;
            }
            const recurring = Object.entries(triggerCounts).filter(([, count]) => count >= 2);
            if (recurring.length > 0) {
                triggers.push(`recurring_trigger: "${recurring[0][0]}" appeared ${recurring[0][1]} times this week`);
            }

            // Skip if no triggers
            if (triggers.length === 0) continue;

            // ─── Generate personalized check-in message ───
            const persona = getPersonaDefinition(user.persona || 'default');

            try {
                const res = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: `You are "${user.aiName || 'Friend AI'}", a caring AI companion.
Your personality: ${persona.name} — ${persona.description}

Generate a SHORT, warm push notification message (max 120 characters) to check in on the user.
The message should feel like it's from a close friend, NOT a therapist or app.

Rules:
- Use 1-2 emojis naturally
- Be specific to the trigger but NOT clinical (don't say "I noticed your mood score dropped")
- Sound natural and caring, like a text from a best friend
- Match the persona style (${persona.key})
- Address the user by name if it feels natural

Return ONLY the notification message text, nothing else.`,
                        },
                        {
                            role: 'user',
                            content: `User: ${user.nickname}
Trigger conditions: ${triggers.join('; ')}
Recent mood: ${latestInsight?.mood || 'unknown'}
Recent emotional state: ${latestInsight?.emotionalState || 'unknown'}`,
                        },
                    ],
                    max_tokens: 80,
                });

                const message = res.choices[0]?.message?.content?.trim();
                if (!message) continue;

                // Store notification in DB
                await prisma.notification.create({
                    data: {
                        userId: user.id,
                        type: 'proactive_care',
                        title: user.aiName || 'Friend AI',
                        message,
                    },
                });

                // Send push notification
                if (user.pushSubscription) {
                    try {
                        const subscription = JSON.parse(user.pushSubscription);
                        const payload = JSON.stringify({
                            title: user.aiName || 'Friend AI',
                            body: message,
                            url: '/chat',
                        });
                        await webpush.sendNotification(subscription, payload);
                    } catch (pushErr) {
                        console.warn(`Push failed for user ${user.id}:`, pushErr);
                        // Still count as sent — the DB notification exists
                    }
                }

                // Update last proactive care timestamp
                await prisma.user.update({
                    where: { id: user.id },
                    data: { lastProactiveCareAt: now },
                });

                sentCount++;
                console.log(`Proactive care sent to ${user.nickname} (${user.id}) — triggers: ${triggers.map(t => t.split(':')[0]).join(', ')}`);

            } catch (genErr) {
                console.error(`Failed to generate check-in for user ${user.id}:`, genErr);
            }
        }

        return Response.json({
            ok: true,
            sentCount,
            totalChecked: users.length,
            timestamp: now.toISOString(),
        });

    } catch (error) {
        console.error('Proactive care cron error:', error);
        return Response.json({ error: 'Proactive care failed' }, { status: 500 });
    }
}
