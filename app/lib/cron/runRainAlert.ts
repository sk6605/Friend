import { prisma } from '@/app/lib/db';
import { fetchForecast, detectRainToday } from '@/app/lib/weather';
import { sendPushNotification } from '@/app/lib/onesignal';

/**
 * Calculate the notification time for a user:
 * - Default: 07:30
 * - If user has `departureTime`: 30 minutes before that
 *
 * Returns { hour, minute } in server local time.
 */
function getNotifyTime(departureTime: string | null): { hour: number; minute: number } {
  const DEFAULT_HOUR = 7;
  const DEFAULT_MINUTE = 30;

  if (!departureTime) return { hour: DEFAULT_HOUR, minute: DEFAULT_MINUTE };

  // departureTime is stored as "HH:mm" (e.g. "08:00", "09:30")
  const parts = departureTime.split(':');
  if (parts.length !== 2) return { hour: DEFAULT_HOUR, minute: DEFAULT_MINUTE };

  let depHour = parseInt(parts[0], 10);
  let depMinute = parseInt(parts[1], 10);
  if (isNaN(depHour) || isNaN(depMinute)) return { hour: DEFAULT_HOUR, minute: DEFAULT_MINUTE };

  // Subtract 30 minutes
  depMinute -= 30;
  if (depMinute < 0) {
    depMinute += 60;
    depHour -= 1;
    if (depHour < 0) depHour = 23; // wrap around midnight
  }

  return { hour: depHour, minute: depMinute };
}

/**
 * Check if the current time is within a notification window for the target time.
 * We allow a 15-minute window (target to target+14 min) so the cron
 * running every 15 minutes will catch it exactly once.
 */
function isInNotifyWindow(targetHour: number, targetMinute: number): boolean {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes(); // e.g. 7:30 = 450
  const targetMinutes = targetHour * 60 + targetMinute;

  // Within a 15-minute window
  return currentMinutes >= targetMinutes && currentMinutes < targetMinutes + 15;
}

export async function runRainAlert(): Promise<{ alertsSent: number; usersChecked: number }> {
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

    // Check if NOW is the right time to notify this user
    const { hour, minute } = getNotifyTime(user.departureTime);
    if (!isInNotifyWindow(hour, minute)) continue;

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

    // Fetch forecast
    const forecast = await fetchForecast(user.city);
    if (!forecast) continue;

    const rainInfo = detectRainToday(forecast);
    if (!rainInfo.willRain) continue;

    // Build notification message
    const departure = user.departureTime || '07:30';
    const lang = user.language || 'en';

    const rainTimes = rainInfo.rainPeriods
      .map(p => `${p.time} — ${p.description} (${p.probability}%)`)
      .join('\n');

    const rainSummary = rainInfo.rainPeriods
      .map(p => p.time)
      .join(', ');

    let title: string;
    let message: string;
    let pushBody: string;

    if (lang === 'zh') {
      title = `🌧️ ${user.city}今天有雨`;
      message = `☂️ 今日下雨时段：\n${rainTimes}\n\n🕐 你的出门时间：${departure}\n💡 记得带伞或雨衣哦！出门前注意查看天气变化。`;
      pushBody = `${user.city}今天 ${rainSummary} 会下雨，记得带伞！☂️`;
    } else {
      title = `🌧️ Rain expected in ${user.city}`;
      message = `☂️ Rain periods today:\n${rainTimes}\n\n🕐 Your departure time: ${departure}\n💡 Don't forget your umbrella or raincoat!`;
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

    // Send via OneSignal
    if (user.pushSubscription === 'onesignal') {
      try {
        await sendPushNotification([user.id], title, pushBody, '/chat');
      } catch (pushErr) {
        console.warn(`Rain alert push failed for user ${user.id}:`, pushErr);
      }
    }

    alertCount++;
    console.log(`Rain alert sent to ${user.nickname} (${user.id}) at ${hour}:${String(minute).padStart(2, '0')} — city: ${user.city}`);
  }

  return { alertsSent: alertCount, usersChecked: users.length };
}
