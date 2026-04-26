/**
 * 结构化指示构造器 (Build Locale Prompt)
 * 作用：为大模型准备最适配的文化要求指令。通过直接注入语种，强制模型不偏台（不要说这跟用户设定的语言产生分裂）。
 */
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

/** 
 * UI 展示/模型强制理解映射器 (Language Code to System Friendly String)
 * 作用：把后端的超短两个字，转换成有具体全称甚至是原版外语后缀的词，加重大模型对语境的敬畏。
 */
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
