"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Download, TrendingUp, TrendingDown, Wallet, PieChart as PieChartIcon, FileText } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-white border border-border shadow-sm rounded-lg p-3 text-sm">
      <p className="text-text-secondary mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="stat-number text-xs">{p.name}: {formatCurrency(p.value)}</p>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const { user } = useAuth();
  const metrics = useQuery(api.dashboard.getDashboardMetrics, user ? { userId: user.userId } : "skip");

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

  if (!user) return <AppLayout><div className="flex items-center justify-center h-96"><p className="text-text-secondary">Loading...</p></div></AppLayout>;

  if (metrics === undefined) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div><h1 className="font-display text-2xl font-bold text-text-primary">Reports</h1></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />)}</div>
          <div className="h-80 rounded-xl bg-gray-100 animate-pulse" />
        </div>
      </AppLayout>
    );
  }

  const hasData = totalIncome > 0 || totalExpense > 0;

  return (
    <AppLayout>
      <div className="space-y-6 animate-enter">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">Reports</h1>
            <p className="text-text-secondary text-sm mt-1">Financial Summary</p>
          </div>
          <Button variant="outline"><Download className="h-4 w-4 mr-2" />Export CSV</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardContent className="p-5"><div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-emerald" /><p className="text-text-secondary text-xs uppercase">Total Income</p></div><p className="stat-number text-2xl text-emerald">{formatCurrency(totalIncome)}</p><p className="text-text-tertiary text-xs mt-1">Avg {formatCurrency(avgMonthlyIncome)}/mo</p></CardContent></Card>
          <Card><CardContent className="p-5"><div className="flex items-center gap-2 mb-2"><TrendingDown className="h-4 w-4 text-rose" /><p className="text-text-secondary text-xs uppercase">Total Expenses</p></div><p className="stat-number text-2xl text-rose">{formatCurrency(totalExpense)}</p><p className="text-text-tertiary text-xs mt-1">Avg {formatCurrency(avgMonthlyExpense)}/mo</p></CardContent></Card>
          <Card><CardContent className="p-5"><div className="flex items-center gap-2 mb-2"><Wallet className="h-4 w-4 text-accent-light" /><p className="text-text-secondary text-xs uppercase">Net Savings</p></div><p className="stat-number text-2xl text-accent-light">{formatCurrency(totalNet)}</p><p className="text-text-tertiary text-xs mt-1">Savings rate: {savingsRate}%</p></CardContent></Card>
          <Card><CardContent className="p-5"><div className="flex items-center gap-2 mb-2"><PieChartIcon className="h-4 w-4 text-blue-400" /><p className="text-text-secondary text-xs uppercase">Net Worth</p></div><p className="stat-number text-2xl text-text-primary">{formatCurrency(metrics.netWorth)}</p></CardContent></Card>
        </div>

        {!hasData ? (
          <Card><CardContent className="p-12 text-center"><FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" /><p className="text-text-secondary">No financial data yet. Add income and expenses to see your reports here.</p></CardContent></Card>
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle>Monthly Income vs Expenses</CardTitle></CardHeader>
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
                <CardHeader><CardTitle>Net Worth Progression</CardTitle></CardHeader>
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
              <CardHeader><div className="flex items-center justify-between"><CardTitle>Monthly Breakdown</CardTitle><Badge>Current FY</Badge></div></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border"><th className="text-left py-3 text-text-secondary font-medium">Month</th><th className="text-right py-3 text-text-secondary font-medium">Income</th><th className="text-right py-3 text-text-secondary font-medium">Expenses</th><th className="text-right py-3 text-text-secondary font-medium">Net</th><th className="text-right py-3 text-text-secondary font-medium">Savings %</th></tr></thead>
                    <tbody>
                      {monthlyPnL.filter((m) => m.income > 0 || m.expense > 0).map((m) => (
                        <tr key={m.month} className="border-b border-border-light hover:bg-surface-tertiary/50">
                          <td className="py-3 text-text-primary">{m.month}</td>
                          <td className="py-3 text-right stat-number text-emerald">{formatCurrency(m.income)}</td>
                          <td className="py-3 text-right stat-number text-rose">{formatCurrency(m.expense)}</td>
                          <td className="py-3 text-right stat-number text-accent-light">{formatCurrency(m.net)}</td>
                          <td className="py-3 text-right stat-number text-text-secondary">{m.income > 0 ? ((m.net / m.income) * 100).toFixed(1) : "0"}%</td>
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

            <Card>
              <CardHeader><CardTitle>Tax Summary</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-border-light"><span className="text-text-secondary">Gross Income</span><span className="stat-number text-text-primary">{formatCurrency(totalIncome)}</span></div>
                  <div className="flex justify-between py-2 border-b border-border-light"><span className="text-text-secondary">TDS Deducted</span><span className="stat-number text-text-primary">{formatCurrency(metrics.totalTDS)}</span></div>
                  <div className="flex justify-between py-2 border-b border-border-light"><span className="text-text-secondary">GST Collected</span><span className="stat-number text-text-primary">{formatCurrency(metrics.totalGSTCollected)}</span></div>
                  <div className="flex justify-between py-2 border-b border-border-light"><span className="text-text-secondary">GST Paid</span><span className="stat-number text-text-primary">{formatCurrency(metrics.totalGSTPaid)}</span></div>
                  <div className="flex justify-between py-2 border-b border-accent/25 col-span-2"><span className="text-accent-light font-medium">Net GST Liability</span><span className="stat-number text-accent-light font-bold">{formatCurrency(metrics.gstLiability)}</span></div>
                  <div className="flex justify-between py-2"><span className="text-text-secondary">80C Investments</span><span className="stat-number text-text-primary">{formatCurrency(metrics.taxSaving80C)} / {formatCurrency(metrics.taxSavingLimit)}</span></div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
