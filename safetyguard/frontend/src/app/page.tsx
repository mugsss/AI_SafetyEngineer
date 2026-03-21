'use client';

import Link from 'next/link';
import {
  Shield,
  ArrowRight,
  ChevronRight,
  Eye,
  AlertTriangle,
  BarChart3,
  GitBranch,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Features } from '@/components/ui/features-4';

function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute right-0 top-1/4 h-[400px] w-[400px] rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <div className="mx-auto max-w-5xl px-6 pb-16 pt-24 md:pb-24 md:pt-36">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
            <Shield className="h-3.5 w-3.5 text-primary" />
            <span>AI Safety Analysis Platform</span>
            <ChevronRight className="h-3 w-3" />
          </div>

          <h1 className="max-w-3xl text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
            <span className="text-foreground">Ship AI with</span>
            <br />
            <span className="bg-gradient-to-r from-primary via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              confidence
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            SafetyGuard scans your repositories with 10 specialized agents to uncover security flaws, hallucination risks, privacy gaps, and more — before they reach production.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="gap-2 px-8 text-base">
              <Link href="/dashboard">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2 px-8 text-base">
              <Link href="/runs/new">
                Run Analysis
                <GitBranch className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

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
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{dim.desc}</p>
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
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">SafetyGuard</span>
        </div>
        <p className="text-xs text-muted-foreground">Multi-Agent AI Safety Analysis</p>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-lg font-bold tracking-tight text-transparent">
              SafetyGuard
            </span>
          </Link>
          <Button asChild size="sm">
            <Link href="/dashboard">
              Open Dashboard
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </nav>

      <HeroSection />
      <StatsBar />
      <Features />
      <DimensionsShowcase />
      <CTASection />
      <Footer />
    </div>
  );
}
