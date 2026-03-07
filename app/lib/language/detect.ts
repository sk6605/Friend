export type LangResult = {
  lang: string;
  confidence: number;
};

// Common word sets for Latin-script language detection
const MALAY_WORDS = new Set([
  'saya', 'aku', 'kamu', 'anda', 'dia', 'mereka', 'kami', 'kita',
  'yang', 'dengan', 'untuk', 'tidak', 'ada', 'ini', 'itu', 'dari',
  'pada', 'ke', 'di', 'adalah', 'akan', 'sudah', 'boleh', 'juga',
  'apa', 'bagaimana', 'kenapa', 'bila', 'sini', 'sana', 'mana',
  'sangat', 'banyak', 'sedikit', 'semua', 'atau', 'dan', 'tapi',
  'kalau', 'jika', 'sebab', 'kerana', 'oleh', 'dalam', 'luar',
  'hanya', 'masih', 'sudah', 'belum', 'pernah', 'selalu', 'kadang',
  'hai', 'helo', 'terima', 'kasih', 'selamat', 'makan', 'minum',
  'pergi', 'datang', 'ambil', 'buat', 'beli', 'kerja', 'rumah',
  'hari', 'waktu', 'masa', 'tahun', 'bulan', 'minggu', 'malam',
]);

const SPANISH_WORDS = new Set([
  'hola', 'gracias', 'por', 'favor', 'como', 'que', 'con', 'del',
  'los', 'las', 'una', 'uno', 'este', 'esta', 'esto', 'eso',
  'pero', 'para', 'muy', 'bien', 'mal', 'soy', 'eres', 'es',
  'tengo', 'tienes', 'tiene', 'hay', 'creo', 'quiero', 'puedo',
  'cuando', 'donde', 'porque', 'tambien', 'ahora', 'aqui', 'alla',
]);

const FRENCH_WORDS = new Set([
  'bonjour', 'merci', 'comment', 'pourquoi', 'parce', 'aussi',
  'mais', 'avec', 'pour', 'dans', 'sur', 'est', 'sont', 'avoir',
  'etre', 'faire', 'aller', 'venir', 'les', 'des', 'une', 'ceci',
  'cela', 'oui', 'non', 'voici', 'voila', 'tres', 'bien',
]);

const GERMAN_WORDS = new Set([
  'ich', 'du', 'er', 'sie', 'wir', 'ihr', 'das', 'die', 'der',
  'ein', 'eine', 'ist', 'sind', 'war', 'haben', 'sein', 'werden',
  'und', 'oder', 'aber', 'wenn', 'dass', 'weil', 'wie', 'was',
  'nicht', 'auch', 'noch', 'schon', 'sehr', 'gut', 'danke', 'bitte',
]);

function countWordMatches(words: string[], wordSet: Set<string>): number {
  return words.filter(w => wordSet.has(w.toLowerCase())).length;
}

export async function detectLanguage(text: string): Promise<LangResult> {
  if (!text || text.trim().length < 3) {
    return { lang: 'en', confidence: 0.2 };
  }

  // Chinese (Simplified + Traditional)
  if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(text)) {
    return { lang: 'zh', confidence: 0.97 };
  }

  // Japanese (Hiragana + Katakana)
  if (/[\u3040-\u30ff]/.test(text)) {
    return { lang: 'ja', confidence: 0.97 };
  }

  // Korean
  if (/[\uac00-\ud7af]/.test(text)) {
    return { lang: 'ko', confidence: 0.97 };
  }

  // Arabic
  if (/[\u0600-\u06ff]/.test(text)) {
    return { lang: 'ar', confidence: 0.95 };
  }

  // Thai
  if (/[\u0e00-\u0e7f]/.test(text)) {
    return { lang: 'th', confidence: 0.95 };
  }

  // Latin-script languages — use special characters + common word analysis
  const lower = text.toLowerCase();

  // German: ü/ö/ä/ß are very distinctive
  if (/[üöäß]/.test(lower)) {
    return { lang: 'de', confidence: 0.90 };
  }

  // Spanish: ñ is very distinctive
  if (/ñ/.test(lower)) {
    return { lang: 'es', confidence: 0.92 };
  }

  // French: distinctive accents like è, ê, œ, ç
  if (/[èêœç]/.test(lower)) {
    return { lang: 'fr', confidence: 0.85 };
  }

  // Word-based detection for languages without distinctive characters
  const words = lower.match(/[a-z]+/g) || [];
  if (words.length >= 2) {
    const msScore = countWordMatches(words, MALAY_WORDS);
    const esScore = countWordMatches(words, SPANISH_WORDS);
    const frScore = countWordMatches(words, FRENCH_WORDS);
    const deScore = countWordMatches(words, GERMAN_WORDS);

    const scores: { lang: string; score: number }[] = [
      { lang: 'ms', score: msScore },
      { lang: 'es', score: esScore },
      { lang: 'fr', score: frScore },
      { lang: 'de', score: deScore },
    ];

    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];

    // Require at least 2 matching words to avoid false positives
    if (best.score >= 2) {
      const confidence = Math.min(0.5 + best.score * 0.1, 0.85);
      return { lang: best.lang, confidence };
    }

    // Single matching word: lower confidence
    if (best.score === 1) {
      return { lang: best.lang, confidence: 0.45 };
    }
  }

  // Default: English
  return { lang: 'en', confidence: 0.6 };
}
