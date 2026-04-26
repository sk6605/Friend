'use client';

// 引入 React Hook：提供状态管理、副作用控制以及回调函数的缓存
import { useState, useEffect, useCallback } from 'react';
// 以下为自相关子组件引入：用于将抽象后的数据转变为不同的可视化卡片及图表
import EmotionBreakdown from './EmotionBreakdown';
import InsightBanner from './InsightBanner';
import DayOfWeekHeatmap from './DayOfWeekHeatmap';
import TriggerPieChart from './TriggerPieChart';
import GrowthCard from './GrowthCard';
import MoodChart from '../MoodChart';
import PatternCard from '../PatternCard';

/**
 * 接口：AggregatedData（聚合数据模型）
 * 作用：定义该组件向后端接口拉取 3 天统计概览后期望接收的数据解构。
 * 用法：作为 data 状态的类型约束。
 */
interface AggregatedData {
    // 情绪分布的占比统计
    emotionBreakdown: { mood: string; percentage: number; count: number; topTriggers: string[]; topTopics: string[] }[];
    // 情绪起伏折线图的点阵数据
    moodCurve: { date: string; moodScore: number; mood: string }[];
    // 情绪触发源的出现次数统计
    triggers: { name: string; count: number }[];
    // 思维模式/认知模式的特征捕捉统计
    patterns: { name: string; count: number }[];
    // 近期谈论的主要话题关键词聚类
    topics: { name: string; count: number }[];
    // 在不同时间段（周几）的平均情绪偏向
    dayOfWeek: { day: string; avgMood: number; count: number }[];
    // 全局基础概览（总均分、走势、消息数、天数等）
    summary: { avgMood: number | null; trend: string; totalMessages: number; totalDays: number; topTrigger: string | null; topPattern: string | null };
    // 自然语言形式的洞察文案，提取了最核心的用户总结
    naturalInsights: string[];
    // 干预/提升建议（认知干预、行为干预或情感支持）
    interventions: { type: 'cognitive' | 'behavioral' | 'support'; title: string; description: string; reason: string }[];
}

/**
 * 组件：ThreeDayTab (三日数据洞察面板)
 * 作用：从后端获取用户最近三天内的聊天日志统计及情绪洞察，并将各项分析结果展示给用户。
 * 引用位置：通常是被放置在 /insights (数据洞见) 页面下的选卡区域之一。
 * 
 * @param {string} userId - 当前查看数据分析的用户的唯一标识符，向后端请求数据的关键凭证
 */
export default function ThreeDayTab({ userId }: { userId: string }) {
    // 状态：用于存储由后端抓取后反序列化解析出的完整统计数据
    const [data, setData] = useState<AggregatedData | null>(null);
    // 状态：标明当前是否处于数据拉取期间，用于展示骨架屏或加载圈
    const [loading, setLoading] = useState(true);
    // 状态：标识后端是否认为用户有足够的数据（通常是最近有聊天记录）来生成有效视图
    const [available, setAvailable] = useState(true);

    /**
     * 函数：fetchData
     * 作用：异步从服务端获取 3 天跨度的聚合式用户洞察数据。
     * 调用：组件挂载后，通过 useEffect 自动调用。
     */
    const fetchData = useCallback(async () => {
        setLoading(true); // 打开加载指示器
        try {
            // 通过 fetch 拉取服务端的洞察路由信息，附带标识及所需的时间跨度 tab
            const res = await fetch(`/api/insights?userId=${userId}&tab=3day`);
            const json = await res.json();
            
            // 如果后端检测到不满足 3 天统计基础门槛（如只有半天记录或没有记录）
            if (!json.available) {
                setAvailable(false); // 对界面宣发“数据不可用”状态
                setData(null); // 清空遗留数据
            } else {
                setAvailable(true); // 声明数据可用
                setData(json.data); // 赋予最新的计算结果装载进页面组件
            }
        } catch { 
            /* 如果网络断开或报错则默默忽略，让组件保持在上一个有效状态并在稍后尝试。此处最好加错误监控 */ 
        }
        setLoading(false); // 数据获取流程结束，去掉加载指示器
    }, [userId]);

    // 钩子：每当组件被挂载进入浏览视野，或者用户ID发生变化时，重新触发向后端取数流程
    useEffect(() => { fetchData(); }, [fetchData]);

    // 界面条件渲染 1：正在加载时的过场界面（展现旋转圈动画）
    if (loading) {
        return <div className="flex items-center justify-center h-48"><div className="w-7 h-7 border-3 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>;
    }

    // 界面条件渲染 2：如果没有足够的数据或者拉取为空，展示空状态提示墙
    if (!available || !data) {
        return (
            <div className="text-center py-16">
                <div className="text-4xl mb-4">📊</div>
                <h3 className="text-base font-semibold text-neutral-700 dark:text-neutral-300 mb-2">No 3-day data yet</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Chat for at least one day to see your 3-day analysis.
                </p>
            </div>
        );
    }

    // 变量计算：根据总览数据的 trend 值（improving[向好], declining[下降]），计算用于展示在分数旁边的箭头 icon
    const trendIcon = data.summary.trend === 'improving' ? '↗' : data.summary.trend === 'declining' ? '↘' : '→';

    // 界面主要渲染：核心数据的列表容器
    return (
        <div className="space-y-5">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">3-Day Analysis</h3>

            {/* Natural language insights - 调用自然语言总结看板组件，展现模型总结的提炼语 */}
            <InsightBanner insights={data.naturalInsights} />

            {/* Summary row - 数据核心 3 大指标（均分，总会话，记录天数）卡组排列 */}
            <div className="grid grid-cols-3 gap-3">
                <StatCard label="Avg Mood" value={data.summary.avgMood?.toFixed(1) || '—'} sub={`/10 ${trendIcon}`} />
                <StatCard label="Messages" value={String(data.summary.totalMessages)} sub="total" />
                <StatCard label="Days" value={String(data.summary.totalDays)} sub="recorded" />
            </div>

            {/* Emotion breakdown - 情绪主要聚类饼图或排行榜呈现 */}
            <Section title="Emotion Distribution">
                <EmotionBreakdown data={data.emotionBreakdown} />
            </Section>

            {/* Mood chart - 当具有足够积分序列时，绘制近三天情绪起伏的曲线路网 */}
            {data.moodCurve.length > 0 && (
                <Section title="Mood Over Time">
                    <MoodChart data={data.moodCurve} />
                </Section>
            )}

            {/* Trigger source breakdown - 触发特定情绪的外因环图排布 */}
            {data.triggers.length > 0 && (
                <Section title="Trigger Sources">
                    <TriggerPieChart data={data.triggers} />
                </Section>
            )}

            {/* Thinking patterns - 基于认知心理学提取出的惯有思维模式清单（例如灾难化思维或全有全无思维） */}
            {data.patterns.length > 0 && (
                <Section title="Thinking Patterns">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {data.patterns.map(p => (
                            <PatternCard key={p.name} name={p.name} count={p.count} maxCount={data.patterns[0].count} />
                        ))}
                    </div>
                </Section>
            )}

            {/* Topics - 被聊到最多的高频关键词及话题气泡标签集 */}
            {data.topics.length > 0 && (
                <Section title="Topics">
                    <div className="flex flex-wrap gap-2">
                        {data.topics.map(t => (
                            <span key={t.name} className="px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                                {t.name} ({t.count})
                            </span>
                        ))}
                    </div>
                </Section>
            )}

            {/* Growth interventions - 用户干预成长看板，列出认知上的调优辅导计划 */}
            <GrowthCard interventions={data.interventions} />
        </div>
    );
}

/**
 * 组件：StatCard (通用小数据模块)
 * 作用：在分析面版中展示诸如分数、占比等带上下标注的微型卡片框。
 * 引用位置：被包含在 ThreeDayTab 父级以及与其同级的 OneWeek/OneMonth 组件中复用排版。
 * 
 * @param {string} label - 标题描述字符串（如 Avg Mood）
 * @param {string} value - 数据的主量文本（如 7.5）
 * @param {string} sub - 尾部的补充说明字符串（如 /10 ↗） 
 */
function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
    return (
        <div className="rounded-xl bg-white/80 dark:bg-white/5 border border-purple-100 dark:border-purple-800/30 p-3 text-center">
            <div className="text-xs text-neutral-400 dark:text-neutral-500 mb-0.5">{label}</div>
            <div className="text-lg font-bold text-neutral-800 dark:text-neutral-100">
                {value}<span className="text-xs font-normal text-neutral-400 ml-1">{sub}</span>
            </div>
        </div>
    );
}

/**
 * 组件：Section (白底边框通用组盒子)
 * 作用：为主画面的所有可视化结构图表提供一个统一规格的外边距骨架及标题。
 * 引用位置：在整个统计报告栏目中包裹一切数据表现形式。
 * 
 * @param {string} title - 栏目标题（如 Mood Over Time）
 * @param {React.ReactNode} children - 由父级传入的具体图表插槽内容
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl bg-white/80 dark:bg-white/5 border border-purple-100 dark:border-purple-800/30 p-5">
            <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-4">{title}</h4>
            {children}
        </div>
    );
}
