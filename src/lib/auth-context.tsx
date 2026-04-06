"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);

  const autoLogin = useMutation(api.auth.autoLogin);
  const logoutMutation = useMutation(api.auth.logout);
  const session = useQuery(api.auth.getSession, token ? { token } : "skip");

  // On mount, check for stored token
  useEffect(() => {
    const stored = localStorage.getItem("arthasutra_token");
    if (stored) {
      setToken(stored);
    }
    setIsLoading(false);
  }, []);

  // Auto-login if no valid session
  useEffect(() => {
    if (isLoading || autoLoginAttempted) return;

    // If we have a token and session loaded successfully, we're good
    if (token && session !== undefined) {
      if (session) {
        // Valid session exists
        return;
      }
      // Token exists but session is null (expired) — clear and auto-login
      localStorage.removeItem("arthasutra_token");
      setToken(null);
    }

    // No token or expired session — auto-login
    if (!token) {
      setAutoLoginAttempted(true);
      autoLogin({}).then((result) => {
        localStorage.setItem("arthasutra_token", result.token);
        setToken(result.token);
      }).catch((err) => {
        console.error("Auto-login failed:", err);
      });
    }
  }, [isLoading, token, session, autoLoginAttempted, autoLogin]);

  const logout = useCallback(async () => {
    if (token) {
      await logoutMutation({ token });
    }
    localStorage.removeItem("arthasutra_token");
    setToken(null);
    setAutoLoginAttempted(false); // Allow re-login
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
    <AuthContext.Provider value={{ user, token, isLoading, logout }}>
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
