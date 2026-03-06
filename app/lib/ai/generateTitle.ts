import { OpenAI } from "openai";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  return new OpenAI({ apiKey });
}

export async function generateTitle(content: string) {
  const prompt = `Based on the following conversation content, generate a short descriptive title (3-6 words, max 30 characters). Return ONLY the title, no quotes or extra text.

Content:
${content}`;

  const openai = getOpenAIClient();
  const res = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return res.choices[0].message.content?.trim() || "New Chat";
}
