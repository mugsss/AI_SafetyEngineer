'use client';

import type { ElementType, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  LayoutDashboard,
  PlayCircle,
  PlusCircle,
  Network,
  FlaskConical,
  Settings,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

export type NavItem = {
  label: string;
  href: string;
  icon: ElementType;
  hint?: string;
};

const overview: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    hint: 'Scores, findings, activity',
  },
  { label: 'Home', href: '/', icon: Home, hint: 'Product overview' },
];

const pipeline: NavItem[] = [
  { label: 'Runs', href: '/runs', icon: PlayCircle, hint: 'History & status' },
  { label: 'New analysis', href: '/runs/new', icon: PlusCircle, hint: 'Repo or upload' },
];

const labs: NavItem[] = [
  { label: 'Simulator', href: '/simulator', icon: Network, hint: 'Graph & flows' },
  { label: 'Playground', href: '/playground', icon: FlaskConical, hint: 'Try prompts' },
];

const system: NavItem[] = [{ label: 'Settings', href: '/settings', icon: Settings, hint: 'Workspace' }];

function matchActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = matchActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'group flex items-start gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200',
        active
          ? 'bg-primary/[0.12] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.28)]'
          : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
          active
            ? 'border-primary/35 bg-primary/18 text-primary'
            : 'border-border/60 bg-secondary/50 text-muted-foreground group-hover:border-border group-hover:bg-secondary',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
        <span className="leading-none">{item.label}</span>
        {item.hint ? (
          <span className="text-[11px] font-normal leading-snug text-muted-foreground">{item.hint}</span>
        ) : null}
      </span>
    </Link>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
      {children}
    </p>
  );
}

export function SidebarBrand({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/35 via-primary/15 to-transparent shadow-[0_12px_40px_-12px_hsl(var(--primary)/0.55)] ring-1 ring-primary/25">
        <Shield className="h-5 w-5 text-primary" />
        <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2 rounded-full bg-emerald-400/90 ring-2 ring-card" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold tracking-tight text-foreground">SafetyGuard</p>
          <Badge
            variant="outline"
            className="h-5 border-primary/25 bg-primary/10 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary"
          >
            Beta
          </Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">AI safety & red-team analysis</p>
      </div>
    </div>
  );
}

export function AppSidebarNav({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <ScrollArea className={cn('min-h-0 flex-1', className)}>
    <nav className="pr-3 pb-8 pt-2">
      <div className="space-y-6">
        <div className="space-y-1">
          <SectionLabel>Overview</SectionLabel>
          {overview.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>

        <Separator className="bg-border/50" />

        <div className="space-y-1">
          <SectionLabel>Analysis pipeline</SectionLabel>
          {pipeline.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>

        <div className="space-y-1">
          <SectionLabel>Labs &amp; simulation</SectionLabel>
          {labs.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>

        <Separator className="bg-border/50" />

        <div className="space-y-1">
          <SectionLabel>Workspace</SectionLabel>
          {system.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      </div>
    </nav>
    </ScrollArea>
  );
}
