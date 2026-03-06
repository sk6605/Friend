'use client';

interface Props {
    data: { day: string; avgMood: number; count: number }[];
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getMoodColor(score: number): string {
    if (score >= 8) return 'bg-emerald-400 dark:bg-emerald-500';
    if (score >= 6) return 'bg-green-300 dark:bg-green-500/80';
    if (score >= 5) return 'bg-yellow-300 dark:bg-yellow-500/70';
    if (score >= 4) return 'bg-orange-300 dark:bg-orange-500/70';
    if (score >= 2) return 'bg-red-300 dark:bg-red-500/70';
    return 'bg-neutral-200 dark:bg-neutral-700';
}

function getMoodEmoji(score: number): string {
    if (score >= 8) return '😊';
    if (score >= 6) return '🙂';
    if (score >= 5) return '😐';
    if (score >= 4) return '😕';
    if (score >= 2) return '😢';
    return '—';
}

export default function DayOfWeekHeatmap({ data }: Props) {
    // Build a map from day name → data
    const dayMap: Record<string, { avgMood: number; count: number }> = {};
    for (const d of data) {
        dayMap[d.day] = { avgMood: d.avgMood, count: d.count };
    }

    return (
        <div className="grid grid-cols-7 gap-2">
            {DAY_LABELS.map(day => {
                const entry = dayMap[day];
                const score = entry?.avgMood || 0;
                const count = entry?.count || 0;

                return (
                    <div key={day} className="flex flex-col items-center gap-1.5">
                        <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{day}</span>
                        <div
                            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all ${count > 0 ? getMoodColor(score) : 'bg-neutral-100 dark:bg-neutral-800/50'
                                }`}
                            title={count > 0 ? `${day}: ${score.toFixed(1)}/10 (${count} days)` : `${day}: no data`}
                        >
                            <span className="text-sm sm:text-base">{count > 0 ? getMoodEmoji(score) : '·'}</span>
                        </div>
                        {count > 0 && (
                            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">{score.toFixed(1)}</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
