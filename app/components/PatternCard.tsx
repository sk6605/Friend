'use client';

const PATTERN_INFO: Record<string, { label: string; description: string }> = {
  'catastrophizing': {
    label: 'Catastrophizing',
    description: 'Expecting the worst possible outcome in every situation',
  },
  'all-or-nothing': {
    label: 'All-or-Nothing',
    description: 'Seeing things in black and white with no middle ground',
  },
  'mind-reading': {
    label: 'Mind Reading',
    description: 'Assuming you know what others are thinking without evidence',
  },
  'overgeneralization': {
    label: 'Overgeneralization',
    description: 'Drawing broad conclusions from a single event',
  },
  'personalization': {
    label: 'Personalization',
    description: 'Taking responsibility for events outside your control',
  },
  'filtering': {
    label: 'Mental Filtering',
    description: 'Focusing only on negatives while ignoring positives',
  },
  'emotional-reasoning': {
    label: 'Emotional Reasoning',
    description: 'Believing something is true because you feel it strongly',
  },
  'should-statements': {
    label: 'Should Statements',
    description: 'Rigid expectations about how things "should" or "must" be',
  },
};

interface PatternCardProps {
  name: string;
  count: number;
  maxCount: number;
}

export default function PatternCard({ name, count, maxCount }: PatternCardProps) {
  const info = PATTERN_INFO[name] || {
    label: name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' '),
    description: 'A detected thinking pattern in your conversations',
  };

  const intensity = Math.min(1, count / Math.max(maxCount, 1));
  const bgOpacity = 0.1 + intensity * 0.25;

  return (
    <div
      className="rounded-xl border border-purple-200 dark:border-purple-800/40 p-4 transition-all hover:shadow-md"
      style={{ backgroundColor: `rgba(139, 92, 246, ${bgOpacity})` }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
          {info.label}
        </span>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-200 dark:bg-purple-800/50 text-purple-700 dark:text-purple-300">
          {count}x
        </span>
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
        {info.description}
      </p>
    </div>
  );
}
