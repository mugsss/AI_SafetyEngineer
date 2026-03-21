'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { TooltipProvider } from '@/components/ui/tooltip';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col lg:pl-72">
          <Topbar />
          <main className="flex-1 px-4 py-6 md:px-6 md:py-8 lg:px-10">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
