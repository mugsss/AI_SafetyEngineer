'use client';

import { Separator } from '@/components/ui/separator';
import { AppSidebarNav, SidebarBrand } from '@/components/layout/sidebar-nav';

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden h-screen w-72 flex-col border-r border-border/50 bg-card/95 bg-gradient-to-b from-card via-card/98 to-background/95 shadow-[12px_0_40px_-24px_rgba(0,0,0,0.65)] backdrop-blur-md lg:flex">
      <div className="flex h-full min-h-0 flex-col px-5 pb-6 pt-7">
        <SidebarBrand />
        <Separator className="my-5 shrink-0 bg-border/50" />
        <AppSidebarNav className="min-h-0 flex-1" />
        <div className="mt-4 shrink-0 rounded-2xl border border-border/40 bg-secondary/30 px-3 py-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground/90">SafetyGuard</span> scans repositories and
            uploads for AI risk across security, privacy, hallucinations, red-team, and operational
            dimensions.
          </p>
        </div>
      </div>
    </aside>
  );
}
