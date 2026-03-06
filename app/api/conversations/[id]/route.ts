import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';

// Helper: verify the conversation belongs to the given user
async function verifyOwnership(conversationId: string, userId: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { userId: true },
  });
  if (!conv) return 'not_found';
  if (conv.userId !== userId) return 'forbidden';
  return 'ok';
}

// GET single conversation with messages
/**
 * API /api/conversations/[id]
 * Manages specific conversation resources.
 *
 * GET: Retrieve conversation with messages.
 * PUT: Update conversation title.
 * DELETE: Delete conversation.
 *
 * Services: Prisma
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Single query: fetch conversation + messages + verify ownership in one round-trip
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    if (conversation.userId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}

// UPDATE conversation — ownership required
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { title, userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const check = await verifyOwnership(id, userId);
    if (check === 'not_found') {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    if (check === 'forbidden') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const conversation = await prisma.conversation.update({
      where: { id },
      data: { title },
    });

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}

// DELETE conversation — ownership required
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const check = await verifyOwnership(id, userId);
    if (check === 'not_found') {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    if (check === 'forbidden') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await prisma.conversation.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}
