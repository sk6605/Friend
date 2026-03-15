import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/db';

/**
 * API /api/notifications/check
 * Manages user notifications.
 *
 * GET: Retrieve undismissed notifications.
 * PATCH: Mark notifications as read or dismissed.
 *
 * Services: Prisma
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return Response.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        dismissed: false,
        OR: [
          { scheduledFor: null },
          { scheduledFor: { lte: new Date() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return Response.json(notifications);
  } catch (error) {
    console.error('Notification check error:', error);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}

// PATCH: Mark notification as read or dismissed
export async function PATCH(req: NextRequest) {
  try {
    const { notificationId, action } = await req.json();

    if (!notificationId || !action) {
      return Response.json({ error: 'notificationId and action required' }, { status: 400 });
    }

    const data: Record<string, boolean> = {};
    if (action === 'read') data.read = true;
    if (action === 'dismiss') data.dismissed = true;

    await prisma.notification.update({
      where: { id: notificationId },
      data,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Notification update error:', error);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
