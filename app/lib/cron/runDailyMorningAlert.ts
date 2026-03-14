import { prisma } from '@/app/lib/db';
import { fetchForecast, detectRainToday } from '@/app/lib/weather';
import { sendPushNotification } from '@/app/lib/onesignal';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Calculate the target notification time for a user:
 * - Default: 07:00
 * - If user has `departureTime`: 15 minutes before that
 *
 * Returns { hour, minute } to be matched against the user's local time.
 */
function getNotifyTime(departureTime: string | null): { hour: number; minute: number } {
    const DEFAULT_HOUR = 7;
    const DEFAULT_MINUTE = 0;

    if (!departureTime) return { hour: DEFAULT_HOUR, minute: DEFAULT_MINUTE };

    const parts = departureTime.split(':');
    if (parts.length !== 2) return { hour: DEFAULT_HOUR, minute: DEFAULT_MINUTE };

    let depHour = parseInt(parts[0], 10);
    let depMinute = parseInt(parts[1], 10);
    if (isNaN(depHour) || isNaN(depMinute)) return { hour: DEFAULT_HOUR, minute: DEFAULT_MINUTE };

    // Subtract 15 minutes
    depMinute -= 15;
    if (depMinute < 0) {
        depMinute += 60;
        depHour -= 1;
        if (depHour < 0) depHour = 23;
    }

    return { hour: depHour, minute: depMinute };
}

/**
 * Check if the user's current local time is within a 15-minute window for the target time.
 */
function isInNotifyWindow(userLocalTimeMs: number, targetHour: number, targetMinute: number): boolean {
    const userDate = new Date(userLocalTimeMs);
    const currentMinutes = userDate.getUTCHours() * 60 + userDate.getUTCMinutes();
    const targetMinutes = targetHour * 60 + targetMinute;

    // Within a 15-minute window
    return currentMinutes >= targetMinutes && currentMinutes < targetMinutes + 15;
}

async function generateWarmWeatherMessage(
    city: string,
    isRainy: boolean,
    rainPeriods: string,
    language: string,
    nickname: string
) {
    const prompt = `You are a warm, caring, and loving AI companion. Your user, ${nickname}, lives in ${city}.
${isRainy ? `There will be rain today at these times: ${rainPeriods}. Remind them affectionately to carry an umbrella.` : 'It is sunny or cloudy today with no major rain. Remind them affectionately to wear sunscreen or stay hydrated.'}
Write a short, heartfelt, and very sweet push notification message (maximum 60-80 chars) to wish them a good morning and give them the weather reminder.
The tone should make them feel deeply loved, cared for, and warm at first sight. 
Respond ONLY with the notification text in ${language === 'zh' ? 'Simplified Chinese' : 'English'}. No quotes, no extra text, no robotic greetings.`;

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'system', content: prompt }],
            temperature: 0.8,
            max_tokens: 150,
        });
        return completion.choices[0].message?.content?.trim() || '';
    } catch (error) {
        console.error('Failed to generate AI weather message:', error);
        return isRainy
            ? (language === 'zh' ? `早安 ${nickname}💕 今天${city}会下雨，出门记得带伞，别让自己淋湿了哦~` : `Good morning ${nickname}💕 It will rain in ${city} today, please don't forget your umbrella!`)
            : (language === 'zh' ? `早安 ${nickname}☀️ 今天${city}天气不错，记得涂防晒，愿你有一整天的好心情！` : `Good morning ${nickname}☀️ Beautiful day in ${city}, remember your sunscreen and have a wonderful day!`);
    }
}

export async function runDailyMorningAlert(): Promise<{ alertsSent: number; usersChecked: number }> {
    const users = await prisma.user.findMany({
        where: {
            city: { not: null },
            subscription: {
                plan: {
                    name: {
                        in: ['pro', 'premium']
                    }
                }
            }
        },
        select: {
            id: true,
            city: true,
            nickname: true,
            departureTime: true,
            language: true,
            pushSubscription: true,
        },
    });

    let alertCount = 0;

    for (const user of users) {
        if (!user.city) continue;

        const forecastData = await fetchForecast(user.city);
        if (!forecastData) continue;

        const { list: forecastList, timezone } = forecastData;

        // Calculate user's current local time to define "Today"
        const userLocalTimeMs = Date.now() + timezone * 1000;

        // Skip if already alerted today (based on user's timezone)
        const userDate = new Date(userLocalTimeMs);
        userDate.setUTCHours(0, 0, 0, 0);
        const todayStartUTC = new Date(userDate.getTime() - timezone * 1000);

        const existing = await prisma.notification.findFirst({
            where: {
                userId: user.id,
                type: 'morning_alert',
                createdAt: { gte: todayStartUTC },
            },
        });
        if (existing) continue;

        const rainInfo = detectRainToday(forecastList);
        const rainSummary = rainInfo.rainPeriods.map(p => p.time).join(', ');

        const lang = user.language || 'en';
        const nickname = user.nickname || 'My friend';

        // Generate AI Message
        const pushBody = await generateWarmWeatherMessage(
            user.city,
            rainInfo.willRain,
            rainSummary,
            lang,
            nickname
        );

        // Provide a localized title
        const morningTitles: Record<string, { rain: string; sun: string }> = {
            en: { rain: `🌧️ Good morning, ${nickname}`, sun: `☀️ Good morning, ${nickname}` },
            zh: { rain: `🌧️ 早安，${nickname}`, sun: `☀️ 早安，${nickname}` },
            es: { rain: `🌧️ Buenos días, ${nickname}`, sun: `☀️ Buenos días, ${nickname}` },
            ja: { rain: `🌧️ おはよう、${nickname}`, sun: `☀️ おはよう、${nickname}` },
            ko: { rain: `🌧️ 좋은 아침, ${nickname}`, sun: `☀️ 좋은 아침, ${nickname}` },
            ms: { rain: `🌧️ Selamat pagi, ${nickname}`, sun: `☀️ Selamat pagi, ${nickname}` },
        };
        const titleSet = morningTitles[lang] || morningTitles['en'];
        const title = rainInfo.willRain ? titleSet.rain : titleSet.sun;

        // Save notification to DB
        await prisma.notification.create({
            data: {
                userId: user.id,
                type: 'morning_alert',
                title,
                message: pushBody,
                data: JSON.stringify({
                    city: user.city,
                    rain: rainInfo.willRain,
                }),
            },
        });

        // Send via OneSignal
        if (user.pushSubscription === 'onesignal') {
            try {
                await sendPushNotification([user.id], title, pushBody, '/chat');
            } catch (pushErr) {
                console.warn(`Morning alert push failed for user ${user.id}:`, pushErr);
            }
        }

        alertCount++;
        console.log(`Morning alert sent to ${user.nickname} (${user.id}) — city: ${user.city}`);
    }

    return { alertsSent: alertCount, usersChecked: users.length };
}
