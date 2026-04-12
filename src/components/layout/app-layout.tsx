"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "./sidebar";
import { PageTransition } from "@/components/ui/page-transition";
import { Menu } from "lucide-react";

// Sidebar context so sidebar + main content share collapse state
interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  setCollapsed: () => {},
  mobileOpen: false,
  setMobileOpen: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F5F6FA]">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="h-12 w-12 rounded-lg bg-accent flex items-center justify-center text-white font-bold">
            AS
          </div>
          <p className="text-text-tertiary text-sm">Loading ArthaSutra...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, mobileOpen, setMobileOpen }}>
      <div className="flex min-h-screen bg-[#F5F6FA]">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
            onClick={closeMobile}
          />
        )}

        <Sidebar />

        <main
          className={`flex-1 transition-all duration-200 p-4 sm:p-6 overflow-auto ${
            collapsed ? "lg:ml-[68px]" : "lg:ml-64"
          } ml-0`}
        >
          {/* Mobile header with hamburger */}
          <div className="flex items-center gap-3 mb-4 lg:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-lg text-text-secondary hover:bg-surface-tertiary transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="h-7 w-7 rounded-md bg-accent flex items-center justify-center text-white font-bold text-xs">
              AS
            </div>
            <span className="text-sm font-semibold text-text-primary">ArthaSutra</span>
          </div>

          <div className="max-w-7xl mx-auto">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
