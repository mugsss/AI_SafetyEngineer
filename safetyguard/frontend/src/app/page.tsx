'use client';

import Link from 'next/link';
import {
  Shield,
  ArrowRight,
  Eye,
  AlertTriangle,
  BarChart3,
  GitBranch,
  Home as HomeIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Features } from '@/components/ui/features-4';
import { HeroSection } from '@/components/ui/hero-section-dark';

/** Unsplash: analytics / workspace imagery (stable public URLs) */
const HERO_PREVIEW = {
  light:
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80',
  dark:
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=80',
};

function StatsBar() {
  const stats = [
    { label: 'Safety Dimensions', value: '10', icon: Eye },
    { label: 'Threat Categories', value: '50+', icon: AlertTriangle },
    { label: 'Analysis Metrics', value: '100+', icon: BarChart3 },
  ];

  return (
    <section className="border-y border-border bg-card/50">
      <div className="mx-auto grid max-w-4xl grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex items-center justify-center gap-4 px-6 py-8">
              <Icon className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DimensionsShowcase() {
  const dimensions = [
    { name: 'Security', desc: 'Prompt injection, credential leaks, OWASP LLM Top-10', color: 'text-red-400' },
    { name: 'Privacy', desc: 'PII exposure, data retention, consent boundaries', color: 'text-violet-400' },
    { name: 'Hallucination', desc: 'Groundedness checks, citation verification, drift detection', color: 'text-amber-400' },
    { name: 'Cost', desc: 'Token waste, caching gaps, model selection efficiency', color: 'text-emerald-400' },
    { name: 'Observability', desc: 'Logging coverage, tracing gaps, alerting blind spots', color: 'text-cyan-400' },
    { name: 'Risk', desc: 'Regulatory compliance, bias detection, safety guardrails', color: 'text-orange-400' },
    { name: 'Performance', desc: 'Latency analysis, throughput bottlenecks, scaling readiness', color: 'text-blue-400' },
    { name: 'Failure Modes', desc: 'Fallback coverage, retry logic, graceful degradation', color: 'text-pink-400' },
  ];

  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            Every dimension, <span className="text-primary">covered</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Our agents perform deep analysis across every critical dimension of your AI application.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {dimensions.map((dim) => (
            <div
              key={dim.name}
              className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:bg-card/80"
            >
              <h3 className={`text-sm font-semibold ${dim.color}`}>{dim.name}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{dim.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-background p-12 md:p-16">
          <Shield className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-6 text-3xl font-bold md:text-4xl">
            Ready to secure your AI stack?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Start your first analysis in under a minute. Just paste a repository URL and let our agents do the work.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="gap-2 px-8">
              <Link href="/runs/new">
                Start Free Analysis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">SafetyGuard</span>
        </div>
        <p className="text-center text-xs text-muted-foreground sm:text-right">
          Multi-Agent AI Safety Analysis
        </p>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-lg font-bold tracking-tight text-transparent">
              SafetyGuard
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <Link href="/">
                <HomeIcon className="h-4 w-4" />
                Home
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard">
                Open Dashboard
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      <HeroSection
        className="overflow-hidden"
        title="SafetyGuard — Multi-agent AI safety"
        subtitle={{
          regular: 'Ship LLM products with ',
          gradient: 'measurable safety & compliance.',
        }}
        description="Clone a repo or upload a zip. Ten specialized agents scan security, privacy, hallucinations, cost, failures, and more — then deliver scores, evidence, and fixes before production."
        ctaText="Open dashboard"
        ctaHref="/dashboard"
        bottomImage={HERO_PREVIEW}
        gridOptions={{
          angle: 65,
          opacity: 0.35,
          cellSize: 52,
          lightLineColor: '#6b7280',
          darkLineColor: '#3f3f46',
        }}
      />

      <div className="relative z-10 bg-background">
        <StatsBar />
        <Features />
        <DimensionsShowcase />
        <CTASection />
        <Footer />
      </div>

      <section className="border-t border-border bg-muted/30 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 px-6 sm:flex-row">
          <p className="text-center text-sm text-muted-foreground">
            Prefer to jump straight into a run?
          </p>
          <Button asChild variant="secondary" size="lg" className="gap-2">
            <Link href="/runs/new">
              <GitBranch className="h-4 w-4" />
              New analysis run
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
