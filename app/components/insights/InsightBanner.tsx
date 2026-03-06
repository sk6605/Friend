'use client';

interface Props {
    insights: string[];
}

export default function InsightBanner({ insights }: Props) {
    if (!insights || insights.length === 0) return null;

    return (
        <div className="rounded-2xl bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-900/20 dark:via-yellow-900/15 dark:to-orange-900/20 border border-amber-200/60 dark:border-amber-700/30 p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">💡</span>
                <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Key Insights</h4>
            </div>
            <ul className="space-y-2.5">
                {insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 dark:bg-amber-500 shrink-0" />
                        <span className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{insight}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
