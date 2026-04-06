"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, TrendingUp, TrendingDown, Calculator, PieChart,
  Shield, Landmark, Bell, FileText, Settings, LogOut, ChevronLeft, ChevronRight, Upload,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Income", href: "/income", icon: TrendingUp },
  { name: "Expenses", href: "/expenses", icon: TrendingDown },
  { name: "Import", href: "/import", icon: Upload },
  { name: "Tax", href: "/tax", icon: Calculator },
  { name: "Investments", href: "/investments", icon: PieChart },
  { name: "Insurance", href: "/insurance", icon: Shield },
  { name: "Loans", href: "/loans", icon: Landmark },
  { name: "Reminders", href: "/reminders", icon: Bell },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-navy-light border-r border-border transition-all duration-300 ease-spring flex flex-col",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center text-white font-bold text-sm shrink-0">
          AS
        </div>
        {!collapsed && (
          <div className="overflow-hidden animate-fade-in">
            <h1 className="font-display text-lg font-bold text-text-primary tracking-tight">
              ArthaSutra
            </h1>
            <p className="text-[10px] text-accent-light font-mono">अर्थसूत्र</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative",
                isActive
                  ? "bg-accent/10 text-accent-light border-l-2 border-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-tertiary"
              )}
            >
              <item.icon className={cn(
                "h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110",
                isActive && "text-accent-light"
              )} />
              {!collapsed && (
                <span className="transition-all duration-200">{item.name}</span>
              )}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-accent rounded-r-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User & Collapse */}
      <div className="border-t border-border p-3 space-y-2">
        {!collapsed && user && (
          <div className="px-2 py-2 animate-fade-in">
            <p className="text-sm font-medium text-text-primary truncate">{user.name}</p>
            <p className="text-xs text-text-tertiary truncate">{user.email}</p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-tertiary hover:text-rose transition-colors duration-200"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Logout</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary transition-all duration-200"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
