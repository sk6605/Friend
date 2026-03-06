'use client';

import { getCrisisResources } from '@/app/lib/crisis/crisisPrompts';

interface SafeModeBannerProps {
  language?: string;
  onDismiss?: () => void;
}

export default function SafeModeBanner({ language = 'en', onDismiss }: SafeModeBannerProps) {
  const resources = getCrisisResources(language);

  const messages: Record<string, { title: string; subtitle: string }> = {
    en: {
      title: 'We care about your safety',
      subtitle: 'If you need immediate help, please reach out to one of these resources:',
    },
    zh: {
      title: '我们关心你的安全',
      subtitle: '如果你需要立即帮助，请联系以下资源：',
    },
    es: {
      title: 'Nos importa tu seguridad',
      subtitle: 'Si necesitas ayuda inmediata, comunícate con alguno de estos recursos:',
    },
    ja: {
      title: 'あなたの安全を大切に思っています',
      subtitle: '今すぐ助けが必要な場合は、以下の相談窓口にご連絡ください：',
    },
    ko: {
      title: '당신의 안전을 소중히 여깁니다',
      subtitle: '즉시 도움이 필요하시면 다음 상담 자원에 연락해 주세요:',
    },
    ms: {
      title: 'Kami mengambil berat tentang keselamatan anda',
      subtitle: 'Jika anda memerlukan bantuan segera, sila hubungi sumber-sumber ini:',
    },
  };

  const msg = messages[language] || messages['en'];

  return (
    <div className="relative mx-3 mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <button
        onClick={() => onDismiss?.()}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-amber-500 transition-colors hover:bg-amber-100 hover:text-amber-700"
        aria-label="Dismiss"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <svg
            className="h-5 w-5 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-amber-900">{msg.title}</h3>
          <p className="mt-1 text-xs text-amber-700">{msg.subtitle}</p>
          <div className="mt-2 whitespace-pre-line text-xs leading-relaxed text-amber-800">
            {resources}
          </div>
        </div>
      </div>
    </div>
  );
}
