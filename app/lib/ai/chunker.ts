/**
 * Split text into overlapping chunks for RAG context injection.
 * Each chunk stays within a token-friendly size so the AI can process it.
 */

const DEFAULT_CHUNK_SIZE = 1500; // ~375 tokens per chunk
const DEFAULT_OVERLAP = 200;    // overlap between chunks for continuity

export interface TextChunk {
  index: number;
  content: string;
}

export function chunkText(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_OVERLAP,
): TextChunk[] {
  if (!text || text.trim().length === 0) return [];

  // If text is small enough, return as single chunk
  if (text.length <= chunkSize) {
    return [{ index: 0, content: text.trim() }];
  }

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    // Try to break at a paragraph or sentence boundary
    if (end < text.length) {
      const slice = text.slice(start, end);

      // Prefer paragraph break
      const lastParagraph = slice.lastIndexOf('\n\n');
      if (lastParagraph > chunkSize * 0.5) {
        end = start + lastParagraph + 2;
      } else {
        // Fallback to sentence break
        const lastSentence = Math.max(
          slice.lastIndexOf('. '),
          slice.lastIndexOf('。'),
          slice.lastIndexOf('! '),
          slice.lastIndexOf('? '),
        );
        if (lastSentence > chunkSize * 0.3) {
          end = start + lastSentence + 2;
        }
      }
    }

    const chunk = text.slice(start, Math.min(end, text.length)).trim();
    if (chunk.length > 0) {
      chunks.push({ index, content: chunk });
      index++;
    }

    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

/**
 * Select the most relevant chunks based on the user's query.
 * Simple keyword-based relevance scoring (no embeddings needed).
 */
export function selectRelevantChunks(
  chunks: TextChunk[],
  query: string,
  maxChunks = 5,
): TextChunk[] {
  if (chunks.length <= maxChunks) return chunks;

  // Extract keywords from query (lowercased, deduplicated)
  const keywords = query
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);

  if (keywords.length === 0) {
    // No useful keywords — return first N chunks
    return chunks.slice(0, maxChunks);
  }

  // Score each chunk by keyword matches
  const scored = chunks.map(chunk => {
    const lower = chunk.content.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      const matches = lower.split(kw).length - 1;
      score += matches;
    }
    return { chunk, score };
  });

  // Sort by score descending, then by original order for ties
  scored.sort((a, b) => b.score - a.score || a.chunk.index - b.chunk.index);

  // Take top chunks and re-sort by original order for coherent reading
  const selected = scored.slice(0, maxChunks).map(s => s.chunk);
  selected.sort((a, b) => a.index - b.index);

  return selected;
}

/**
 * Format selected chunks into a context string for the AI prompt.
 */
export function formatChunksForPrompt(
  chunks: TextChunk[],
  fileName: string,
  totalChunks: number,
): string {
  if (chunks.length === 0) return '';

  const header = `[Content from "${fileName}" — showing ${chunks.length} of ${totalChunks} sections]`;
  const body = chunks
    .map(c => `--- Section ${c.index + 1} ---\n${c.content}`)
    .join('\n\n');

  return `${header}\n\n${body}`;
}
