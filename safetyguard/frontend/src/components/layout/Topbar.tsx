'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Plus, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { AppSidebarNav, SidebarBrand } from '@/components/layout/sidebar-nav';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Command center',
  '/runs': 'Analysis runs',
  '/runs/new': 'New analysis',
  '/simulator': 'Simulator',
  '/playground': 'Playground',
  '/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/report/')) return 'Safety report';
  if (pageTitles[pathname]) return pageTitles[pathname];
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname.startsWith(path + '/')) return title;
  }
  return 'SafetyGuard';
}

function getPageSubtitle(pathname: string): string | null {
  if (pathname === '/dashboard') return 'Posture across your latest scan';
  if (pathname.startsWith('/runs/new')) return 'Point at a repo or upload a bundle';
  if (pathname === '/runs') return 'Queue, failures, and drill-ins';
  if (pathname === '/simulator') return 'Dependency graph & blast radius';
  if (pathname === '/playground') return 'Prompts & policy checks';
  if (pathname === '/settings') return 'Workspace preferences';
  if (pathname.startsWith('/report/')) return 'Evidence-backed findings';
  return null;
}

export function Topbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const pageTitle = getPageTitle(pathname);
  const subtitle = getPageSubtitle(pathname);

  return (
    <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 border-b border-border/50 bg-background/80 px-4 py-2 backdrop-blur-md lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 border-border/60 bg-card/50 lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="flex h-full max-h-[100dvh] w-[min(100vw,20rem)] flex-col gap-0 border-border/60 bg-card p-0 sm:max-w-[20rem]"
          >
            <SheetHeader className="space-y-0 border-b border-border/50 px-5 py-5 text-left">
              <SheetTitle className="sr-only">Main navigation</SheetTitle>
              <SheetDescription className="sr-only">
                SafetyGuard workspace links: dashboard, runs, simulator, playground, and settings.
              </SheetDescription>
              <SidebarBrand />
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-4">
              <AppSidebarNav onNavigate={() => setOpen(false)} />
            </div>
            <Separator className="bg-border/50" />
            <p className="px-5 py-4 text-[11px] leading-relaxed text-muted-foreground">
              Use the command center to prioritize critical findings before shipping AI features.
            </p>
          </SheetContent>
        </Sheet>

        <div className="min-w-0">
          <p className="hidden text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground lg:block">
            SafetyGuard
          </p>
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground md:text-xl">
            {pageTitle}
          </h1>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground md:text-sm">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="hidden text-muted-foreground sm:inline-flex">
          <Link href="/">
            <Home className="mr-1.5 h-4 w-4" />
            Home
          </Link>
        </Button>
        <Button asChild size="sm" className="gap-1.5 shadow-sm">
          <Link href="/runs/new">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New analysis</span>
            <span className="sm:hidden">Run</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
