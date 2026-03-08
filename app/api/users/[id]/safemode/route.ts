import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/db';

/**
 * GET /api/users/[id]/safemode
 * Checks if the user is currently in Safe Mode (Crisis Intervention).
 *
 * Returns: { safeMode: boolean, safeModeAt: Date, safeModeConversationIds: string[] }
 * Services: Prisma
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { safeMode: true, safeModeAt: true },
    });

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Return conversation-scoped safe mode data
    let safeModeConversationIds: string[] = [];
    if (user.safeMode) {
      const activeEvents = await prisma.crisisEvent.findMany({
        where: {
          userId: id,
          riskLevel: { gte: 2 },
          status: { in: ['open', 'escalated', 'acknowledged', 'intervening'] },
          conversationId: { not: null },
        },
        select: { conversationId: true },
      });
      safeModeConversationIds = activeEvents
        .map((e) => e.conversationId!)
        .filter(Boolean);
    }

    return Response.json({
      safeMode: user.safeMode,
      safeModeAt: user.safeModeAt,
      safeModeConversationIds,
    });
  } catch (err) {
    console.error('Safe mode check error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
