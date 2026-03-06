import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getPersonaPrompt } from "@/app/lib/ai/personaPrompts";
import { baseSystemPrompt, adultPrompt } from "@/app/lib/chat/promptBuilder";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simple rate limiter for demo endpoint
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count++;
  return entry.count <= 20;
}

/**
 * POST /api/chat/demo
 * Stateless demo chat — no DB writes, no auth required.
 * Used for the "Try it" experience on the login page.
 */
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
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
    },
  });
}
