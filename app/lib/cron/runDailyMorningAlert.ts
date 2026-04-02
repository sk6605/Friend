import { prisma } from '@/app/lib/db';
import { fetchWeather, fetchForecast, detectRainToday, detectRainTomorrow } from '@/app/lib/weather';
import { sendPushNotification } from '@/app/lib/onesignal';
import { getPersonaPrompt } from '@/app/lib/ai/personaPrompts';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─── Helpers ──────────────────────────────────────────────────────

function getLangName(lang: string): string {
  const map: Record<string, string> = {
    zh: 'Simplified Chinese', es: 'Spanish', ja: 'Japanese',
    ko: 'Korean', ms: 'Malay', en: 'English',
  };
  return map[lang] || 'English';
}

function getSeasonContext(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring — flowers, fresh air, new beginnings';
  if (month >= 6 && month <= 8) return 'summer — hot days, sunshine, staying cool';
  if (month >= 9 && month <= 11) return 'autumn — cool breezes, warm drinks, cozy vibes';
  return 'winter — chilly days, bundling up, hot cocoa weather';
}

function getDateSeed(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Title Generators ──────────────────────────────────────

function getMorningTitle(lang: string, nickname: string, isRainy: boolean): string {
  const titles: Record<string, { rain: string; sun: string }> = {
    en: { rain: `🌧️ Good morning, ${nickname}`, sun: `☀️ Good morning, ${nickname}` },
    zh: { rain: `🌧️ 早安，${nickname}`, sun: `☀️ 早安，${nickname}` },
    es: { rain: `🌧️ Buenos días, ${nickname}`, sun: `☀️ Buenos días, ${nickname}` },
    ja: { rain: `🌧️ おはよう、${nickname}`, sun: `☀️ おはよう、${nickname}` },
    ko: { rain: `🌧️ 좋은 아침, ${nickname}`, sun: `☀️ 좋은 아침, ${nickname}` },
    ms: { rain: `🌧️ Selamat pagi, ${nickname}`, sun: `☀️ Selamat pagi, ${nickname}` },
  };
  const set = titles[lang] || titles['en'];
  return isRainy ? set.rain : set.sun;
}

function getLunchTitle(lang: string, nickname: string): string {
  const titles: Record<string, string> = {
    en: `🍽️ Lunch time, ${nickname}!`,
    zh: `🍽️ ${nickname}，午餐时间到啦！`,
    es: `🍽️ ¡Hora de comer, ${nickname}!`,
    ja: `🍽️ ${nickname}、ランチタイムだよ！`,
    ko: `🍽️ ${nickname}, 점심 시간이야!`,
    ms: `🍽️ Masa makan tengah hari, ${nickname}!`,
  };
  return titles[lang] || titles['en'];
}

function getEveningTitle(lang: string, nickname: string): string {
  const titles: Record<string, string> = {
    en: `🌇 End of the day, ${nickname}`,
    zh: `🌇 ${nickname}，辛苦一天了`,
    es: `🌇 Fin del día, ${nickname}`,
    ja: `🌇 ${nickname}、お疲れ様`,
    ko: `🌇 ${nickname}, 오늘 하루 수고했어`,
    ms: `🌇 Tamat hari bekerja, ${nickname}`,
  };
  return titles[lang] || titles['en'];
}

function getTomorrowTitle(lang: string, nickname: string): string {
  const titles: Record<string, string> = {
    en: `🌙 Tomorrow's weather, ${nickname}`,
    zh: `🌙 ${nickname}，明天天气预报`,
    es: `🌙 Clima de mañana, ${nickname}`,
    ja: `🌙 ${nickname}、明日の天気`,
    ko: `🌙 ${nickname}, 내일 날씨`,
    ms: `🌙 Cuaca esok, ${nickname}`,
  };
  return titles[lang] || titles['en'];
}

// ─── Unified Persona-Driven Message Generator ─────────────────────

interface NotificationMessages {
  morningTitle: string;
  morning: string;
  lunchTitle: string;
  lunch: string;
  eveningTitle: string;
  evening: string;
  tomorrowTitle: string;
  tomorrowWeather: string;
}

interface GenerateContext {
  nickname: string;
  language: string;
  persona: string;
  city: string;
  dayOfWeek: string;
  date: string;
  season: string;
  // Today's weather
  temp: number;
  humidity: number;
  weatherDescription: string;
  isRainy: boolean;
  rainPeriods: string;
  // Tomorrow's forecast
  tomorrowSummary: string;
  tomorrowTempMin: number;
  tomorrowTempMax: number;
  tomorrowWillRain: boolean;
  tomorrowRainTimes: string;
}

async function generateAllMessages(ctx: GenerateContext): Promise<NotificationMessages> {
  const langName = getLangName(ctx.language);
  const personaOverlay = getPersonaPrompt(ctx.persona);

  // Build a rich context-aware prompt that lets the AI freely express based on persona
  const prompt = `You are ${ctx.nickname}'s personal AI companion sending push notifications throughout the day. You are their close friend who genuinely cares about them.

${personaOverlay ? `YOUR PERSONALITY:\n${personaOverlay}\n` : 'You are warm, balanced, supportive, and naturally funny.'}

TODAY'S CONTEXT:
- Date: ${ctx.date} (${ctx.dayOfWeek})
- Season: ${ctx.season}
- City: ${ctx.city}
- Current weather: ${ctx.weatherDescription}, ${ctx.temp}°C, humidity ${ctx.humidity}%
${ctx.isRainy ? `- ⚠️ RAIN TODAY at: ${ctx.rainPeriods} — you MUST warn them about the rain and specific times` : '- No rain expected today'}

TOMORROW'S FORECAST:
- ${ctx.tomorrowSummary}, ${ctx.tomorrowTempMin}°C ~ ${ctx.tomorrowTempMax}°C
${ctx.tomorrowWillRain ? `- Rain expected at: ${ctx.tomorrowRainTimes}` : '- Clear / no rain'}

Generate 4 notifications (Title + Message). Each pair must feel like a REAL text from a close friend — not robotic, not generic. Stay fully in character with your personality.

RULES:
1. Every title and message must be COMPLETELY UNIQUE — never use cliché patterns.
2. Include weather info naturally.
3. Titles should be short and catchy (e.g., "Morning, bestie! ☀️").
4. Messages should be under 100 characters.
5. MUST respond in ${langName} ONLY.
6. Use 1-3 relevant emojis per title/message.

Respond with EXACTLY this JSON format, no markdown, no extra text:
{
  "morningTitle": "...",
  "morning": "...",
  "lunchTitle": "...",
  "lunch": "...",
  "eveningTitle": "...",
  "evening": "...",
  "tomorrowTitle": "...",
  "tomorrowWeather": "..."
} `;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      temperature: 1.1,
      max_tokens: 800,
    });

    const raw = completion.choices[0].message?.content?.trim() || '';
    // Enhanced JSON cleaning: extract JSON if it's wrapped in markdown
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const cleaned = jsonMatch ? jsonMatch[0] : raw;
    
    const parsed = JSON.parse(cleaned);

    return {
      morningTitle: parsed.morningTitle || getMorningTitle(ctx.language, ctx.nickname, ctx.isRainy),
      morning: parsed.morning || getFallback('morning', ctx),
      lunchTitle: parsed.lunchTitle || getLunchTitle(ctx.language, ctx.nickname),
      lunch: parsed.lunch || getFallback('lunch', ctx),
      eveningTitle: parsed.eveningTitle || getEveningTitle(ctx.language, ctx.nickname),
      evening: parsed.evening || getFallback('evening', ctx),
      tomorrowTitle: parsed.tomorrowTitle || getTomorrowTitle(ctx.language, ctx.nickname),
      tomorrowWeather: parsed.tomorrowWeather || getFallback('tomorrow', ctx),
    };
  } catch (err) {
    console.error(`AI notification generation failed for ${ctx.nickname}:`, err);
    return {
      morningTitle: getMorningTitle(ctx.language, ctx.nickname, ctx.isRainy),
      morning: getFallback('morning', ctx),
      lunchTitle: getLunchTitle(ctx.language, ctx.nickname),
      lunch: getFallback('lunch', ctx),
      eveningTitle: getEveningTitle(ctx.language, ctx.nickname),
      evening: getFallback('evening', ctx),
      tomorrowTitle: getTomorrowTitle(ctx.language, ctx.nickname),
      tomorrowWeather: getFallback('tomorrow', ctx),
    };
  }
}

// ─── Fallbacks ──────────────────────────────────────────────────

function getFallback(type: 'morning' | 'lunch' | 'evening' | 'tomorrow', ctx: GenerateContext): string {
  const { nickname, language: lang, temp, humidity, isRainy, tomorrowTempMin, tomorrowTempMax, tomorrowWillRain } = ctx;

  const fallbacks: Record<string, Record<string, string>> = {
    morning: {
      zh: isRainy
        ? `早安 ${nickname}💕 今天${temp}°C，湿度${humidity}%，会下雨，记得带伞哦~`
        : `早安 ${nickname}☀️ 今天${temp}°C，湿度${humidity}%，天气不错，记得防晒！`,
      en: isRainy
        ? `Good morning ${nickname}💕 It's ${temp}°C, ${humidity}% humidity — rain coming, grab your umbrella!`
        : `Good morning ${nickname}☀️ It's ${temp}°C, ${humidity}% humidity. Beautiful day — stay hydrated!`,
    },
    lunch: {
      zh: `${nickname}💕 该吃午饭啦！好好吃饭，下午才有力气哦~`,
      en: `Hey ${nickname}💕 Time for lunch! Eat something yummy and recharge~`,
    },
    evening: {
      zh: `${nickname}🌟 辛苦一天了！今天过得怎么样？你真的很棒哦~`,
      en: `Hey ${nickname}🌟 Another day done! How was your day? You did amazing~`,
    },
    tomorrow: {
      zh: tomorrowWillRain
        ? `${nickname}🌙 明天${tomorrowTempMin}-${tomorrowTempMax}°C，会下雨，记得准备雨伞哦~晚安！`
        : `${nickname}🌙 明天${tomorrowTempMin}-${tomorrowTempMax}°C，天气不错~早点休息，晚安！`,
      en: tomorrowWillRain
        ? `${nickname}🌙 Tomorrow: ${tomorrowTempMin}-${tomorrowTempMax}°C with rain — prep your umbrella! Good night~`
        : `${nickname}🌙 Tomorrow: ${tomorrowTempMin}-${tomorrowTempMax}°C, looking clear! Rest well, good night~`,
    },
  };

  return fallbacks[type]?.[lang] || fallbacks[type]?.['en'] || `Hey ${nickname}! 💕`;
}

// ─── Deduplication Helper ──────────────────────────────────────

async function hasNotificationToday(userId: string, type: string, todayStartUTC: Date): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type,
      createdAt: { gte: todayStartUTC },
    },
  });
  return !!existing;
}

// ─── Main Cron Function ──────────────────────────────────────

export async function runDailyMorningAlert(): Promise<{ alertsSent: number; usersChecked: number }> {
  const DEFAULT_CITY = 'Kuala Lumpur';

  const users = await prisma.user.findMany({
    where: {
      subscription: {
        plan: {
          name: { in: ['pro', 'premium'] },
        },
      },
    },
    select: {
      id: true,
      city: true,
      nickname: true,
      language: true,
      persona: true,
      pushSubscription: true,
    },
  });

  let alertCount = 0;

  for (const user of users) {
    const userCity = user.city || DEFAULT_CITY;

    try {
      // Fetch weather data
      const [weatherData, forecastData] = await Promise.all([
        fetchWeather(userCity),
        fetchForecast(userCity),
      ]);

      if (!forecastData) {
        console.warn(`No forecast data for ${userCity}, skipping user ${user.id}`);
        continue;
      }

      const { list: forecastList, timezone } = forecastData;
      const lang = user.language || 'en';
      const nickname = user.nickname || 'My friend';
      const persona = user.persona || 'default';

      // Calculate user's local "today" start in UTC
      const userLocalTimeMs = Date.now() + timezone * 1000;
      const userDate = new Date(userLocalTimeMs);
      userDate.setUTCHours(0, 0, 0, 0);
      const todayStartUTC = new Date(userDate.getTime() - timezone * 1000);

      // Check dedup for morning_alert (skip ALL if morning already sent)
      if (await hasNotificationToday(user.id, 'morning_alert', todayStartUTC)) {
        continue;
      }

      // ─── Today's weather data ───
      const rainInfo = detectRainToday(forecastList, timezone);
      const rainSummary = rainInfo.rainPeriods.map(p => `${p.time} (${p.probability}% chance, ${p.description})`).join(', ');

      // Use forecast data as fallback if current weather fails
      const temp = weatherData?.temp ?? Math.round(forecastList[0]?.main?.temp ?? 0);
      const humidity = weatherData?.humidity ?? Math.round(forecastList[0]?.main?.humidity ?? 0);
      const weatherDescription = weatherData?.description ?? 'unknown';

      // ─── Tomorrow's forecast ───
      const tomorrowInfo = detectRainTomorrow(forecastList, timezone);
      const tomorrowRainTimes = tomorrowInfo.rainPeriods.map(p => p.time).join(', ');

      // Day of week
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayOfWeek = days[userDate.getUTCDay()];

      // ─── Generate all 4 messages in one AI call using persona ───
      const ctx: GenerateContext = {
        nickname,
        language: lang,
        persona,
        city: userCity,
        dayOfWeek,
        date: getDateSeed(),
        season: getSeasonContext(),
        temp,
        humidity,
        weatherDescription,
        isRainy: rainInfo.willRain,
        rainPeriods: rainSummary,
        tomorrowSummary: tomorrowInfo.summary,
        tomorrowTempMin: tomorrowInfo.tempMin,
        tomorrowTempMax: tomorrowInfo.tempMax,
        tomorrowWillRain: tomorrowInfo.willRain,
        tomorrowRainTimes,
      };

      const messages = await generateAllMessages(ctx);

      // ─── Titles (Now using AI versions if available) ───
      const morningTitle = messages.morningTitle;
      const lunchTitle = messages.lunchTitle;
      const eveningTitle = messages.eveningTitle;
      const tomorrowTitle = messages.tomorrowTitle;

      // ─── Schedule times (user local → UTC) ───
      const lunchLocalMs = userDate.getTime() + 12 * 60 * 60 * 1000;
      const lunchUtcDate = new Date(lunchLocalMs - timezone * 1000);

      const eveningLocalMs = userDate.getTime() + 18 * 60 * 60 * 1000;
      const eveningUtcDate = new Date(eveningLocalMs - timezone * 1000);

      const nightLocalMs = userDate.getTime() + 21 * 60 * 60 * 1000;
      const nightUtcDate = new Date(nightLocalMs - timezone * 1000);

      // ─── Create all 4 notifications ───
      await prisma.notification.createMany({
        data: [
          {
            userId: user.id,
            type: 'morning_alert',
            title: morningTitle,
            message: messages.morning,
            data: JSON.stringify({ city: userCity, rain: rainInfo.willRain, temp, humidity }),
          },
          {
            userId: user.id,
            type: 'lunch_reminder',
            title: lunchTitle,
            message: messages.lunch,
            scheduledFor: lunchUtcDate,
          },
          {
            userId: user.id,
            type: 'evening_checkin',
            title: eveningTitle,
            message: messages.evening,
            scheduledFor: eveningUtcDate,
          },
          {
            userId: user.id,
            type: 'evening_weather',
            title: tomorrowTitle,
            message: messages.tomorrowWeather,
            scheduledFor: nightUtcDate,
            data: JSON.stringify({ tomorrow: tomorrowInfo }),
          },
        ],
      });

      // ─── OneSignal push notifications ───
      if (user.pushSubscription === 'onesignal') {
        try {
          await Promise.all([
            sendPushNotification([user.id], morningTitle, messages.morning, '/chat'),
            sendPushNotification([user.id], lunchTitle, messages.lunch, '/chat', lunchUtcDate),
            sendPushNotification([user.id], eveningTitle, messages.evening, '/chat', eveningUtcDate),
            sendPushNotification([user.id], tomorrowTitle, messages.tomorrowWeather, '/chat', nightUtcDate),
          ]);
        } catch (pushErr) {
          console.warn(`Push notification failed for user ${user.id}:`, pushErr);
        }
      }

      alertCount++;
      console.log(`4 persona-driven notifications generated for ${nickname} (${user.id}) — persona: ${persona}, city: ${userCity}`);
    } catch (err) {
      console.error(`Morning alert failed for user ${user.id}:`, err);
    }
  }

  return { alertsSent: alertCount, usersChecked: users.length };
}
