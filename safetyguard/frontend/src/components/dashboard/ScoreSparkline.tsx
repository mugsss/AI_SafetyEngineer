'use client';

import {
  LineChart,
  Line,
  Tooltip,
  ResponsiveContainer,
  YAxis,
} from 'recharts';

interface ScoreSparklineProps {
  data: { run: number; score: number }[];
  className?: string;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground shadow-lg">
      Score: {payload[0].value}
    </div>
  );
}

export function ScoreSparkline({ data, className }: ScoreSparklineProps) {
  return (
    <div className={className} style={{ width: 200, height: 80 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <YAxis domain={[0, 100]} hide />
          <Tooltip
            content={<CustomTooltip />}
            cursor={false}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="hsl(217, 91%, 60%)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'hsl(217, 91%, 60%)', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: 'hsl(217, 91%, 60%)', strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
