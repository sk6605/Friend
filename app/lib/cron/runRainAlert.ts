import { prisma } from '@/app/lib/db';
import { fetchForecast, detectRainToday } from '@/app/lib/weather';
import webpush from 'web-push';

function initWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (publicKey && privateKey) {
    webpush.setVapidDetails('mailto:admin@friendai.com', publicKey, privateKey);
  }
}

export async function runRainAlert(): Promise<{ alertsSent: number; usersChecked: number }> {
  initWebPush();

  // Find all users who have a city set (regardless of ageGroup)
  const users = await prisma.user.findMany({
    where: {
      city: { not: null },
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

    // Skip if already alerted today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const existing = await prisma.notification.findFirst({
      where: {
        userId: user.id,
        type: 'rain_alert',
        createdAt: { gte: todayStart },
      },
    });

    if (existing) continue;

    // Fetch forecast for user's city
    const forecast = await fetchForecast(user.city);
    if (!forecast) continue;

    const rainInfo = detectRainToday(forecast);
    if (!rainInfo.willRain) continue;

    // Build a pretty, localized notification message
    const departure = user.departureTime || '07:30';
    const lang = user.language || 'en';

    const rainTimes = rainInfo.rainPeriods
      .map(p => `${p.time} — ${p.description} (${p.probability}%)`)
      .join('\n');

    const rainSummary = rainInfo.rainPeriods
      .map(p => p.time)
      .join(', ');

    // Build rich notification message
    let title: string;
    let message: string;
    let pushBody: string;

    if (lang === 'zh') {
      title = `🌧️ ${user.city}今天有雨`;
      message = `☂️ 今日下雨时段：\n${rainTimes}\n\n🕐 你的出门时间：${departure}\n💡 记得带伞或雨衣哦！出门前注意查看天气变化。`;
      pushBody = `${user.city}今天 ${rainSummary} 会下雨，记得带伞！☂️`;
    } else {
      title = `🌧️ Rain expected in ${user.city}`;
      message = `☂️ Rain periods today:\n${rainTimes}\n\n🕐 Your departure time: ${departure}\n💡 Don't forget your umbrella or raincoat! Check the weather before heading out.`;
      pushBody = `Rain at ${rainSummary} in ${user.city}. Bring an umbrella! ☂️`;
    }

    // Save notification to DB
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'rain_alert',
        title,
        message,
        data: JSON.stringify({
          city: user.city,
          rainPeriods: rainInfo.rainPeriods,
          departureTime: departure,
        }),
      },
    });

    // Send Web Push notification
    if (user.pushSubscription) {
      try {
        const subscription = JSON.parse(user.pushSubscription);
        await webpush.sendNotification(subscription, JSON.stringify({
          title,
          body: pushBody,
          url: '/chat',
        }));
      } catch (pushErr) {
        console.warn(`Rain alert push failed for user ${user.id}:`, pushErr);
      }
    }

    alertCount++;
    console.log(`Rain alert sent to ${user.nickname} (${user.id}) — city: ${user.city}, periods: ${rainSummary}`);
  }

  return { alertsSent: alertCount, usersChecked: users.length };
}
