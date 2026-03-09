export default function ChatHeader({
  aiName,
  onOpenSidebar,
  onExport,
  onOpenChallenge,
  streak,
}: {
  aiName?: string;
  onOpenSidebar?: () => void;
  onExport?: () => void;
  onOpenChallenge?: () => void;
  streak?: number;
}) {
  return (
    <header className="
      px-4 sm:px-6 py-4
      border-b border-purple-100/50 dark:border-purple-800/20
      flex items-center gap-3
      bg-white/80 dark:bg-[#0f0e17]/80 backdrop-blur-xl
      z-20 relative
    ">
      {/* Hamburger — mobile only */}
      {onOpenSidebar && (
        <button
          onClick={onOpenSidebar}
          className="md:hidden p-1.5 -ml-1 rounded-lg text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-white/5 transition-colors"
          aria-label="Open sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      )}

      {/* Heart */}
      <span className="heartbeat" aria-hidden="true">
        &#9829;
      </span>

      {/* Status */}
      <span className="text-sm font-medium text-purple-600/80 dark:text-purple-400/90">
        {aiName || 'Lumi'}
      </span>

      {/* Streak */}
      {streak !== undefined && streak > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 rounded-full border border-orange-200 dark:border-orange-800/50" title={`${streak} day streak!`}>
          <span className="text-orange-500 text-xs">🔥</span>
          <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{streak}</span>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {onExport && (
          <button
            onClick={onExport}
            className="p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-purple-500 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-white/5 transition-colors"
            aria-label="Export conversation"
            title="Download conversation"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </button>
        )}

        {/* Daily Challenge Icon */}
        {onOpenChallenge && (
          <button
            onClick={onOpenChallenge}
            className="p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-purple-500 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-white/5 transition-colors"
            aria-label="Daily Challenge"
            title="Daily Challenge"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </button>
        )}



        <span className="flex items-center gap-1.5 text-xs text-emerald-500 dark:text-emerald-400">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          Online
        </span>
      </div>
    </header>
  );
}
