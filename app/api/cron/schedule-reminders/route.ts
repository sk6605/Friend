import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/db';

/**
 * GET /api/cron/schedule-reminders
 * Cron Job: Runs frequent intervals (e.g. every 15 mins) to check schedule.
 *
 * Logic:
 * 1. Queries `ScheduleItem` for items due for notification.
 * 2. Sends Push Notification for each due item.
 * 3. Marks item as notified.
 *
 * Trigger: External Cron Service
 * Services: Prisma
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const key = req.nextUrl.searchParams.get('key');
  if (cronSecret && key !== cronSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
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

    return Response.json({
      ok: true,
      remindersCreated: notifiedCount,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Schedule reminder cron error:', error);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
