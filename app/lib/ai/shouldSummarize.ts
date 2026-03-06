export function shouldSummarize(messageCount: number, summaryCount: number) {
  // Generate first summary after 4 messages (enough context)
  if (summaryCount === 0 && messageCount >= 4) return true;
  // Update summary every 10 messages after that
  if (summaryCount > 0 && messageCount >= (summaryCount * 10 + 4)) return true;
  return false;
}
