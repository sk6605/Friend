import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/db';
import { deactivateSafeMode } from '@/app/lib/crisis/safeMode';

function checkAdminAuth(req: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return false;
  const key = req.nextUrl.searchParams.get('key') || req.headers.get('x-admin-key');
  return key === adminSecret;
}

/**
 * GET /api/admin/crisis — List crisis events with filters
 */
export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const status = req.nextUrl.searchParams.get('status'); // open | acknowledged | resolved | escalated
    const riskLevel = req.nextUrl.searchParams.get('riskLevel');
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 200);

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Build where clause
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (riskLevel) where.riskLevel = parseInt(riskLevel);

    // Fetch crisis events
    const events = await prisma.crisisEvent.findMany({
      where,
      orderBy: [
        { riskLevel: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    // Fetch user info for events
    const userIds = [...new Set(events.map((e) => e.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nickname: true, ageGroup: true, email: true, profilePicture: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Enrich events with user info
    const enrichedEvents = events.map((e) => ({
      ...e,
      keywords: e.keywords ? JSON.parse(e.keywords) : [],
      user: userMap.get(e.userId) || null,
    }));

    // Stats
    const openEvents = await prisma.crisisEvent.count({ where: { status: 'open' } });
    const usersInSafeMode = await prisma.user.count({ where: { safeMode: true } });
    const eventsToday = await prisma.crisisEvent.count({ where: { createdAt: { gte: last24h } } });
    const eventsThisWeek = await prisma.crisisEvent.count({ where: { createdAt: { gte: last7d } } });

    // Users currently in SAFE_MODE
    const safeModeUsers = await prisma.user.findMany({
      where: { safeMode: true },
      select: { id: true, nickname: true, ageGroup: true, email: true, safeModeAt: true },
    });

    return Response.json({
      events: enrichedEvents,
      stats: {
        openEvents,
        usersInSafeMode,
        eventsToday,
        eventsThisWeek,
      },
      safeModeUsers,
    });
  } catch (err) {
    console.error('Crisis API error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/crisis — Update a crisis event or deactivate SAFE_MODE
 */
export async function PATCH(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'updateEvent') {
      const { eventId, status, notes } = body;
      if (!eventId) {
        return Response.json({ error: 'eventId required' }, { status: 400 });
      }

      const data: Record<string, unknown> = {};
      if (status) {
        data.status = status;
        if (status === 'resolved') {
          data.resolvedAt = new Date();
          data.resolvedBy = 'admin';
        }
      }
      if (notes !== undefined) data.notes = notes;

      const updated = await prisma.crisisEvent.update({
        where: { id: eventId },
        data,
      });

      // If resolving, also deactivate safe mode for the user
      if (status === 'resolved' && updated.userId) {
        await deactivateSafeMode(updated.userId, 'admin', notes || 'Admin resolved crisis event');
      }

      return Response.json({ ok: true, event: updated });
    }

    if (action === 'deactivateSafeMode') {
      const { userId, reason } = body;
      if (!userId) {
        return Response.json({ error: 'userId required' }, { status: 400 });
      }

      await deactivateSafeMode(userId, 'admin', reason || 'Admin deactivated SAFE_MODE');

      // Resolve all open crisis events for this user (including 'intervening')
      await prisma.crisisEvent.updateMany({
        where: { userId, status: { in: ['open', 'intervening', 'acknowledged', 'escalated'] } },
        data: { status: 'resolved', resolvedBy: 'admin', resolvedAt: new Date() },
      });

      return Response.json({ ok: true });
    }

    if (action === 'intervene') {
      const { eventId } = body;
      if (!eventId) return Response.json({ error: 'eventId required' }, { status: 400 });

      const updated = await prisma.crisisEvent.update({
        where: { id: eventId },
        data: { status: 'intervening' },
      });

      return Response.json({ ok: true, event: updated });
    }

    if (action === 'sendMessage') {
      const { eventId, content } = body;
      if (!eventId || !content) return Response.json({ error: 'eventId and content required' }, { status: 400 });

      // Find the event to get conversationId
      const event = await prisma.crisisEvent.findUnique({
        where: { id: eventId },
        select: { conversationId: true },
      });

      if (!event || !event.conversationId) {
        return Response.json({ error: 'Conversation not found for this event' }, { status: 404 });
      }

      // Add message as assistant with warning indicator prefix
      const message = await prisma.message.create({
        data: {
          conversationId: event.conversationId,
          role: 'assistant',
          content: `⚠️ **[Lumi Support Team]**\n\n${content}`,
        },
      });

      // Ensure the event is in intervening state
      await prisma.crisisEvent.update({
        where: { id: eventId },
        data: { status: 'intervening' }
      });

      // Update the conversation's messageCount
      await prisma.conversation.update({
        where: { id: event.conversationId },
        data: { messageCount: { increment: 1 } }
      });

      return Response.json({ ok: true, message });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Crisis PATCH error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
