import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';

/**
 * 助手函数：校验会话归属权
 * 确保 A 用户无法通过直接修改 URL 访问或操作 B 用户的会话。
 */
async function verifyOwnership(conversationId: string, userId: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { userId: true },
  });
  if (!conv) return 'not_found';
  if (conv.userId !== userId) return 'forbidden';
  return 'ok';
}

/**
 * 接口：/api/conversations/[id]
 * 作用：管理单条特定会话。
 * 
 * GET: 获取会话详情及该会话下的所有历史消息。
 * PUT: 修改会话标题。
 * DELETE: 删除会话及其关联的所有消息。
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

    // 一次性查出：会话主体 + 所有消息列表
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }, // 消息按时间正序排列
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    // 归属权校验
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

// 修改标题
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

// 删除会话
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

    // 注意：Prisma Schema 中配置了 Cascade Delete，会同步删除关联的 Message
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

