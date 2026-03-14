import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-300/20 dark:bg-purple-600/10 rounded-full blur-3xl animate-[pulse_6s_ease-in-out_infinite]" />
        <div className="absolute -bottom-40 -right-40 w-[30rem] h-[30rem] bg-pink-200/20 dark:bg-pink-600/8 rounded-full blur-3xl animate-[pulse_8s_ease-in-out_infinite_1s]" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-amber-200/15 dark:bg-amber-500/5 rounded-full blur-3xl animate-[pulse_7s_ease-in-out_infinite_2s]" />
      </div>

      <div className="relative z-10 text-center max-w-lg">
        {/* Big 404 */}
        <div className="relative mb-6">
          <span className="text-[10rem] sm:text-[12rem] font-black leading-none tracking-tighter bg-gradient-to-br from-purple-400 via-pink-400 to-amber-400 dark:from-purple-400 dark:via-pink-500 dark:to-amber-500 bg-clip-text text-transparent select-none opacity-90"
            style={{ WebkitTextStroke: '1px transparent' }}
          >
            404
          </span>
          {/* Floating emoji */}
          <span className="absolute top-8 -right-2 sm:right-4 text-4xl sm:text-5xl animate-bounce" style={{ animationDuration: '2.5s' }}>
            🛸
          </span>
        </div>

        {/* Message */}
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-800 dark:text-white mb-3">
          Lost in Space
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-base sm:text-lg mb-2 leading-relaxed">
          Looks like this page has drifted into another dimension.
        </p>
        <p className="text-neutral-400 dark:text-neutral-500 text-sm mb-10">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="
              group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl
              bg-gradient-to-r from-purple-600 to-pink-500
              hover:from-purple-500 hover:to-pink-400
              text-white font-semibold text-sm
              shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30
              transition-all duration-300 active:scale-[0.97]
            "
          >
            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Lumi
          </Link>
          <Link
            href="/chat"
            className="
              inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl
              text-purple-600 dark:text-purple-300 text-sm font-medium
              bg-purple-50/80 dark:bg-purple-600/15
              border border-purple-200 dark:border-purple-500/30
              hover:bg-purple-100 dark:hover:bg-purple-600/25
              hover:border-purple-300 dark:hover:border-purple-500/50
              transition-all duration-300 active:scale-[0.97]
            "
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            Start Chatting
          </Link>
        </div>

        {/* Subtle footer */}
        <p className="mt-14 text-xs text-neutral-300 dark:text-neutral-600">
          Lumi — Your AI Companion
        </p>
      </div>
    </div>
  );
}
