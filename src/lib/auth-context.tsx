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
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    userType: "employee" | "consultant" | "both"
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loginMutation = useMutation(api.auth.login);
  const registerMutation = useMutation(api.auth.register);
  const logoutMutation = useMutation(api.auth.logout);
  const session = useQuery(api.auth.getSession, token ? { token } : "skip");

  useEffect(() => {
    const stored = localStorage.getItem("arthasutra_token");
    if (stored) {
      setToken(stored);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (session === null && token) {
      localStorage.removeItem("arthasutra_token");
      setToken(null);
    }
    setIsLoading(false);
  }, [session, token]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await loginMutation({ email, password });
      localStorage.setItem("arthasutra_token", result.token);
      setToken(result.token);
    },
    [loginMutation]
  );

  const register = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      userType: "employee" | "consultant" | "both"
    ) => {
      const result = await registerMutation({
        name,
        email,
        password,
        user_type: userType,
      });
      localStorage.setItem("arthasutra_token", result.token);
      setToken(result.token);
    },
    [registerMutation]
  );

  const logout = useCallback(async () => {
    if (token) {
      await logoutMutation({ token });
    }
    localStorage.removeItem("arthasutra_token");
    setToken(null);
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
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
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
