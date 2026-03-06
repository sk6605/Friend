import { prisma } from '@/app/lib/db';

export async function runScheduleReminders(): Promise<{ remindersCreated: number }> {
  const now = new Date();

  const dueItems = await prisma.scheduleItem.findMany({
    where: {
      notifyAt: { lte: now },
      notified: false,
    },
  });

  let notifiedCount = 0;

  for (const item of dueItems) {
    const eventTime = item.date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    await prisma.notification.create({
      data: {
        userId: item.userId,
        type: 'schedule_reminder',
        title: `📅 Upcoming: ${item.subject}`,
        message: `Your ${item.type} "${item.subject}" starts at ${eventTime}. Get ready!`,
        data: JSON.stringify({ scheduleItemId: item.id }),
      },
    });

    await prisma.scheduleItem.update({
      where: { id: item.id },
      data: { notified: true },
    });

    notifiedCount++;
  }

  if (notifiedCount > 0) {
    console.log(`[Cron] Schedule reminders: sent ${notifiedCount} notifications`);
  }

  return { remindersCreated: notifiedCount };
}
