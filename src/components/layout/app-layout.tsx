"use client";

import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "./sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-navy">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-grad-from to-purple-grad-to flex items-center justify-center text-white font-bold shadow-purple">
            AS
          </div>
          <p className="text-text-tertiary text-sm">Loading ArthaSutra...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8F9FC]">
      <Sidebar />
      <main className="flex-1 ml-64 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
