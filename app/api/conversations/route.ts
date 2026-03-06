import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';

// GET conversations — userId is REQUIRED
/**
 * API /api/conversations
 * Manages conversation collection.
 *
 * GET: List all conversations for a user.
 * POST: Create a new conversation.
 *
 * Services: Prisma
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const conversations = await prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

// POST create new conversation — userId is REQUIRED
export async function POST(request: NextRequest) {
  try {
    const { title, userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const conversation = await prisma.conversation.create({
      data: {
        title: title || 'New Conversation',
        userId,
      },
    });

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
