'use client';

interface EmotionItem {
  mood: string;
  percentage: number;
  count: number;
  topTriggers: string[];
  topTopics: string[];
}

const MOOD_COLORS: Record<string, { bg: string; bar: string; text: string; dot: string }> = {
  happy:    { bg: 'bg-emerald-50 dark:bg-emerald-900/20',  bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  sad:      { bg: 'bg-blue-50 dark:bg-blue-900/20',        bar: 'bg-blue-500',    text: 'text-blue-700 dark:text-blue-400',       dot: 'bg-blue-500' },
  anxious:  { bg: 'bg-amber-50 dark:bg-amber-900/20',      bar: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-400',     dot: 'bg-amber-500' },
  stressed: { bg: 'bg-red-50 dark:bg-red-900/20',          bar: 'bg-red-500',     text: 'text-red-700 dark:text-red-400',         dot: 'bg-red-500' },
  calm:     { bg: 'bg-teal-50 dark:bg-teal-900/20',        bar: 'bg-teal-500',    text: 'text-teal-700 dark:text-teal-400',       dot: 'bg-teal-500' },
  angry:    { bg: 'bg-rose-50 dark:bg-rose-900/20',        bar: 'bg-rose-500',    text: 'text-rose-700 dark:text-rose-400',       dot: 'bg-rose-500' },
  neutral:  { bg: 'bg-gray-50 dark:bg-gray-800/30',        bar: 'bg-gray-400',    text: 'text-gray-600 dark:text-gray-400',       dot: 'bg-gray-400' },
  lonely:   { bg: 'bg-indigo-50 dark:bg-indigo-900/20',    bar: 'bg-indigo-500',  text: 'text-indigo-700 dark:text-indigo-400',   dot: 'bg-indigo-500' },
  grateful: { bg: 'bg-lime-50 dark:bg-lime-900/20',        bar: 'bg-lime-500',    text: 'text-lime-700 dark:text-lime-400',       dot: 'bg-lime-500' },
  excited:  { bg: 'bg-yellow-50 dark:bg-yellow-900/20',    bar: 'bg-yellow-500',  text: 'text-yellow-700 dark:text-yellow-400',   dot: 'bg-yellow-500' },
};

const DEFAULT_COLOR = { bg: 'bg-purple-50 dark:bg-purple-900/20', bar: 'bg-purple-500', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500' };

function getColor(mood: string) {
  return MOOD_COLORS[mood.toLowerCase()] || DEFAULT_COLOR;
}

export default function EmotionBreakdown({ data }: { data: EmotionItem[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-neutral-400 dark:text-neutral-500 text-sm">
        No emotion data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stacked percentage bar */}
      <div className="flex h-6 rounded-full overflow-hidden bg-neutral-100 dark:bg-white/5">
        {data.map((item) => {
          const color = getColor(item.mood);
          return (
            <div
              key={item.mood}
              className={`${color.bar} transition-all duration-500 relative group`}
              style={{ width: `${Math.max(item.percentage, 2)}%` }}
              title={`${item.mood}: ${item.percentage}%`}
            >
              {item.percentage >= 12 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                  {item.percentage}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Emotion list with details */}
      <div className="space-y-2.5">
        {data.map((item) => {
          const color = getColor(item.mood);
          return (
            <div key={item.mood} className={`rounded-xl px-4 py-3 ${color.bg} border border-transparent`}>
              <div className="flex items-center gap-2.5 mb-1">
                <span className={`w-2.5 h-2.5 rounded-full ${color.dot} shrink-0`} />
                <span className={`text-sm font-semibold capitalize ${color.text}`}>
                  {item.mood}
                </span>
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 ml-auto">
                  {item.percentage}% ({item.count} {item.count === 1 ? 'day' : 'days'})
                </span>
              </div>
              {(item.topTriggers.length > 0 || item.topTopics.length > 0) && (
                <div className="ml-5 space-y-0.5">
                  {item.topTriggers.length > 0 && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      <span className="font-medium">Triggers:</span> {item.topTriggers.join(', ')}
                    </p>
                  )}
                  {item.topTopics.length > 0 && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      <span className="font-medium">Areas:</span> {item.topTopics.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
