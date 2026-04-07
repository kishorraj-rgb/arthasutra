"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { StaggerContainer, StaggerItem } from "@/components/ui/stagger-container";
import { SkeletonCard, Skeleton } from "@/components/ui/skeleton";
import { playSuccess } from "@/lib/sounds";
import { formatCurrency, amountInWords, CHART_COLORS, CATEGORY_COLORS } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
  Calculator,
  IndianRupee,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ---------------------------------------------------------------------------
// Static demo data for tax regime comparison (depends on tax calculator inputs)
// ---------------------------------------------------------------------------

const taxComparison = {
  grossIncome: 3420000,
  oldRegime: {
    taxable: 2535000,
    tax: 447720,
    deductions: 885000,
    cess: 17909,
    total: 465629,
  },
  newRegime: {
    taxable: 3345000,
    tax: 495400,
    deductions: 75000,
    cess: 19816,
    total: 515216,
  },
};

// ---------------------------------------------------------------------------
// Shimmer skeleton loading component
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-80 mt-2" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Charts row skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-6">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-72 w-full" />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-52 w-full rounded-full mx-auto" style={{ maxWidth: 160 }} />
        </div>
      </div>

      {/* Bottom row skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state for new users
// ---------------------------------------------------------------------------

function DashboardEmptyState() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary mt-1">Your financial overview</p>
      </div>

      <div className="flex flex-col items-center justify-center py-24">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-accent/10 mb-6">
          <Wallet className="h-10 w-10 text-accent-light" />
        </div>
        <h2 className="font-display text-2xl font-bold text-text-primary mb-2">
          Welcome to ArthaSutra!
        </h2>
        <p className="text-text-secondary text-center max-w-md">
          Start by adding your income and expenses. Once you have some data,
          your financial dashboard will come to life with insights, charts, and
          smart reminders.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip for Recharts
// ---------------------------------------------------------------------------

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-border shadow-sm rounded-lg p-3 text-sm">
      <p className="text-text-secondary font-medium mb-1">{label}</p>
      {payload.map((entry: TooltipPayloadEntry, idx: number) => (
        <p key={idx} className="flex items-center gap-2" style={{ color: entry.color }}>
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

interface PieTooltipPayloadEntry {
  name: string;
  value: number;
  payload: { category: string };
}

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: PieTooltipPayloadEntry[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  return (
    <div className="bg-white border border-border shadow-sm rounded-lg p-3 text-sm">
      <p className="text-text-primary font-medium">{entry.name}</p>
      <p className="stat-number text-accent-light">{formatCurrency(entry.value)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reminder helpers
// ---------------------------------------------------------------------------

function getReminderStatus(
  reminder: { due_date: string; is_completed: boolean }
): "overdue" | "due_soon" | "upcoming" {
  if (reminder.is_completed) return "upcoming";
  const now = new Date();
  const due = new Date(reminder.due_date);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  if (diffDays <= 7) return "due_soon";
  return "upcoming";
}

function reminderColor(status: "overdue" | "due_soon" | "upcoming") {
  switch (status) {
    case "overdue":
      return "destructive" as const;
    case "due_soon":
      return "warning" as const;
    case "upcoming":
      return "success" as const;
  }
}

function reminderLabel(status: "overdue" | "due_soon" | "upcoming") {
  switch (status) {
    case "overdue":
      return "Overdue";
    case "due_soon":
      return "Due Soon";
    case "upcoming":
      return "Upcoming";
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

// ---------------------------------------------------------------------------
// Check if all metrics are zero (new user with no data)
// ---------------------------------------------------------------------------

function isEmptyMetrics(metrics: {
  netWorth: number;
  totalIncome: number;
  totalExpenses: number;
  currentMonthIncome: number;
  currentMonthExpenses: number;
  totalInvested: number;
  totalCurrentValue: number;
  portfolioGainLoss: number;
  totalLoanOutstanding: number;
}): boolean {
  return (
    metrics.netWorth === 0 &&
    metrics.totalIncome === 0 &&
    metrics.totalExpenses === 0 &&
    metrics.currentMonthIncome === 0 &&
    metrics.currentMonthExpenses === 0 &&
    metrics.totalInvested === 0 &&
    metrics.totalCurrentValue === 0 &&
    metrics.portfolioGainLoss === 0 &&
    metrics.totalLoanOutstanding === 0
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { user } = useAuth();
  const metrics = useQuery(
    api.dashboard.getDashboardMetrics,
    user ? { userId: user.userId } : "skip"
  );
  const hasSoundPlayed = useRef(false);

  const savings = taxComparison.oldRegime.total - taxComparison.newRegime.total;
  const betterRegime = savings < 0 ? "Old Regime" : "New Regime";
  const savingsAmount = Math.abs(savings);

  // Play success sound when data first loads
  useEffect(() => {
    if (metrics && metrics !== undefined && !hasSoundPlayed.current) {
      if (!isEmptyMetrics(metrics)) {
        playSuccess();
        hasSoundPlayed.current = true;
      }
    }
  }, [metrics]);

  // --- Loading state ---
  if (!user || metrics === undefined) {
    return (
      <AppLayout>
        <DashboardSkeleton />
      </AppLayout>
    );
  }

  // --- Empty state for new users ---
  if (isEmptyMetrics(metrics)) {
    return (
      <AppLayout>
        <DashboardEmptyState />
      </AppLayout>
    );
  }

  // --- Build stat cards from real data ---
  const statCards = [
    {
      title: "Net Worth",
      value: metrics.netWorth,
      icon: Wallet,
      color: "#F0A500",
      bgGlow: "from-purple-grad-from/20 to-accent/5",
    },
    {
      title: "Monthly Income",
      value: metrics.currentMonthIncome,
      icon: TrendingUp,
      color: "#10B981",
      bgGlow: "from-emerald-500/20 to-emerald-500/5",
    },
    {
      title: "Monthly Expenses",
      value: metrics.currentMonthExpenses,
      icon: TrendingDown,
      color: "#F43F5E",
      bgGlow: "from-rose-500/20 to-rose-500/5",
    },
    {
      title: "Portfolio Gain/Loss",
      value: metrics.portfolioGainLoss,
      icon: PieChartIcon,
      color: "#F0A500",
      bgGlow: "from-purple-grad-from/20 to-accent/5",
    },
    {
      title: "Tax Saved YTD",
      value: metrics.taxSaving80C,
      icon: Calculator,
      color: "#8B5CF6",
      bgGlow: "from-purple-500/20 to-purple-500/5",
    },
    {
      title: "GST Liability",
      value: metrics.gstLiability,
      icon: IndianRupee,
      color: "#F97316",
      bgGlow: "from-orange-500/20 to-orange-500/5",
    },
  ];

  // --- Build expense breakdown from real data ---
  const expenseBreakdown = Object.entries(metrics.expenseByCategory).map(
    ([category, value]) => ({
      name: category
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      value,
      category,
    })
  );

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="font-display text-3xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-text-secondary mt-1">
            Welcome back. Here is your financial overview for FY {metrics.fyLabel}.
          </p>
        </motion.div>

        {/* Stat Cards Grid — staggered entrance */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {statCards.map((card) => {
            const Icon = card.icon;
            const isPositive = card.value >= 0;
            const isMonthly = card.title === "Monthly Income" || card.title === "Monthly Expenses";
            const displayMonthLabel = metrics.displayMonth
              ? new Date(metrics.displayMonth + "-01").toLocaleDateString("en-IN", { month: "short", year: "numeric" })
              : "";
            return (
              <StaggerItem key={card.title}>
                <Card className="group relative overflow-hidden">
                  <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle className="text-sm font-medium text-text-secondary">
                        {card.title}
                      </CardTitle>
                      {isMonthly && displayMonthLabel && (
                        <span className="text-[10px] text-text-tertiary">{displayMonthLabel}</span>
                      )}
                    </div>
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${card.color}15` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: card.color }} />
                    </div>
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="flex items-baseline gap-2">
                      <AnimatedNumber
                        value={card.value}
                        className="stat-number text-2xl font-bold text-text-primary tabular-nums"
                      />
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-xs text-text-tertiary">
                      {isPositive ? (
                        <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 text-rose-400" />
                      )}
                      {card.title}
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Cash Flow Trend - spans 2 cols */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-accent-light" />
                  Cash Flow Trend
                </CardTitle>
                <p className="text-xs text-text-tertiary">Last 12 months (FY {metrics.fyLabel})</p>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {metrics.cashFlow.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={metrics.cashFlow}
                        margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(0,0,0,0.06)"
                        />
                        <XAxis
                          dataKey="month"
                          tick={{ fill: "rgba(107,114,128,0.5)", fontSize: 12 }}
                          axisLine={{ stroke: "rgba(107,114,128,0.3)" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "rgba(107,114,128,0.5)", fontSize: 12 }}
                          axisLine={{ stroke: "rgba(107,114,128,0.3)" }}
                          tickLine={false}
                          tickFormatter={(v: number) =>
                            v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${(v / 1000).toFixed(0)}K`
                          }
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="income"
                          name="Income"
                          stroke={CHART_COLORS.income}
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 5, strokeWidth: 2, fill: CHART_COLORS.income }}
                        />
                        <Line
                          type="monotone"
                          dataKey="expense"
                          name="Expense"
                          stroke={CHART_COLORS.expense}
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 5, strokeWidth: 2, fill: CHART_COLORS.expense }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-text-tertiary text-sm">
                      No cash flow data yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Monthly Breakdown Donut */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5 text-accent-light" />
                  Monthly Breakdown
                </CardTitle>
                <p className="text-xs text-text-tertiary">Expense categories</p>
              </CardHeader>
              <CardContent>
                {expenseBreakdown.length > 0 ? (
                  <>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={expenseBreakdown}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                          >
                            {expenseBreakdown.map((entry) => (
                              <Cell
                                key={entry.category}
                                fill={CATEGORY_COLORS[entry.category] ?? "#6B7280"}
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<PieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Legend */}
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      {expenseBreakdown.slice(0, 6).map((entry) => (
                        <div key={entry.category} className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: CATEGORY_COLORS[entry.category] ?? "#6B7280",
                            }}
                          />
                          <span className="text-text-secondary truncate">{entry.name}</span>
                          <span className="stat-number text-text-secondary ml-auto">
                            {formatCurrency(entry.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-52 text-text-tertiary text-sm">
                    No expense data yet
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Upcoming Reminders */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-accent-light" />
                  Upcoming Reminders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics.upcomingReminders.length > 0 ? (
                    metrics.upcomingReminders.map((reminder, idx) => {
                      const status = getReminderStatus(reminder);
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-lg border border-border-light bg-surface-tertiary/50 px-4 py-3 transition-colors hover:bg-surface-tertiary"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`h-2 w-2 rounded-full flex-shrink-0 ${
                                status === "overdue"
                                  ? "bg-rose-500 animate-pulse"
                                  : status === "due_soon"
                                    ? "bg-amber-400"
                                    : "bg-emerald-400"
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="text-sm text-text-primary truncate">{reminder.title}</p>
                              <p className="text-xs text-text-tertiary">
                                {formatDate(reminder.due_date)}
                                {reminder.amount != null && (
                                  <span className="ml-2 text-text-secondary">
                                    {formatCurrency(reminder.amount)}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <Badge variant={reminderColor(status)} className="flex-shrink-0 ml-3">
                            {reminderLabel(status)}
                          </Badge>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex items-center justify-center py-8 text-text-tertiary text-sm">
                      No upcoming reminders
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Tax Regime Comparison (static demo) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-accent-light" />
                  Tax Regime Comparison
                </CardTitle>
                <p className="text-xs text-text-tertiary">
                  Gross Income: {formatCurrency(taxComparison.grossIncome)}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {/* Old Regime */}
                  <div
                    className={`rounded-lg border p-4 transition-colors ${
                      betterRegime === "Old Regime"
                        ? "border-accent/30 bg-accent/5"
                        : "border-border-light bg-surface-tertiary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-text-secondary">Old Regime</h4>
                      {betterRegime === "Old Regime" && (
                        <Badge variant="default" className="text-[10px]">
                          Better
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-text-tertiary">Deductions</span>
                        <span className="stat-number text-emerald-400">
                          {formatCurrency(taxComparison.oldRegime.deductions)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-tertiary">Taxable Income</span>
                        <span className="stat-number text-text-secondary">
                          {formatCurrency(taxComparison.oldRegime.taxable)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-tertiary">Tax + Cess</span>
                        <span className="stat-number text-rose-400">
                          {formatCurrency(taxComparison.oldRegime.total)}
                        </span>
                      </div>
                      <div className="border-t border-border pt-2 flex justify-between text-sm">
                        <span className="text-text-secondary font-medium">Total Tax</span>
                        <span className="stat-number font-bold text-text-primary">
                          {formatCurrency(taxComparison.oldRegime.total)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* New Regime */}
                  <div
                    className={`rounded-lg border p-4 transition-colors ${
                      betterRegime === "New Regime"
                        ? "border-accent/30 bg-accent/5"
                        : "border-border-light bg-surface-tertiary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-text-secondary">New Regime</h4>
                      {betterRegime === "New Regime" && (
                        <Badge variant="default" className="text-[10px]">
                          Better
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-text-tertiary">Deductions</span>
                        <span className="stat-number text-emerald-400">
                          {formatCurrency(taxComparison.newRegime.deductions)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-tertiary">Taxable Income</span>
                        <span className="stat-number text-text-secondary">
                          {formatCurrency(taxComparison.newRegime.taxable)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-tertiary">Tax + Cess</span>
                        <span className="stat-number text-rose-400">
                          {formatCurrency(taxComparison.newRegime.total)}
                        </span>
                      </div>
                      <div className="border-t border-border pt-2 flex justify-between text-sm">
                        <span className="text-text-secondary font-medium">Total Tax</span>
                        <span className="stat-number font-bold text-text-primary">
                          {formatCurrency(taxComparison.newRegime.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Savings callout */}
                <div className="mt-4 rounded-lg border border-accent/25 bg-accent/5 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-text-secondary">You save with {betterRegime}</p>
                    <p className="stat-number text-lg font-bold text-accent-light">
                      <AnimatedNumber value={savingsAmount} />
                    </p>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-accent-light" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
