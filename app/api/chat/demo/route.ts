import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getPersonaPrompt } from "@/app/lib/ai/personaPrompts";
import { baseSystemPrompt, adultPrompt } from "@/app/lib/chat/promptBuilder";
import { prisma } from "@/app/lib/db";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Persistent rate limiter for demo endpoint using Prisma.
 * Limits each IP to a certain number of messages per 24 hours.
 */
async function checkPersistentRateLimit(ip: string): Promise<{ allowed: boolean; remaining?: number }> {
  const MAX_DAILY_DEMO = 8; // Allowing 8 free messages per IP per 24h
  const now = new Date();
  
  try {
    const entry = await prisma.demoUsage.upsert({
      where: { ip },
      update: {},
      create: { ip, count: 0, lastUsed: now },
    });

    // Check if it's a new day (24h window)
    const lastUsed = new Date(entry.lastUsed);
    const isNewDay = now.getTime() - lastUsed.getTime() > 24 * 60 * 60 * 1000;

    let newCount = isNewDay ? 1 : entry.count + 1;

    if (!isNewDay && entry.count >= MAX_DAILY_DEMO) {
      return { allowed: false, remaining: 0 };
    }

    await prisma.demoUsage.update({
      where: { ip },
      data: {
        count: newCount,
        lastUsed: now,
      },
    });

    return { allowed: true, remaining: MAX_DAILY_DEMO - newCount };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    // Fail open or closed? For demo, we can fail open but log it.
    return { allowed: true };
  }
}

/**
 * POST /api/chat/demo
 * Stateless demo chat — no DB writes for messages, but tracks IP usage.
 */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
    req.headers.get("x-real-ip") || 
    "unknown";

  const { allowed, remaining } = await checkPersistentRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Demo limit reached. Please sign up for unlimited access! ✨" },
      { status: 429 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Service unavailable." },
      { status: 503 }
    );
  }

  const { messages, persona, language } = await req.json();

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Invalid messages." }, { status: 400 });
  }

  // Prevent excessively long demo messages
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.content && lastMessage.content.length > 300) {
    return NextResponse.json({ error: "Message too long." }, { status: 400 });
  }

  const langRule =
    language === "en"
      ? "MANDATORY LANGUAGE RULE: You MUST reply exclusively in English. Do not use any other language, regardless of what language the user writes in."
      : "MANDATORY LANGUAGE RULE: You MUST reply exclusively in Chinese (Simplified). Do not use any other language, regardless of what language the user writes in.";

  const personaOverlay = getPersonaPrompt(persona || "default");
  const systemPrompt = [langRule, baseSystemPrompt, adultPrompt, personaOverlay]
    .filter(Boolean)
    .join("\n\n");

  const openai = new OpenAI({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await sleep(600);

        const response = await openai.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.map((m: { role: string; content: string }) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          ],
          stream: true,
        });

        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (!content) continue;
          await sleep(20);
          controller.enqueue(encoder.encode(content));
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-RateLimit-Remaining": remaining?.toString() || "0",
    },
  });
}
