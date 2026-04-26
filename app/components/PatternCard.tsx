'use client';

/**
 * 认知失调模式知识库 (PATTERN_INFO)
 * 作用：针对分析出来的特定思维模式（认知扭曲）提供直观的标签和通俗易懂的定义。
 */
const PATTERN_INFO: Record<string, { label: string; description: string }> = {
  'catastrophizing': {
    label: '灾难化思考 Catastrophizing',
    description: '倾向于把事情的结果往最坏的方向想，甚至预感末日的到来。',
  },
  'all-or-nothing': {
    label: '非黑即白 All-or-Nothing',
    description: '看问题走极端，认为不完美就是彻头彻尾的失败，没有中间地带。',
  },
  'mind-reading': {
    label: '主观读心 Mind Reading',
    description: '在没有事实依据的情况下，就断定别人在想什么且通常是负面的。',
  },
  'overgeneralization': {
    label: '过度泛化 Overgeneralization',
    description: '通过单一的一次负面事件，就得出“我总是失败”这种普遍性的结论。',
  },
  'personalization': {
    label: '过度归因 Personalization',
    description: '认为别人的反应或外部突发事件都是因为自己造成的，背负不属于自己的锅。',
  },
  'filtering': {
    label: '消极过滤 Mental Filtering',
    description: '像戴了墨镜一样，只盯着生活中的负面细节，对所有正面事物视而不见。',
  },
  'emotional-reasoning': {
    label: '情绪化推理 Emotional Reasoning',
    description: '把“感觉”当做“事实”：因为我感觉很糟，所以事情一定真的很糟。',
  },
  'should-statements': {
    label: '应该化偏见 Should Statements',
    description: '用僵化的“应该”、“必须”来要求自己和他人，一旦未达标就陷入自责或愤怒。',
  },
};

interface PatternCardProps {
  name: string;
  count: number;
  maxCount: number;
}

/**
 * 组件：PatternCard (认知模式展示卡片)
 * 作用：在分析报告中展示特定思维模式的出现次数及其强度。
 * 设计逻辑：卡片的背景颜色深度由 `intensity` (count/maxCount) 动态决定，呈现“热力图”效果。
 */
export default function PatternCard({ name, count, maxCount }: PatternCardProps) {
  const info = PATTERN_INFO[name] || {
    label: name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' '),
    description: 'A detected thinking pattern in your conversations',
  };

  // 强度计算：用于动态控制背景颜色的透明度
  const intensity = Math.min(1, count / Math.max(maxCount, 1));
  const bgOpacity = 0.1 + intensity * 0.25;

  return (
    <div
      className="rounded-xl border border-purple-200 dark:border-purple-800/40 p-4 transition-all hover:shadow-md cursor-default"
      style={{ backgroundColor: `rgba(139, 92, 246, ${bgOpacity})` }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
          {info.label}
        </span>
        {/* 出现次数小标签 */}
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-200 dark:bg-purple-800/50 text-purple-700 dark:text-purple-300">
          {count}x
        </span>
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
        {info.description}
      </p>
    </div>
  );
}
