import OpenAI from 'openai';

// ─── 类型定义 ───

export type CrisisCategory = 'self_harm' | 'extreme_speech' | 'none';

/**
 * 危机评估报告
 */
export interface CrisisAssessment {
  riskLevel: 0 | 1 | 2 | 3; // 风险等级 (0: 无风险, 1: 轻微, 2: 高风险, 3: 迫在眉睫)
  reason: string;            // 判定理由
  matchedKeywords: string[]; // 命中的敏感词
  isImmediateDanger: boolean;// 是否存在即刻生命危险
  category: CrisisCategory;  // 危机分类 (自残/极端言论)
}

/**
 * ─── 阶段 1：关键字词法嗅探 (Keyword Pre-filter) ───
 * 极速全正则拦截 (~0.1ms)
 * 作用：直接在本地利用正则对字典进行扫描，把 99% 的普通消息过滤在 AI 大门外，极大降低 Token 消耗成本。
 */

// 自残/自杀倾向词库
const CRISIS_KEYWORDS: { pattern: RegExp; weight: 'high' | 'medium' }[] = [
  // ── 英文直接倾向 (HIGH) ──
  { pattern: /\b(kill\s*(my|him|her)?self|suicide|suicidal|end\s*(my|this)\s*life|take\s*my\s*(own\s*)?life)\b/i, weight: 'high' },
  { pattern: /\b(want\s*to\s*die|wanna\s*die|wish\s*i\s*was\s*dead|better\s*off\s*dead)\b/i, weight: 'high' },
  { pattern: /\b(don'?t\s*want\s*to\s*(live|be\s*alive|exist)|no\s*reason\s*to\s*live)\b/i, weight: 'high' },
  { pattern: /\b(ending\s*it\s*all|end\s*it\s*all|going\s*to\s*end\s*it)\b/i, weight: 'high' },
  { pattern: /\b(self[- ]?harm|cut(ting)?\s*my(self)?|hurting?\s*my(self)?)\b/i, weight: 'high' },

  // ── 实施方案相关 (HIGH) ──
  { pattern: /\b(overdose|hang\s*myself|jump\s*(off|from)|slit\s*(my\s*)?(wrist|throat))\b/i, weight: 'high' },
  { pattern: /\b(take\s*(all\s*(the|my)\s*)?pills|swallow\s*pills)\b/i, weight: 'high' },

  // ── 间接信号 (MEDIUM) ──
  { pattern: /\b(can'?t\s*(go|keep)\s*on|can'?t\s*take\s*(it|this)\s*(any\s*more|anymore))\b/i, weight: 'medium' },
  { pattern: /\b(no\s*point\s*(in\s*)?(living|anything|going\s*on)|life\s*is\s*(not\s*worth|pointless|meaningless))\b/i, weight: 'medium' },
  { pattern: /\b(everyone\s*would\s*be\s*better\s*off\s*without\s*me)\b/i, weight: 'medium' },
  { pattern: /\b(goodbye\s*(forever|world|everyone)|farewell\s*(letter|note|message))\b/i, weight: 'medium' },
  { pattern: /\b(i'?m?\s*a\s*burden|nobody\s*(would\s*)?(cares?|miss\s*me|notice))\b/i, weight: 'medium' },
  { pattern: /\b(giving\s*away\s*(my\s*)?(stuff|things|belongings))\b/i, weight: 'medium' },

  // ── 中文支持 ──
  { pattern: /(自杀|自残|不想活|想死|结束生命|活不下去|割腕|跳楼|服药自尽|了结|寻死|厌世)/u, weight: 'high' },
  { pattern: /(活着没意思|生无可恋|世界没有我会更好|没人在乎我)/u, weight: 'medium' },

  // ── 西班牙语 ──
  { pattern: /\b(suicidarme|matarme|quiero\s*morir(me)?|no\s*quiero\s*vivir|acabar\s*con\s*mi\s*vida)\b/i, weight: 'high' },
  { pattern: /\b(autolesion|cortarme|hacerme\s*daño)\b/i, weight: 'high' },

  // ── 日语 ──
  { pattern: /(自殺|死にたい|生きたくない|自傷|リスカ|飛び降り|首吊り)/u, weight: 'high' },
  { pattern: /(生きる意味|消えたい|いなくなりたい|死んだ方がいい)/u, weight: 'medium' },

  // ── 韩语 ──
  { pattern: /(자살|죽고\s*싶|살고\s*싶지\s*않|자해|목숨을\s*끊)/u, weight: 'high' },
  { pattern: /(살아있는\s*이유|사라지고\s*싶|없어지고\s*싶)/u, weight: 'medium' },

  // ── 马来语 ──
  { pattern: /\b(bunuh\s*diri|mahu\s*mati|tak\s*mahu\s*hidup|menyakiti\s*diri)\b/i, weight: 'high' },
];

/**
 * 极端言论词典 (Extreme Speech Keywords)
 * 侦测恐怖主义、仇恨言论、暴力犯罪计划等。
 */
const EXTREME_SPEECH_KEYWORDS: { pattern: RegExp; weight: 'high' | 'medium' }[] = [
  // ── 恐怖主义/大规模暴力 (HIGH) ──
  { pattern: /\b(bomb\s*(threat|plan|making|build)|make\s*a\s*bomb|plant\s*a\s*bomb|detonate|explosive\s*device)\b/i, weight: 'high' },
  { pattern: /\b(terrorist|terrorism|jihad|mass\s*(shooting|murder|attack|casualt))\b/i, weight: 'high' },
  { pattern: /\b(school\s*shoot|shoot\s*up\s*(the|a)\s*(school|church|mosque|synagogue|mall))\b/i, weight: 'high' },
  { pattern: /\b(bio(logical)?\s*weapon|chemical\s*weapon|anthrax|ricin|sarin)\b/i, weight: 'high' },

  // ── 仇恨言论/激进主义 (HIGH) ──
  { pattern: /\b(white\s*supremac|race\s*war|ethnic\s*cleansing|genocide\s*(plan|should))\b/i, weight: 'high' },
  { pattern: /\b(kill\s*all\s*(the\s*)?(jews|muslims|christians|blacks|whites|gays|immigrants))\b/i, weight: 'high' },
  { pattern: /\b(death\s*to\s*(all\s*)?(jews|muslims|christians|blacks|whites|gays|immigrants))\b/i, weight: 'high' },

  // ── 对他人的暴力企图 (HIGH) ──
  { pattern: /\b(going\s*to\s*(kill|murder|stab|shoot)\s*(him|her|them|my|the|someone|people))\b/i, weight: 'high' },
  { pattern: /\b(plan(ning)?\s*to\s*(murder|attack|assault|kidnap|abduct))\b/i, weight: 'high' },
  { pattern: /\b(want\s*to\s*(murder|kill\s*(him|her|them|people|someone)))\b/i, weight: 'high' },
  { pattern: /\b(how\s*to\s*(murder|poison|assassinate|kidnap)\s*(someone|a\s*person)?)\b/i, weight: 'high' },

  // ── 严重非法勾当 (HIGH) ──
  { pattern: /\b(how\s*to\s*(make|cook|produce)\s*(meth|crack|fentanyl|heroin|cocaine))\b/i, weight: 'high' },
  { pattern: /\b(child\s*(porn|exploitation|abuse|trafficking)|csam|cp\s+links?)\b/i, weight: 'high' },
  { pattern: /\b(human\s*trafficking|sex\s*traffick|slave\s*trade)\b/i, weight: 'high' },
  { pattern: /\b(how\s*to\s*(hack|ddos|ransomware|phish|steal\s*(identity|credit\s*card)))\b/i, weight: 'medium' },

  // ── 中文支持 ──
  { pattern: /(恐怖袭击|恐怖主义|炸弹|爆炸|制造武器|屠杀|灭族)/u, weight: 'high' },
  { pattern: /(杀了他|杀了她|杀人计划|绑架|贩毒|制毒|人口贩卖|儿童色情)/u, weight: 'high' },
];

interface KeywordMatch {
  keyword: string;
  weight: 'high' | 'medium';
  category: 'self_harm' | 'extreme_speech';
}

/**
 * 辅助函数：扫描敏感词
 */
function scanKeywords(message: string): KeywordMatch[] {
  const matches: KeywordMatch[] = [];
  for (const { pattern, weight } of CRISIS_KEYWORDS) {
    const match = message.match(pattern);
    if (match) {
      matches.push({ keyword: match[0], weight, category: 'self_harm' });
    }
  }
  for (const { pattern, weight } of EXTREME_SPEECH_KEYWORDS) {
    const match = message.match(pattern);
    if (match) {
      matches.push({ keyword: match[0], weight, category: 'extreme_speech' });
    }
  }
  return matches;
}

/**
 * ─── 阶段 2：AI 大脑定性定级 (AI Classification) ───
 * 作用：只有在阶段 1 命中的词汇时，才会花 Token 激活大模型，去根据上下文判断这是否真的是危机。
 * 核心逻辑：区分口癖、隐喻（如“笑死我了”）与真实的求救信号。
 */

const CLASSIFICATION_PROMPT = `You are a crisis and safety risk assessment system. Your ONLY job is to classify the risk level of a user message.

Risk Levels:
- 0 = NORMAL: No risk. The keywords matched are used in a benign context (metaphor, humor, song lyrics, gaming slang like "I killed it").
- 1 = LOW CONCERN: Mild emotional distress OR casual/vague mention of sensitive topics without clear intent.
- 2 = HIGH RISK: Explicit suicidal ideation, hopelessness, or support for violence/terrorism.
- 3 = IMMINENT DANGER: Specific plan, method, or timeline for self-harm or violence.

You MUST respond with valid JSON only:
{
  "riskLevel": 0|1|2|3,
  "reason": "Brief explanation",
  "isImmediateDanger": true|false,
  "category": "self_harm"|"extreme_speech"|"none"
}`;

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  return new OpenAI({ apiKey });
}

async function classifyWithAI(
  userMessage: string,
  recentMessages: { role: string; content: string }[],
  userAgeGroup: string,
  matchedKeywords: string[],
  primaryCategory: CrisisCategory,
): Promise<CrisisAssessment> {
  const openai = getOpenAIClient();

  const contextSnippet = recentMessages
    .slice(-6)
    .map((m) => `[${m.role}]: ${m.content}`)
    .join('\n');

  const userPrompt = `User age group: ${userAgeGroup}
Matched keywords: ${matchedKeywords.join(', ')}

Context:
${contextSnippet}

Message to classify: "${userMessage}"`;

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        { role: 'system', content: CLASSIFICATION_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    const raw = res.choices[0]?.message?.content || '';
    const cleaned = raw.replace(/```json?\s*|\s*```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const aiCategory = parsed.category === 'extreme_speech' ? 'extreme_speech'
      : parsed.category === 'self_harm' ? 'self_harm'
        : primaryCategory;

    return {
      riskLevel: Math.min(3, Math.max(0, parsed.riskLevel)) as 0 | 1 | 2 | 3,
      reason: parsed.reason || 'No reason provided',
      matchedKeywords,
      isImmediateDanger: parsed.isImmediateDanger === true,
      category: parsed.riskLevel === 0 ? 'none' : aiCategory,
    };
  } catch (err) {
    console.error('Crisis AI classification failed:', err);
    // 如果 AI 挂掉但命中了高危敏感词，采取“宁错杀不放过”原则，默认设为等级 2
    return {
      riskLevel: matchedKeywords.length > 0 ? 2 : 1,
      reason: 'AI classification failed — defaulting to cautious assessment',
      matchedKeywords,
      isImmediateDanger: false,
      category: primaryCategory,
    };
  }
}
/*
�有字典飘红，才激活最便宜聪明的大语言模型去做阅读理解，判断真假和危险性级别 (AI classification only if keywords match)
 *
 * @returns 危机评估报告，附带 0-3 的风险指数 (Returns riskLevel 0-3 with explanation)
 */
export async function assessCrisisRisk(
  userMessage: string,
  recentMessages: { role: string; content: string }[],
  userAgeGroup: string,
): Promise<CrisisAssessment> {
  // Stage 1: Keyword pre-filter
  const keywordMatches = scanKeywords(userMessage);

  if (keywordMatches.length === 0) {
    return {
      riskLevel: 0,
      reason: 'No crisis keywords detected',
      matchedKeywords: [],
      isImmediateDanger: false,
      category: 'none',
    };
  }

  // Determine primary category based on keyword matches
  const hasExtreme = keywordMatches.some((m) => m.category === 'extreme_speech');
  const hasSelfHarm = keywordMatches.some((m) => m.category === 'self_harm');
  const primaryCategory: CrisisCategory = hasExtreme && !hasSelfHarm ? 'extreme_speech' : 'self_harm';

  // Stage 2: AI classification
  const matchedKeywordStrings = keywordMatches.map((m) => m.keyword);
  return classifyWithAI(userMessage, recentMessages, userAgeGroup, matchedKeywordStrings, primaryCategory);
}
