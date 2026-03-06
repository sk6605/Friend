'use client';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  minDate?: string;
  maxDate?: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
  onApply: () => void;
}

export default function DateRangePicker({
  startDate,
  endDate,
  minDate,
  maxDate,
  onStartChange,
  onEndChange,
  onApply,
}: DateRangePickerProps) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  const inputClass = `
    px-3 py-1.5 rounded-xl text-sm
    bg-neutral-50 dark:bg-[#2a2440]
    border border-neutral-200 dark:border-neutral-600
    text-neutral-800 dark:text-neutral-100
    outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-900/30
    transition-all dark:color-scheme-dark
  `;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">From</span>
      <input
        type="date"
        value={startDate}
        min={minDate}
        max={endDate}
        onChange={(e) => onStartChange(e.target.value)}
        className={inputClass}
      />
      <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">To</span>
      <input
        type="date"
        value={endDate}
        min={startDate}
        max={maxDate || new Date().toISOString().slice(0, 10)}
        onChange={(e) => onEndChange(e.target.value)}
        className={inputClass}
      />
      <button
        onClick={onApply}
        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-all active:scale-[0.97]"
      >
        Apply
      </button>
      <span className="text-xs text-neutral-400 dark:text-neutral-500">
        {diffDays > 0 ? `${diffDays} day${diffDays > 1 ? 's' : ''}` : ''}
      </span>
    </div>
  );
}
