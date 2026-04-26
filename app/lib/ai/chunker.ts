/**
 * AI RAG 文本分割机 (Context Text Chunker)
 * 作用：将解析出来的超大文档内容，切碎成重叠的小薄片（Chunks），以避免因为超过单次系统级 Token 百科全书容量，
 * 而导致调用失败或者丧失高精度定位能力。这使得大模型能有效通过有限“滑动窗口”吸收上下文。
 */

const DEFAULT_CHUNK_SIZE = 1500; // 每一块的最大容量，大概算作 ~375 个 AI token 单位
const DEFAULT_OVERLAP = 200;    // 重叠保留缓冲区（让上一段的结尾跟下一段的开头重叠 200，保证段落意思不被彻底撕碎断尾）

// 结构类型：切块实体
export interface TextChunk {
  index: number; // 当前被切出的索引标号
  content: string; // 当前这一薄块纯文身
}

/**
 * 分割作业机
 * 使用了自动探查句子句号和末尾进行优化分割的逻辑避免强行把词汇截断成两半。
 */
export function chunkText(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_OVERLAP,
): TextChunk[] {
  // 无视空文本
  if (!text || text.trim().length === 0) return [];

  // 如果原本的文本自己就很短（不超过块上限），无需使用循环池，直接送出去
  if (text.length <= chunkSize) {
    return [{ index: 0, content: text.trim() }];
  }

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    // 当大刀切下来时，看看是不是还能再优雅一点
    if (end < text.length) {
      const slice = text.slice(start, end);

      // 第一优先级找换行符 (寻找上一次出现换行标记的位置，如果有的话从那里开切断开最佳)
      const lastParagraph = slice.lastIndexOf('\n\n');
      // 如果换行符发生在此块的靠后位置 (大于容量 50%)，就在那切
      if (lastParagraph > chunkSize * 0.5) {
        end = start + lastParagraph + 2;
      } else {
        // 次级优先级：如果没空行就找中文句号。、英文. 甚至问号 ! 和 ?。
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

    // 做完了切角定桩，开始实际取出并且扔进库
    const chunk = text.slice(start, Math.min(end, text.length)).trim();
    if (chunk.length > 0) {
      chunks.push({ index, content: chunk });
      index++;
    }

    // 重置下一次的切刀起手式。因为有了 overlap，所以要退后拉回几百个词形成链环效应。
    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

/**
 * 本地低性能高配比检索：精选切片 (Top K Selector)
 * 作用：无需花钱动用 Embedding 向量提取库，直接基于用户说话里的 "关键词汇频次", 
 * 把前面切出来的那些几十块碎片中最相关（涵盖这些词最多）的前 5 块筛选出来组成最佳阵列送给 AI 看。
 */
export function selectRelevantChunks(
  chunks: TextChunk[],
  query: string,
  maxChunks = 5,
): TextChunk[] {
  // 如果统共就那么几块，那就不过滤全给。
  if (chunks.length <= maxChunks) return chunks;

  // 1.从用户的查询聊天内容里，抽取有意义的独立关键词语。抛弃所有乱七八糟的杂音符号只留大小写及汉字。
  const keywords = query
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);

  if (keywords.length === 0) {
    // 保护机制：如果用户就问个“嗯”，抽不出意义字，就给默认把前 5 块最开头的一起带走。
    return chunks.slice(0, maxChunks);
  }

  // 2.针对所有的块，进行交叉对比暴力检索记分法
  const scored = chunks.map(chunk => {
    const lower = chunk.content.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      // 巧用 split 长度减 1 得出命中的次数进行累加加分
      const matches = lower.split(kw).length - 1;
      score += matches;
    }
    return { chunk, score };
  });

  // 3.进行排位：分数高的名列前茅。如果好几块分数一样高则按原文先手出场顺序为辅
  scored.sort((a, b) => b.score - a.score || a.chunk.index - b.chunk.index);

  // 4.削头取最精髓的前 5 条，而后为了阅读连贯性，按原文的排列序号重新排序归位。
  const selected = scored.slice(0, maxChunks).map(s => s.chunk);
  selected.sort((a, b) => a.index - b.index);

  return selected;
}

/**
 * 拼装机：将筛选后的几片精肉，搭配上明确的指示说明文字后喂给模型上下文对话队列。
 */
export function formatChunksForPrompt(
  chunks: TextChunk[],
  fileName: string,
  totalChunks: number,
): string {
  if (chunks.length === 0) return '';

  // 让 AI 知道当前的资料来自于哪里、且这是全局的一小部分而不是全文，避免产生误判
  const header = `[Content from "${fileName}" — showing ${chunks.length} of ${totalChunks} sections]`;
  const body = chunks
    // 这里非常重要：插入明显的分割点，以便 AI 在寻找线索时能够清晰界定上下文的作用隔断
    .map(c => `--- Section ${c.index + 1} ---\n${c.content}`)
    .join('\n\n');

  return `${header}\n\n${body}`;
}
