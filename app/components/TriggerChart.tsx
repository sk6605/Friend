'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface TriggerItem {
  name: string;
  count: number;
}

export default function TriggerChart({ data }: { data: TriggerItem[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-neutral-400 dark:text-neutral-500 text-sm">
        No trigger data yet
      </div>
    );
  }

  const chartData = data.slice(0, 6).map(d => ({
    ...d,
    name: d.name.length > 18 ? d.name.slice(0, 16) + '...' : d.name,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          width={120}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e1b2e',
            border: '1px solid #6b21a8',
            borderRadius: '12px',
            fontSize: '12px',
            color: '#e5e7eb',
          }}
        />
        <Bar dataKey="count" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
