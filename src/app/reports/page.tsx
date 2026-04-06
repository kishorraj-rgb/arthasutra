"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Download, TrendingUp, TrendingDown, Wallet, PieChart as PieChartIcon } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";

const monthlyPnL = [
  { month: "Apr", income: 310000, expense: 145000, net: 165000 },
  { month: "May", income: 310000, expense: 152000, net: 158000 },
  { month: "Jun", income: 385000, expense: 138000, net: 247000 },
  { month: "Jul", income: 310000, expense: 165000, net: 145000 },
  { month: "Aug", income: 310000, expense: 142000, net: 168000 },
  { month: "Sep", income: 395000, expense: 158000, net: 237000 },
  { month: "Oct", income: 310000, expense: 148000, net: 162000 },
  { month: "Nov", income: 310000, expense: 155000, net: 155000 },
  { month: "Dec", income: 385000, expense: 170000, net: 215000 },
  { month: "Jan", income: 310000, expense: 145000, net: 165000 },
  { month: "Feb", income: 310000, expense: 140000, net: 170000 },
  { month: "Mar", income: 395000, expense: 160000, net: 235000 },
];

const netWorthTrend = [
  { month: "Apr", value: 9500000 },
  { month: "May", value: 9750000 },
  { month: "Jun", value: 10100000 },
  { month: "Jul", value: 10350000 },
  { month: "Aug", value: 10600000 },
  { month: "Sep", value: 11000000 },
  { month: "Oct", value: 11200000 },
  { month: "Nov", value: 11450000 },
  { month: "Dec", value: 11800000 },
  { month: "Jan", value: 12050000 },
  { month: "Feb", value: 12300000 },
  { month: "Mar", value: 12450000 },
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-navy border border-gold/20 rounded-lg p-3 text-sm shadow-xl">
      <p className="text-white/60 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="stat-number text-xs">
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const totalIncome = monthlyPnL.reduce((s, m) => s + m.income, 0);
  const totalExpense = monthlyPnL.reduce((s, m) => s + m.expense, 0);
  const totalNet = totalIncome - totalExpense;
  const avgMonthlyIncome = totalIncome / 12;
  const avgMonthlyExpense = totalExpense / 12;
  const savingsRate = ((totalNet / totalIncome) * 100).toFixed(1);

  return (
    <AppLayout>
      <div className="space-y-6 animate-enter">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Reports</h1>
            <p className="text-white/50 text-sm mt-1">FY 2025-26 Annual Financial Summary</p>
          </div>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Annual Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-emerald" />
                <p className="text-white/50 text-xs uppercase">Total Income</p>
              </div>
              <p className="stat-number text-2xl text-emerald">{formatCurrency(totalIncome)}</p>
              <p className="text-white/30 text-xs mt-1">Avg {formatCurrency(avgMonthlyIncome)}/mo</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-rose" />
                <p className="text-white/50 text-xs uppercase">Total Expenses</p>
              </div>
              <p className="stat-number text-2xl text-rose">{formatCurrency(totalExpense)}</p>
              <p className="text-white/30 text-xs mt-1">Avg {formatCurrency(avgMonthlyExpense)}/mo</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-gold" />
                <p className="text-white/50 text-xs uppercase">Net Savings</p>
              </div>
              <p className="stat-number text-2xl text-gold">{formatCurrency(totalNet)}</p>
              <p className="text-white/30 text-xs mt-1">Savings rate: {savingsRate}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <PieChartIcon className="h-4 w-4 text-blue-400" />
                <p className="text-white/50 text-xs uppercase">Net Worth Growth</p>
              </div>
              <p className="stat-number text-2xl text-white">{formatCurrency(netWorthTrend[11].value - netWorthTrend[0].value)}</p>
              <p className="text-white/30 text-xs mt-1">
                +{(((netWorthTrend[11].value - netWorthTrend[0].value) / netWorthTrend[0].value) * 100).toFixed(1)}% this FY
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Monthly P&L Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Profit & Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyPnL}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" fontSize={12} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} name="Income" />
                  <Bar dataKey="expense" fill="#F43F5E" radius={[4, 4, 0, 0]} name="Expense" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Net Worth Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Net Worth Progression</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={netWorthTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" fontSize={12} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="value" stroke="#F0A500" strokeWidth={2} dot={false} name="Net Worth" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Breakdown Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Monthly Breakdown</CardTitle>
              <Badge>FY 2025-26</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 text-white/50 font-medium">Month</th>
                    <th className="text-right py-3 text-white/50 font-medium">Income</th>
                    <th className="text-right py-3 text-white/50 font-medium">Expenses</th>
                    <th className="text-right py-3 text-white/50 font-medium">Net</th>
                    <th className="text-right py-3 text-white/50 font-medium">Savings %</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyPnL.map((m) => (
                    <tr key={m.month} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-3 text-white">{m.month}</td>
                      <td className="py-3 text-right stat-number text-emerald">{formatCurrency(m.income)}</td>
                      <td className="py-3 text-right stat-number text-rose">{formatCurrency(m.expense)}</td>
                      <td className="py-3 text-right stat-number text-gold">{formatCurrency(m.net)}</td>
                      <td className="py-3 text-right stat-number text-white/60">
                        {((m.net / m.income) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gold/20 font-bold">
                    <td className="py-3 text-gold">Total</td>
                    <td className="py-3 text-right stat-number text-emerald">{formatCurrency(totalIncome)}</td>
                    <td className="py-3 text-right stat-number text-rose">{formatCurrency(totalExpense)}</td>
                    <td className="py-3 text-right stat-number text-gold">{formatCurrency(totalNet)}</td>
                    <td className="py-3 text-right stat-number text-white">{savingsRate}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Tax Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Tax Computation Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/60">Gross Income</span>
                <span className="stat-number text-white">{formatCurrency(totalIncome)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/60">Standard Deduction</span>
                <span className="stat-number text-emerald">- {formatCurrency(75000)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/60">80C Deductions</span>
                <span className="stat-number text-emerald">- {formatCurrency(150000)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/60">80D (Health Insurance)</span>
                <span className="stat-number text-emerald">- {formatCurrency(25000)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/60">80CCD(1B) NPS</span>
                <span className="stat-number text-emerald">- {formatCurrency(50000)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-white/60">24(b) Home Loan Interest</span>
                <span className="stat-number text-emerald">- {formatCurrency(200000)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gold/20 col-span-2">
                <span className="text-gold font-medium">Taxable Income (Old Regime)</span>
                <span className="stat-number text-gold font-bold">
                  {formatCurrency(totalIncome - 75000 - 150000 - 25000 - 50000 - 200000)}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-white/60">TDS Deducted</span>
                <span className="stat-number text-white">{formatCurrency(234000)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-white/60">Advance Tax Paid</span>
                <span className="stat-number text-white">{formatCurrency(58500)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
