"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();

  useEffect(() => {
    // No login needed — auto-login happens in AuthProvider
    router.push("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-gold to-amber-600 flex items-center justify-center text-navy font-bold animate-pulse">
          AS
        </div>
        <p className="text-white/50 text-sm">Redirecting to dashboard...</p>
      </div>
    </div>
  );
}
