import { create } from 'zustand';
import type { User } from '@/types/api';

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  activePage: string;
  setActivePage: (page: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),

  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  activePage: 'dashboard',
  setActivePage: (page) => set({ activePage: page }),
}));
