/**
 * 语言指纹判别器组件
 * 作用：为应用内所有没有显式声明语言的用户或环境，自动判定对方输入是什么语言的文本。
 * 代价：极度节约，不用调用第三方付费 API！而是自己通过自建的“核心特征字典集”通过 O(N) 复杂度的本地探针寻找规律。
 */
export type LangResult = {
  lang: string;
  confidence: number;
};

// ============================================
// 本地 NLP 字典分发池 (Common word sets for Latin-script)
// 下方通过大量手工统计出的最高频词汇，不需要精准无误，只要匹配命中次数够高就能断定语言。
// ============================================

// 马来语核心高频词汇 (Malay High-Freq Words)
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

// 小工具：交集撞击器。拿一个字符串数组穿透字库，看命中了多长。
function countWordMatches(words: string[], wordSet: Set<string>): number {
  return words.filter(w => wordSet.has(w.toLowerCase())).length;
}

/**
 * 语言特征侦查器主控程序 (Main Language Detector)
 * 流程：
 * 1. 过滤垃圾或太短的数据。
 * 2. 先利用高成本的正值表达式尝试套特殊中日韩越俄拉丁文字组：比如只要出现汉字直接拉起准星 (0.97 confidence)。
 * 3. 应对西欧罗马字圈混淆区：去字库里跑一下。
 * 
 * @param text 需要验证的原始片段
 */
export async function detectLanguage(text: string): Promise<LangResult> {
  // 如果太短连 3 字符都没，或是空值，则直接默认为英语放过
  if (!text || text.trim().length < 3) {
    return { lang: 'en', confidence: 0.2 };
  }

  // 1. 中文系：包含了繁体和简体字库段
  if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(text)) {
    return { lang: 'zh', confidence: 0.97 };
  }

  // 2. 日文系：平假名与片假名识别
  if (/[\u3040-\u30ff]/.test(text)) {
    return { lang: 'ja', confidence: 0.97 };
  }

  // 3. 韩文系：特殊发音组区块识别
  if (/[\uac00-\ud7af]/.test(text)) {
    return { lang: 'ko', confidence: 0.97 };
  }

  // 4. 阿拉伯：语区
  if (/[\u0600-\u06ff]/.test(text)) {
    return { lang: 'ar', confidence: 0.95 };
  }

  // 5. 泰文系：专属符识别
  if (/[\u0e00-\u0e7f]/.test(text)) {
    return { lang: 'th', confidence: 0.95 };
  }

  // ============== 西欧圈字母系文字处理 ==============
  const lower = text.toLowerCase();

  // 德语特性：出现了这四个灵魂出窍符必是德文
  if (/[üöäß]/.test(lower)) {
    return { lang: 'de', confidence: 0.90 };
  }

  // 西班牙文特性：波浪符独一家
  if (/ñ/.test(lower)) {
    return { lang: 'es', confidence: 0.92 };
  }

  // 法文独有音标符号系统
  if (/[èêœç]/.test(lower)) {
    return { lang: 'fr', confidence: 0.85 };
  }

  // ================= 裸拉字母碰撞（特征无感语系） =================
  // 用空格剥离一切单词然后用循环怼向我们的高频短语库，看看匹配率谁更高。
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

    // 要求大于两层重合，否则可能仅仅只是拼音相似
    if (best.score >= 2) {
      const confidence = Math.min(0.5 + best.score * 0.1, 0.85);
      return { lang: best.lang, confidence };
    }

    // 若只有一个单词重合，勉强也给通过，但信心值大降，方便上游决定要不要信它。
    if (best.score === 1) {
      return { lang: best.lang, confidence: 0.45 };
    }
  }

  // Default: 最后如果实在测不出来，英语大一统
  return { lang: 'en', confidence: 0.6 };
}
