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
${isRainy ? `Today's forecast shows rain at these specific times: ${rainPeriods}. You MUST mention the specific time(s) when rain will occur (e.g. "下午6点会下雨" or "around 6pm it will rain"). Remind them affectionately to carry an umbrella.` : 'The FULL DAY forecast shows no significant rain today. It will be mostly sunny or cloudy. Remind them affectionately to wear sunscreen or stay hydrated.'}
Write a short, heartfelt, and very sweet push notification message (maximum 80-100 chars) to wish them a good morning and give them the weather reminder.
IMPORTANT: If there is rain, you MUST include the specific time(s) in your message. Do not just say "it will rain" — say WHEN it will rain.
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

        const rainInfo = detectRainToday(forecastList, timezone);
        const rainSummary = rainInfo.rainPeriods.map(p => `${p.time} (${p.probability}% chance, ${p.description})`).join(', ');

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

        // ─── Schedule Lunch Reminder (12:00 local) ───
        const lunchLocalMs = userDate.getTime() + 12 * 60 * 60 * 1000; // noon in user's local tz
        const lunchUtcMs = lunchLocalMs - timezone * 1000;
        const lunchUtcDate = new Date(lunchUtcMs);

        const lunchTitle = generateScheduledTitle('lunch', lang, nickname);
        const lunchBody = await generateScheduledMessage('lunch', lang, nickname);

        await prisma.notification.create({
            data: {
                userId: user.id,
                type: 'lunch_reminder',
                title: lunchTitle,
                message: lunchBody,
                scheduledFor: lunchUtcDate,
            },
        });

        if (user.pushSubscription === 'onesignal') {
            try {
                await sendPushNotification([user.id], lunchTitle, lunchBody, '/chat', lunchUtcDate);
            } catch (pushErr) {
                console.warn(`Lunch reminder push schedule failed for user ${user.id}:`, pushErr);
            }
        }

        // ─── Schedule Evening Check-in (18:00 local) ───
        const eveningLocalMs = userDate.getTime() + 18 * 60 * 60 * 1000; // 6pm in user's local tz
        const eveningUtcMs = eveningLocalMs - timezone * 1000;
        const eveningUtcDate = new Date(eveningUtcMs);

        const eveningTitle = generateScheduledTitle('evening', lang, nickname);
        const eveningBody = await generateScheduledMessage('evening', lang, nickname);

        await prisma.notification.create({
            data: {
                userId: user.id,
                type: 'evening_checkin',
                title: eveningTitle,
                message: eveningBody,
                scheduledFor: eveningUtcDate,
            },
        });

        if (user.pushSubscription === 'onesignal') {
            try {
                await sendPushNotification([user.id], eveningTitle, eveningBody, '/chat', eveningUtcDate);
            } catch (pushErr) {
                console.warn(`Evening check-in push schedule failed for user ${user.id}:`, pushErr);
            }
        }

        alertCount++;
        console.log(`Morning alert + scheduled lunch/evening sent to ${user.nickname} (${user.id}) — city: ${user.city}`);
    }

    return { alertsSent: alertCount, usersChecked: users.length };
}

// ─── Helpers for Lunch & Evening Notifications ────────────────────

function generateScheduledTitle(type: 'lunch' | 'evening', lang: string, nickname: string): string {
    const titles: Record<string, Record<string, string>> = {
        lunch: {
            en: `🍽️ Lunch time, ${nickname}!`,
            zh: `🍽️ ${nickname}，午餐时间到啦！`,
            es: `🍽️ ¡Hora de comer, ${nickname}!`,
            ja: `🍽️ ${nickname}、ランチタイムだよ！`,
            ko: `🍽️ ${nickname}, 점심 시간이야!`,
            ms: `🍽️ Masa makan tengah hari, ${nickname}!`,
        },
        evening: {
            en: `🌇 End of the day, ${nickname}`,
            zh: `🌇 ${nickname}，辛苦一天了`,
            es: `🌇 Fin del día, ${nickname}`,
            ja: `🌇 ${nickname}、お疲れ様`,
            ko: `🌇 ${nickname}, 오늘 하루 수고했어`,
            ms: `🌇 Tamat hari bekerja, ${nickname}`,
        },
    };
    return titles[type][lang] || titles[type]['en'];
}

async function generateScheduledMessage(type: 'lunch' | 'evening', lang: string, nickname: string): Promise<string> {
    const langName = lang === 'zh' ? 'Simplified Chinese' : lang === 'es' ? 'Spanish' : lang === 'ja' ? 'Japanese' : lang === 'ko' ? 'Korean' : lang === 'ms' ? 'Malay' : 'English';

    const prompts: Record<string, string> = {
        lunch: `You are a warm, caring AI companion. Write a short, sweet lunch reminder for ${nickname} (max 60-80 chars).
Remind them lovingly to eat well and take a break. The tone should feel like a caring best friend.
Respond ONLY in ${langName}. No quotes, no extra text.`,
        evening: `You are a warm, caring AI companion. Write a short, sweet end-of-day message for ${nickname} (max 60-80 chars).
Gently ask how their day went and remind them they did great today. The tone should feel like a caring best friend.
Respond ONLY in ${langName}. No quotes, no extra text.`,
    };

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'system', content: prompts[type] }],
            temperature: 0.8,
            max_tokens: 150,
        });
        return completion.choices[0].message?.content?.trim() || getFallbackMessage(type, lang, nickname);
    } catch {
        return getFallbackMessage(type, lang, nickname);
    }
}

function getFallbackMessage(type: 'lunch' | 'evening', lang: string, nickname: string): string {
    const fallbacks: Record<string, Record<string, string>> = {
        lunch: {
            en: `Hey ${nickname}💕 Time for lunch! Eat something delicious and recharge~`,
            zh: `${nickname}💕 该吃午饭啦！好好吃饭，下午才有力气哦~`,
        },
        evening: {
            en: `Hey ${nickname}🌟 Another day done! How was your day? You did amazing~`,
            zh: `${nickname}🌟 辛苦一天了！今天过得怎么样？你真的很棒哦~`,
        },
    };
    return fallbacks[type][lang] || fallbacks[type]['en'];
}

