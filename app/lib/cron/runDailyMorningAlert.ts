import { prisma } from '@/app/lib/db';
import { fetchWeather, fetchForecast, detectRainToday, detectRainTomorrow } from '@/app/lib/weather';
import { sendPushNotification } from '@/app/lib/onesignal';
import { getPersonaPrompt } from '@/app/lib/ai/personaPrompts';
import OpenAI from 'openai';

// 初始化 OpenAI 客户端，读取环境变量中的 key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─── Helpers (辅助工具函数库) ──────────────────────────────────────────────────────

/**
 * 助手函数：获取完整语言名称
 * 作用：将短语言代码转换为完整的英文名称，以便喂给 OpenAI 做 prompt 上下文限制。
 */
function getLangName(lang: string): string {
  const map: Record<string, string> = {
    zh: 'Simplified Chinese', es: 'Spanish', ja: 'Japanese',
    ko: 'Korean', ms: 'Malay', en: 'English',
  };
  return map[lang] || 'English';
}

/**
 * 助手函数：季节感知器
 * 作用：根据当前月份返回季节相关的英文描述短语，增加 AI 生成通知的时令沉浸感。
 */
function getSeasonContext(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring — flowers, fresh air, new beginnings';
  if (month >= 6 && month <= 8) return 'summer — hot days, sunshine, staying cool';
  if (month >= 9 && month <= 11) return 'autumn — cool breezes, warm drinks, cozy vibes';
  return 'winter — chilly days, bundling up, hot cocoa weather';
}

/**
 * 助手函数：日期种子生成器
 * 作用：获取当天的 YYYY-MM-DD 格式，用作 AI 随机生成内容的固定伪随机种子之一，保证当天的生成一致性或避免重复。
 */
function getDateSeed(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Title Generators (备用降级策略的标题生成器) ──────────────────────────────────────

/** 根据语言和天气，返回早安通知的标题 */
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

/** 根据语言，返回午餐通知的标题 */
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

/** 根据语言，返回傍晚问候通知的标题 */
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

/** 根据语言，返回明晚天气预报通知的标题 */
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

// ─── Unified Persona-Driven Message Generator (核心功能：人格化通知批量生成器) ────────

/** 接口：期待 OpenAI 一次性返回的 4 组推送包含标题和文案的键值对 */
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

/** 接口：提供给大模型作为“今日状况”上下文的所有元数据 */
interface GenerateContext {
  nickname: string;
  language: string;
  persona: string;
  city: string;
  dayOfWeek: string;
  date: string;
  season: string;
  // 以下关于今日的天气情况
  temp: number;
  humidity: number;
  weatherDescription: string;
  isRainy: boolean;
  rainPeriods: string;
  // 以下关于明日的预报
  tomorrowSummary: string;
  tomorrowTempMin: number;
  tomorrowTempMax: number;
  tomorrowWillRain: boolean;
  tomorrowRainTimes: string;
}

/**
 * 核心调用函数：generateAllMessages
 * 作用：调用 OpenAI 的 GPT 模型，将用户偏好的语言、城市今天和明天的天气组装进 System Prompt 中，
 * 一次性为该用户生成全天候的 4 条专属问候推送通知（早安含当日天气、午餐提醒、下班关怀、晚安含明日天气预报）。
 * 返回：解析干净的 JSON 结构。并在失败时附带内置了支持多语言的降级 Fallback。
 */
async function generateAllMessages(ctx: GenerateContext): Promise<NotificationMessages> {
  const langName = getLangName(ctx.language);
  const personaOverlay = getPersonaPrompt(ctx.persona);

  // 生成一条带随机数的随机种子，让 AI 每天即便是相同的天气也能产生绝不重复的话术语料
  const uniqueSeed = `${ctx.date}-${ctx.dayOfWeek}-${Math.random().toString(36).slice(2, 8)}`;

  // 系统角色设定：带入指定的性格预设(personaOverlay)及强硬的 JSON 输出限制
  const systemPrompt = `You are ${ctx.nickname}'s personal AI companion named Lumi. You send push notifications throughout the day as their close friend who genuinely cares about them.

${personaOverlay ? `YOUR PERSONALITY:\n${personaOverlay}\n` : 'You are warm, balanced, supportive, and naturally funny.'}

IMPORTANT: You MUST respond with ONLY a valid JSON object. No markdown fences, no explanation, no extra text before or after the JSON.`;

  // 用户诉求指令：塞入用户真实环境的天气变量，并且要求输出极短的贴近真实发短信般的长度
  const userPrompt = `Generate 4 push notifications for ${ctx.nickname} for today.

TODAY'S CONTEXT:
- Date: ${ctx.date} (${ctx.dayOfWeek})
- Season: ${ctx.season}
- City: ${ctx.city}
- Current weather: ${ctx.weatherDescription}, ${ctx.temp}°C, humidity ${ctx.humidity}%
${ctx.isRainy ? `- ⚠️ RAIN TODAY at: ${ctx.rainPeriods} — you MUST mention rain and remind them to bring an umbrella` : '- No rain expected today'}

TOMORROW'S FORECAST:
- ${ctx.tomorrowSummary}, ${ctx.tomorrowTempMin}°C ~ ${ctx.tomorrowTempMax}°C
${ctx.tomorrowWillRain ? `- Rain expected at: ${ctx.tomorrowRainTimes}` : '- Clear / no rain'}

RULES:
1. Each notification (title + message) must be COMPLETELY UNIQUE and creative — never use generic templates.
2. Weave weather info naturally into the message.
3. Titles: short, catchy, with 1-2 emojis.
4. Messages: under 100 characters, with 1-3 emojis. Feel like a real text from a best friend.
5. MUST respond in ${langName} ONLY.
6. Variation seed: ${uniqueSeed}

The 4 notifications are:
1. morningTitle + morning (sent at ~7:00 AM)
2. lunchTitle + lunch (sent at ~12:00 PM)
3. eveningTitle + evening (sent at ~6:00 PM)
4. tomorrowTitle + tomorrowWeather (sent at ~9:00 PM, about tomorrow's weather)

Respond with ONLY this JSON, nothing else:
{"morningTitle":"...","morning":"...","lunchTitle":"...","lunch":"...","eveningTitle":"...","evening":"...","tomorrowTitle":"...","tomorrowWeather":"..."}`;

  // 定义网路请求的重试机制，最多 3 次，防止 OpenAI 抽风或者输出不是合法 JSON
  const MAX_RETRIES = 3;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[MorningAlert] AI generation attempt ${attempt}/${MAX_RETRIES} for ${ctx.nickname}`);

      const completion = await openai.chat.completions.create({
        model: 'gpt-4.1-mini', // 实际上使用的是性价比高的模型系列
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.9, // 较高温度保证文案多样性
        max_tokens: 600,
        response_format: { type: 'json_object' }, // 官方约束返回 JSON
      });

      const raw = completion.choices[0].message?.content?.trim() || '';
      console.log(`[MorningAlert] AI raw response (attempt ${attempt}): ${raw.slice(0, 200)}`);

      if (!raw) {
        throw new Error('Empty AI response');
      }

      // 脏数据清洗：如果模型依然包裹了 markdown json 语法块，通过正则剔除掉
      let cleaned = raw;
      const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        cleaned = jsonMatch[1].trim();
      }
      const objMatch = cleaned.match(/\{[\s\S]*\}/);
      if (objMatch) {
        cleaned = objMatch[0];
      }

      const parsed = JSON.parse(cleaned);

      // JSON 结构效验：检查返回的具体字段是否与我们代码后端的期望一一对应
      const requiredKeys = ['morningTitle', 'morning', 'lunchTitle', 'lunch', 'eveningTitle', 'evening', 'tomorrowTitle', 'tomorrowWeather'] as const;
      const missing = requiredKeys.filter(k => !parsed[k] || typeof parsed[k] !== 'string' || parsed[k].trim().length === 0);

      if (missing.length > 0) {
        throw new Error(`AI response missing fields: ${missing.join(', ')}`);
      }

      console.log(`[MorningAlert] AI generation SUCCESS for ${ctx.nickname} on attempt ${attempt}`);

      // 返回安全验证后的标准格式
      return {
        morningTitle: parsed.morningTitle,
        morning: parsed.morning,
        lunchTitle: parsed.lunchTitle,
        lunch: parsed.lunch,
        eveningTitle: parsed.eveningTitle,
        evening: parsed.evening,
        tomorrowTitle: parsed.tomorrowTitle,
        tomorrowWeather: parsed.tomorrowWeather,
      };
    } catch (err) {
      lastError = err;
      console.error(`[MorningAlert] AI attempt ${attempt}/${MAX_RETRIES} failed for ${ctx.nickname}:`, err instanceof Error ? err.message : err);

      // 延时退避重试 (Exponential backoff)
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 300 * attempt));
      }
    }
  }

  // 兜底逻辑：三次重试全部失败后，直接读取本地写死的死板文案模版作为最终推送内容返回，不阻断业务
  console.error(`[MorningAlert] ALL ${MAX_RETRIES} AI attempts failed for ${ctx.nickname}. Using fallback templates. Last error:`, lastError);
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

// ─── Fallbacks (兜底硬编码文案集合) ──────────────────────────────────────────────────

/**
 * 助手函数：获取备用语
 * 作用：当 AI 报错时提供多语言安全返回预案。
 */
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

// ─── Deduplication Helper (防重复推送过滤器) ──────────────────────────────────────

/**
 * 助手函数：检查该通知今日是否已经入库
 * 作用：防止 Cron Job 脚本因系统报错或集群重试被执行多次，而给同一用户同一时段发送多条推送
 */
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

// ─── Main Cron Function (外部暴露的定时任务主入口) ──────────────────────────────────────

/**
 * 定时任务：基础的早安及全天通知生成中枢
 * 作用：查询数据库内所有符合资格的高级用户，拉取他们城市的当地天气情况，
 * 将聚合的元数据委托给大模型去生成专属口吻全天 4 个时段（早、中、晚、临睡前天气）的消息文案。
 * 最后将所有的文案一并拆进 Notifications 数据表，配合客户端队列分时发出。
 */
export async function runDailyMorningAlert(): Promise<{ alertsSent: number; usersChecked: number }> {
  const DEFAULT_CITY = 'Kuala Lumpur';

  // 1. 查询目标分群：在这里我们只筛选订阅用户（Pro 或 Premium 计划），因为调用耗费模型资源
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

  // 2. 依次为主叫用户计算并打标
  for (const user of users) {
    const userCity = user.city || DEFAULT_CITY;

    try {
      // 3. 并行获取该用户城市的：当天即时天气及未来 5 天的时段预报
      const [weatherData, forecastData] = await Promise.all([
        fetchWeather(userCity),
        fetchForecast(userCity),
      ]);

      if (!forecastData) {
        console.warn(`No forecast data for ${userCity}, skipping user ${user.id}`);
        continue; // 天气获取失败则跳过该用户本次批处理
      }

      const { list: forecastList, timezone } = forecastData;
      const lang = user.language || 'en';
      const nickname = user.nickname || 'My friend';
      const persona = user.persona || 'default';

      // 4. 时区归一化计算：计算出用户当地时区内“今天凌晨0点”对应的 UTC 时间戳作为参考锚点
      const userLocalTimeMs = Date.now() + timezone * 1000;
      const userDate = new Date(userLocalTimeMs);
      userDate.setUTCHours(0, 0, 0, 0);
      const todayStartUTC = new Date(userDate.getTime() - timezone * 1000);

      // 5. 阻断检查：如果是同一天的触发，一旦早安被发送过，则直接跳出循环
      if (await hasNotificationToday(user.id, 'morning_alert', todayStartUTC)) {
        continue;
      }

      // ─── 今日状态解析组装 ───
      // 从序列化的天气列表中解析出今日的落雨点
      const rainInfo = detectRainToday(forecastList, timezone);
      const rainSummary = rainInfo.rainPeriods.map(p => `${p.time} (${p.probability}% chance, ${p.description})`).join(', ');

      // 如果即时天气失败则依赖第一档的天气预备段
      const temp = weatherData?.temp ?? Math.round(forecastList[0]?.main?.temp ?? 0);
      const humidity = weatherData?.humidity ?? Math.round(forecastList[0]?.main?.humidity ?? 0);
      const weatherDescription = weatherData?.description ?? 'unknown';

      // ─── 明日预报解析组装 ───
      const tomorrowInfo = detectRainTomorrow(forecastList, timezone);
      const tomorrowRainTimes = tomorrowInfo.rainPeriods.map(p => p.time).join(', ');

      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayOfWeek = days[userDate.getUTCDay()];

      // ─── 统一触发 GPT 生成 ───
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

      const morningTitle = messages.morningTitle;
      const lunchTitle = messages.lunchTitle;
      const eveningTitle = messages.eveningTitle;
      const tomorrowTitle = messages.tomorrowTitle;

      // ─── 规划未来调用的时间戳 (本地时间倒推回服务端 UTC 格式) ───
      const lunchLocalMs = userDate.getTime() + 12 * 60 * 60 * 1000;
      const lunchUtcDate = new Date(lunchLocalMs - timezone * 1000);

      const eveningLocalMs = userDate.getTime() + 18 * 60 * 60 * 1000;
      const eveningUtcDate = new Date(eveningLocalMs - timezone * 1000);

      const nightLocalMs = userDate.getTime() + 21 * 60 * 60 * 1000;
      const nightUtcDate = new Date(nightLocalMs - timezone * 1000);

      // ─── 保存待下发的全部通知批文至应用专属库 ───
      await prisma.notification.createMany({
        data: [
          {
            userId: user.id,
            type: 'morning_alert', // 无需填 scheduledFor，早安即刻生效下发
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

      // ─── 发送指令分包至第三方手机信令推送提供商 (OneSignal) ───
      if (user.pushSubscription === 'onesignal') {
        try {
          await Promise.all([
            // 当前时间立刻发送的早安 Push
            sendPushNotification([user.id], morningTitle, messages.morning, '/chat'),
            // 带有 scheduled_at 未来时间戳约束的长连接发包预存库
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