'use client';

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface MoodPoint {
  date: string;
  moodScore: number;
  mood: string;
}

/**
 * 组件：情绪折线趋势图 (MoodChart)
 * 作用：利用 Recharts 插件渲染用户过去一段时间的心情分数走势。
 * 数据：接受一个点集数组，包含日期、分数值和对应的情绪标签。
 */
export default function MoodChart({ data }: { data: MoodPoint[] }) {
  // 如果当前时间维度内没有打卡数据，展示提示词
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-neutral-400 dark:text-neutral-500 text-sm">
        No mood data yet
      </div>
    );
  }

  return (
    // 自动适配父容器宽度的 Recharts 包裹器
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        {/* 背景虚线格栅 */}
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        {/* 横轴：日期（切掉年份，只保留月-日） */}
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickFormatter={(v: string) => v.slice(5)}
        />
        {/* 纵轴：锁定在 1-10 分的刻度范围 */}
        <YAxis
          domain={[1, 10]}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          ticks={[1, 3, 5, 7, 10]}
        />
        {/* 浮窗提示：当鼠标摸到折线点时的详细信息弹窗 */}
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e1b2e',
            border: '1px solid #6b21a8',
            borderRadius: '12px',
            fontSize: '12px',
            color: '#e5e7eb',
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, _name: any, props: any) => [
            `${value}/10 — ${props?.payload?.mood || ''}`,
            'Mood',
          ]}
        />
        {/* 核心折线：采用 monotone 算法平滑曲线，紫色调 */}
        <Line
          type="monotone"
          dataKey="moodScore"
          stroke="#8b5cf6"
          strokeWidth={2.5}
          dot={{ fill: '#8b5cf6', r: 4 }}
          activeDot={{ r: 6, fill: '#a78bfa' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
