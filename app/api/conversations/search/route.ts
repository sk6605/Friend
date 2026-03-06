import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/db';

/**
 * API /api/conversations/search
 * Semantic/Keyword search across conversation history.
 *
 * Logic:
 * - Searches message content for keywords.
 * - Groups results by conversation.
 * - Returns snippets with context.
 *
 * Services: Prisma
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  const query = req.nextUrl.searchParams.get('q')?.trim();

  if (!userId || !query) {
    return Response.json([], { status: 200 });
  }

  try {
    // Search messages that belong to this user's conversations
    const messages = await prisma.message.findMany({
      where: {
        conversation: { userId },
        content: { contains: query },
      },
      select: {
        id: true,
        content: true,
        role: true,
        createdAt: true,
        conversationId: true,
        conversation: {
          select: {
            id: true,
            title: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    // Group by conversation, keep first matching message as snippet
    const conversationMap = new Map<
      string,
      {
        id: string;
        title: string;
        updatedAt: string;
        snippet: string;
        matchRole: string;
        matchedAt: string;
        messageId: string;
      }
    >();

    for (const msg of messages) {
      if (!conversationMap.has(msg.conversationId)) {
        // Extract snippet around the match
        const idx = msg.content.toLowerCase().indexOf(query.toLowerCase());
        const start = Math.max(0, idx - 30);
        const end = Math.min(msg.content.length, idx + query.length + 30);
        let snippet = msg.content.slice(start, end).trim();
        if (start > 0) snippet = '...' + snippet;
        if (end < msg.content.length) snippet = snippet + '...';

        conversationMap.set(msg.conversationId, {
          id: msg.conversation.id,
          title: msg.conversation.title,
          updatedAt: msg.conversation.updatedAt.toISOString(),
          snippet,
          matchRole: msg.role,
          matchedAt: msg.createdAt.toISOString(),
          messageId: msg.id,
        });
      }
    }

    return Response.json(Array.from(conversationMap.values()));
  } catch (error) {
    console.error('Search error:', error);
    return Response.json({ error: 'Search failed' }, { status: 500 });
  }
}
