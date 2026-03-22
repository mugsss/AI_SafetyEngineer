'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Shield } from 'lucide-react';

interface NavLink {
  label: string;
  href: string;
  isActive?: boolean;
}

interface ResponsiveHeroBannerProps {
  navLinks?: NavLink[];
  ctaButtonText?: string;
  ctaButtonHref?: string;
  badgeText?: string;
  badgeLabel?: string;
  title?: string;
  titleLine2?: string;
  description?: string;
  primaryButtonText?: string;
  primaryButtonHref?: string;
  secondaryButtonText?: string;
  secondaryButtonHref?: string;
  partnersTitle?: string;
  partnerNames?: string[];
}

/**
 * Home hero — intentionally avoids:
 * - backdrop-blur (GPU compositor cost / tab crashes in Chrome)
 * - staggered opacity/transform animations on mount
 * - gradient text (bg-clip-text) which forces extra compositing layers
 * - multiple stacked radial gradients
 */
const ResponsiveHeroBanner: React.FC<ResponsiveHeroBannerProps> = ({
  navLinks = [
    { label: 'Home', href: '/', isActive: true },
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Runs', href: '/runs/new' },
    { label: 'Simulator', href: '/simulator' },
    { label: 'Playground', href: '/playground' },
  ],
  ctaButtonText = 'Get Started',
  ctaButtonHref = '/runs/new',
  badgeLabel = 'New',
  badgeText = 'Multi-agent AI safety analysis platform',
  title = 'Secure Your AI',
  titleLine2 = 'Before It Ships',
  description =
    'Connect a repository and let ten specialized safety agents scan for security vulnerabilities, hallucinations, privacy risks, and more — delivering scored findings and concrete fixes before production.',
  primaryButtonText = 'Start Analysis',
  primaryButtonHref = '/runs/new',
  secondaryButtonText = 'Open Dashboard',
  secondaryButtonHref = '/dashboard',
  partnersTitle = 'Analyzing AI systems across every critical dimension',
  partnerNames = ['Security', 'Privacy', 'Hallucination', 'Cost', 'Observability', 'Risk', 'Performance', 'Failure Modes', 'Compliance', 'Drift'],
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <section className="relative isolate min-h-screen w-full overflow-hidden bg-[#07080c]">
      {/* Single flat gradient — no images, minimal layers */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0c1220] via-[#07080c] to-[#050508]"
      />

      <header className="relative z-10">
        <div className="mx-6">
          <div className="flex items-center justify-between pt-4">
            <Link href="/" className="inline-flex shrink-0 items-center gap-2">
              {/* shrink-0 + overflow-hidden: inline SVGs in flex rows can otherwise stretch to huge bounds in Chrome */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-blue-500/15 ring-1 ring-blue-400/25">
                <Shield className="h-4 w-4 shrink-0 text-blue-400" strokeWidth={2} aria-hidden />
              </div>
              <span className="text-sm font-bold tracking-tight text-white">SafetyGuard</span>
            </Link>

            <nav className="hidden items-center gap-2 md:flex">
              <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-[#12141c]/95 px-1 py-1">
                {navLinks.map((link, index) => (
                  <Link
                    key={index}
                    href={link.href}
                    className={`rounded-full px-3 py-2 font-sans text-sm font-medium transition-colors ${
                      link.isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  href={ctaButtonHref}
                  className="ml-1 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 font-sans text-sm font-medium text-neutral-900 transition-opacity hover:opacity-90"
                >
                  {ctaButtonText}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 7h10v10" />
                    <path d="M7 17 17 7" />
                  </svg>
                </Link>
              </div>
            </nav>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 md:hidden"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {mobileMenuOpen ? (
                  <>
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </>
                ) : (
                  <>
                    <path d="M4 5h16" />
                    <path d="M4 12h16" />
                    <path d="M4 19h16" />
                  </>
                )}
              </svg>
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="mt-2 space-y-1 rounded-2xl border border-white/10 bg-[#0a0c12] p-4 md:hidden">
              {navLinks.map((link, index) => (
                <Link
                  key={index}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-xl px-4 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href={ctaButtonHref}
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 block rounded-full bg-white py-2.5 text-center text-sm font-semibold text-neutral-900"
              >
                {ctaButtonText}
              </Link>
            </div>
          )}
        </div>
      </header>

      <div className="relative z-10">
        <div className="mx-auto max-w-7xl px-6 pb-16 pt-28 sm:pt-28 md:pt-32 lg:pt-40">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-white/10 bg-[#12141c] px-2.5 py-2">
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 font-sans text-xs font-medium text-neutral-900">
                {badgeLabel}
              </span>
              <span className="font-sans text-sm font-medium text-white/90">{badgeText}</span>
            </div>

            <h1 className="font-serif text-4xl font-normal leading-tight tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              {title}
              <br className="hidden sm:block" />
              <span className="text-blue-400">{titleLine2}</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
              {description}
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link
                href={primaryButtonHref}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 font-sans text-sm font-semibold text-white transition-colors hover:bg-white/15"
              >
                {primaryButtonText}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
              <Link
                href={secondaryButtonHref}
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 font-sans text-sm font-medium text-white/80 transition-colors hover:text-white"
              >
                {secondaryButtonText}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-20 max-w-5xl">
            <p className="mb-6 text-center text-sm text-white/60">{partnersTitle}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {partnerNames.map((name, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#12141c] px-3.5 py-1.5 text-xs font-medium text-white/70"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400/80" />
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ResponsiveHeroBanner;
