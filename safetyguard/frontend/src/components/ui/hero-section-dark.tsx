'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface HeroSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: {
    regular: string;
    gradient: string;
  };
  description?: string;
  ctaText?: string;
  ctaHref?: string;
  /** Ignored — image removed for stability */
  bottomImage?: { light: string; dark: string } | null;
  /** Ignored — retro grid removed for stability */
  gridOptions?: Record<string, unknown>;
}

const HeroSection = React.forwardRef<HTMLDivElement, HeroSectionProps>(
  (
    {
      className,
      title = 'SafetyGuard',
      subtitle = {
        regular: 'Ship AI products with ',
        gradient: 'proof-driven safety and trust.',
      },
      description = 'Connect a repository, run specialized safety agents, and get actionable findings before production.',
      ctaText = 'Start analysis run',
      ctaHref = '/runs/new',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      bottomImage: _bottomImage,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      gridOptions: _gridOptions,
      ...props
    },
    ref,
  ) => {
    const isExternal =
      ctaHref.startsWith('http://') || ctaHref.startsWith('https://');

    return (
      <div
        className={cn(
          'relative overflow-hidden bg-background px-6 py-24 sm:py-32 md:py-40',
          className,
        )}
        ref={ref}
        {...props}
      >
        {/* Subtle static radial glow — no animation, no heavy blur stacking */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% -10%, rgba(99,102,241,0.18) 0%, transparent 70%)',
          }}
        />

        <div className="mx-auto max-w-3xl space-y-6 text-center">
          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground">
            {title}
          </div>

          {/* Headline */}
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            {subtitle.regular}
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              {subtitle.gradient}
            </span>
          </h1>

          {/* Description */}
          <p className="mx-auto max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {description}
          </p>

          {/* CTA */}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {isExternal ? (
              <a
                href={ctaHref}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
              >
                {ctaText}
              </a>
            ) : (
              <Link
                href={ctaHref}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
              >
                {ctaText}
              </Link>
            )}
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-border/60 bg-card/50 px-8 text-sm font-medium text-foreground transition hover:bg-card"
            >
              Open dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  },
);
HeroSection.displayName = 'HeroSection';

export { HeroSection };
