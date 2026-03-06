interface Props {
  onSelect: (mood: string) => void;
}

export default function MoodSelector({ onSelect }: Props) {
  const moods = [
    { label: "Happy", emoji: "😊", value: "happy", color: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/50 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-300" },
    { label: "Sad", emoji: "😔", value: "sad", color: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/50 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300" },
    { label: "Angry", emoji: "😡", value: "angry", color: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/50 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-700 dark:text-red-300" },
    { label: "Quiet", emoji: "😶", value: "silent", color: "bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-600/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300" },
    { label: "Hungry", emoji: "🍔", value: "hungry", color: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700/50 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-700 dark:text-orange-300" },
  ];

  return (
    <div className="flex flex-wrap gap-2 mt-3 ml-1">
      {moods.map(m => (
        <button
          key={m.value}
          onClick={() => onSelect(m.value)}
          className={`
            px-3.5 py-2 rounded-full
            border text-sm font-medium
            transition-all duration-200
            hover:scale-105 active:scale-95
            hover:shadow-sm
            ${m.color}
          `}
        >
          <span className="mr-1.5">{m.emoji}</span>
          {m.label}
        </button>
      ))}
    </div>
  );
}
