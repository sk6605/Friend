import { prisma } from '@/app/lib/db';
import { fetchForecast, detectRainToday } from '@/app/lib/weather';

export async function runRainAlert(): Promise<{ alertsSent: number; usersChecked: number }> {
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
    console.log(`Rain alert sent to ${user.nickname} (${user.id}) — city: ${user.city}`);
  }

  return { alertsSent: alertCount, usersChecked: users.length };
}
