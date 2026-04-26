'use client';

import { useState, useEffect } from 'react';
import { useConfetti } from '@/app/hooks/useConfetti'; // We might need to create this or use a simple library

interface Challenge {
    id: string;
    text: string;
    type: string;
    difficulty: string;
}

/**
 * 组件：每日试炼任务卡片 (DailyChallengeCard)
 * 作用：在聊天页面顶部弹出的游戏化小组件。每天随机发给用户一个现实生活中的正向任务（比如去散步、喝水）。
 * 机制：一旦用户点击完成，将通过 API /api/challenges 写回积分和日志。采用乐观更新(Optimistic Update)机制让按钮秒变绿色，提升粘性反馈。
 */
export default function DailyChallengeCard({ userId }: { userId: string }) {
    const [challenge, setChallenge] = useState<Challenge | null>(null);
    const [completed, setCompleted] = useState(false);
    const [loading, setLoading] = useState(true);

    // 生命期钩子组：组件挂载后，悄悄地从后台抽卡，拿取今天的每日任务题干
    useEffect(() => {
        if (!userId) return;
        fetch(`/api/challenges?userId=${userId}`)
            .then(res => res.json())
            .then(data => {
                // 如果后端正常派发了当天的挑战
                if (data.challenge) {
                    setChallenge(data.challenge);
                    // 同步后端存折里的打卡记录，说不定他已经在别的地方完成过了
                    setCompleted(data.completed);
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [userId]);

    /**
     * 行为处理器：打卡按钮事件
     * 策略：采取假装无延迟（乐观更新）的方式。用户一点击立刻 UI 庆祝并阻止二次点击，后台异步慢慢上传数据。
     * 失败情况：如果没网或者报错，则把 UI 状态回滚撤回。
     */
    const handleComplete = async () => {
        if (!challenge) return;

        // Optimistic update (盲目自信：先亮起绿色完成提示灯再说)
        setCompleted(true);

        try {
            await fetch('/api/challenges', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, challengeId: challenge.id }),
            });
            // Trigger confetti here if we had the hook (可以在此处抛出碎纸屑庆祝特效)
        } catch (err) {
            console.error(err);
            setCompleted(false); // revert on error (失败则回退按钮状态重试)
        }
    };

    // 如果接口还没回数据，静悄悄不占地方
    if (loading) return null;
    if (!challenge) return null;

    return (
        <div className="
            mb-4 mx-4 p-4 
            bg-white/60 dark:bg-white/5 backdrop-blur-md 
            rounded-2xl 
            border border-purple-100/50 dark:border-purple-800/20 
            flex flex-col gap-3
            shadow-sm hover:shadow-md transition-all duration-300
            mt-3
        ">
            <div className="w-full">
                {/* 顶部指示栏：包含了小红条标签和动态分配的难度颜色 */}
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-300 uppercase tracking-wider bg-purple-100 dark:bg-purple-900/40 px-1.5 py-0.5 rounded-md">
                        Daily Challenge
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${challenge.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
                        challenge.difficulty === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' :
                            'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800'
                        }`}>
                        {challenge.difficulty}
                    </span>
                </div>
                {/* 题目正文：如果完工了字体将被加上删除线置灰 */}
                <p className={`text-sm font-medium leading-snug ${completed ? 'text-neutral-400 dark:text-neutral-500 line-through' : 'text-neutral-700 dark:text-neutral-200'}`}>
                    {challenge.text}
                </p>
            </div>
            
            {/* 核心互动按钮：动态样式的变形按钮 */}
            <button
                onClick={handleComplete}
                disabled={completed}
                className={`w-full px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 shadow-sm  ${completed
                    ? 'bg-emerald-100 text-emerald-700 cursor-default border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                    : 'bg-purple-600/90 text-white hover:bg-purple-600 hover:shadow-purple-500/20 active:scale-[0.98]'
                    }`}
            >
                {completed ? 'Done! 🎉' : 'Complete Challenge'}
            </button>
        </div>
    );
}
