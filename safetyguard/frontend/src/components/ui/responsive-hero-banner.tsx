'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface NavLink {
  label: string;
  href: string;
  isActive?: boolean;
}

interface ResponsiveHeroBannerProps {
  backgroundImageUrl?: string;
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

const ResponsiveHeroBanner: React.FC<ResponsiveHeroBannerProps> = ({
  backgroundImageUrl = 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=3840&q=80',
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
    <section className="w-full isolate min-h-screen overflow-hidden relative">
      {/* Background image — next/image not used here because this is a full-screen decorative bg */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={backgroundImageUrl}
        alt=""
        className="w-full h-full object-cover absolute inset-0"
      />
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/65" />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-black/30" />

      {/* Header */}
      <header className="z-10 relative">
        <div className="mx-6">
          <div className="flex items-center justify-between pt-4">
            {/* Logo / brand */}
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 ring-1 ring-blue-400/30">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <span className="text-sm font-bold tracking-tight text-white">SafetyGuard</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-full bg-white/5 px-1 py-1 ring-1 ring-white/10 backdrop-blur">
                {navLinks.map((link, index) => (
                  <Link
                    key={index}
                    href={link.href}
                    className={`px-3 py-2 text-sm font-medium transition-colors font-sans rounded-full ${
                      link.isActive
                        ? 'text-white bg-white/10'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  href={ctaButtonHref}
                  className="ml-1 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-medium text-neutral-900 hover:bg-white/90 font-sans transition-colors"
                >
                  {ctaButtonText}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 7h10v10" />
                    <path d="M7 17 17 7" />
                  </svg>
                </Link>
              </div>
            </nav>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur"
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

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-2 rounded-2xl bg-black/80 ring-1 ring-white/10 backdrop-blur p-4 space-y-1">
              {navLinks.map((link, index) => (
                <Link
                  key={index}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href={ctaButtonHref}
                onClick={() => setMobileMenuOpen(false)}
                className="block mt-2 text-center rounded-full bg-white py-2.5 text-sm font-semibold text-neutral-900"
              >
                {ctaButtonText}
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Hero content */}
      <div className="z-10 relative">
        <div className="sm:pt-28 md:pt-32 lg:pt-40 max-w-7xl mx-auto pt-28 px-6 pb-16">
          <div className="mx-auto max-w-3xl text-center">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-3 rounded-full bg-white/10 px-2.5 py-2 ring-1 ring-white/15 backdrop-blur animate-fade-slide-in-1">
              <span className="inline-flex items-center text-xs font-medium text-neutral-900 bg-white/90 rounded-full py-0.5 px-2 font-sans">
                {badgeLabel}
              </span>
              <span className="text-sm font-medium text-white/90 font-sans">
                {badgeText}
              </span>
            </div>

            {/* Headline */}
            <h1 className="sm:text-5xl md:text-6xl lg:text-7xl leading-tight text-4xl text-white tracking-tight font-serif font-normal animate-fade-slide-in-2">
              {title}
              <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
                {titleLine2}
              </span>
            </h1>

            {/* Description */}
            <p className="sm:text-lg animate-fade-slide-in-3 text-base text-white/75 max-w-2xl mt-6 mx-auto leading-relaxed">
              {description}
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row sm:gap-4 mt-10 gap-3 items-center justify-center animate-fade-slide-in-4">
              <Link
                href={primaryButtonHref}
                className="inline-flex items-center gap-2 hover:bg-white/20 text-sm font-semibold text-white bg-white/10 ring-white/20 ring-1 rounded-full py-3 px-6 font-sans transition-colors backdrop-blur"
              >
                {primaryButtonText}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
              <Link
                href={secondaryButtonHref}
                className="inline-flex items-center gap-2 rounded-full bg-transparent px-5 py-3 text-sm font-medium text-white/80 hover:text-white font-sans transition-colors"
              >
                {secondaryButtonText}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Dimensions strip */}
          <div className="mx-auto mt-20 max-w-5xl animate-fade-slide-in-1">
            <p className="text-sm text-white/60 text-center mb-6">
              {partnersTitle}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {partnerNames.map((name, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3.5 py-1.5 text-xs font-medium text-white/70 ring-1 ring-white/10 backdrop-blur"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400/70" />
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
