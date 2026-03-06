import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/db';
import { fetchForecast, detectRainToday } from '@/app/lib/weather';

/**
 * GET /api/cron/rain-alert
 * Cron Job: Runs daily (morning) to check weather.
 *
 * Logic:
 * 1. Fetches weather forecast for users with a saved city.
 * 2. If rain is expected, sends a "Bring an umbrella" notification.
 * 3. Customizes message based on user's departure time.
 *
 * Trigger: External Cron Service
 * Services: OpenWeatherMap, Prisma
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const key = req.nextUrl.searchParams.get('key');
  if (cronSecret && key !== cronSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Only check adult users who have a city set
    const users = await prisma.user.findMany({
      where: {
        city: { not: null },
        ageGroup: 'adult',
      },
      select: { id: true, city: true, nickname: true, departureTime: true },
    });

    let alertCount = 0;

    for (const user of users) {
      if (!user.city) continue;

      // Check if we already sent a rain alert today
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

      const forecast = await fetchForecast(user.city);
      if (!forecast) continue;

      const rainInfo = detectRainToday(forecast);
      if (!rainInfo.willRain) continue;

      const departure = user.departureTime || '07:30';
      const periods = rainInfo.rainPeriods
        .map(p => `${p.time} (${p.probability}% chance)`)
        .join(', ');

      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'rain_alert',
          title: '🌧️ Umbrella reminder!',
          message: `Rain expected today in ${user.city}: ${periods}. Don't forget your umbrella before leaving at ${departure}!`,
          data: JSON.stringify({
            city: user.city,
            rainPeriods: rainInfo.rainPeriods,
            departureTime: departure,
          }),
        },
      });

      alertCount++;
    }

    return Response.json({
      ok: true,
      alertsSent: alertCount,
      usersChecked: users.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Rain alert cron error:', error);
    return Response.json({ error: 'Rain alert check failed' }, { status: 500 });
  }
}
