import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';

/**
 * API /api/conversations/[id]/messages
 * Manages messages within a conversation.
 *
 * POST: Add a new message (manual/system injection).
 * DELETE: Delete a specific message.
 *
 * Services: Prisma
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const conversationId = (await params).id;

  if (!conversationId) {
    return NextResponse.json({ error: 'no id' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { role, content, userId } = body;

    // Verify conversation exists and belongs to the user
    if (userId) {
      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { userId: true },
      });
      if (!conv) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
      if (conv.userId !== userId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const message = await prisma.message.create({
      data: {
        role,
        content,
        conversationId,
      },
    });

    return NextResponse.json(message);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE a single message by messageId
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const conversationId = (await params).id;
  const messageId = request.nextUrl.searchParams.get('messageId');
  const userId = request.nextUrl.searchParams.get('userId');

  if (!messageId) {
    return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
  }

  try {
    // Verify conversation ownership
    if (userId) {
      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { userId: true },
      });
      if (!conv) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
      if (conv.userId !== userId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Verify message belongs to this conversation
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { conversationId: true },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    if (message.conversationId !== conversationId) {
      return NextResponse.json({ error: 'Message does not belong to this conversation' }, { status: 403 });
    }

    await prisma.message.delete({ where: { id: messageId } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
