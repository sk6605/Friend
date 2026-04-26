import { prisma } from '@/app/lib/db';

/**
 * 违规风控层：账户封禁处罚阶梯阈值法则 (Account restriction thresholds)
 * 作用：用作打击频繁且故意教唆 AI 言论极端的发声者。若一次接一次触碰底线，将从警告跃迁到冻结，直至永封。
 * 注意：封禁系统仅涵盖 `extreme_speech` 反恐仇恨暴力的判定条；轻生自残者不接受任何形式的用户惩罚而是干预。
 * 
 * - 第一次犯戒 (1st violation / riskLevel >= 2): 系统仅秘密入档留底案，作书面警告。
 * - 第二次犯戒 (2nd violation): 剥夺应用交互权利，处于为期 24 小时的小黑屋封禁期。
 * - 第三次犯戒 (3rd violation): 剥夺交互权利，处于 7 天的大黑屋封禁。
 * - 第四次起底 (4th+ violation): 无期徒刑，永久标记黑名单，应用不可进入。
 */

// 时间段与阈值矩阵参数定义
const RESTRICTION_TIERS = [
  { minViolations: 2, durationMs: 24 * 60 * 60 * 1000, label: '24 hours' },       // 2nd offense
  { minViolations: 3, durationMs: 7 * 24 * 60 * 60 * 1000, label: '7 days' },     // 3rd offense
  { minViolations: 4, durationMs: null, label: 'permanent' },                       // 4th+ offense (Null代表无限期)
];

// 向外暴露的回流契约
export interface RestrictionResult {
  restricted: boolean;
  violationCount: number;
  duration: string | null; // e.g. "24 hours", "7 days", "permanent", 或是空代表仍在警告池 (warning only)
}

/**
 * 黑名单录入法庭：将违规人的案底记上升一本，在抵达阈值时果断降下神罚触发封禁令
 * 先发条件：只有在明确命中 'extreme_speech' 并且事态界定为 2 层（高危险性）或者 3 层才配调起这里。
 */
export async function recordViolationAndRestrict(
  userId: string,
  reason: string,
): Promise<RestrictionResult> {
  // 1. 无脑递增它的违规案底数值并接出现在的总计作为判罚标准
  const user = await prisma.user.update({
    where: { id: userId },
    data: { violationCount: { increment: 1 } },
    select: { violationCount: true },
  });

  const count = user.violationCount;

  // 2. 利用数组倒序大法 (Reserve) 从最高阶法则自上而下匹配寻找符合的刑期阶层，找不到就落空
  const tier = [...RESTRICTION_TIERS].reverse().find((t) => count >= t.minViolations);

  if (!tier) {
    // 3. 没被找到阶级：证明案底不够高 (只是第一回)，仅仅发回假底单作为内部警告通过
    return { restricted: false, violationCount: count, duration: null };
  }

  // 4. 定罪：下发数据库全限制令
  const now = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: {
      restricted: true, // 使能标志位卡断它的聊天通道
      restrictedAt: now, // 封禁即刻生效日
      restrictedUntil: tier.durationMs ? new Date(now.getTime() + tier.durationMs) : null, // 加入未来刑满释放绝对时间截取戳（若是无限期则是空）
      restrictionReason: reason, // 强挂犯罪理由封条用于系统面版显示
    },
  });

  return { restricted: true, violationCount: count, duration: tier.label };
}

/**
 * 看守所哨兵：审查用户入场资格。
 * 特性：它并非一味读取，它兼具隐形减刑系统的职责。只要判定期时发现解禁时间到了，它会现场将其释放并改写数据库为良名。
 */
export async function checkRestriction(userId: string): Promise<{
  restricted: boolean;
  restrictedUntil: Date | null;
  reason: string | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { restricted: true, restrictedUntil: true, restrictionReason: true },
  });

  // 如果它很清白
  if (!user || !user.restricted) {
    return { restricted: false, restrictedUntil: null, reason: null };
  }

  // 前卫的惰性释放机制 (Lazy expiration check): 
  // 发现它的封停日期是之前的时候（已经比当下的时间老了）
  if (user.restrictedUntil && user.restrictedUntil <= new Date()) {
    // 抹平它身上的负面锁定标志让它满血复活 
    await prisma.user.update({
      where: { id: userId },
      data: { restricted: false, restrictedAt: null, restrictedUntil: null, restrictionReason: null },
    });
    return { restricted: false, restrictedUntil: null, reason: null }; // 绿灯放行
  }

  // 时辰未到，继续滚回小黑屋并且带上时间给用户展示
  return {
    restricted: true,
    restrictedUntil: user.restrictedUntil,
    reason: user.restrictionReason,
  };
}
