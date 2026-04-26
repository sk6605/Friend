/**
 * AI 记忆节流阀：总结时机探针 (Summarization Threshold Checker)
 * 作用：避免每一句话都要把所有的聊天历史压缩一次（费钱费时，也是为了符合 token 滑动窗口）。
 *      这里提供了一个灵活扩展的阶梯算法。
 * 
 * @param {number} messageCount 当前这条对话链总共发生的发言回合记数
 * @param {number} summaryCount 这条对话链已经做过几次主动压缩归纳了
 * @returns {boolean} 向中心引擎发放许可，告诉它可以开启耗资昂贵的总结线程了
 */
export function shouldSummarize(messageCount: number, summaryCount: number) {
  // 第一个阈值：当房间聊天破冰起步（大于等 4 句对话轮次）时，执行这辈子的第一次大纲梳理
  if (summaryCount === 0 && messageCount >= 4) return true;
  // 第二个阶梯增长：初夜之后，每过 10 句话积累了一定的墨水后，再挤压做一次覆盖式总结覆盖。
  if (summaryCount > 0 && messageCount >= (summaryCount * 10 + 4)) return true;
  
  // 其余时间安静关闭
  return false;
}
