'use client';

/**
 * StatCardProps - 统计卡片属性
 * @param label - 统计项名称 (如 "Total Users")
 * @param value - 统计数值 (如 1234)
 * @param sub - (可选) 副标题或说明文字
 * @param icon - (可选) 图标字符或 Emoji
 */
interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: string;
}

/**
 * 组件：后台管理通用统计卡片 (StatCard)
 * 采用深色玻璃拟态风格 (Glassmorphism)，适配管理员面板。
 */
export default function StatCard({ label, value, sub, icon }: StatCardProps) {
  return (
    <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-800 p-5 hover:border-slate-700 transition-all hover:bg-slate-800/50 group">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-slate-400 transition-colors">
          {label}
        </span>
        {icon && <span className="text-lg opacity-70">{icon}</span>}
      </div>
      <div className="flex flex-col">
        <span className="text-2xl font-bold text-white tracking-tight">
          {value}
        </span>
        {sub && (
          <span className="text-xs text-slate-400 mt-1 opacity-80">
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}
