import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const FALLBACK_CHALLENGES = [
    { text: "Take a 5-minute walk without your phone.", type: "physical", difficulty: "easy" },
    { text: "Write down 3 things you are grateful for.", type: "gratitude", difficulty: "easy" },
    { text: "Drink a glass of water right now.", type: "physical", difficulty: "easy" },
    { text: "Send a kind message to a friend.", type: "social", difficulty: "medium" },
    { text: "Take 5 deep breaths.", type: "mindfulness", difficulty: "easy" },
    { text: "Listen to your favorite song.", type: "mindfulness", difficulty: "easy" },
    { text: "Stretch for 2 minutes.", type: "physical", difficulty: "easy" },
    { text: "Compliment someone today.", type: "social", difficulty: "medium" },
    { text: "Read 5 pages of a book.", type: "mindfulness", difficulty: "medium" },
    { text: "Declutter one small area of your room.", type: "mindfulness", difficulty: "medium" },
];

/**
 * Generate a personalized challenge using GPT, based on the user's profile,
 * interests, recent mood, and past challenges.
 */
async function generatePersonalizedChallenge(
    userProfile: { memory?: string | null; profile?: string | null },
    recentInsights: { mood?: string | null; topics?: string | null; emotionalState?: string | null }[],
    recentChallengeTexts: string[]
): Promise<{ text: string; type: string; difficulty: string } | null> {
    try {
        // Build context from user data
        const profileInfo = userProfile.profile
            ? `User interests/profile: ${userProfile.profile}`
            : '';
        const memoryInfo = userProfile.memory
            ? `What we know about this user: ${userProfile.memory}`
            : '';

        const moodInfo = recentInsights.length > 0
            ? `Recent emotional patterns:\n${recentInsights.map(i =>
                `- Mood: ${i.mood || 'unknown'}, Topics: ${i.topics || 'none'}, State: ${i.emotionalState || 'unknown'}`
            ).join('\n')}`
            : '';

        const pastChallenges = recentChallengeTexts.length > 0
            ? `Recently completed challenges (avoid repeating):\n${recentChallengeTexts.map(t => `- ${t}`).join('\n')}`
            : '';

        const prompt = `Generate ONE personalized daily wellness challenge for this user.

${profileInfo}
${memoryInfo}
${moodInfo}
${pastChallenges}

Rules:
- The challenge should be SPECIFIC and personalized to the user's interests, hobbies, or emotional needs
- It should be realistic and achievable TODAY
- If the user seems stressed or anxious, lean toward calming/mindfulness challenges
- If the user has specific hobbies (gaming, cooking, music, etc.), incorporate them naturally
- Vary the type: mindfulness, physical, social, gratitude, creative, or learning
- Keep it to 1-2 sentences, warm and encouraging tone
- Do NOT repeat any recently completed challenges

Respond in this exact JSON format (no markdown, no code fences):
{"text": "the challenge description", "type": "mindfulness|physical|social|gratitude|creative|learning", "difficulty": "easy|medium|hard"}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.8,
            max_tokens: 200,
        });

        const content = response.choices[0]?.message?.content?.trim();
        if (!content) return null;

        const parsed = JSON.parse(content);
        if (parsed.text && parsed.type && parsed.difficulty) {
            return parsed;
        }
        return null;
    } catch (error) {
        console.error('Failed to generate personalized challenge:', error);
        return null;
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check if user already has a challenge for today (completed or assigned)
        const existingCompletion = await prisma.userChallenge.findFirst({
            where: {
                userId,
                completedAt: { gte: today },
            },
            include: { challenge: true },
        });

        if (existingCompletion) {
            return NextResponse.json({
                challenge: existingCompletion.challenge,
                completed: true,
            });
        }

        // Check if we already generated a challenge for today (stored in DB)
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        const todaysGenerated = await prisma.dailyChallenge.findFirst({
            where: {
                createdAt: { gte: today, lte: todayEnd },
                completions: { some: { userId } },
            },
        });

        // If we already assigned one today but it wasn't completed, find it
        // We use a naming convention: challenges with text starting with "[user:" are personalized
        const personalizedToday = await prisma.dailyChallenge.findFirst({
            where: {
                text: { startsWith: `[user:${userId}]` },
                createdAt: { gte: today, lte: todayEnd },
            },
        });

        if (personalizedToday) {
            return NextResponse.json({
                challenge: {
                    ...personalizedToday,
                    // Strip the user tag from display text
                    text: personalizedToday.text.replace(`[user:${userId}]`, '').trim(),
                },
                completed: false,
            });
        }

        // Fetch user data for personalization
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { memory: true, profile: true },
        });

        // Fetch recent mood/emotional data (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const recentInsights = await prisma.dailyInsight.findMany({
            where: { userId, date: { gte: weekAgo } },
            select: { mood: true, topics: true, emotionalState: true },
            orderBy: { date: 'desc' },
            take: 5,
        });

        // Fetch recently completed challenge texts (last 14 days) to avoid repeats
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        const recentCompletions = await prisma.userChallenge.findMany({
            where: { userId, completedAt: { gte: twoWeeksAgo } },
            include: { challenge: true },
            orderBy: { completedAt: 'desc' },
            take: 10,
        });
        const recentChallengeTexts = recentCompletions.map(c => c.challenge.text);

        // Try AI-generated personalized challenge
        const aiChallenge = await generatePersonalizedChallenge(
            user || {},
            recentInsights,
            recentChallengeTexts
        );

        if (aiChallenge) {
            // Store in DB so same challenge is returned all day
            const stored = await prisma.dailyChallenge.create({
                data: {
                    text: `[user:${userId}]${aiChallenge.text}`,
                    type: aiChallenge.type,
                    difficulty: aiChallenge.difficulty,
                },
            });

            return NextResponse.json({
                challenge: {
                    ...stored,
                    text: aiChallenge.text, // Clean display text
                },
                completed: false,
            });
        }

        // Fallback: use predefined challenges if AI generation fails
        // Ensure fallback challenges exist in DB
        const count = await prisma.dailyChallenge.count({
            where: { text: { not: { startsWith: '[user:' } } },
        });
        if (count === 0) {
            await prisma.dailyChallenge.createMany({ data: FALLBACK_CHALLENGES });
        }

        const genericChallenges = await prisma.dailyChallenge.findMany({
            where: { text: { not: { startsWith: '[user:' } } },
        });
        const userHash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
        const index = (userHash + dayOfYear) % genericChallenges.length;

        return NextResponse.json({
            challenge: genericChallenges[index],
            completed: false,
        });

    } catch (error) {
        console.error('Error fetching challenge:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const { userId, challengeId } = await req.json();

    if (!userId || !challengeId) {
        return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    try {
        // Check if already completed today to prevent double counting
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existing = await prisma.userChallenge.findFirst({
            where: { userId, challengeId, completedAt: { gte: today } }
        });

        if (existing) {
            return NextResponse.json({ success: true, alreadyCompleted: true });
        }

        await prisma.userChallenge.create({
            data: {
                userId,
                challengeId,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error completing challenge:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
