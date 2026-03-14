interface Props {
  onSelect: (mood: string) => void;
  language?: string;
}

// ─── Localized mood labels ───
const moodLabels: Record<string, Record<string, string>> = {
  en: { happy: 'Happy', sad: 'Sad', angry: 'Angry', excited: 'Excited', anxious: 'Anxious', tired: 'Tired' },
  zh: { happy: '开心', sad: '难过', angry: '生气', excited: '兴奋', anxious: '焦虑', tired: '疲惫' },
  es: { happy: 'Feliz', sad: 'Triste', angry: 'Enojado', excited: 'Emocionado', anxious: 'Ansioso', tired: 'Cansado' },
  ja: { happy: '嬉しい', sad: '悲しい', angry: '怒り', excited: 'ワクワク', anxious: '不安', tired: '疲れた' },
  ko: { happy: '행복', sad: '슬픔', angry: '화남', excited: '신남', anxious: '불안', tired: '피곤' },
  ms: { happy: 'Gembira', sad: 'Sedih', angry: 'Marah', excited: 'Teruja', anxious: 'Cemas', tired: 'Penat' },
};

function getLabel(lang: string | undefined, key: string): string {
  const l = lang && moodLabels[lang] ? lang : 'en';
  return moodLabels[l][key] || moodLabels['en'][key];
}

const moods = [
  { key: 'happy', emoji: '😊', color: 'bg-amber-100/60 dark:bg-amber-900/25 border-amber-300/50 dark:border-amber-600/30 hover:bg-amber-200/70 dark:hover:bg-amber-800/30 text-amber-700 dark:text-amber-300' },
  { key: 'sad', emoji: '😔', color: 'bg-blue-100/60 dark:bg-blue-900/25 border-blue-300/50 dark:border-blue-600/30 hover:bg-blue-200/70 dark:hover:bg-blue-800/30 text-blue-700 dark:text-blue-300' },
  { key: 'angry', emoji: '😡', color: 'bg-red-100/60 dark:bg-red-900/25 border-red-300/50 dark:border-red-600/30 hover:bg-red-200/70 dark:hover:bg-red-800/30 text-red-700 dark:text-red-300' },
  { key: 'excited', emoji: '🤩', color: 'bg-pink-100/60 dark:bg-pink-900/25 border-pink-300/50 dark:border-pink-600/30 hover:bg-pink-200/70 dark:hover:bg-pink-800/30 text-pink-700 dark:text-pink-300' },
  { key: 'anxious', emoji: '😰', color: 'bg-purple-100/60 dark:bg-purple-900/25 border-purple-300/50 dark:border-purple-600/30 hover:bg-purple-200/70 dark:hover:bg-purple-800/30 text-purple-700 dark:text-purple-300' },
  { key: 'tired', emoji: '😴', color: 'bg-slate-100/60 dark:bg-slate-800/25 border-slate-300/50 dark:border-slate-600/30 hover:bg-slate-200/70 dark:hover:bg-slate-700/30 text-slate-600 dark:text-slate-300' },
];

export default function MoodSelector({ onSelect, language }: Props) {
  return (
    <div className="flex flex-wrap gap-2 mt-3 ml-1">
      {moods.map(m => (
        <button
          key={m.key}
          onClick={() => onSelect(m.key)}
          className={`
            px-3.5 py-2 rounded-full
            border text-sm font-medium
            backdrop-blur-sm
            transition-all duration-200
            hover:scale-105 active:scale-95
            hover:shadow-sm
            ${m.color}
          `}
        >
          <span className="mr-1.5">{m.emoji}</span>
          {getLabel(language, m.key)}
        </button>
      ))}
    </div>
  );
}
