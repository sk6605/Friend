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
 * POST /api/chat
 * Core chat API endpoint.
 *
 * Capabilities:
 * - RAG: Semantic search and file analysis using extracted text chunks.
 * - Processing: Streamed responses via OpenAI GPT-4o-mini.
 * - System Prompt: Dynamically built based on persona, language, crisis risk, weather, and user memory.
 * - Memory: Updates long-term memory based on conversation insights.
 * - Crisis: Real-time risk assessment and intervention (Safe Mode).
 * - Tools: Weather detection, file analysis, schedule redirection.
 *
 * Services: OpenAI, Prisma, OpenWeatherMap
 */
export async function POST(req: NextRequest) {
  try {
    // ─── Rate limit by IP ───
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429 }
      );
    }

    const { messages, resumeAssistant, fileUrls, fileMetadata, fileExtractedTexts, conversationId, userId } = await req.json();

    // ─── Check account restriction ───
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

    // ─── Enforce daily message limit based on subscription plan ───
    let userPlanName = 'Free'; // default plan
    if (userId) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const messagesToday = await prisma.message.count({
        where: {
          conversation: { userId },
          role: 'user',
          createdAt: { gte: todayStart },
        },
      });

      // Get user's plan limit
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
        include: { plan: true },
      });

      const dailyLimit = subscription?.plan?.dailyMessageLimit ?? 20; // default to free plan limit
      userPlanName = subscription?.plan?.name ?? 'Free';

      // Bypass daily limit if user is in SAFE_MODE (to allow crisis intervention)
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

    // Extract content from uploaded files with RAG chunking
    let filesContent = '';
    if (fileUrls && fileUrls.length > 0 && fileMetadata && fileMetadata.length > 0) {
      // Get the user's latest message for relevance matching
      const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
      const queryText = lastUserMsg?.content || '';

      for (let i = 0; i < fileUrls.length; i++) {
        const metadata = fileMetadata[i];
        try {
          // Use pre-extracted text from upload if available
          let extractedText = fileExtractedTexts?.[i];

          // Fallback: try filesystem extraction (for backward compatibility)
          if (!extractedText) {
            const fileUrl = fileUrls[i];
            const urlPath = new URL(fileUrl, 'http://localhost').pathname;
            const filePath = path.join(process.cwd(), 'public', urlPath.replace(/^\/public\//, ''));
            if (fs.existsSync(filePath)) {
              extractedText = await extractTextFromFile(filePath, metadata.name);
            }
          }

          if (extractedText) {
            // Chunk the text and select relevant sections
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

    // ─── Fetch user for personalization + memory ───
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

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          conversations: {
            where: {
              id: { not: conversationId },
              summary: { not: null },
            },
            orderBy: { updatedAt: 'desc' },
            take: 5,
            select: { summary: true, title: true },
          },
        },
      });

      if (user) {
        // Track age group, SAFE_MODE state, and data control preference
        userAgeGroup = user.ageGroup || 'adult';
        userDataControl = user.dataControl ?? true;

        // Scope safe mode to the triggering conversation (not global)
        if (user.safeMode) {
          const activeCrisisForConv = await prisma.crisisEvent.findFirst({
            where: {
              userId,
              conversationId: conversation.id,
              riskLevel: { gte: 2 },
              status: { in: ['open', 'escalated', 'acknowledged', 'intervening'] },
            },
            select: { classificationReason: true, status: true },
          });
          isSafeMode = !!activeCrisisForConv;
          if (activeCrisisForConv) {
            if (activeCrisisForConv.status === 'intervening') isIntervening = true;
            const reason = activeCrisisForConv.classificationReason || '';
            safeModeCategory = reason.toLowerCase().includes('extreme_speech') ? 'extreme_speech' : 'self_harm';
          }
        }

        // Age-based personality
        if (user.ageGroup === 'child') ageGroupPrompt = childPrompt;
        else if (user.ageGroup === 'teen') ageGroupPrompt = teenPrompt;
        else ageGroupPrompt = adultPrompt;

        // Custom AI name and preferred language
        if (user.aiName) customAiName = user.aiName;
        if (user.language) preferredLanguage = user.language;

        // AI persona
        personaPrompt = getPersonaPrompt(user.persona || 'default');

        // User profile — include name and age if available
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
          } catch {
            // ignore malformed profile JSON
          }
        }

        // Long-term memory
        if (user.memory) {
          crossConversationMemory += `
Your long-term memory about this user (reference naturally when relevant):
${user.memory}
`;
        }

        // Recent conversation summaries for cross-chat context
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

    // ─── Growth context: inject recent emotional patterns into system prompt ───
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

    // ─── Weather detection ───
    let weatherPrompt = '';
    if (isWeatherQuery(userText)) {
      let city = extractCity(userText);

      // Fallback to user's saved city
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
        // No city available — instruct AI to ask
        weatherPrompt = `
[The user asked about weather but no city was specified and no default city is saved.]
Ask the user which city they'd like weather for, and mention you can remember it for next time.
`;
      }
    }


    // ─── Build system prompt using extracted builder ───
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

    // ─── Crisis risk assessment (before streaming) ───
    if (userId && !isSafeMode) {
      const assessment = await assessCrisisRisk(
        userText,
        messages.slice(-6).map((m: any) => ({ role: m.role, content: m.content })),
        userAgeGroup,
      );

      if (assessment.riskLevel >= 2) {
        // HIGH RISK or IMMINENT DANGER — activate SAFE_MODE
        const eventId = await recordCrisisEvent(
          userId, null, conversation.id,
          assessment.riskLevel, userText,
          assessment.reason, assessment.matchedKeywords,
        );
        await activateSafeMode(userId, eventId, assessment.reason);
        notifyCrisisIntervention(userId, {
          id: eventId,
          riskLevel: assessment.riskLevel,
          triggerContent: userText,
          category: assessment.category,
          classificationReason: assessment.reason,
          matchedKeywords: assessment.matchedKeywords,
        }).catch((err) => console.error('Crisis notification failed:', err));

        // Switch to appropriate prompt based on category
        isSafeMode = true;
        safeModeCategory = assessment.category === 'extreme_speech' ? 'extreme_speech' : 'self_harm';
        formattedMessages[0] = {
          role: 'system',
          content: safeModeCategory === 'extreme_speech'
            ? buildExtremeSpeechPrompt(effectiveLang, userAgeGroup)
            : buildCrisisSystemPrompt(effectiveLang, userAgeGroup),
        };

        // Apply account restriction for extreme speech violations
        if (assessment.category === 'extreme_speech') {
          recordViolationAndRestrict(userId, assessment.reason)
            .catch((err) => console.error('Account restriction failed:', err));
        }
      } else if (assessment.riskLevel === 1) {
        // EMOTIONAL DISTRESS — log for monitoring, continue normal flow
        recordCrisisEvent(
          userId, null, conversation.id,
          1, userText, assessment.reason, assessment.matchedKeywords,
        ).catch((err) => console.error('Crisis event logging failed:', err));
      }
    }

    const encoder = new TextEncoder();
    let fullAnswerEn = "";

    const needSummary = shouldSummarize(messageCount, conversation.summaryCount);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const openai = getOpenAIClient();
          await sleep(1500);

          if (isIntervening) {
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
              await sleep(30);
              fullAnswerEn += content;
              controller.enqueue(encoder.encode(content));
            }

            controller.close();
          }

          // Post-stream processing
          try {
            await prisma.conversation.update({
              where: { id: conversation.id },
              data: { messageCount },
            });

            // Skip title/summary/memory/schedule processing in SAFE_MODE
            if (!isSafeMode) {
              const allMsgs = [
                ...messages,
                { role: "assistant", content: fullAnswerEn },
              ];

              // Generate title on first message (don't wait for summary)
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

              // Update user memory with learned preferences (every 10 messages)
              // Respects dataControl — skip if user opted out (unless in SAFE_MODE crisis)
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

