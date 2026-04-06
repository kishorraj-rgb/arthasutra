"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, CHART_COLORS, CATEGORY_COLORS } from "@/lib/utils";
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
// Mock data
// ---------------------------------------------------------------------------

const cashFlowData = [
  { month: "Apr", income: 275000, expense: 128000 },
  { month: "May", income: 280000, expense: 135000 },
  { month: "Jun", income: 285000, expense: 142000 },
  { month: "Jul", income: 290000, expense: 138000 },
  { month: "Aug", income: 285000, expense: 148000 },
  { month: "Sep", income: 295000, expense: 155000 },
  { month: "Oct", income: 285000, expense: 140000 },
  { month: "Nov", income: 310000, expense: 162000 },
  { month: "Dec", income: 340000, expense: 175000 },
  { month: "Jan", income: 285000, expense: 138000 },
  { month: "Feb", income: 285000, expense: 132000 },
  { month: "Mar", income: 285000, expense: 142000 },
];

const expenseBreakdown = [
  { name: "Housing", value: 35000, category: "housing" },
  { name: "Food & Dining", value: 22000, category: "food" },
  { name: "Transport", value: 12000, category: "transport" },
  { name: "School Fees", value: 18000, category: "school_fees" },
  { name: "Insurance", value: 15000, category: "insurance" },
  { name: "Utilities", value: 8000, category: "utilities" },
  { name: "Medical", value: 6000, category: "medical" },
  { name: "Entertainment", value: 10000, category: "entertainment" },
  { name: "Driver Salary", value: 9000, category: "driver_salary" },
  { name: "Other", value: 7000, category: "other" },
];

const reminders = [
  {
    id: 1,
    title: "GST Filing - GSTR-3B",
    date: "2026-04-01",
    status: "overdue" as const,
  },
  {
    id: 2,
    title: "Advance Tax - Q1 Instalment",
    date: "2026-04-15",
    status: "due_soon" as const,
  },
  {
    id: 3,
    title: "LIC Premium Payment",
    date: "2026-04-10",
    status: "due_soon" as const,
  },
  {
    id: 4,
    title: "SIP - HDFC Flexi Cap Fund",
    date: "2026-04-20",
    status: "upcoming" as const,
  },
  {
    id: 5,
    title: "PPF Annual Contribution Deadline",
    date: "2026-04-30",
    status: "upcoming" as const,
  },
];

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
// Stat cards config
// ---------------------------------------------------------------------------

const statCards = [
  {
    title: "Net Worth",
    value: 12450000,
    icon: Wallet,
    color: "#F0A500",
    bgGlow: "from-gold/20 to-gold/5",
    trend: "+8.2% from last year",
    trendUp: true,
  },
  {
    title: "Monthly Income",
    value: 285000,
    icon: TrendingUp,
    color: "#10B981",
    bgGlow: "from-emerald-500/20 to-emerald-500/5",
    trend: "+5.1% from last month",
    trendUp: true,
  },
  {
    title: "Monthly Expenses",
    value: 142000,
    icon: TrendingDown,
    color: "#F43F5E",
    bgGlow: "from-rose-500/20 to-rose-500/5",
    trend: "+2.3% from last month",
    trendUp: false,
  },
  {
    title: "Portfolio Gain/Loss",
    value: 340000,
    icon: PieChartIcon,
    color: "#F0A500",
    bgGlow: "from-gold/20 to-gold/5",
    trend: "+12.4% returns",
    trendUp: true,
    suffix: "+12.4%",
  },
  {
    title: "Tax Saved YTD",
    value: 187500,
    icon: Calculator,
    color: "#8B5CF6",
    bgGlow: "from-purple-500/20 to-purple-500/5",
    trend: "FY 2025-26",
    trendUp: true,
  },
  {
    title: "GST Liability",
    value: 18000,
    icon: IndianRupee,
    color: "#F97316",
    bgGlow: "from-orange-500/20 to-orange-500/5",
    trend: "This month",
    trendUp: false,
  },
];

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
    <div className="bg-navy border border-gold/20 rounded-lg p-3 text-sm shadow-xl">
      <p className="text-white/70 font-medium mb-1">{label}</p>
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
    <div className="bg-navy border border-gold/20 rounded-lg p-3 text-sm shadow-xl">
      <p className="text-white font-medium">{entry.name}</p>
      <p className="stat-number text-gold">{formatCurrency(entry.value)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reminder helpers
// ---------------------------------------------------------------------------

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
// Page Component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const savings = taxComparison.oldRegime.total - taxComparison.newRegime.total;
  const betterRegime = savings < 0 ? "Old Regime" : "New Regime";
  const savingsAmount = Math.abs(savings);

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="animate-enter">
          <h1 className="font-display text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-white/50 mt-1">
            Welcome back. Here is your financial overview for FY 2025-26.
          </p>
        </div>

        {/* Stat Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {statCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.title}
                className="animate-enter group relative overflow-hidden"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                {/* Subtle gradient glow */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${card.bgGlow} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />
                <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-white/60">
                    {card.title}
                  </CardTitle>
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${card.color}15` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: card.color }} />
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <div className="flex items-baseline gap-2">
                    <span className="stat-number text-2xl font-bold text-white">
                      {formatCurrency(card.value)}
                    </span>
                    {card.suffix && (
                      <Badge variant="success" className="text-xs">
                        {card.suffix}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-white/40">
                    {card.trendUp ? (
                      <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-rose-400" />
                    )}
                    {card.trend}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Cash Flow Trend - spans 2 cols */}
          <Card
            className="lg:col-span-2 animate-enter"
            style={{ animationDelay: "500ms" }}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-gold" />
                Cash Flow Trend
              </CardTitle>
              <p className="text-xs text-white/40">Last 12 months (FY 2025-26)</p>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={cashFlowData}
                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.05)"
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
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
              </div>
            </CardContent>
          </Card>

          {/* Monthly Breakdown Donut */}
          <Card className="animate-enter" style={{ animationDelay: "600ms" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-gold" />
                Monthly Breakdown
              </CardTitle>
              <p className="text-xs text-white/40">Expense categories</p>
            </CardHeader>
            <CardContent>
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
                    <span className="text-white/50 truncate">{entry.name}</span>
                    <span className="stat-number text-white/70 ml-auto">
                      {formatCurrency(entry.value)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Upcoming Reminders */}
          <Card className="animate-enter" style={{ animationDelay: "700ms" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-gold" />
                Upcoming Reminders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3 transition-colors hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-2 w-2 rounded-full flex-shrink-0 ${
                          reminder.status === "overdue"
                            ? "bg-rose-500 animate-pulse"
                            : reminder.status === "due_soon"
                              ? "bg-amber-400"
                              : "bg-emerald-400"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{reminder.title}</p>
                        <p className="text-xs text-white/40">{formatDate(reminder.date)}</p>
                      </div>
                    </div>
                    <Badge variant={reminderColor(reminder.status)} className="flex-shrink-0 ml-3">
                      {reminderLabel(reminder.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tax Regime Comparison */}
          <Card className="animate-enter" style={{ animationDelay: "800ms" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-gold" />
                Tax Regime Comparison
              </CardTitle>
              <p className="text-xs text-white/40">
                Gross Income: {formatCurrency(taxComparison.grossIncome)}
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {/* Old Regime */}
                <div
                  className={`rounded-lg border p-4 transition-colors ${
                    betterRegime === "Old Regime"
                      ? "border-gold/30 bg-gold/5"
                      : "border-white/5 bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-white/70">Old Regime</h4>
                    {betterRegime === "Old Regime" && (
                      <Badge variant="default" className="text-[10px]">
                        Better
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Deductions</span>
                      <span className="stat-number text-emerald-400">
                        {formatCurrency(taxComparison.oldRegime.deductions)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Taxable Income</span>
                      <span className="stat-number text-white/70">
                        {formatCurrency(taxComparison.oldRegime.taxable)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Tax + Cess</span>
                      <span className="stat-number text-rose-400">
                        {formatCurrency(taxComparison.oldRegime.total)}
                      </span>
                    </div>
                    <div className="border-t border-white/10 pt-2 flex justify-between text-sm">
                      <span className="text-white/60 font-medium">Total Tax</span>
                      <span className="stat-number font-bold text-white">
                        {formatCurrency(taxComparison.oldRegime.total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* New Regime */}
                <div
                  className={`rounded-lg border p-4 transition-colors ${
                    betterRegime === "New Regime"
                      ? "border-gold/30 bg-gold/5"
                      : "border-white/5 bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-white/70">New Regime</h4>
                    {betterRegime === "New Regime" && (
                      <Badge variant="default" className="text-[10px]">
                        Better
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Deductions</span>
                      <span className="stat-number text-emerald-400">
                        {formatCurrency(taxComparison.newRegime.deductions)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Taxable Income</span>
                      <span className="stat-number text-white/70">
                        {formatCurrency(taxComparison.newRegime.taxable)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Tax + Cess</span>
                      <span className="stat-number text-rose-400">
                        {formatCurrency(taxComparison.newRegime.total)}
                      </span>
                    </div>
                    <div className="border-t border-white/10 pt-2 flex justify-between text-sm">
                      <span className="text-white/60 font-medium">Total Tax</span>
                      <span className="stat-number font-bold text-white">
                        {formatCurrency(taxComparison.newRegime.total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Savings callout */}
              <div className="mt-4 rounded-lg border border-gold/20 bg-gold/5 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/50">You save with {betterRegime}</p>
                  <p className="stat-number text-lg font-bold text-gold">
                    {formatCurrency(savingsAmount)}
                  </p>
                </div>
                <ArrowUpRight className="h-5 w-5 text-gold" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
