'use client';

/**
 * ActivityRowProps - 活动行属性
 * @param label - 活动项名称
 * @param value - 活动数值或状态
 * @param subLabel - (可选) 二级说明
 */
interface ActivityRowProps {
  label: string;
  value: string | number;
  subLabel?: string;
}

/**
 * 组件：后台管理小列表行 (ActivityRow)
 * 用于展示最近活动、活跃度等列表型数据。
 */
export default function ActivityRow({ label, value, subLabel }: ActivityRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0 group">
      <div className="flex flex-col">
        <span className="text-sm text-slate-300 group-hover:text-white transition-colors capitalize">
          {label}
        </span>
        {subLabel && (
          <span className="text-[10px] text-slate-500 uppercase tracking-tighter">
            {subLabel}
          </span>
        )}
      </div>
      <span className="text-sm font-semibold text-slate-100 bg-slate-800/50 px-2 py-0.5 rounded-md min-w-[32px] text-center border border-slate-700/30">
        {value}
      </span>
    </div>
  );
}
