'use client';

import { useState, useEffect } from 'react';
import { useConfetti } from '@/app/hooks/useConfetti'; // We might need to create this or use a simple library

interface Challenge {
    id: string;
    text: string;
    type: string;
    difficulty: string;
}

export default function DailyChallengeCard({ userId }: { userId: string }) {
    const [challenge, setChallenge] = useState<Challenge | null>(null);
    const [completed, setCompleted] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        fetch(`/api/challenges?userId=${userId}`)
            .then(res => res.json())
            .then(data => {
                if (data.challenge) {
                    setChallenge(data.challenge);
                    setCompleted(data.completed);
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [userId]);

    const handleComplete = async () => {
        if (!challenge) return;

        // Optimistic update
        setCompleted(true);

        try {
            await fetch('/api/challenges', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, challengeId: challenge.id }),
            });
            // Trigger confetti here if we had the hook
        } catch (err) {
            console.error(err);
            setCompleted(false); // revert on error
        }
    };

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
                <p className={`text-sm font-medium leading-snug ${completed ? 'text-neutral-400 dark:text-neutral-500 line-through' : 'text-neutral-700 dark:text-neutral-200'}`}>
                    {challenge.text}
                </p>
            </div>
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
