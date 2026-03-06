import OpenAI from "openai";

export async function generateSummary(messages: any[]) {

    function getOpenAIClient() {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY environment variable is not set");
      }
      return new OpenAI({
        apiKey,
      });
    }

  const openai = getOpenAIClient();
  const formatted = messages.map(m => ({ role: m.role, content: m.content }));
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: "Please summarize the following dialogue for me concisely." },
      ...formatted
    ]
  });
  return response.choices[0]?.message?.content || "Failed to generate summary";
}