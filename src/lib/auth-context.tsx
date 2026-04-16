"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useSession, signOut } from "next-auth/react";

interface User {
  userId: Id<"users">;
  name: string;
  email: string;
  user_type: "employee" | "consultant" | "both";
  gst_registered: boolean;
  annual_ctc?: number;
  monthly_salary?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  authError: string | null;
  retryLogin: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: googleSession, status: googleStatus } = useSession();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginInProgress, setLoginInProgress] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const autoLogin = useMutation(api.auth.autoLogin);
  const logoutMutation = useMutation(api.auth.logout);
  const session = useQuery(api.auth.getSession, token ? { token } : "skip");

  // On mount, check for stored Convex token
  useEffect(() => {
    const stored = localStorage.getItem("arthasutra_token");
    if (stored) {
      setToken(stored);
    }
    setIsLoading(false);
  }, []);

  const performAutoLogin = useCallback(() => {
    if (loginInProgress) return;
    setLoginInProgress(true);
    setAuthError(null);
    autoLogin({}).then((result) => {
      localStorage.setItem("arthasutra_token", result.token);
      setToken(result.token);
      setLoginInProgress(false);
    }).catch((err) => {
      console.error("Convex auto-login failed:", err);
      setAuthError("Login failed. Please try again.");
      setLoginInProgress(false);
    });
  }, [autoLogin, loginInProgress]);

  const retryLogin = useCallback(() => {
    localStorage.removeItem("arthasutra_token");
    setToken(null);
    setAuthError(null);
    performAutoLogin();
  }, [performAutoLogin]);

  // When Google session is available and we don't have a Convex session, auto-login to Convex
  useEffect(() => {
    if (isLoading || loginInProgress || googleStatus === "loading") return;

    // If Google is not authenticated, don't try Convex auto-login
    if (googleStatus !== "authenticated" || !googleSession?.user) return;

    // If we already have a valid Convex token + session, we're good
    if (token && session) return;

    // If token exists but session is null (expired), clear it
    if (token && session === null) {
      localStorage.removeItem("arthasutra_token");
      setToken(null);
    }

    // Auto-login to Convex (creates user if needed)
    if (!token || session === null) {
      performAutoLogin();
    }
  }, [isLoading, token, session, loginInProgress, performAutoLogin, googleSession, googleStatus]);

  const logout = useCallback(async () => {
    if (token) {
      await logoutMutation({ token });
    }
    localStorage.removeItem("arthasutra_token");
    setToken(null);
    setLoginInProgress(false);
    setAuthError(null);
    await signOut({ callbackUrl: "/auth" });
  }, [token, logoutMutation]);

  const user: User | null = session
    ? {
        userId: session.userId,
        name: session.name,
        email: session.email,
        user_type: session.user_type,
        gst_registered: session.gst_registered,
        annual_ctc: session.annual_ctc ?? undefined,
        monthly_salary: session.monthly_salary ?? undefined,
      }
    : null;

  return (
    <AuthContext.Provider value={{ user, token, isLoading, authError, retryLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
