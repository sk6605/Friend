// 导入官方大语言模型驱动
import OpenAI from "openai";

/**
 * 后台压缩算子：对话总结归纳提炼器
 * 作用：如果房间消息超过了一定限度，强行把几十条废话对话全部灌给模型太贵了而且容易突破 token 失忆。
 * 我们调用这个工具，强行将这大几千字揉合成一段干练的 100 字主轴，
 * 下一次聊天只要带着这个主轴，AI 就回忆起跟用户这辈子的关联。
 * 
 * @param {any[]} messages 前端发来的这个房间一长串历史发言聊天记录对象
 * @returns {Promise<string>} 经过脱水浓缩后产生的信息小结
 */
export async function generateSummary(messages: any[]) {

    // 局部内挂实例，防止初始化炸栈
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
  // 清洗从数据库进来的脏数据，只留下角色类型和纯发言给模型去总结
  const formatted = messages.map(m => ({ role: m.role, content: m.content }));
  
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini", // 使用大锅炖型小词库模型应付归纳游刃有余
    messages: [
      { role: "system", content: "Please summarize the following dialogue for me concisely." },
      ...formatted // 展解打散接盘全对话数组
    ]
  });
  
  // 抽出提炼结果返回，作为这整个房间的唯一核心灵魂保存
  return response.choices[0]?.message?.content || "Failed to generate summary";
}