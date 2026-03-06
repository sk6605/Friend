'use client';

interface HourlyData {
  hour: number;
  label: string;
  userMessages: number;
  aiMessages: number;
  total: number;
}

export default function DailyRowChart({ data }: { data: HourlyData[] }) {
  const maxTotal = Math.max(...data.map(d => d.total), 1);
  const hasAnyData = data.some(d => d.total > 0);

  if (!hasAnyData) {
    return (
      <div className="flex items-center justify-center h-32 text-neutral-400 dark:text-neutral-500 text-sm">
        No message activity
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-purple-500" />
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400">You</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-purple-300 dark:bg-purple-700" />
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400">AI</span>
        </div>
      </div>

      {/* Hourly rows */}
      <div className="space-y-[2px]">
        {data.map(row => {
          const userWidth = (row.userMessages / maxTotal) * 100;
          const aiWidth = (row.aiMessages / maxTotal) * 100;
          const isActive = row.total > 0;

          return (
            <div key={row.hour} className="flex items-center gap-2 group">
              {/* Hour label */}
              <span className={`
                w-10 text-right text-[10px] font-mono shrink-0 transition-colors
                ${isActive
                  ? 'text-neutral-600 dark:text-neutral-300 font-medium'
                  : 'text-neutral-300 dark:text-neutral-700'
                }
              `}>
                {row.label}
              </span>

              {/* Bar container */}
              <div className="flex-1 h-5 flex items-center gap-[1px] rounded-md overflow-hidden bg-neutral-50 dark:bg-white/[0.02]">
                {isActive ? (
                  <>
                    {row.userMessages > 0 && (
                      <div
                        className="h-full bg-purple-500 rounded-l-md transition-all duration-500 relative group-hover:brightness-110"
                        style={{ width: `${userWidth}%`, minWidth: '4px' }}
                      />
                    )}
                    {row.aiMessages > 0 && (
                      <div
                        className={`h-full bg-purple-300 dark:bg-purple-700 transition-all duration-500 relative group-hover:brightness-110 ${row.userMessages === 0 ? 'rounded-l-md' : ''} rounded-r-md`}
                        style={{ width: `${aiWidth}%`, minWidth: '4px' }}
                      />
                    )}
                  </>
                ) : (
                  <div className="h-full w-full" />
                )}
              </div>

              {/* Count */}
              <span className={`
                w-6 text-right text-[10px] shrink-0 transition-colors
                ${isActive
                  ? 'text-neutral-600 dark:text-neutral-300 font-medium'
                  : 'text-neutral-200 dark:text-neutral-800'
                }
              `}>
                {isActive ? row.total : ''}
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary row */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-neutral-100 dark:border-white/5">
        <span className="w-10 text-right text-[10px] font-mono text-neutral-500 dark:text-neutral-400 font-semibold shrink-0">
          Total
        </span>
        <div className="flex-1 text-xs text-neutral-600 dark:text-neutral-300">
          {data.reduce((a, b) => a + b.userMessages, 0)} you + {data.reduce((a, b) => a + b.aiMessages, 0)} AI
        </div>
        <span className="w-6 text-right text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 shrink-0">
          {data.reduce((a, b) => a + b.total, 0)}
        </span>
      </div>
    </div>
  );
}
