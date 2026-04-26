import { prisma } from '@/app/lib/db';

/**
 * 核心干预动作：将用户打入安全隔离舱 (Activate SAFE_MODE)
 * 作用：当发生致命危机（例如轻生倾向），直接锁定账户状态，并且切断大模型的所有普通设定，
 * 强制套上 crisisPrompts，并且将操作日志留档。
 * 
 * @param userId 用户 ID
 * @param crisisEventId 触发这个隔离的原始事件（外键挂钩）
 * @param reason 控制台日志：为什么要抓他进来？
 */
export async function activateSafeMode(
  userId: string,
  crisisEventId: string,
  reason: string,
): Promise<void> {
  // 使用事务 (Transaction) 保证两步必须同时成功，不可分割
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        safeMode: true, // 核心标志位：安全模式开启
        safeModeAt: new Date(),
      },
    }),
    prisma.safeModeLog.create({
      data: {
        userId,
        crisisEventId,
        action: 'activated',
        reason,
        performedBy: 'system', // 目前都是由系统 AI 大脑自动判定并触发
      },
    }),
  ]);
}

/**
 * 解除警报，释放用户 (Deactivate SAFE_MODE)
 * 作用：管理员确认用户已经脱离危险后，通过控制台按钮呼叫这个接口解救。
 */
export async function deactivateSafeMode(
  userId: string,
  performedBy: string,
  reason: string,
): Promise<void> {
  // 同样使用强一致性写入，不容许漏单
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        safeMode: false,
        safeModeAt: null,
      },
    }),
    prisma.safeModeLog.create({
      data: {
        userId,
        action: 'deactivated',
        reason,
        performedBy, // 这里会记下是哪个管理员点击了释放按钮
      },
    }),
  ]);
}

/**
 * 危机记录仪：将风控中心 (Detector) 分析的结果保存为案底 (Record a crisis event)
 * 作用：不包含封号或进黑名单的越权操作，只单纯把罪状书写入数据库。
 * 
 * @returns {string} 新创建的案底记录的 ID
 */
export async function recordCrisisEvent(
  userId: string,
  messageId: string | null,
  conversationId: string,
  riskLevel: number,
  triggerContent: string,
  classificationReason: string,
  keywords: string[],
): Promise<string> {
  const event = await prisma.crisisEvent.create({
    data: {
      userId,
      messageId,
      conversationId,
      riskLevel,
      triggerContent,
      classificationReason,
      keywords: JSON.stringify(keywords), // 数组转存字符串化 JSON，因为部分关系型数据库只有标量列
      status: riskLevel >= 2 ? 'open' : 'acknowledged', // 如果风险很高，标记为 'open' 警务状态等待人工审核关闭；若是小警报则假装没事发生
    },
  });
  return event.id; // 送出这串单号以供上游挂载和绑定 log
}
