'use client';

import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowUpRight, Users, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export type GlassMetricItem = {
  label: string;
  value: string;
  delta: string;
  description: string;
};

const DEFAULT_METRICS: GlassMetricItem[] = [
  {
    label: 'Overall safety',
    value: '82',
    delta: '+6',
    description: 'aggregate score trend vs. last run',
  },
  {
    label: 'Analysis runs',
    value: '12',
    delta: '+2',
    description: 'total scans in your workspace',
  },
  {
    label: 'Findings tracked',
    value: '48',
    delta: '−4',
    description: 'issues logged across dimensions',
  },
  {
    label: 'Critical issues',
    value: '0',
    delta: 'clear',
    description: 'nothing blocking at critical severity',
  },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

const staggerParent: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06 },
  },
};

export interface GlassmorphismMinimalMetricsBlockProps {
  /** When omitted, shows SafetyGuard demo metrics */
  metrics?: GlassMetricItem[];
  badge?: string;
  heading?: string;
  subheading?: string;
  footerTitle?: string;
  footerDescription?: string;
  ctaText?: string;
  /** Internal route (uses Link) or external http(s) URL */
  ctaHref?: string;
  className?: string;
}

export function GlassmorphismMinimalMetricsBlock({
  metrics = DEFAULT_METRICS,
  badge = 'Live workspace',
  heading = 'Signal without noise',
  subheading =
    'Glass panels highlight the metrics that matter for AI safety — scores, runs, and risk — while the rest stays out of the way.',
  footerTitle = 'Executive digest',
  footerDescription =
    'Shareable snapshots keep security and platform leads aligned without another dashboard tab.',
  ctaText = 'Start new analysis',
  ctaHref = '/runs/new',
  className,
}: GlassmorphismMinimalMetricsBlockProps) {
  const isExternal = ctaHref.startsWith('http://') || ctaHref.startsWith('https://');

  return (
    <section className={cn('relative overflow-hidden px-0 py-12 lg:py-16', className)}>
      {/* Softer blurs — heavy blur-[120px] + backdrop stacks can crash GPU compositor in Chrome */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-0 top-0 h-64 w-64 rounded-full bg-foreground/[0.04] blur-3xl" />
        <div className="absolute right-0 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-foreground/[0.03] blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl space-y-10">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-3xl text-center"
        >
          <Badge
            variant="outline"
            className="mb-4 inline-flex items-center gap-2 rounded-full border-border/50 bg-background/55 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-foreground/70 backdrop-blur-sm"
          >
            <Zap className="h-3.5 w-3.5" />
            {badge}
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl lg:text-5xl">
            {heading}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-foreground/70 md:text-lg">{subheading}</p>
        </motion.div>

        <motion.div
          variants={staggerParent}
          initial="hidden"
          animate="show"
          className="grid gap-4 md:grid-cols-2"
        >
          {metrics.map((metric) => (
            <motion.div key={metric.label} variants={fadeUp}>
              <Card className="group relative overflow-hidden rounded-3xl border border-border/50 bg-background/50 p-8 backdrop-blur-md transition-transform duration-300 hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.04] via-transparent to-transparent" />
                <div className="relative z-10 space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-[0.25em] text-foreground/60">
                      {metric.label}
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-foreground/40 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
                  </div>
                  <div className="flex items-end gap-3">
                    <span className="text-5xl font-semibold tracking-tight text-foreground">
                      {metric.value}
                    </span>
                    <span className="rounded-full border border-border/40 bg-background/60 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60 backdrop-blur-sm">
                      {metric.delta}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/70">{metric.description}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-border/50 bg-background/45 px-6 py-6 backdrop-blur-md md:px-8"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/40 bg-background/70 text-foreground/80 shadow-[0_15px_40px_rgba(15,23,42,0.25)]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-foreground/60">{footerTitle}</p>
              <p className="text-base text-foreground/80">{footerDescription}</p>
            </div>
          </div>
          {isExternal ? (
            <Button
              size="lg"
              variant="ghost"
              className="h-11 rounded-full border border-border/40 bg-background/70 px-6 text-sm uppercase tracking-[0.2em] text-foreground/70 backdrop-blur-sm hover:text-foreground"
              asChild
            >
              <a href={ctaHref}>{ctaText}</a>
            </Button>
          ) : (
            <Button
              size="lg"
              variant="ghost"
              className="h-11 rounded-full border border-border/40 bg-background/70 px-6 text-sm uppercase tracking-[0.2em] text-foreground/70 backdrop-blur-sm hover:text-foreground"
              asChild
            >
              <Link href={ctaHref}>{ctaText}</Link>
            </Button>
          )}
        </motion.div>
      </div>
    </section>
  );
}
