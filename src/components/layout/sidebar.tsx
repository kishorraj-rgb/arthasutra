"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, TrendingUp, TrendingDown, Calculator, PieChart,
  Shield, Landmark, Bell, FileText, Settings, LogOut, ChevronLeft, ChevronRight, Upload,
  RefreshCw, FolderLock, CreditCard, Receipt,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Income", href: "/income", icon: TrendingUp },
  { name: "Expenses", href: "/expenses", icon: TrendingDown },
  { name: "Import", href: "/import", icon: Upload },
  { name: "Subscriptions", href: "/subscriptions", icon: RefreshCw },
  { name: "Credit Cards", href: "/credit-cards", icon: CreditCard },
  { name: "Invoices", href: "/invoices", icon: Receipt },
  { name: "Tax", href: "/tax", icon: Calculator },
  { name: "Investments", href: "/investments", icon: PieChart },
  { name: "Insurance", href: "/insurance", icon: Shield },
  { name: "Loans", href: "/loans", icon: Landmark },
  { name: "Vault", href: "/vault", icon: FolderLock },
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
        "fixed left-0 top-0 z-40 h-screen bg-white border-r border-gray-200 transition-all duration-200 flex flex-col",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-200">
        <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-sm shrink-0">
          AS
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
              ArthaSutra
            </h1>
            <p className="text-[10px] text-accent font-mono tracking-wide">अर्थसूत्र</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 relative group",
                isActive
                  ? "bg-accent/5 text-accent"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 hover:pl-4"
              )}
            >
              <div className={cn(
                "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-200",
                isActive
                  ? "h-5 bg-accent"
                  : "h-0 bg-accent/50 group-hover:h-4"
              )} />
              <item.icon className={cn(
                "h-[18px] w-[18px] shrink-0",
                isActive && "text-accent"
              )} />
              {!collapsed && (
                <span>{item.name}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User & Collapse */}
      <div className="border-t border-gray-200 p-3 space-y-2">
        {!collapsed && user && (
          <div className="px-2 py-2">
            <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 hover:text-red-500 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Logout</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
