import { prisma } from "@/app/lib/db";

/**
 * 核心功能：游戏化与用户活跃度追踪 (Gamification & Engagement Tracking)
 * 
 * 职责 (Responsibilities):
 * 1. 检查用户上次活跃时间 (Check last active time).
 * 2. 如果是新的一天，增加连续打卡天数 (Increment streak for consecutive days).
 * 3. 如果中断了打卡，重置连续天数归零 (Reset streak if a day is missed).
 * 4. 更新数据库中的活跃状态 (Persist changes to the database).
 */
export async function updateDailyStreak(userId: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { streak: true, lastActiveAt: true },
        });

        if (user) {
            const now = new Date();
            const lastActive = user.lastActiveAt ? new Date(user.lastActiveAt) : null;
            let newStreak = user.streak;

            if (lastActive) {
                // 将时间归一化到午夜 00:00:00，以便按天计算 (Normalize to midnight for daily calculation)
                const lastDate = new Date(lastActive);
                lastDate.setHours(0, 0, 0, 0);

                const todayDate = new Date(now);
                todayDate.setHours(0, 0, 0, 0);

                // 计算两次活跃之间的天数差 (Calculate days difference)
                const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 1) {
                    // 连续打卡 (Consecutive day)
                    newStreak += 1;
                } else if (diffDays > 1) {
                    // 中断打卡，重置为 1 (Missed a day or more, reset)
                    newStreak = 1;
                }
                // 如果 diffDays === 0，表示同一天内多次活跃，保持原样 (Same day, keep streak)
            } else {
                // 第一次活跃 (First time active)
                newStreak = 1;
            }

            // 将最新状态写回数据库 (Update user in database)
            await prisma.user.update({
                where: { id: userId },
                data: {
                    streak: newStreak,
                    lastActiveAt: now,
                },
            });
        }
    } catch (error) {
        console.error("更新连续打卡天数失败 / Failed to update daily streak:", error);
    }
}
