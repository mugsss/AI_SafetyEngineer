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
import ResponsiveHeroBanner from '@/components/ui/responsive-hero-banner';

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
      {/* Full-screen hero with built-in nav */}
      <ResponsiveHeroBanner
        backgroundImageUrl="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=3840&q=80"
        navLinks={[
          { label: 'Home', href: '/', isActive: true },
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'New Run', href: '/runs/new' },
          { label: 'Simulator', href: '/simulator' },
          { label: 'Playground', href: '/playground' },
        ]}
        ctaButtonText="Get Started"
        ctaButtonHref="/runs/new"
        badgeLabel="v1.0"
        badgeText="Multi-agent AI safety analysis platform"
        title="Secure Your AI"
        titleLine2="Before It Ships"
        description="Connect a repository and let ten specialized safety agents scan for security vulnerabilities, hallucinations, privacy risks, cost inefficiencies, and more — delivering scored findings and concrete fixes before production."
        primaryButtonText="Start Analysis Run"
        primaryButtonHref="/runs/new"
        secondaryButtonText="Open Dashboard"
        secondaryButtonHref="/dashboard"
        partnersTitle="Analyzing AI systems across every critical safety dimension"
        partnerNames={['Security', 'Privacy', 'Hallucination', 'Cost', 'Observability', 'Risk', 'Performance', 'Failure Modes', 'Compliance', 'Drift']}
      />

      {/* Below-fold content */}
      <div className="relative z-10 bg-background">
        <StatsBar />
        <Features />
        <DimensionsShowcase />
        <CTASection />

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

        <Footer />
      </div>
    </div>
  );
}
