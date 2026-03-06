'use client';

interface TabNotAvailableProps {
  tabName: string;
  daysNeeded: number;
  daysHave: number;
}

export default function TabNotAvailable({ tabName, daysNeeded, daysHave }: TabNotAvailableProps) {
  const remaining = daysNeeded - daysHave;
  const progress = Math.min(100, Math.round((daysHave / daysNeeded) * 100));

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {/* Lock icon */}
      <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-5">
        <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>

      <h3 className="text-base font-semibold text-neutral-700 dark:text-neutral-200 mb-2">
        {tabName} Analysis
      </h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6 max-w-xs">
        Requires {daysNeeded} days of chat data. You have {daysHave} day{daysHave !== 1 ? 's' : ''} so far
        {remaining > 0 && ` — ${remaining} more to go!`}
      </p>

      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="flex justify-between text-xs text-neutral-400 dark:text-neutral-500 mb-1.5">
          <span>{daysHave} / {daysNeeded} days</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-neutral-100 dark:bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-purple-500 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
