'use client';

import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
  YAxis,
  XAxis,
} from 'recharts';

interface ScoreSparklineProps {
  data: { run: number; score: number }[];
  className?: string;
  height?: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value;
  if (!Number.isFinite(v)) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground">Run #{label}</p>
      <p className="text-sm font-semibold text-foreground">{Math.round(v as number)}/100</p>
    </div>
  );
}

function sanitizeData(data: ScoreSparklineProps['data']) {
  if (!Array.isArray(data) || data.length === 0) return [];
  return data.filter(
    (d) =>
      d &&
      typeof d.run === 'number' &&
      Number.isFinite(d.score) &&
      d.score >= 0 &&
      d.score <= 100,
  );
}

export function ScoreSparkline({ data, className, height = 160 }: ScoreSparklineProps) {
  const clean = sanitizeData(data);
  if (clean.length === 0) {
    return (
      <div
        className={className}
        style={{ height }}
        role="status"
        aria-label="No chart data"
      >
        <div className="flex h-full min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
          Not enough scored runs to plot a trend.
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ width: '100%', height, minHeight: height }}>
      <ResponsiveContainer width="100%" height="100%" minHeight={height}>
        <AreaChart data={clean} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(213, 94%, 58%)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="hsl(213, 94%, 58%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="run" hide />
          <YAxis domain={[0, 100]} hide />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeDasharray: '4 4' }} />
          <Area
            type="monotone"
            dataKey="score"
            stroke="hsl(213, 94%, 58%)"
            strokeWidth={2.5}
            fill="url(#scoreGradient)"
            dot={{ r: 4, fill: 'hsl(213, 94%, 58%)', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: 'hsl(213, 94%, 58%)', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
