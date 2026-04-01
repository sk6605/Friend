import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';

/**
 * GET /api/crisis/status?userId=...
 * Used by the frontend to poll for crisis intervention status.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { safeMode: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find the latest unresolved crisis event for this user (include 'intervening')
    const latestEvent = await prisma.crisisEvent.findFirst({
      where: {
        userId,
        status: { in: ['open', 'acknowledged', 'intervening'] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        isAdminTyping: true,
        lastAdminTypingAt: true,
      },
    });

    // Check if admin is typing (within last 8 seconds for network lag)
    const isTyping =
      latestEvent?.isAdminTyping &&
      latestEvent.lastAdminTypingAt &&
      new Date().getTime() - new Date(latestEvent.lastAdminTypingAt).getTime() < 8000;

    // isResolved = user is no longer in safeMode AND no active crisis events remain
    const isResolved = !user.safeMode;

    return NextResponse.json({
      safeMode: user.safeMode,
      activeEventId: latestEvent?.id || null,
      isAdminTyping: !!isTyping,
      isResolved,
    });
  } catch (error) {
    console.error('Crisis status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
