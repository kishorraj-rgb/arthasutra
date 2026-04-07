"use client";

import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "./sidebar";
import { PageTransition } from "@/components/ui/page-transition";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F5F6FA]">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="h-12 w-12 rounded-lg bg-accent flex items-center justify-center text-white font-bold">
            AS
          </div>
          <p className="text-gray-400 text-sm">Loading ArthaSutra...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Sidebar />
      <main className="flex-1 ml-64 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  );
}
