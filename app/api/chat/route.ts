import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { extractTextFromFile } from "@/app/lib/fileExtractor";
import { chunkText, selectRelevantChunks, formatChunksForPrompt } from "@/app/lib/ai/chunker";
import * as fs from 'fs';
import * as path from 'path';
import { detectLanguage } from "@/app/lib/language/detect";

import { shouldSummarize } from "@/app/lib/ai/shouldSummarize";
import { generateSummary } from "@/app/lib/ai/summary";
import { generateTitle } from "@/app/lib/ai/generateTitle";
import { prisma } from "@/app/lib/db";
import { isWeatherQuery, extractCity, fetchWeather, formatWeatherForPrompt } from "@/app/lib/weather";
import { assessCrisisRisk } from "@/app/lib/crisis/crisisDetector";
import { buildCrisisSystemPrompt, buildExtremeSpeechPrompt } from "@/app/lib/crisis/crisisPrompts";
import { activateSafeMode, recordCrisisEvent } from "@/app/lib/crisis/safeMode";
import { notifyCrisisIntervention } from "@/app/lib/crisis/interventionNotifier";
import { checkRestriction, recordViolationAndRestrict } from "@/app/lib/crisis/accountRestriction";
import { getPersonaPrompt } from "@/app/lib/ai/personaPrompts";

import { updateDailyStreak } from "@/app/lib/chat/gamification";
import { buildSystemPrompt, childPrompt, teenPrompt, adultPrompt } from "@/app/lib/chat/promptBuilder";


function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  return new OpenAI({ apiKey });
}


// ─── Simple in-memory rate limiter (per IP) ───
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 15;        // max 15 requests per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60_000);

/**
 * 接口：POST /api/chat
 * 作用：核心聊天处理引擎。支持 AI 流式输出、RAG (检索增强生成)、危机监测与干预、个性化记忆及分级订阅限制。
 * 
 * 核心流程：
 * 1. 频率限制 (Rate Limiting)
 * 2. 账号封禁检查 (Account Restriction)
 * 3. 订阅额度检查 (Daily Limit)
 * 4. RAG 增强：分析上传文件并进行语义分片匹配。
 * 5. 个性化上下文构建：聚合用户画像、长期记忆、近期心情模式及天气。
 * 6. 危机安全评估：实时检测自残/极端言论，触发安全模式。
 * 7. AI 响应流生成：调用 OpenAI GPT 模型。
 * 8. 后处理：更新对话标题、生成摘要、同步长期记忆。
 */
export async function POST(req: NextRequest) {
  try {
    // ─── 频率限制：基于 IP 的简易内存限流 ───
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429 }
      );
    }

    const { messages, resumeAssistant, fileUrls, fileMetadata, fileExtractedTexts, conversationId, userId } = await req.json();

    // ─── 安全检查：账号封禁状态校验 ───
    if (userId) {
      const restriction = await checkRestriction(userId);
      if (restriction.restricted) {
        const untilMsg = restriction.restrictedUntil
          ? `Your account is temporarily restricted until ${restriction.restrictedUntil.toISOString()}. `
          : 'Your account has been permanently restricted. ';
        return NextResponse.json(
          { error: untilMsg + 'Please contact support if you believe this is an error.', restricted: true },
          { status: 403 },
        );
      }
    }

    // ─── 阶梯订阅限制：根据不同计划强制每日消息限额 ───
    let userPlanName = 'Free'; // 默认计划
    if (userId) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // 统计用户今日发送的消息数
      const messagesToday = await prisma.message.count({
        where: {
          conversation: { userId },
          role: 'user',
          createdAt: { gte: todayStart },
        },
      });

      // 获取当前计划配置
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
        include: { plan: true },
      });

      const dailyLimit = subscription?.plan?.dailyMessageLimit ?? 20; // 免费版默认 20 条
      userPlanName = subscription?.plan?.name ?? 'Free';

      // 异常豁免：若处于 SafeMode (安全模式/危机干预中)，则强行绕过额度限制，确保能输出劝导信息。
      const isUserSafeMode = await prisma.user.findUnique({ where: { id: userId }, select: { safeMode: true } });

      if (dailyLimit !== -1 && messagesToday >= dailyLimit && !isUserSafeMode?.safeMode) {
        return NextResponse.json(
          {
            error: `You've reached your daily limit of ${dailyLimit} messages. Upgrade your plan for more!`,
            limitReached: true,
            dailyLimit,
            messagesUsed: messagesToday,
          },
          { status: 429 }
        );
      }
    }

    // ─── Gamification: Update Streak ───
    if (userId) {
      // 通过抽离的服务模块异步更新用户的活跃连续记录 (Update streak asynchronously using extracted service)
      updateDailyStreak(userId).catch(err => console.error("Streak sync error:", err));
    }

    let conversation;

    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });
    }

    if (!conversation) {
      const createData: any = {
        messageCount: 0,
        summaryCount: 0,
        title: "New Conversation",
        userId: userId || undefined,
      };
      if (conversationId) createData.id = conversationId;

      conversation = await prisma.conversation.create({
        data: createData,
      });
    }

    const messageCount = conversation.messageCount + 1;

    // ─── RAG 实现：基于已上传文件的内容检索 ───
    let filesContent = '';
    if (fileUrls && fileUrls.length > 0 && fileMetadata && fileMetadata.length > 0) {
      const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
      const queryText = lastUserMsg?.content || '';

      for (let i = 0; i < fileUrls.length; i++) {
        const metadata = fileMetadata[i];
        try {
          // 优先使用前端预提取的文本
          let extractedText = fileExtractedTexts?.[i];

          // 兜底：若预提取失败，尝试在服务端二次提取
          if (!extractedText) {
            const fileUrl = fileUrls[i];
            const urlPath = new URL(fileUrl, 'http://localhost').pathname;
            const filePath = path.join(process.cwd(), 'public', urlPath.replace(/^\/public\//, ''));
            if (fs.existsSync(filePath)) {
              extractedText = await extractTextFromFile(filePath, metadata.name);
            }
          }

          if (extractedText) {
            // 对文本进行分片 (Chunking) 并基于当前对话内容选择最相关的前 5 个片段
            const allChunks = chunkText(extractedText);
            const relevantChunks = selectRelevantChunks(allChunks, queryText, 5);
            const formatted = formatChunksForPrompt(relevantChunks, metadata.name, allChunks.length);
            filesContent += `\n\n${formatted}`;
          }
        } catch (error) {
          console.error(`Error processing file ${metadata.name}:`, error);
        }
      }
    }

    // ─── 个性化与跨会话记忆 (Cross-Session Memory) ───
    let userProfilePrompt = '';
    let ageGroupPrompt = adultPrompt;
    let crossConversationMemory = '';
    let customAiName = 'Lumi';
    let preferredLanguage = '';
    let personaPrompt = '';
    let isSafeMode = false;
    let isIntervening = false;
    let safeModeCategory = 'self_harm' as 'self_harm' | 'extreme_speech';
    let userAgeGroup = 'adult';
    let userDataControl = true;
    let isMemoryEnabled = false;
    let isCustomPersonaEnabled = false;

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscription: { include: { plan: true } },
          conversations: {
            where: {
              id: { not: conversationId },
              summary: { not: null },
            },
            orderBy: { updatedAt: 'desc' },
            take: 5, // 获取最近 5 次不同会话的摘要，维持认知连续性
            select: { summary: true, title: true },
          },
        },
      });

      if (user) {
        // 功能开关检查 (基于订阅)
        isMemoryEnabled = user.subscription?.plan?.memoryEnabled ?? false;
        isCustomPersonaEnabled = user.subscription?.plan?.customAiPersonality ?? false;
        userAgeGroup = user.ageGroup || 'adult';
        userDataControl = user.dataControl ?? true;

        // 【核心】SafeMode 局部化判断
        // 我们只在触发危机的那个对话中开启安全模式，而不影响其他并行会话。
        if (user.safeMode) {
          const activeCrisisForConv = await prisma.crisisEvent.findFirst({
            where: {
              userId,
              conversationId: conversation.id,
              riskLevel: { gte: 2 },
              status: { in: ['open', 'escalated', 'acknowledged', 'intervening'] },
            },
            select: { id: true, classificationReason: true, status: true },
          });
          isSafeMode = !!activeCrisisForConv;
          if (activeCrisisForConv) {
            const reason = activeCrisisForConv.classificationReason || '';
            safeModeCategory = reason.toLowerCase().includes('extreme_speech') ? 'extreme_speech' : 'self_harm';
          }
        }

        // 年龄段适配提示词
        if (user.ageGroup === 'child') ageGroupPrompt = childPrompt;
        else if (user.ageGroup === 'teen') ageGroupPrompt = teenPrompt;
        else ageGroupPrompt = adultPrompt;

        if (user.aiName) customAiName = user.aiName;
        if (user.language) preferredLanguage = user.language;

        // 根据订阅权限决定是否启用自定义人格
        const effectivePersona = isCustomPersonaEnabled ? (user.persona || 'default') : 'default';
        personaPrompt = getPersonaPrompt(effectivePersona);

        // 构建用户基础画像描述
        userProfilePrompt = `
About this user (use naturally in conversation, don't list these back):
- Name: ${user.nickname}
${user.age ? `- Age: ${user.age}` : '- Age: not provided (treat as adult)'}
`;
        if (user.profile) {
          try {
            const p = JSON.parse(user.profile) as Record<string, string>;
            if (p.interests) userProfilePrompt += `- Interests: ${p.interests}\n`;
            if (p.hobbies) userProfilePrompt += `- Hobbies: ${p.hobbies}\n`;
            if (p.goals) userProfilePrompt += `- Goals: ${p.goals}\n`;
          } catch { /* ignore */ }
        }

        // 注入长期记忆 (Pro 专属)
        if (user.memory && isMemoryEnabled) {
          crossConversationMemory += `
Your long-term memory about this user (reference naturally when relevant):
${user.memory}
`;
        }

        // 注入跨对话历史摘要，让 AI 记得“上次我们聊了什么”
        if (user.conversations.length > 0) {
          const summaries = user.conversations
            .filter(c => c.summary)
            .map(c => `- [${c.title}]: ${c.summary}`)
            .join('\n');
          if (summaries) {
            crossConversationMemory += `
Recent conversation history with this user (use to maintain continuity):
${summaries}
`;
          }
        }
      }
    }

    // ─── 成长洞察：将近期（7天内）的情绪模式注入 Prompt，让 AI 更懂用户 ───
    if (userId && userDataControl) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentInsights = await prisma.dailyInsight.findMany({
        where: { userId, date: { gte: sevenDaysAgo } },
        orderBy: { date: 'desc' },
        take: 7,
      });

      const patternsFound = recentInsights.filter(i => i.thinkingPattern || i.triggerEvent);
      if (patternsFound.length > 0) {
        const patternSummary = patternsFound.map(i => {
          const parts = [i.date.toISOString().slice(0, 10)];
          if (i.mood) parts.push(`mood: ${i.mood}`);
          if (i.triggerEvent) parts.push(`trigger: ${i.triggerEvent}`);
          if (i.thinkingPattern) parts.push(`pattern: ${i.thinkingPattern}`);
          return parts.join(', ');
        }).join('\n');

        crossConversationMemory += `
Recent emotional patterns (reference naturally when relevant, be supportive not clinical):
${patternSummary}
`;
      }
    }

    // Detect language
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === "user");
    const userText = lastUserMessage?.content || "";
    const { lang } = await detectLanguage(userText);
    const useNumberedSections = !!(filesContent);

    // ─── 天气工具：检测用户是否询问天气并注入实时数据 ───
    let weatherPrompt = '';
    if (isWeatherQuery(userText)) {
      let city = extractCity(userText);

      // 兜底：若询问中未提及城市，尝试使用用户资料中保存的城市
      if (!city && userId) {
        const weatherUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { city: true },
        });
        city = weatherUser?.city || null;
      }

      if (city) {
        const weather = await fetchWeather(city);
        if (weather) {
          weatherPrompt = formatWeatherForPrompt(weather);
        }
      } else {
        // 如果无法确定城市，指示 AI 主动询问并告知可以记住它
        weatherPrompt = `
[The user asked about weather but no city was specified and no default city is saved.]
Ask the user which city they'd like weather for, and mention you can remember it for next time.
`;
      }
    }


    // ─── 组装系统提示词 (Final System Prompt Assembly) ───
    const effectiveLang = preferredLanguage || lang;
    const systemPrompt = buildSystemPrompt({
      isSafeMode,
      safeModeCategory,
      effectiveLang,
      userAgeGroup,
      customAiName,
      ageGroupPrompt,
      personaPrompt,
      userPlanName,
      userProfilePrompt,
      crossConversationMemory,
      useNumberedSections,
      weatherPrompt,
    });

    // Format messages for OpenAI
    const formattedMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((msg: any) => {
        let content = msg.content;
        if (msg.role === "user") {
          if (filesContent && content.includes("【已上传文件】")) {
            content += filesContent;
          }
        }
        return {
          role: (msg.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
          content,
        };
      }),
    ];

    if (typeof resumeAssistant === "string" && resumeAssistant.length > 0) {
      formattedMessages.push({ role: "assistant", content: resumeAssistant });
      formattedMessages.push({
        role: "user",
        content: "Continue from the partial assistant message above. Do NOT repeat any text already present. Continue seamlessly from the exact end.",
      });
    }

    // ─── 核心安全防护：危机风险概率评估 (Crisis Risk Assessment) ───
    let justActivatedSafeMode = false;
    if (userId) {
      // 在提交给 AI 之前，先通过专用检测引擎评估是否存在自残或极端言论
      const assessment = await assessCrisisRisk(
        userText,
        messages.slice(-6).map((m: any) => ({ role: m.role, content: m.content })),
        userAgeGroup,
      );

      if (assessment.riskLevel >= 2) {
        // 高风险触发：持久化危机记录并立即推送到管理终端
        const eventId = await recordCrisisEvent(
          userId, null, conversation.id,
          assessment.riskLevel, userText,
          assessment.reason, assessment.matchedKeywords,
        );

        notifyCrisisIntervention(userId, {
          id: eventId,
          riskLevel: assessment.riskLevel,
          triggerContent: userText,
          category: assessment.category,
          classificationReason: assessment.reason,
          matchedKeywords: assessment.matchedKeywords,
        }).catch((err) => console.error('Crisis notification failed:', err));

        // 首次触发：强制开启 SafeMode（安全模式）
        // 此时系统提示词将被重置为“热线接线员”模式，不再进行常规闲聊。
        if (!isSafeMode) {
          await activateSafeMode(userId, eventId, assessment.reason);
          isSafeMode = true;
          justActivatedSafeMode = true;
          safeModeCategory = assessment.category === 'extreme_speech' ? 'extreme_speech' : 'self_harm';

          formattedMessages[0] = {
            role: 'system',
            content: safeModeCategory === 'extreme_speech'
              ? buildExtremeSpeechPrompt(effectiveLang, userAgeGroup)
              : buildCrisisSystemPrompt(effectiveLang, userAgeGroup),
          };
        }

        // 账号阶梯限制：若为极端言论违规，则自动记录违规次数并可能触发禁言。
        if (assessment.category === 'extreme_speech') {
          await recordViolationAndRestrict(userId, assessment.reason);
        }
      }
    }

    // ─── AI 输出闸门：当管理员手动干预时，静默 AI 响应 ───
    // 如果已经由管理员介入聊天 (Intervening)，AI 必须立刻停止生成，等待人工处理。
    if (isSafeMode && !justActivatedSafeMode) {
      if (userId) {
        try {
          await prisma.message.create({
            data: {
              conversationId: conversation.id,
              role: 'user',
              content: userText,
              fileAttachments: fileUrls.length > 0 ? JSON.stringify(fileUrls.map((url: string, i: number) => ({
                url, name: fileMetadata[i].name, size: fileMetadata[i].size, type: fileMetadata[i].type
              }))) : null,
            }
          });
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { messageCount: messageCount }
          });
        } catch (e) { console.error("Error saving silent user message:", e); }
      }

      // 返回空响应，前端检测到无流式输出时会显示“管理员已介入”等提示。
      return new Response(null, { status: 200 });
    }

    // ─── 启动响应流 (Stream response) ───
    const encoder = new TextEncoder();
    let fullAnswerEn = "";

    const needSummary = shouldSummarize(messageCount, conversation.summaryCount);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const openai = getOpenAIClient();
          await sleep(1500); // 模拟人类思考停顿

          if (isSafeMode && !justActivatedSafeMode) {
            // Human is actively intervening: do not call OpenAI. AI is paused.
            controller.close();
          } else {
            const response = await openai.chat.completions.create({
              model: "gpt-4.1-mini",
              messages: formattedMessages,
              stream: true,
            });

            for await (const chunk of response) {
              const content = chunk.choices[0]?.delta?.content || "";
              if (!content) continue;
              await sleep(30); // 模拟打字机效果
              fullAnswerEn += content;
              controller.enqueue(encoder.encode(content));
            }

            controller.close();
          }

          // ─── 后处理逻辑：在流结束后异步执行，不阻塞主流程 ───
          try {
            await prisma.conversation.update({
              where: { id: conversation.id },
              data: { messageCount },
            });

            // 如果处于正常模式，执行摘要、标题生成及记忆更新
            if (!isSafeMode) {
              const allMsgs = [
                ...messages,
                { role: "assistant", content: fullAnswerEn },
              ];

              // 首次对话：自动生成简洁标题
              if (messageCount === 1) {
                const firstUserMsg = messages.find((m: any) => m.role === 'user');
                if (firstUserMsg) {
                  const title = await generateTitle(firstUserMsg.content);
                  await prisma.conversation.update({
                    where: { id: conversation.id },
                    data: { title },
                  });
                }
              }

              // 定期摘要：防止历史消息过长导致 Token 溢出
              if (needSummary) {
                const summary = await generateSummary(allMsgs);
                const title = await generateTitle(summary);
                await prisma.conversation.update({
                  where: { id: conversation.id },
                  data: {
                    summary,
                    title,
                    summaryCount: { increment: 1 },
                  },
                });
              }

              // 学习用户：每 10 条消息迭代一次长期记忆
              if (userId && messageCount % 10 === 0 && (userDataControl || isSafeMode)) {
                await updateUserMemory(userId);
              }



              // Save city from weather query only if user explicitly mentioned a specific city
              // and the weather API successfully validated it
              if (userId && isWeatherQuery(userText)) {
                const cityMentioned = extractCity(userText);
                if (cityMentioned) {
                  // Validate with weather API before saving
                  const validWeather = await fetchWeather(cityMentioned);
                  if (validWeather) {
                    const currentUser = await prisma.user.findUnique({
                      where: { id: userId },
                      select: { city: true },
                    });
                    if (!currentUser?.city || currentUser.city !== validWeather.city) {
                      await prisma.user.update({
                        where: { id: userId },
                        data: { city: validWeather.city },
                      });
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.error("Post-stream processing failed:", e);
          }
        } catch (err) {
          controller.error(err);
        }
      },
    });

    const responseHeaders: Record<string, string> = {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    };
    if (isSafeMode) {
      responseHeaders["X-Safe-Mode"] = "true";
    }

    return new Response(stream, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Chat API Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to generate response: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * Analyze recent conversations and update the user's long-term memory.
 * Extracts preferences, speaking style, recurring topics, and key facts.
 */
async function updateUserMemory(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        conversations: {
          orderBy: { updatedAt: 'desc' },
          take: 3,
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
          },
        },
      },
    });

    if (!user || user.conversations.length === 0) return;

    const recentUserMessages = user.conversations
      .flatMap(c => c.messages.filter(m => m.role === 'user').map(m => m.content))
      .slice(0, 30);

    if (recentUserMessages.length < 5) return;

    const openai = getOpenAIClient();
    const existingMemory = user.memory || 'No existing memory.';

    const res = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `You are an AI memory manager. Analyze the user's recent messages and update their long-term memory profile.

Current memory:
${existingMemory}

Extract and update:
- Communication style (formal/casual, emoji usage, language preferences)
- Recurring interests and topics
- Important life events or facts they've shared
- Preferences and dislikes
- Current goals or challenges
- Emotional patterns

Output a concise memory document (max 500 words). Merge with existing memory — don't lose old facts, but update outdated info.
CONTENT SAFETY: Do NOT include or reference any unsafe, illegal, or extreme content. Skip messages containing violence, self-harm methods, illegal activities, or explicit content. Only retain safe, constructive insights.`,
        },
        {
          role: 'user',
          content: `Recent messages from the user:\n${recentUserMessages.map((m, i) => `${i + 1}. ${m}`).join('\n')}`,
        },
      ],
    });

    const newMemory = res.choices[0]?.message?.content;
    if (newMemory) {
      await prisma.user.update({
        where: { id: userId },
        data: { memory: newMemory },
      });
    }
  } catch (err) {
    console.error('Failed to update user memory:', err);
  }
}

