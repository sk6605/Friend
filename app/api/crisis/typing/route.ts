import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';

/**
 * POST /api/crisis/typing
 * Used by the Admin dashboard to pulse the typing indicator.
 * Body: { eventId: string, isTyping: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const { eventId, isTyping } = await req.json();

    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
    }

    await prisma.crisisEvent.update({
      where: { id: eventId },
      data: {
        isAdminTyping: isTyping,
        lastAdminTypingAt: isTyping ? new Date() : undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Crisis typing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
