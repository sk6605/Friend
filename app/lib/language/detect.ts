export type LangResult = {
  lang: string;
  confidence: number;
};

export async function detectLanguage(text: string): Promise<LangResult> {
  if (!text || text.trim().length < 3) {
    return { lang: "en", confidence: 0.2 };
  }

  // 中文
  if (/[\u4e00-\u9fff]/.test(text)) {
    return { lang: "zh", confidence: 0.95 };
  }

  // 日文
  if (/[\u3040-\u30ff]/.test(text)) {
    return { lang: "ja", confidence: 0.95 };
  }

  // 韩文
  if (/[\uac00-\ud7af]/.test(text)) {
    return { lang: "ko", confidence: 0.95 };
  }

  // 马来 / 印尼（基本都是拉丁）
  if (/[a-zA-Z]/.test(text)) {
    return { lang: "en", confidence: 0.6 };
  }

  return { lang: "en", confidence: 0.3 };
}
