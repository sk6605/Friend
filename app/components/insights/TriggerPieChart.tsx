'use client';

interface Props {
    data: { name: string; count: number }[];
}

const COLORS = [
    'bg-purple-500', 'bg-blue-500', 'bg-rose-500', 'bg-amber-500',
    'bg-emerald-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500',
];

const COLORS_LIGHT = [
    'bg-purple-100 dark:bg-purple-900/30', 'bg-blue-100 dark:bg-blue-900/30',
    'bg-rose-100 dark:bg-rose-900/30', 'bg-amber-100 dark:bg-amber-900/30',
    'bg-emerald-100 dark:bg-emerald-900/30', 'bg-cyan-100 dark:bg-cyan-900/30',
    'bg-pink-100 dark:bg-pink-900/30', 'bg-indigo-100 dark:bg-indigo-900/30',
];

export default function TriggerPieChart({ data }: Props) {
    if (!data || data.length === 0) return null;

    const total = data.reduce((a, b) => a + b.count, 0);
    const topItems = data.slice(0, 6);

    return (
        <div className="space-y-3">
            {topItems.map((item, i) => {
                const pct = Math.round((item.count / total) * 100);
                const colorIdx = i % COLORS.length;

                return (
                    <div key={item.name} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 capitalize">{item.name}</span>
                            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{pct}%</span>
                        </div>
                        <div className={`w-full h-2.5 rounded-full ${COLORS_LIGHT[colorIdx]} overflow-hidden`}>
                            <div
                                className={`h-full rounded-full ${COLORS[colorIdx]} transition-all duration-500`}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
