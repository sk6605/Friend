'use client';

interface PeriodSelectorProps {
  options: { value: string; label: string }[];
  selected: string;
  onChange: (value: string) => void;
  label?: string;
}

export default function PeriodSelector({ options, selected, onChange, label }: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</span>
      )}
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="
          px-3 py-1.5 rounded-xl text-sm font-medium
          bg-neutral-50 dark:bg-[#2a2440]
          border border-neutral-200 dark:border-neutral-600
          text-neutral-800 dark:text-neutral-100
          outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-900/30
          transition-all appearance-none cursor-pointer
          pr-8
        "
        style={{
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
          backgroundPosition: 'right 0.5rem center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '1.25em 1.25em',
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value} className="bg-white dark:bg-[#2a2440]">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
