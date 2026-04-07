"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrency, getCurrentFinancialYear, INCOME_TYPES, EXPENSE_CATEGORIES } from "@/lib/utils";
import {
  Download,
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart as PieChartIcon,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Activity,
  BookOpen,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-white border border-border shadow-sm rounded-lg p-3 text-sm">
      <p className="text-text-secondary mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="stat-number text-xs">
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

function getFYOptions() {
  const now = new Date();
  const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const options = [];
  for (let y = currentYear; y >= currentYear - 4; y--) {
    options.push({ value: `${y}-${(y + 1).toString().slice(-2)}`, label: `FY ${y}-${(y + 1).toString().slice(-2)}` });
  }
  return options;
}

function getIncomeTypeLabel(type: string) {
  return INCOME_TYPES.find((t) => t.value === type)?.label ?? type;
}

function getCategoryLabel(cat: string) {
  return EXPENSE_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

const ACCOUNT_HEADS = [
  { value: "all", label: "All Accounts" },
  ...INCOME_TYPES.map((t) => ({ value: t.value, label: `Income: ${t.label}` })),
  ...EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: `Expense: ${c.label}` })),
];

export default function ReportsPage() {
  const { user } = useAuth();
  const [selectedFY, setSelectedFY] = useState(getCurrentFinancialYear());
  const [accountHead, setAccountHead] = useState("all");

  const metrics = useQuery(
    api.dashboard.getDashboardMetrics,
    user ? { userId: user.userId } : "skip"
  );

  const pnl = useQuery(
    api.reports.getProfitAndLoss,
    user ? { userId: user.userId, financialYear: selectedFY } : "skip"
  );

  const balanceSheet = useQuery(
    api.reports.getBalanceSheet,
    user ? { userId: user.userId } : "skip"
  );

  const cashFlow = useQuery(
    api.reports.getCashFlow,
    user ? { userId: user.userId, financialYear: selectedFY } : "skip"
  );

  const ledger = useQuery(
    api.reports.getLedger,
    user
      ? { userId: user.userId, financialYear: selectedFY, accountHead }
      : "skip"
  );

  const monthlyPnL = useMemo(() => {
    if (!metrics?.cashFlow) return [];
    return metrics.cashFlow.map((cf) => {
      const [, m] = cf.month.split("-");
      const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return { month: monthNames[parseInt(m)] || cf.month, income: cf.income, expense: cf.expense, net: cf.net };
    });
  }, [metrics]);

  const totalIncome = metrics?.totalIncome ?? 0;
  const totalExpense = metrics?.totalExpenses ?? 0;
  const totalNet = totalIncome - totalExpense;
  const monthCount = monthlyPnL.filter((m) => m.income > 0 || m.expense > 0).length || 1;
  const avgMonthlyIncome = Math.round(totalIncome / monthCount);
  const avgMonthlyExpense = Math.round(totalExpense / monthCount);
  const savingsRate = totalIncome > 0 ? ((totalNet / totalIncome) * 100).toFixed(1) : "0";

  const netWorthTrend = useMemo(() => {
    if (!metrics?.cashFlow) return [];
    let running = (metrics?.totalCurrentValue ?? 0) - (metrics?.totalLoanOutstanding ?? 0) - totalNet;
    return metrics.cashFlow.map((cf) => {
      running += cf.net;
      const [, m] = cf.month.split("-");
      const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return { month: monthNames[parseInt(m)] || cf.month, value: Math.max(0, running) };
    });
  }, [metrics, totalNet]);

  if (!user)
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-text-secondary">Loading...</p>
        </div>
      </AppLayout>
    );

  const isLoading = metrics === undefined;

  return (
    <AppLayout>
      <div className="space-y-6 animate-enter">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">Reports</h1>
            <p className="text-text-secondary text-sm mt-1">Financial Statements &amp; Analysis</p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              options={getFYOptions()}
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
              className="w-40"
            />
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
            <div className="h-80 rounded-xl bg-gray-100 animate-pulse" />
          </div>
        ) : (
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="pnl">P&amp;L</TabsTrigger>
              <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
              <TabsTrigger value="cash-flow">Cash Flow</TabsTrigger>
              <TabsTrigger value="ledger">Ledger</TabsTrigger>
            </TabsList>

            {/* ==================== OVERVIEW TAB ==================== */}
            <TabsContent value="overview">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-emerald" />
                        <p className="text-text-secondary text-xs uppercase">Total Income</p>
                      </div>
                      <p className="stat-number text-2xl text-emerald">{formatCurrency(totalIncome)}</p>
                      <p className="text-text-tertiary text-xs mt-1">Avg {formatCurrency(avgMonthlyIncome)}/mo</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="h-4 w-4 text-rose" />
                        <p className="text-text-secondary text-xs uppercase">Total Expenses</p>
                      </div>
                      <p className="stat-number text-2xl text-rose">{formatCurrency(totalExpense)}</p>
                      <p className="text-text-tertiary text-xs mt-1">Avg {formatCurrency(avgMonthlyExpense)}/mo</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <Wallet className="h-4 w-4 text-accent-light" />
                        <p className="text-text-secondary text-xs uppercase">Net Savings</p>
                      </div>
                      <p className="stat-number text-2xl text-accent-light">{formatCurrency(totalNet)}</p>
                      <p className="text-text-tertiary text-xs mt-1">Savings rate: {savingsRate}%</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <PieChartIcon className="h-4 w-4 text-blue-400" />
                        <p className="text-text-secondary text-xs uppercase">Net Worth</p>
                      </div>
                      <p className="stat-number text-2xl text-text-primary">{formatCurrency(metrics.netWorth)}</p>
                    </CardContent>
                  </Card>
                </div>

                {totalIncome === 0 && totalExpense === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-text-secondary">
                        No financial data yet. Add income and expenses to see your reports here.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle>Monthly Income vs Expenses</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyPnL}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                              <XAxis dataKey="month" stroke="rgba(107,114,128,0.5)" fontSize={12} />
                              <YAxis stroke="rgba(107,114,128,0.5)" fontSize={12} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                              <Tooltip content={<CustomTooltip />} />
                              <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} name="Income" />
                              <Bar dataKey="expense" fill="#F43F5E" radius={[4, 4, 0, 0]} name="Expense" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {netWorthTrend.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Net Worth Progression</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={netWorthTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                                <XAxis dataKey="month" stroke="rgba(107,114,128,0.5)" fontSize={12} />
                                <YAxis stroke="rgba(107,114,128,0.5)" fontSize={12} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                                <Tooltip content={<CustomTooltip />} />
                                <Line type="monotone" dataKey="value" stroke="#F0A500" strokeWidth={2} dot={false} name="Net Worth" />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>Monthly Breakdown</CardTitle>
                          <Badge>FY {selectedFY}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left py-3 text-text-secondary font-medium">Month</th>
                                <th className="text-right py-3 text-text-secondary font-medium">Income</th>
                                <th className="text-right py-3 text-text-secondary font-medium">Expenses</th>
                                <th className="text-right py-3 text-text-secondary font-medium">Net</th>
                                <th className="text-right py-3 text-text-secondary font-medium">Savings %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {monthlyPnL
                                .filter((m) => m.income > 0 || m.expense > 0)
                                .map((m) => (
                                  <tr key={m.month} className="border-b border-border-light hover:bg-surface-tertiary/50">
                                    <td className="py-3 text-text-primary">{m.month}</td>
                                    <td className="py-3 text-right stat-number text-emerald">{formatCurrency(m.income)}</td>
                                    <td className="py-3 text-right stat-number text-rose">{formatCurrency(m.expense)}</td>
                                    <td className="py-3 text-right stat-number text-accent-light">{formatCurrency(m.net)}</td>
                                    <td className="py-3 text-right stat-number text-text-secondary">
                                      {m.income > 0 ? ((m.net / m.income) * 100).toFixed(1) : "0"}%
                                    </td>
                                  </tr>
                                ))}
                              {monthlyPnL.filter((m) => m.income > 0 || m.expense > 0).length > 1 && (
                                <tr className="border-t-2 border-accent/25 font-bold">
                                  <td className="py-3 text-accent-light">Total</td>
                                  <td className="py-3 text-right stat-number text-emerald">{formatCurrency(totalIncome)}</td>
                                  <td className="py-3 text-right stat-number text-rose">{formatCurrency(totalExpense)}</td>
                                  <td className="py-3 text-right stat-number text-accent-light">{formatCurrency(totalNet)}</td>
                                  <td className="py-3 text-right stat-number text-text-primary">{savingsRate}%</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </TabsContent>

            {/* ==================== P&L TAB ==================== */}
            <TabsContent value="pnl">
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-accent-light" />
                  <h2 className="font-display text-xl font-semibold text-text-primary">Profit &amp; Loss Statement</h2>
                  <Badge className="ml-auto">FY {selectedFY}</Badge>
                </div>

                {pnl === undefined ? (
                  <div className="h-64 rounded-xl bg-gray-100 animate-pulse" />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Revenue */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                          Revenue
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {Object.entries(pnl.revenue).length === 0 ? (
                            <p className="text-text-tertiary text-sm py-4 text-center">No revenue entries</p>
                          ) : (
                            <>
                              {Object.entries(pnl.revenue)
                                .sort(([, a], [, b]) => b - a)
                                .map(([type, amount]) => (
                                  <div key={type} className="flex justify-between py-2 border-b border-border-light">
                                    <span className="text-text-secondary text-sm">{getIncomeTypeLabel(type)}</span>
                                    <span className="stat-number text-sm text-emerald-500">{formatCurrency(amount)}</span>
                                  </div>
                                ))}
                              <div className="flex justify-between py-3 border-t-2 border-emerald-200 font-bold">
                                <span className="text-text-primary">Gross Income</span>
                                <span className="stat-number text-emerald-500">{formatCurrency(pnl.grossIncome)}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Expenses */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ArrowDownRight className="h-4 w-4 text-rose-400" />
                          Expenses
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {Object.entries(pnl.expenses).length === 0 ? (
                            <p className="text-text-tertiary text-sm py-4 text-center">No expense entries</p>
                          ) : (
                            <>
                              {Object.entries(pnl.expenses)
                                .sort(([, a], [, b]) => b - a)
                                .map(([cat, amount]) => (
                                  <div key={cat} className="flex justify-between py-2 border-b border-border-light">
                                    <span className="text-text-secondary text-sm">{getCategoryLabel(cat)}</span>
                                    <span className="stat-number text-sm text-rose-500">{formatCurrency(amount)}</span>
                                  </div>
                                ))}
                              <div className="flex justify-between py-3 border-t-2 border-rose-200 font-bold">
                                <span className="text-text-primary">Total Expenses</span>
                                <span className="stat-number text-rose-500">{formatCurrency(pnl.totalExpenses)}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Net Profit */}
                    <Card className="lg:col-span-2">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${pnl.netProfit >= 0 ? "bg-emerald-50" : "bg-rose-50"}`}>
                              {pnl.netProfit >= 0 ? (
                                <TrendingUp className="h-6 w-6 text-emerald-500" />
                              ) : (
                                <TrendingDown className="h-6 w-6 text-rose-500" />
                              )}
                            </div>
                            <div>
                              <p className="text-text-secondary text-sm">Net Profit / Loss</p>
                              <p className={`stat-number text-3xl font-bold ${pnl.netProfit >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                {formatCurrency(pnl.netProfit)}
                              </p>
                            </div>
                          </div>
                          <Badge variant={pnl.netProfit >= 0 ? "success" : "destructive"}>
                            {pnl.netProfit >= 0 ? "Profit" : "Loss"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ==================== BALANCE SHEET TAB ==================== */}
            <TabsContent value="balance-sheet">
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <Scale className="h-5 w-5 text-accent-light" />
                  <h2 className="font-display text-xl font-semibold text-text-primary">Balance Sheet</h2>
                </div>

                {balanceSheet === undefined ? (
                  <div className="h-64 rounded-xl bg-gray-100 animate-pulse" />
                ) : (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Assets */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-emerald-500">
                            <ArrowUpRight className="h-4 w-4" />
                            Assets
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex justify-between py-2 border-b border-border-light">
                              <span className="text-text-secondary text-sm">Cash &amp; Bank Balance</span>
                              <span className="stat-number text-sm">{formatCurrency(balanceSheet.assets.cash)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border-light">
                              <span className="text-text-secondary text-sm">Investments (Current Value)</span>
                              <span className="stat-number text-sm">{formatCurrency(balanceSheet.assets.investments)}</span>
                            </div>
                            <div className="flex justify-between py-3 border-t-2 border-emerald-200 font-bold">
                              <span className="text-emerald-600">Total Assets</span>
                              <span className="stat-number text-emerald-600">
                                {formatCurrency(balanceSheet.assets.cash + balanceSheet.assets.investments)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Liabilities */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-rose-500">
                            <ArrowDownRight className="h-4 w-4" />
                            Liabilities
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex justify-between py-2 border-b border-border-light">
                              <span className="text-text-secondary text-sm">Loan Outstanding</span>
                              <span className="stat-number text-sm">{formatCurrency(balanceSheet.liabilities.loans)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border-light">
                              <span className="text-text-secondary text-sm">GST Liability</span>
                              <span className="stat-number text-sm">{formatCurrency(balanceSheet.liabilities.gstLiability)}</span>
                            </div>
                            <div className="flex justify-between py-3 border-t-2 border-rose-200 font-bold">
                              <span className="text-rose-600">Total Liabilities</span>
                              <span className="stat-number text-rose-600">
                                {formatCurrency(balanceSheet.liabilities.loans + balanceSheet.liabilities.gstLiability)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Net Worth */}
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                              <Wallet className="h-6 w-6 text-accent-light" />
                            </div>
                            <div>
                              <p className="text-text-secondary text-sm">Net Worth (Assets - Liabilities)</p>
                              <p className="stat-number text-3xl font-bold text-accent-light">
                                {formatCurrency(balanceSheet.netWorth)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </TabsContent>

            {/* ==================== CASH FLOW TAB ==================== */}
            <TabsContent value="cash-flow">
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-5 w-5 text-accent-light" />
                  <h2 className="font-display text-xl font-semibold text-text-primary">Cash Flow Statement</h2>
                  <Badge className="ml-auto">FY {selectedFY}</Badge>
                </div>

                {cashFlow === undefined ? (
                  <div className="h-64 rounded-xl bg-gray-100 animate-pulse" />
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-5">
                          <p className="text-text-secondary text-xs uppercase mb-2">Operating Activities</p>
                          <p className={`stat-number text-2xl font-bold ${cashFlow.operating >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                            {formatCurrency(cashFlow.operating)}
                          </p>
                          <p className="text-text-tertiary text-xs mt-1">Income minus operating expenses</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-5">
                          <p className="text-text-secondary text-xs uppercase mb-2">Investing Activities</p>
                          <p className={`stat-number text-2xl font-bold ${cashFlow.investing >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                            {formatCurrency(cashFlow.investing)}
                          </p>
                          <p className="text-text-tertiary text-xs mt-1">Investment income minus purchases</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-5">
                          <p className="text-text-secondary text-xs uppercase mb-2">Financing Activities</p>
                          <p className={`stat-number text-2xl font-bold ${cashFlow.financing >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                            {formatCurrency(cashFlow.financing)}
                          </p>
                          <p className="text-text-tertiary text-xs mt-1">EMI &amp; loan payments</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${cashFlow.netCashFlow >= 0 ? "bg-emerald-50" : "bg-rose-50"}`}>
                              <Activity className={`h-6 w-6 ${cashFlow.netCashFlow >= 0 ? "text-emerald-500" : "text-rose-500"}`} />
                            </div>
                            <div>
                              <p className="text-text-secondary text-sm">Net Cash Flow</p>
                              <p className={`stat-number text-3xl font-bold ${cashFlow.netCashFlow >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                {formatCurrency(cashFlow.netCashFlow)}
                              </p>
                            </div>
                          </div>
                          <Badge variant={cashFlow.netCashFlow >= 0 ? "success" : "destructive"}>
                            {cashFlow.netCashFlow >= 0 ? "Positive" : "Negative"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Summary Table */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Cash Flow Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-3 text-text-secondary font-medium">Activity</th>
                              <th className="text-right py-3 text-text-secondary font-medium">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-border-light">
                              <td className="py-3 text-text-primary">Operating Activities</td>
                              <td className={`py-3 text-right stat-number ${cashFlow.operating >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                {formatCurrency(cashFlow.operating)}
                              </td>
                            </tr>
                            <tr className="border-b border-border-light">
                              <td className="py-3 text-text-primary">Investing Activities</td>
                              <td className={`py-3 text-right stat-number ${cashFlow.investing >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                {formatCurrency(cashFlow.investing)}
                              </td>
                            </tr>
                            <tr className="border-b border-border-light">
                              <td className="py-3 text-text-primary">Financing Activities</td>
                              <td className={`py-3 text-right stat-number ${cashFlow.financing >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                {formatCurrency(cashFlow.financing)}
                              </td>
                            </tr>
                            <tr className="border-t-2 border-accent/25 font-bold">
                              <td className="py-3 text-accent-light">Net Cash Flow</td>
                              <td className={`py-3 text-right stat-number ${cashFlow.netCashFlow >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                {formatCurrency(cashFlow.netCashFlow)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </TabsContent>

            {/* ==================== LEDGER TAB ==================== */}
            <TabsContent value="ledger">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-accent-light" />
                    <h2 className="font-display text-xl font-semibold text-text-primary">General Ledger</h2>
                  </div>
                  <Select
                    options={ACCOUNT_HEADS}
                    value={accountHead}
                    onChange={(e) => setAccountHead(e.target.value)}
                    className="w-56"
                  />
                </div>

                {ledger === undefined ? (
                  <div className="h-64 rounded-xl bg-gray-100 animate-pulse" />
                ) : ledger.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-text-secondary">No transactions found for this account head in FY {selectedFY}.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-surface-tertiary/50">
                              <th className="text-left py-3 px-4 text-text-secondary font-medium">Date</th>
                              <th className="text-left py-3 px-4 text-text-secondary font-medium">Description</th>
                              <th className="text-right py-3 px-4 text-text-secondary font-medium">Debit</th>
                              <th className="text-right py-3 px-4 text-text-secondary font-medium">Credit</th>
                              <th className="text-right py-3 px-4 text-text-secondary font-medium">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ledger.map((entry, i) => (
                              <tr key={i} className="border-b border-border-light hover:bg-surface-tertiary/30">
                                <td className="py-3 px-4 text-text-primary font-mono text-xs">{entry.date}</td>
                                <td className="py-3 px-4 text-text-primary">{entry.description}</td>
                                <td className="py-3 px-4 text-right stat-number text-rose-500">
                                  {entry.debit > 0 ? formatCurrency(entry.debit) : "-"}
                                </td>
                                <td className="py-3 px-4 text-right stat-number text-emerald-500">
                                  {entry.credit > 0 ? formatCurrency(entry.credit) : "-"}
                                </td>
                                <td className={`py-3 px-4 text-right stat-number font-bold ${entry.balance >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                  {formatCurrency(entry.balance)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
