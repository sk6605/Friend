import OpenAI from 'openai';

// ─── Types ───

export type CrisisCategory = 'self_harm' | 'extreme_speech' | 'none';

export interface CrisisAssessment {
  riskLevel: 0 | 1 | 2 | 3;
  reason: string;
  matchedKeywords: string[];
  isImmediateDanger: boolean;
  category: CrisisCategory;
}

// ─── Stage 1: Keyword Pre-filter ───
// Fast regex scan (~0.1ms) — filters out 99%+ of benign messages at zero API cost.

const CRISIS_KEYWORDS: { pattern: RegExp; weight: 'high' | 'medium' }[] = [
  // ── Direct self-harm / suicidal (HIGH) ──
  { pattern: /\b(kill\s*(my|him|her)?self|suicide|suicidal|end\s*(my|this)\s*life|take\s*my\s*(own\s*)?life)\b/i, weight: 'high' },
  { pattern: /\b(want\s*to\s*die|wanna\s*die|wish\s*i\s*was\s*dead|better\s*off\s*dead)\b/i, weight: 'high' },
  { pattern: /\b(don'?t\s*want\s*to\s*(live|be\s*alive|exist)|no\s*reason\s*to\s*live)\b/i, weight: 'high' },
  { pattern: /\b(ending\s*it\s*all|end\s*it\s*all|going\s*to\s*end\s*it)\b/i, weight: 'high' },
  { pattern: /\b(self[- ]?harm|cut(ting)?\s*my(self)?|hurting?\s*my(self)?)\b/i, weight: 'high' },

  // ── Method-related (HIGH) ──
  { pattern: /\b(overdose|hang\s*myself|jump\s*(off|from)|slit\s*(my\s*)?(wrist|throat))\b/i, weight: 'high' },
  { pattern: /\b(take\s*(all\s*(the|my)\s*)?pills|swallow\s*pills)\b/i, weight: 'high' },

  // ── Indirect signals (MEDIUM) ──
  { pattern: /\b(can'?t\s*(go|keep)\s*on|can'?t\s*take\s*(it|this)\s*(any\s*more|anymore))\b/i, weight: 'medium' },
  { pattern: /\b(no\s*point\s*(in\s*)?(living|anything|going\s*on)|life\s*is\s*(not\s*worth|pointless|meaningless))\b/i, weight: 'medium' },
  { pattern: /\b(everyone\s*would\s*be\s*better\s*off\s*without\s*me)\b/i, weight: 'medium' },
  { pattern: /\b(goodbye\s*(forever|world|everyone)|farewell\s*(letter|note|message))\b/i, weight: 'medium' },
  { pattern: /\b(i'?m?\s*a\s*burden|nobody\s*(would\s*)?(cares?|miss\s*me|notice))\b/i, weight: 'medium' },
  { pattern: /\b(giving\s*away\s*(my\s*)?(stuff|things|belongings))\b/i, weight: 'medium' },

  // ── Chinese ──
  { pattern: /(自杀|自残|不想活|想死|结束生命|活不下去|割腕|跳楼|服药自尽|了结|寻死|厌世)/u, weight: 'high' },
  { pattern: /(活着没意思|生无可恋|世界没有我会更好|没人在乎我)/u, weight: 'medium' },

  // ── Spanish ──
  { pattern: /\b(suicidarme|matarme|quiero\s*morir(me)?|no\s*quiero\s*vivir|acabar\s*con\s*mi\s*vida)\b/i, weight: 'high' },
  { pattern: /\b(autolesion|cortarme|hacerme\s*daño)\b/i, weight: 'high' },
  { pattern: /\b(no\s*vale\s*la\s*pena\s*vivir|todos\s*estarían\s*mejor\s*sin\s*mí)\b/i, weight: 'medium' },

  // ── Japanese ──
  { pattern: /(自殺|死にたい|生きたくない|自傷|リスカ|飛び降り|首吊り)/u, weight: 'high' },
  { pattern: /(生きる意味|消えたい|いなくなりたい|死んだ方がいい)/u, weight: 'medium' },

  // ── Korean ──
  { pattern: /(자살|죽고\s*싶|살고\s*싶지\s*않|자해|목숨을\s*끊)/u, weight: 'high' },
  { pattern: /(살아있는\s*이유|사라지고\s*싶|없어지고\s*싶)/u, weight: 'medium' },

  // ── Malay ──
  { pattern: /\b(bunuh\s*diri|mahu\s*mati|tak\s*mahu\s*hidup|menyakiti\s*diri)\b/i, weight: 'high' },
];

// ─── Extreme Speech Keywords ───
// Detects terrorism, hate speech, violence against others, and illegal activity.

const EXTREME_SPEECH_KEYWORDS: { pattern: RegExp; weight: 'high' | 'medium' }[] = [
  // ── Terrorism / mass violence (HIGH) ──
  { pattern: /\b(bomb\s*(threat|plan|making|build)|make\s*a\s*bomb|plant\s*a\s*bomb|detonate|explosive\s*device)\b/i, weight: 'high' },
  { pattern: /\b(terrorist|terrorism|jihad|mass\s*(shooting|murder|attack|casualt))\b/i, weight: 'high' },
  { pattern: /\b(school\s*shoot|shoot\s*up\s*(the|a)\s*(school|church|mosque|synagogue|mall))\b/i, weight: 'high' },
  { pattern: /\b(bio(logical)?\s*weapon|chemical\s*weapon|anthrax|ricin|sarin)\b/i, weight: 'high' },

  // ── Hate speech / supremacism (HIGH) ──
  { pattern: /\b(white\s*supremac|race\s*war|ethnic\s*cleansing|genocide\s*(plan|should))\b/i, weight: 'high' },
  { pattern: /\b(kill\s*all\s*(the\s*)?(jews|muslims|christians|blacks|whites|gays|immigrants))\b/i, weight: 'high' },
  { pattern: /\b(death\s*to\s*(all\s*)?(jews|muslims|christians|blacks|whites|gays|immigrants))\b/i, weight: 'high' },

  // ── Violence against others (HIGH) ──
  { pattern: /\b(going\s*to\s*(kill|murder|stab|shoot)\s*(him|her|them|my|the|someone|people))\b/i, weight: 'high' },
  { pattern: /\b(plan(ning)?\s*to\s*(murder|attack|assault|kidnap|abduct))\b/i, weight: 'high' },
  { pattern: /\b(want\s*to\s*(murder|kill\s*(him|her|them|people|someone)))\b/i, weight: 'high' },
  { pattern: /\b(how\s*to\s*(murder|poison|assassinate|kidnap)\s*(someone|a\s*person)?)\b/i, weight: 'high' },

  // ── Illegal activities (MEDIUM → escalate via AI) ──
  { pattern: /\b(how\s*to\s*(make|cook|produce)\s*(meth|crack|fentanyl|heroin|cocaine))\b/i, weight: 'high' },
  { pattern: /\b(child\s*(porn|exploitation|abuse|trafficking)|csam|cp\s+links?)\b/i, weight: 'high' },
  { pattern: /\b(human\s*trafficking|sex\s*traffick|slave\s*trade)\b/i, weight: 'high' },
  { pattern: /\b(how\s*to\s*(hack|ddos|ransomware|phish|steal\s*(identity|credit\s*card)))\b/i, weight: 'medium' },

  // ── Chinese ──
  { pattern: /(恐怖袭击|恐怖主义|炸弹|爆炸|制造武器|屠杀|灭族)/u, weight: 'high' },
  { pattern: /(杀了他|杀了她|杀人计划|绑架|贩毒|制毒|人口贩卖|儿童色情)/u, weight: 'high' },
  { pattern: /(种族清洗|仇恨犯罪|种族歧视|极端主义)/u, weight: 'medium' },

  // ── Japanese ──
  { pattern: /(テロ|爆弾|大量殺人|銃乱射|誘拐|殺害計画|児童ポルノ|人身売買)/u, weight: 'high' },
  { pattern: /(ヘイトスピーチ|民族浄化|虐殺)/u, weight: 'medium' },

  // ── Korean ──
  { pattern: /(테러|폭탄|대량\s*살상|총기\s*난사|납치|살해\s*계획|아동\s*포르노|인신매매)/u, weight: 'high' },
  { pattern: /(혐오\s*발언|인종\s*청소|학살)/u, weight: 'medium' },

  // ── Spanish ──
  { pattern: /\b(terrorismo|bomba|atentado|masacre|genocidio|secuestrar|tráfico\s*de\s*personas)\b/i, weight: 'high' },
  { pattern: /\b(discurso\s*de\s*odio|supremacismo|limpieza\s*étnica)\b/i, weight: 'medium' },

  // ── Malay ──
  { pattern: /\b(keganasan|pengganas|bom|serangan\s*besar|penculikan|pemerdagangan\s*manusia)\b/i, weight: 'high' },
];

interface KeywordMatch {
  keyword: string;
  weight: 'high' | 'medium';
  category: 'self_harm' | 'extreme_speech';
}

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

// ─── Stage 2: AI Classification ───
// Only invoked when Stage 1 finds keyword matches.

const CLASSIFICATION_PROMPT = `You are a crisis and safety risk assessment system. Your ONLY job is to classify the risk level of a user message in the context of a conversation with an AI companion chatbot.

There are TWO categories of risk:
A) SELF-HARM — suicidal ideation, self-harm, personal crisis
B) EXTREME SPEECH — terrorism, hate speech, violence against others, illegal activities

Risk Levels:
- 0 = NORMAL: No risk. The keywords matched are used in a benign context (e.g., academic discussion, fiction, metaphor, humor, song lyrics, gaming slang like "I killed it", news discussion).
- 1 = LOW CONCERN: Mild emotional distress OR casual/vague mention of sensitive topics without clear intent.
- 2 = HIGH RISK: (Self-harm) Suicidal ideation, self-harm intent, hopelessness. (Extreme) Expressing hate/support for violence/terrorism, requesting instructions for illegal acts, explicit hate speech targeting groups.
- 3 = IMMINENT DANGER: (Self-harm) Specific plan, method, timeline for self-harm. (Extreme) Specific plans for violence/attacks, active recruitment for terrorism, imminent threats against others.

Critical distinctions:
- "I'm dying of laughter" = 0 (metaphor)
- "I killed the exam" = 0 (slang)
- "What caused the terrorist attack in the news?" = 0 (academic/news discussion)
- "I feel so depressed lately" = 1/self_harm
- "I hate that group of people" = 1/extreme_speech (vague, no action)
- "I've been thinking about ending it" = 2/self_harm
- "How to make a bomb" = 2/extreme_speech (requesting dangerous instructions)
- "Kill all [group]" = 2/extreme_speech (explicit hate/violence)
- "I have pills and I'm going to take them all tonight" = 3/self_harm
- "I'm going to shoot up the school tomorrow" = 3/extreme_speech (specific threat)

AGE CONSIDERATION:
- For children (under 13) and teenagers (13-17), apply a LOWER threshold: statements that would be level 1 for adults may warrant level 2 for minors.

You MUST respond with valid JSON only. No markdown, no explanation outside JSON:
{
  "riskLevel": 0|1|2|3,
  "reason": "Brief explanation (1-2 sentences)",
  "isImmediateDanger": true|false,
  "category": "self_harm"|"extreme_speech"|"none"
}`;

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is not set');
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

Recent conversation context:
${contextSnippet}

Latest user message to classify:
"${userMessage}"`;

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
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
    // On classification failure with high-weight keywords, err on the side of caution
    const hasHighWeight = matchedKeywords.length > 0;
    return {
      riskLevel: hasHighWeight ? 2 : 1,
      reason: 'AI classification failed — defaulting to cautious assessment based on keyword match',
      matchedKeywords,
      isImmediateDanger: false,
      category: primaryCategory,
    };
  }
}

// ─── Public API ───

/**
 * Assess crisis risk of a user message using two-stage detection:
 * 1. Keyword pre-filter (instant, zero cost)
 * 2. AI classification (only if keywords match)
 *
 * Returns riskLevel 0-3 with explanation.
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
