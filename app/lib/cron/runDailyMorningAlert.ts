import { prisma } from '@/app/lib/db';
import { fetchWeather, fetchForecast, detectRainToday, detectRainTomorrow } from '@/app/lib/weather';
import { sendPushNotification } from '@/app/lib/onesignal';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─── AI Message Generators ──────────────────────────────────────

function getLangName(lang: string): string {
  const map: Record<string, string> = {
    zh: 'Simplified Chinese', es: 'Spanish', ja: 'Japanese',
    ko: 'Korean', ms: 'Malay', en: 'English',
  };
  return map[lang] || 'English';
}

async function generateMorningMessage(
  city: string,
  temp: number,
  humidity: number,
  isRainy: boolean,
  rainPeriods: string,
  language: string,
  nickname: string
): Promise<string> {
  const langName = getLangName(language);
  const weatherDetail = `Current temperature: ${temp}°C, humidity: ${humidity}%.`;
  const rainDetail = isRainy
    ? `Today's forecast shows rain at: ${rainPeriods}. You MUST mention the specific time(s) and remind them to bring an umbrella.`
    : 'No rain expected today. It will be mostly sunny or cloudy. Suggest sunscreen or staying hydrated.';

  const prompt = `You are ${nickname}'s warm, caring best friend. ${nickname} lives in ${city}.
${weatherDetail}
${rainDetail}
Write a short, heartfelt morning push notification (max 100 chars).
Include the temperature and humidity naturally in your message.
${isRainy ? 'MUST include specific rain times.' : ''}
Tone: deeply loved, warm, personal — like a message from someone who truly cares.
Respond ONLY in ${langName}. No quotes, no extra text.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.8,
      max_tokens: 150,
    });
    return completion.choices[0].message?.content?.trim() || getMorningFallback(nickname, city, temp, humidity, isRainy, language);
  } catch {
    return getMorningFallback(nickname, city, temp, humidity, isRainy, language);
  }
}

function getMorningFallback(nickname: string, city: string, temp: number, humidity: number, isRainy: boolean, lang: string): string {
  if (lang === 'zh') {
    return isRainy
      ? `早安 ${nickname}💕 ${city}今天${temp}°C，湿度${humidity}%，会下雨，记得带伞哦~`
      : `早安 ${nickname}☀️ ${city}今天${temp}°C，湿度${humidity}%，天气不错，记得防晒！`;
  }
  return isRainy
    ? `Good morning ${nickname}💕 ${city} is ${temp}°C, ${humidity}% humidity today. Rain expected — grab your umbrella!`
    : `Good morning ${nickname}☀️ ${city} is ${temp}°C, ${humidity}% humidity. Beautiful day — stay hydrated!`;
}

async function generateLunchMessage(nickname: string, language: string, weatherSummary: string, dayOfWeek: string): Promise<string> {
  const langName = getLangName(language);
  const prompt = `You are ${nickname}'s caring best friend. Write a short, warm lunch reminder (max 80 chars).
Today is ${dayOfWeek}. Weather: ${weatherSummary}.
Be personal, human, casual. Use their name naturally. Make them feel cared for.
Remind them to eat well and take a proper break. Sound like a real person texting, not an AI.
Respond ONLY in ${langName}. No quotes, no extra text.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.9,
      max_tokens: 100,
    });
    return completion.choices[0].message?.content?.trim() || getLunchFallback(nickname, language);
  } catch {
    return getLunchFallback(nickname, language);
  }
}

function getLunchFallback(nickname: string, lang: string): string {
  if (lang === 'zh') return `${nickname}💕 该吃午饭啦！好好吃饭，下午才有力气哦~`;
  return `Hey ${nickname}💕 Time for lunch! Eat something yummy and recharge~`;
}

async function generateEveningMessage(nickname: string, language: string, weatherSummary: string): Promise<string> {
  const langName = getLangName(language);
  const prompt = `You are ${nickname}'s caring best friend. Write a short, warm evening check-in (max 80 chars).
Today's weather was: ${weatherSummary}.
Be personal and genuine. Ask how their day went naturally. Sound like a real friend texting.
Make them feel appreciated. Don't be generic or robotic.
Respond ONLY in ${langName}. No quotes, no extra text.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.9,
      max_tokens: 100,
    });
    return completion.choices[0].message?.content?.trim() || getEveningFallback(nickname, language);
  } catch {
    return getEveningFallback(nickname, language);
  }
}

function getEveningFallback(nickname: string, lang: string): string {
  if (lang === 'zh') return `${nickname}🌟 辛苦一天了！今天过得怎么样？你真的很棒哦~`;
  return `Hey ${nickname}🌟 Another day done! How was your day? You did amazing~`;
}

async function generateTomorrowWeatherMessage(
  nickname: string,
  language: string,
  tomorrowSummary: string,
  tempMin: number,
  tempMax: number,
  willRain: boolean,
  rainTimes: string
): Promise<string> {
  const langName = getLangName(language);
  const rainInfo = willRain ? `Rain expected at: ${rainTimes}. Remind them to prepare an umbrella.` : 'No rain expected — should be clear.';

  const prompt = `You are ${nickname}'s caring best friend. Write a short evening message about TOMORROW's weather (max 100 chars).
Tomorrow's forecast: ${tomorrowSummary}. Temp range: ${tempMin}°C - ${tempMax}°C.
${rainInfo}
Give practical, warm advice about what to prepare for tomorrow. Sound like a real person who cares.
Respond ONLY in ${langName}. No quotes, no extra text.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.8,
      max_tokens: 150,
    });
    return completion.choices[0].message?.content?.trim() || getTomorrowFallback(nickname, tempMin, tempMax, willRain, language);
  } catch {
    return getTomorrowFallback(nickname, tempMin, tempMax, willRain, language);
  }
}

function getTomorrowFallback(nickname: string, tempMin: number, tempMax: number, willRain: boolean, lang: string): string {
  if (lang === 'zh') {
    return willRain
      ? `${nickname}🌙 明天${tempMin}-${tempMax}°C，会下雨，记得准备雨伞哦~晚安！`
      : `${nickname}🌙 明天${tempMin}-${tempMax}°C，天气不错~早点休息，晚安！`;
  }
  return willRain
    ? `${nickname}🌙 Tomorrow: ${tempMin}-${tempMax}°C with rain — prep your umbrella! Good night~`
    : `${nickname}🌙 Tomorrow: ${tempMin}-${tempMax}°C, looking clear! Rest well, good night~`;
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
  const users = await prisma.user.findMany({
    where: {
      city: { not: null },
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
      pushSubscription: true,
    },
  });

  let alertCount = 0;

  for (const user of users) {
    if (!user.city) continue;

    try {
      // Fetch weather data
      const [weatherData, forecastData] = await Promise.all([
        fetchWeather(user.city),
        fetchForecast(user.city),
      ]);

      if (!forecastData) {
        console.warn(`No forecast data for ${user.city}, skipping user ${user.id}`);
        continue;
      }

      const { list: forecastList, timezone } = forecastData;
      const lang = user.language || 'en';
      const nickname = user.nickname || 'My friend';

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
      const weatherSummary = weatherData
        ? `${weatherData.description}, ${temp}°C, humidity ${humidity}%`
        : `${temp}°C, humidity ${humidity}%`;

      // ─── Tomorrow's forecast ───
      const tomorrowInfo = detectRainTomorrow(forecastList, timezone);
      const tomorrowRainTimes = tomorrowInfo.rainPeriods.map(p => p.time).join(', ');

      // Day of week for lunch message
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayOfWeek = days[userDate.getUTCDay()];

      // ─── Generate all 4 AI messages ───
      const [morningBody, lunchBody, eveningBody, tomorrowBody] = await Promise.all([
        generateMorningMessage(user.city, temp, humidity, rainInfo.willRain, rainSummary, lang, nickname),
        generateLunchMessage(nickname, lang, weatherSummary, dayOfWeek),
        generateEveningMessage(nickname, lang, weatherSummary),
        generateTomorrowWeatherMessage(nickname, lang, tomorrowInfo.summary, tomorrowInfo.tempMin, tomorrowInfo.tempMax, tomorrowInfo.willRain, tomorrowRainTimes),
      ]);

      // ─── Titles ───
      const morningTitle = getMorningTitle(lang, nickname, rainInfo.willRain);
      const lunchTitle = getLunchTitle(lang, nickname);
      const eveningTitle = getEveningTitle(lang, nickname);
      const tomorrowTitle = getTomorrowTitle(lang, nickname);

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
            message: morningBody,
            data: JSON.stringify({ city: user.city, rain: rainInfo.willRain, temp, humidity }),
          },
          {
            userId: user.id,
            type: 'lunch_reminder',
            title: lunchTitle,
            message: lunchBody,
            scheduledFor: lunchUtcDate,
          },
          {
            userId: user.id,
            type: 'evening_checkin',
            title: eveningTitle,
            message: eveningBody,
            scheduledFor: eveningUtcDate,
          },
          {
            userId: user.id,
            type: 'evening_weather',
            title: tomorrowTitle,
            message: tomorrowBody,
            scheduledFor: nightUtcDate,
            data: JSON.stringify({ tomorrow: tomorrowInfo }),
          },
        ],
      });

      // ─── OneSignal push notifications ───
      if (user.pushSubscription === 'onesignal') {
        try {
          await Promise.all([
            sendPushNotification([user.id], morningTitle, morningBody, '/chat'),
            sendPushNotification([user.id], lunchTitle, lunchBody, '/chat', lunchUtcDate),
            sendPushNotification([user.id], eveningTitle, eveningBody, '/chat', eveningUtcDate),
            sendPushNotification([user.id], tomorrowTitle, tomorrowBody, '/chat', nightUtcDate),
          ]);
        } catch (pushErr) {
          console.warn(`Push notification failed for user ${user.id}:`, pushErr);
        }
      }

      alertCount++;
      console.log(`4 notifications generated for ${nickname} (${user.id}) — city: ${user.city}`);
    } catch (err) {
      console.error(`Morning alert failed for user ${user.id}:`, err);
    }
  }

  return { alertsSent: alertCount, usersChecked: users.length };
}
