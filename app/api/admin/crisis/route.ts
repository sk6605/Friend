import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/db';
import { deactivateSafeMode } from '@/app/lib/crisis/safeMode';

/**
 * 助手函数：校验管理员权限
 * 检查 URL 参数或 Header 中的密钥是否正确。
 */
function checkAdminAuth(req: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return false;
  const key = req.nextUrl.searchParams.get('key') || req.headers.get('x-admin-key');
  return key === adminSecret;
}

/**
 * 接口：GET /api/admin/crisis
 * 作用：获取所有危机事件列表及统计摘要。
 * 支持按状态、风险等级过滤。
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

    // 构造查询条件
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (riskLevel) where.riskLevel = parseInt(riskLevel);

    // 查询危机事件
    const events = await prisma.crisisEvent.findMany({
      where,
      orderBy: [
        { riskLevel: 'desc' }, // 严重者优先
        { createdAt: 'desc' }, // 最近触发者优先
      ],
      take: limit,
    });

    // 聚合关联用户信息
    const userIds = [...new Set(events.map((e) => e.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nickname: true, ageGroup: true, email: true, profilePicture: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const enrichedEvents = events.map((e) => ({
      ...e,
      keywords: e.keywords ? JSON.parse(e.keywords) : [],
      user: userMap.get(e.userId) || null,
    }));

    // 计算统计指标
    const openEvents = await prisma.crisisEvent.count({ where: { status: 'open' } });
    const usersInSafeMode = await prisma.user.count({ where: { safeMode: true } });
    const eventsToday = await prisma.crisisEvent.count({ where: { createdAt: { gte: last24h } } });
    const eventsThisWeek = await prisma.crisisEvent.count({ where: { createdAt: { gte: last7d } } });

    // 当前处于安全模式（强制管制中）的用户
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
 * 接口：PATCH /api/admin/crisis
 * 作用：处理各类管理员干预行为（更新状态、发送人工劝导信息、解除限制等）。
 */
export async function PATCH(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // 动作 1：更新特定事件状态
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

      // 如果标记为“已解决”，则同步解除该用户的安全模式
      if (status === 'resolved' && updated.userId) {
        await deactivateSafeMode(updated.userId, 'admin', notes || 'Admin resolved crisis event');
      }

      return Response.json({ ok: true, event: updated });
    }

    // 动作 2：手动解除用户的安全模式（SafeMode）
    if (action === 'deactivateSafeMode') {
      const { userId, reason } = body;
      if (!userId) {
        return Response.json({ error: 'userId required' }, { status: 400 });
      }

      await deactivateSafeMode(userId, 'admin', reason || 'Admin deactivated SAFE_MODE');

      // 同时自动平复该用户名下所有待处理的危机记录
      await prisma.crisisEvent.updateMany({
        where: { userId, status: { in: ['open', 'intervening', 'acknowledged', 'escalated'] } },
        data: { status: 'resolved', resolvedBy: 'admin', resolvedAt: new Date() },
      });

      return Response.json({ ok: true });
    }

    // 动作 3：开始干预（标记状态为 intervening）
    if (action === 'intervene') {
      const { eventId } = body;
      if (!eventId) return Response.json({ error: 'eventId required' }, { status: 400 });

      const updated = await prisma.crisisEvent.update({
        where: { id: eventId },
        data: { status: 'intervening' },
      });

      return Response.json({ ok: true, event: updated });
    }

    // 动作 4：向用户发送人工劝导消息（这会禁用 AI 输出）
    if (action === 'sendMessage') {
      const { eventId, content } = body;
      if (!eventId || !content) return Response.json({ error: 'eventId and content required' }, { status: 400 });

      const event = await prisma.crisisEvent.findUnique({
        where: { id: eventId },
        select: { conversationId: true },
      });

      if (!event || !event.conversationId) {
        return Response.json({ error: 'Conversation not found for this event' }, { status: 404 });
      }

      // 创建带有特殊标识的人工消息，以便前端区分 AI 与人工
      const message = await prisma.message.create({
        data: {
          conversationId: event.conversationId,
          role: 'assistant',
          content: `⚠️ **[Lumi Support Team]**\n\n${content}`,
        },
      });

      // 确保事件状态切换为“干预中”
      await prisma.crisisEvent.update({
        where: { id: eventId },
        data: { status: 'intervening' }
      });

      // 同步更新会话消息总数
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
