import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/db';

function checkAdminAuth(req: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return false;
  const key = req.nextUrl.searchParams.get('key') || req.headers.get('x-admin-key');
  return key === adminSecret;
}

/**
 * GET /api/admin/crisis/[id] — Get full crisis event detail
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkAdminAuth(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const event = await prisma.crisisEvent.findUnique({
      where: { id },
    });

    if (!event) {
      return Response.json({ error: 'Crisis event not found' }, { status: 404 });
    }

    // Fetch user info
    const user = await prisma.user.findUnique({
      where: { id: event.userId },
      select: {
        id: true,
        nickname: true,
        email: true,
        ageGroup: true,
        profilePicture: true,
        safeMode: true,
        safeModeAt: true,
      },
    });

    // Fetch conversation context if available
    let conversationMessages: { role: string; content: string; createdAt: Date }[] = [];
    if (event.conversationId) {
      const messages = await prisma.message.findMany({
        where: { conversationId: event.conversationId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { role: true, content: true, createdAt: true },
      });
      conversationMessages = messages.reverse();
    }

    // Fetch safe mode log for this user
    const safeModeHistory = await prisma.safeModeLog.findMany({
      where: { userId: event.userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Fetch all crisis events for this user
    const userCrisisHistory = await prisma.crisisEvent.findMany({
      where: { userId: event.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        riskLevel: true,
        status: true,
        triggerContent: true,
        createdAt: true,
      },
    });

    return Response.json({
      event: {
        ...event,
        keywords: event.keywords ? JSON.parse(event.keywords) : [],
      },
      user,
      conversationMessages,
      safeModeHistory,
      userCrisisHistory,
    });
  } catch (err) {
    console.error('Crisis detail API error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/crisis/[id] — Update crisis event status/notes
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkAdminAuth(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { status, notes } = body;

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
      where: { id },
      data,
    });

    return Response.json({ ok: true, event: updated });
  } catch (err) {
    console.error('Crisis PATCH detail error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
