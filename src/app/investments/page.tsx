"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency, INVESTMENT_TYPES, CHART_COLORS } from "@/lib/utils";
import {
  Plus,
  TrendingUp,
  PieChart as PieChartIcon,
  Target,
  GraduationCap,
  Home,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// --------------- Static Data (Goal-Based Planning - future feature) ---------------

const goals = [
  {
    id: "1",
    name: "Child Education",
    icon: GraduationCap,
    target: 5000000,
    years: 15,
    status: "On track",
    statusColor: "text-emerald-400",
    progress: 78,
  },
  {
    id: "2",
    name: "Retirement",
    icon: Briefcase,
    target: 50000000,
    years: 25,
    status: "Need to increase SIP by \u20B95,000",
    statusColor: "text-amber-400",
    progress: 42,
  },
  {
    id: "3",
    name: "Home Purchase",
    icon: Home,
    target: 10000000,
    years: 5,
    status: "65% achieved",
    statusColor: "text-emerald-400",
    progress: 65,
  },
];

const TAX_SECTIONS = [
  { value: "none", label: "None" },
  { value: "80C", label: "Section 80C" },
  { value: "80D", label: "Section 80D" },
  { value: "80CCD", label: "Section 80CCD" },
];

const PIE_COLORS = [
  CHART_COLORS.blue,
  CHART_COLORS.purple,
  CHART_COLORS.income,
  CHART_COLORS.cyan,
  CHART_COLORS.orange,
  CHART_COLORS.indigo,
  CHART_COLORS.gold,
  "#ec4899",
  "#14b8a6",
  "#f43f5e",
];

// --------------- Custom Tooltip ---------------

function CustomPieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { color: string } }> }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-navy-card shadow-lg-soft backdrop-blur-xl px-4 py-3 shadow-xl">
        <p className="text-sm font-medium text-text-primary">{payload[0].name}</p>
        <p className="font-mono text-sm text-accent-light">{formatCurrency(payload[0].value)}</p>
      </div>
    );
  }
  return null;
}

function CustomLegend({ payload }: { payload?: Array<{ value: string; color: string }> }) {
  if (!payload) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs text-text-secondary">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.value}
        </div>
      ))}
    </div>
  );
}

// --------------- Helper ---------------

function getTypeLabel(type: string) {
  return INVESTMENT_TYPES.find((t) => t.value === type)?.label ?? type;
}

// --------------- Loading Skeleton ---------------

function InvestmentsSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-24 rounded bg-gray-100" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-32 rounded bg-gray-100" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category + Pie skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-20 rounded bg-gray-100" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="h-4 w-full rounded bg-gray-100" />
                <div className="h-4 w-full rounded bg-gray-100" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <div className="h-5 w-40 rounded bg-gray-100" />
          </CardHeader>
          <CardContent className="flex items-center justify-center min-h-[320px]">
            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          </CardContent>
        </Card>
      </div>

      {/* Investment cards skeleton */}
      <div>
        <div className="h-6 w-40 rounded bg-gray-100 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="h-5 w-36 rounded bg-gray-100" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-4 w-full rounded bg-gray-100" />
                <div className="h-4 w-full rounded bg-gray-100" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// --------------- Page ---------------

export default function InvestmentsPage() {
  const { user } = useAuth();
  const portfolio = useQuery(
    api.investments.getInvestmentPortfolio,
    user ? { userId: user.userId } : "skip"
  );
  const addInvestment = useMutation(api.investments.addInvestment);
  const deleteInvestment = useMutation(api.investments.deleteInvestment);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    type: "",
    name: "",
    investedAmount: "",
    currentValue: "",
    dateInvested: "",
    maturityDate: "",
    expectedReturn: "",
    lockInPeriod: "",
    taxSaving: false,
    taxSection: "none",
  });

  function handleFormChange(field: string, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setFormData({
      type: "",
      name: "",
      investedAmount: "",
      currentValue: "",
      dateInvested: "",
      maturityDate: "",
      expectedReturn: "",
      lockInPeriod: "",
      taxSaving: false,
      taxSection: "none",
    });
  }

  async function handleSubmit() {
    if (!user || !formData.type || !formData.name || !formData.investedAmount || !formData.dateInvested) return;

    setSubmitting(true);
    try {
      await addInvestment({
        userId: user.userId,
        type: formData.type as "mutual_fund" | "stocks" | "ppf" | "nps" | "fd" | "rd" | "gold" | "real_estate" | "elss" | "ulip",
        name: formData.name,
        invested_amount: parseFloat(formData.investedAmount),
        current_value: parseFloat(formData.currentValue) || parseFloat(formData.investedAmount),
        date_invested: formData.dateInvested,
        maturity_date: formData.maturityDate || undefined,
        expected_return_rate: parseFloat(formData.expectedReturn) || 0,
        lock_in_period: formData.lockInPeriod ? parseFloat(formData.lockInPeriod) : undefined,
        tax_saving: formData.taxSaving,
        section: (formData.taxSaving ? formData.taxSection : "none") as "80C" | "80D" | "80CCD" | "none",
      });
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Failed to add investment:", error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await deleteInvestment({ id: id as any });
    } catch (error) {
      console.error("Failed to delete investment:", error);
    }
  }

  // Build category breakdown and pie data from portfolio
  const categoryBreakdown = portfolio
    ? Object.entries(portfolio.byType).map(([key, data]) => ({
        key,
        name: getTypeLabel(key),
        invested: data.invested,
        current: data.current,
        count: data.count,
      }))
    : [];

  const pieData = categoryBreakdown.map((c, i) => ({
    name: c.name,
    value: c.current,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* ---- Page Header ---- */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-text-primary tracking-tight">
              Investments
            </h1>
            <p className="mt-1 text-text-secondary text-sm">
              Track your portfolio, tax savings &amp; financial goals
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Investment
          </Button>
        </div>

        {/* ---- Loading State ---- */}
        {portfolio === undefined ? (
          <InvestmentsSkeleton />
        ) : portfolio.investments.length === 0 ? (
          /* ---- Empty State ---- */
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 mb-4">
                <TrendingUp className="h-8 w-8 text-accent-light" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                No investments tracked yet
              </h3>
              <p className="text-text-secondary text-sm max-w-md mb-6">
                Start building your portfolio! Add your first investment to track performance, tax savings, and progress toward your financial goals.
              </p>
              <Button onClick={() => setDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Investment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ---- Portfolio Overview ---- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-text-secondary">
                    Total Invested
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-2xl font-bold text-text-primary">
                    {formatCurrency(portfolio.totalInvested)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-text-secondary">
                    Current Value
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-2xl font-bold text-accent-light">
                    {formatCurrency(portfolio.totalCurrent)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-text-secondary">
                    Total Gain / Loss
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <p
                      className={`font-mono text-2xl font-bold ${
                        portfolio.gainLoss >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {portfolio.gainLoss >= 0 ? "+" : ""}
                      {formatCurrency(portfolio.gainLoss)}
                    </p>
                    <span
                      className={`flex items-center text-sm ${
                        portfolio.gainLoss >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {portfolio.gainLoss >= 0 ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" />
                      )}
                      {portfolio.gainLossPercent.toFixed(1)}%
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-text-secondary">
                    Total Holdings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-2xl font-bold text-text-primary">
                      {portfolio.investments.length}
                    </p>
                    <TrendingUp className="h-5 w-5 text-accent-light" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ---- Category Breakdown + Pie Chart ---- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Category cards */}
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {categoryBreakdown.map((cat, idx) => {
                  const gain = cat.current - cat.invested;
                  const gainPercent =
                    cat.invested > 0
                      ? ((gain / cat.invested) * 100).toFixed(1)
                      : "0.0";
                  const isPositive = gain >= 0;
                  return (
                    <Card key={cat.key}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium text-text-secondary">
                            {cat.name}
                          </CardTitle>
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                PIE_COLORS[idx % PIE_COLORS.length],
                            }}
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-text-tertiary">Invested</span>
                          <span className="font-mono text-sm text-text-secondary">
                            {formatCurrency(cat.invested)}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-text-tertiary">Current</span>
                          <span className="font-mono text-sm font-semibold text-text-primary">
                            {formatCurrency(cat.current)}
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-1 pt-1">
                          {isPositive ? (
                            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5 text-rose-400" />
                          )}
                          <span
                            className={`font-mono text-xs font-semibold ${
                              isPositive ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {isPositive ? "+" : ""}
                            {formatCurrency(gain)} ({gainPercent}%)
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Pie Chart */}
              <Card className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5 text-accent-light" />
                    <CardTitle>Portfolio Allocation</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 min-h-[320px]">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="45%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomPieTooltip />} />
                        <Legend content={<CustomLegend />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-text-tertiary text-sm">
                      No allocation data
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ---- 80C Tax Saving Progress ---- */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-accent-light" />
                    Section 80C Tax Saving
                  </CardTitle>
                  <Badge
                    variant={
                      portfolio.taxSavingUsed >= portfolio.taxSavingLimit
                        ? "success"
                        : "warning"
                    }
                  >
                    {formatCurrency(portfolio.taxSavingUsed)} of{" "}
                    {formatCurrency(portfolio.taxSavingLimit)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress
                  value={
                    portfolio.taxSavingLimit > 0
                      ? (portfolio.taxSavingUsed / portfolio.taxSavingLimit) *
                        100
                      : 0
                  }
                  indicatorClassName="bg-gradient-to-r from-purple-grad-from to-purple-grad-to"
                  className="h-3"
                />
                <p className="text-xs text-text-tertiary text-right">
                  Remaining:{" "}
                  {formatCurrency(
                    Math.max(
                      0,
                      portfolio.taxSavingLimit - portfolio.taxSavingUsed
                    )
                  )}
                </p>
              </CardContent>
            </Card>

            {/* ---- Individual Investment Cards ---- */}
            <div>
              <h2 className="font-display text-xl font-semibold text-text-primary mb-4">
                Your Investments
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {portfolio.investments.map((inv) => {
                  const gain = inv.current_value - inv.invested_amount;
                  const returnPercent =
                    inv.invested_amount > 0
                      ? (gain / inv.invested_amount) * 100
                      : 0;
                  const isPositive = returnPercent >= 0;
                  return (
                    <Card key={inv._id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base leading-snug">
                            {inv.name}
                          </CardTitle>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {getTypeLabel(inv.type)}
                            </Badge>
                            <button
                              onClick={() => handleDelete(inv._id)}
                              className="rounded p-1 text-text-tertiary hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                              title="Delete investment"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div>
                            <p className="text-text-tertiary text-xs">Invested</p>
                            <p className="font-mono text-text-primary">
                              {formatCurrency(inv.invested_amount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-text-tertiary text-xs">
                              Current Value
                            </p>
                            <p className="font-mono font-semibold text-text-primary">
                              {formatCurrency(inv.current_value)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-border-light pt-3">
                          <div className="flex items-center gap-1">
                            {isPositive ? (
                              <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-rose-400" />
                            )}
                            <span
                              className={`font-mono text-sm font-bold ${
                                isPositive
                                  ? "text-emerald-400"
                                  : "text-rose-400"
                              }`}
                            >
                              {isPositive ? "+" : ""}
                              {returnPercent.toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-right text-xs text-text-tertiary">
                            <p>Invested: {inv.date_invested}</p>
                            {inv.maturity_date && (
                              <p>Maturity: {inv.maturity_date}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ---- Goal-Based Planning (static/demo - future feature) ---- */}
        <div>
          <h2 className="font-display text-xl font-semibold text-text-primary mb-4">
            Goal-Based Planning
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {goals.map((goal) => {
              const GoalIcon = goal.icon;
              return (
                <Card key={goal.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                        <GoalIcon className="h-5 w-5 text-accent-light" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{goal.name}</CardTitle>
                        <p className="text-xs text-text-tertiary mt-0.5">
                          Target: {formatCurrency(goal.target)} in {goal.years}{" "}
                          yrs
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Progress
                      value={goal.progress}
                      indicatorClassName="bg-gradient-to-r from-purple-grad-from to-purple-grad-to"
                      className="h-2"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-text-secondary">
                        {goal.progress}%
                      </span>
                      <span
                        className={`text-xs font-medium ${goal.statusColor}`}
                      >
                        {goal.status}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* ---- Add Investment Dialog ---- */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Investment</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="inv-type">Investment Type</Label>
                <Select
                  id="inv-type"
                  options={[...INVESTMENT_TYPES]}
                  placeholder="Select type"
                  value={formData.type}
                  onChange={(e) => handleFormChange("type", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-name">Name</Label>
                <Input
                  id="inv-name"
                  placeholder="e.g. Axis Bluechip Fund"
                  value={formData.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-invested">Invested Amount</Label>
                <Input
                  id="inv-invested"
                  type="number"
                  placeholder="0"
                  value={formData.investedAmount}
                  onChange={(e) =>
                    handleFormChange("investedAmount", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-current">Current Value</Label>
                <Input
                  id="inv-current"
                  type="number"
                  placeholder="0"
                  value={formData.currentValue}
                  onChange={(e) =>
                    handleFormChange("currentValue", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-date">Date Invested</Label>
                <Input
                  id="inv-date"
                  type="date"
                  value={formData.dateInvested}
                  onChange={(e) =>
                    handleFormChange("dateInvested", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-maturity">Maturity Date (optional)</Label>
                <Input
                  id="inv-maturity"
                  type="date"
                  value={formData.maturityDate}
                  onChange={(e) =>
                    handleFormChange("maturityDate", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-return">Expected Return Rate (%)</Label>
                <Input
                  id="inv-return"
                  type="number"
                  placeholder="12"
                  value={formData.expectedReturn}
                  onChange={(e) =>
                    handleFormChange("expectedReturn", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-lockin">Lock-in Period (years)</Label>
                <Input
                  id="inv-lockin"
                  type="number"
                  placeholder="0"
                  value={formData.lockInPeriod}
                  onChange={(e) =>
                    handleFormChange("lockInPeriod", e.target.value)
                  }
                />
              </div>

              <div className="flex items-center justify-between sm:col-span-2 rounded-lg border border-border-light bg-surface-tertiary/50 p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="inv-tax">Tax Saving Investment</Label>
                  <p className="text-xs text-text-tertiary">
                    Mark if this qualifies for tax deduction
                  </p>
                </div>
                <Switch
                  id="inv-tax"
                  checked={formData.taxSaving}
                  onCheckedChange={(checked) =>
                    handleFormChange("taxSaving", checked)
                  }
                />
              </div>

              {formData.taxSaving && (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="inv-section">Tax Section</Label>
                  <Select
                    id="inv-section"
                    options={TAX_SECTIONS}
                    value={formData.taxSection}
                    onChange={(e) =>
                      handleFormChange("taxSection", e.target.value)
                    }
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Investment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
