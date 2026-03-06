'use client';

interface Intervention {
    type: 'cognitive' | 'behavioral' | 'support';
    title: string;
    description: string;
    reason: string;
}

interface Props {
    interventions: Intervention[];
}

const TYPE_CONFIG = {
    cognitive: {
        icon: '🧠',
        label: 'Cognitive Exercise',
        border: 'border-violet-200 dark:border-violet-700/40',
        bg: 'bg-violet-50/70 dark:bg-violet-900/15',
        badge: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
    },
    behavioral: {
        icon: '🎯',
        label: 'Behavioral Challenge',
        border: 'border-teal-200 dark:border-teal-700/40',
        bg: 'bg-teal-50/70 dark:bg-teal-900/15',
        badge: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
    },
    support: {
        icon: '🤝',
        label: 'Support Suggestion',
        border: 'border-rose-200 dark:border-rose-700/40',
        bg: 'bg-rose-50/70 dark:bg-rose-900/15',
        badge: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
    },
};

export default function GrowthCard({ interventions }: Props) {
    if (!interventions || interventions.length === 0) return null;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <span className="text-lg">🌱</span>
                <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Growth Recommendations</h4>
            </div>
            {interventions.map((item, i) => {
                const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.cognitive;
                return (
                    <div key={i} className={`rounded-2xl border ${config.border} ${config.bg} p-4 space-y-2`}>
                        <div className="flex items-center gap-2">
                            <span className="text-base">{config.icon}</span>
                            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${config.badge}`}>
                                {config.label}
                            </span>
                        </div>
                        <h5 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{item.title}</h5>
                        <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">{item.description}</p>
                        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 italic">Based on: {item.reason}</p>
                    </div>
                );
            })}
        </div>
    );
}
