export function buildLocalePrompt(lang: string): string {
  switch (lang) {
    case 'zh':
      return 'Respond in natural, friendly Simplified Chinese (简体中文).';
    case 'ja':
      return 'Respond in polite, natural Japanese (日本語).';
    case 'ko':
      return 'Respond in friendly, natural Korean (한국어).';
    case 'es':
      return 'Respond in friendly, natural Spanish (Español).';
    case 'ms':
      return 'Respond in friendly, natural Malay (Bahasa Melayu).';
    case 'de':
      return 'Respond in concise, direct German (Deutsch).';
    case 'fr':
      return 'Respond in friendly, natural French (Français).';
    case 'ar':
      return 'Respond in friendly, natural Arabic (العربية).';
    case 'th':
      return 'Respond in friendly, natural Thai (ภาษาไทย).';
    case 'en':
    default:
      return 'Respond in friendly, natural English.';
  }
}

/** Map language code to a human-readable name for system prompts */
export function langCodeToName(code: string): string {
  const map: Record<string, string> = {
    en: 'English',
    zh: 'Simplified Chinese (简体中文)',
    es: 'Spanish (Español)',
    ja: 'Japanese (日本語)',
    ko: 'Korean (한국어)',
    ms: 'Malay (Bahasa Melayu)',
    de: 'German (Deutsch)',
    fr: 'French (Français)',
    ar: 'Arabic (العربية)',
    th: 'Thai (ภาษาไทย)',
  };
  return map[code] || code;
}
