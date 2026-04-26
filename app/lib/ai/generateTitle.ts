// 导入 OpenAI 官方 Node.js 客户端驱动
import { OpenAI } from "openai";

/**
 * 局部隔离封装：获取已加载了机密环境变量的 OpenAI 实例
 * 作用：确保避免未注入 Key 就发送请求的黑洞错误，尽早阻断挂错。
 * @returns {OpenAI} 配置完毕的可用请求客户端
 */
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  return new OpenAI({ apiKey });
}

/**
 * 标题自动提炼器 (Auto Title Generator)
 * 作用：当用户新建聊天记录并说出第一句话之后，把内容丢给最便宜快速的小模型（4.1-mini），
 *      让它强行归纳出一个极短的“聊天房间名”，挂在侧边栏历史记录处，替代空洞的 "New Chat"。
 * 
 * @param {string} content 用户在当前房间说的长篇大论或首句开场白
 * @returns {Promise<string>} 经过严苛限制抽出来的纯文本短标题
 */
export async function generateTitle(content: string) {
  // 制约极强的系统提示词：强求它只返回 3~6 个字且不要加废话引号
  const prompt = `Based on the following conversation content, generate a short descriptive title (3-6 words, max 30 characters). Return ONLY the title, no quotes or extra text.

Content:
${content}`;

  const openai = getOpenAIClient();
  // 调用快模型产生结案
  const res = await openai.chat.completions.create({
    model: "gpt-4.1-mini", // 廉价、速度极快，用来抽副标题最合理
    messages: [{ role: "user", content: prompt }],
  });

  // 如果它偶尔发疯啥也没返回，就安全回滚到默认字眼防备报错
  return res.choices[0].message.content?.trim() || "New Chat";
}
