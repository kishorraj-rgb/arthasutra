"use client";

import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "./sidebar";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Demo mode: skip auth redirect when Convex is not connected
  const demoMode = !process.env.NEXT_PUBLIC_CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL.includes("your-convex");

  useEffect(() => {
    if (!demoMode && !isLoading && !user) {
      router.push("/auth");
    }
  }, [user, isLoading, router, demoMode]);

  if (!demoMode && isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-navy">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-gold to-amber-600 flex items-center justify-center text-navy font-bold animate-pulse">
            AS
          </div>
          <p className="text-white/50 text-sm">Loading ArthaSutra...</p>
        </div>
      </div>
    );
  }

  if (!demoMode && !user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-navy">
      <Sidebar />
      <main className="flex-1 ml-64 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
