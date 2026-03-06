export async function translate(
  text: string,
  from: string,
  to: string,
  translator?: (prompt: string) => Promise<string>
): Promise<string> {
  if (from === to || !translator) return text;

  const prompt = `
Translate the following text from ${from} to ${to}.
Keep original meaning, tone, and formatting.
Do NOT add explanations.

Text:
"""${text}"""
`;

  return translator(prompt);
}
