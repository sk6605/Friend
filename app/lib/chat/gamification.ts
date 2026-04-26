import { prisma } from "@/app/lib/db";

/**
 * 核心功能：游戏化与用户活跃度追踪器 (Gamification & Engagement Tracking)
 * 
 * 职责与作用 (Responsibilities):
 * 无论是登录、发送语音还是传图片，只要触发了能代表“人活着”的动作，前端都要想办法 Call 进来这里。
 * 主要业务是在背后的数据库为用户算一笔“每日打卡连续坚持天数”的账。
 * 
 * 1. 检查用户上次活跃时间 (Check last active time).
 * 2. 如果是新的一天，增加连续打卡天数 (Increment streak for consecutive days).
 * 3. 如果中断了打卡，重置连续天数归零 (Reset streak if a day is missed).
 * 4. 更新数据库中的活跃状态 (Persist changes to the database).
 * 
 * @param {string} userId 被打卡的那个特定用户的数字人主键 ID 
 */
export async function updateDailyStreak(userId: string) {
    try {
        // 先去数据库查出这个人的存量连续打卡积分是多少
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { streak: true, lastActiveAt: true },
        });

        if (user) {
            const now = new Date();
            const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt) : null;
            let newStreak = user.streak;

            if (lastActive) {
                // 将时间归一化到午夜 00:00:00，避免因为下午两点和早上七点的跨度误伤，保证按全天周期计算
                const lastDate = new Date(lastActive);
                lastDate.setHours(0, 0, 0, 0);

                const todayDate = new Date(now);
                todayDate.setHours(0, 0, 0, 0);

                // 计算两次活跃之间的天数绝对差值
                const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 1) {
                    // 只相隔正好一天：续命成功，连签分数+1 (Consecutive day)
                    newStreak += 1;
                } else if (diffDays > 1) {
                    // 相隔断层了一天及以上：惩罚机制触发，打卡连签积分清空重刷成一天 (Missed a day or more, reset)
                    newStreak = 1;
                }
                // 如果 diffDays === 0，表示他今天同一天内在平台上发了多次信息，对连续打卡不增不减，保持原样忽略
            } else {
                // 第一次来玩的人从 1 开启
                newStreak = 1;
            }

            // 开写：将他当前正确的结算记录盖回数据库进行长卷宗驻留 
            await prisma.user.update({
                where: { id: userId },
                data: {
                    streak: newStreak, // 最新打卡里程碑数字
                    lastActiveAt: now, // 覆盖最新的碰触锚点时间
                },
            });
        }
    } catch (error) {
        console.error("更新连续打卡天数失败 / Failed to update daily streak:", error);
    }
}
