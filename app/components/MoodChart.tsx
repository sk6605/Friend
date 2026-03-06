'use client';

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface MoodPoint {
  date: string;
  moodScore: number;
  mood: string;
}

export default function MoodChart({ data }: { data: MoodPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-neutral-400 dark:text-neutral-500 text-sm">
        No mood data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickFormatter={(v: string) => v.slice(5)}
        />
        <YAxis
          domain={[1, 10]}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          ticks={[1, 3, 5, 7, 10]}
        />
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
