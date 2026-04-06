"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency, INCOME_TYPES, CATEGORY_COLORS } from "@/lib/utils";
import {
  Plus,
  TrendingUp,
  IndianRupee,
  FileText,
  Edit,
  Trash2,
  Filter,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const incomeEntries = [
  {
    id: "1",
    date: "2026-03-31",
    type: "salary",
    description: "Monthly Salary - TCS Ltd",
    amount: 235000,
    tds: 19500,
    gst: 0,
    invoice: "",
  },
  {
    id: "2",
    date: "2026-03-15",
    type: "freelance",
    description: "UI/UX Consulting - FinEdge",
    amount: 75000,
    tds: 7500,
    gst: 13500,
    invoice: "INV-2026-042",
  },
  {
    id: "3",
    date: "2026-03-01",
    type: "rental",
    description: "Flat Rental - Koramangala 2BHK",
    amount: 25000,
    tds: 0,
    gst: 0,
    invoice: "",
  },
  {
    id: "4",
    date: "2026-02-28",
    type: "salary",
    description: "Monthly Salary - TCS Ltd",
    amount: 235000,
    tds: 19500,
    gst: 0,
    invoice: "",
  },
  {
    id: "5",
    date: "2026-02-20",
    type: "interest",
    description: "FD Interest - SBI 3-Year",
    amount: 4200,
    tds: 420,
    gst: 0,
    invoice: "",
  },
  {
    id: "6",
    date: "2026-02-10",
    type: "dividend",
    description: "HDFC Bank Equity Dividend",
    amount: 3500,
    tds: 350,
    gst: 0,
    invoice: "",
  },
  {
    id: "7",
    date: "2026-02-01",
    type: "rental",
    description: "Flat Rental - Koramangala 2BHK",
    amount: 25000,
    tds: 0,
    gst: 0,
    invoice: "",
  },
  {
    id: "8",
    date: "2026-01-31",
    type: "salary",
    description: "Monthly Salary - TCS Ltd",
    amount: 235000,
    tds: 19500,
    gst: 0,
    invoice: "",
  },
  {
    id: "9",
    date: "2026-01-18",
    type: "freelance",
    description: "Mobile App Design - HealthFirst",
    amount: 120000,
    tds: 12000,
    gst: 21600,
    invoice: "INV-2026-031",
  },
  {
    id: "10",
    date: "2026-01-05",
    type: "interest",
    description: "Savings Account Interest - ICICI",
    amount: 1850,
    tds: 0,
    gst: 0,
    invoice: "",
  },
];

const monthlyChartData = [
  { month: "Apr", salary: 235000, freelance: 50000, rental: 25000, interest: 1200, dividend: 0 },
  { month: "May", salary: 235000, freelance: 0, rental: 25000, interest: 1200, dividend: 2800 },
  { month: "Jun", salary: 235000, freelance: 85000, rental: 25000, interest: 1200, dividend: 0 },
  { month: "Jul", salary: 235000, freelance: 0, rental: 25000, interest: 4200, dividend: 0 },
  { month: "Aug", salary: 235000, freelance: 60000, rental: 25000, interest: 1200, dividend: 3500 },
  { month: "Sep", salary: 235000, freelance: 0, rental: 25000, interest: 1200, dividend: 0 },
  { month: "Oct", salary: 235000, freelance: 110000, rental: 25000, interest: 1200, dividend: 0 },
  { month: "Nov", salary: 235000, freelance: 0, rental: 25000, interest: 4200, dividend: 2800 },
  { month: "Dec", salary: 235000, freelance: 45000, rental: 25000, interest: 1200, dividend: 0 },
  { month: "Jan", salary: 235000, freelance: 120000, rental: 25000, interest: 1850, dividend: 0 },
  { month: "Feb", salary: 235000, freelance: 0, rental: 25000, interest: 4200, dividend: 3500 },
  { month: "Mar", salary: 235000, freelance: 75000, rental: 25000, interest: 0, dividend: 0 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_BADGE_MAP: Record<string, { label: string; color: string }> = {
  salary: { label: "Salary", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  freelance: { label: "Freelance", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  rental: { label: "Rental", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  interest: { label: "Interest", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  dividend: { label: "Dividend", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  other: { label: "Other", color: "bg-white/5 text-white/70 border-white/10" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IncomePage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Stats
  const totalIncome = incomeEntries.reduce((s, e) => s + e.amount, 0);
  const totalTds = incomeEntries.reduce((s, e) => s + e.tds, 0);
  const totalGst = incomeEntries.reduce((s, e) => s + e.gst, 0);
  const projectedAnnual = Math.round(totalIncome * (12 / 3)); // 3 months of data shown

  // Filtered entries
  const filtered = incomeEntries.filter((e) => {
    if (typeFilter && e.type !== typeFilter) return false;
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    return true;
  });

  function handleFormSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setDialogOpen(false);
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-white">Income</h1>
            <p className="text-white/50 text-sm mt-1">
              Track all income sources, TDS and GST for FY 2025-26
            </p>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-gradient-to-r from-gold to-amber-600 hover:from-gold/90 hover:to-amber-600/90 text-navy font-semibold"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Income
          </Button>
        </div>

        {/* ---- Stats Row ---- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <IndianRupee className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wider">Total Income YTD</p>
                <p className="text-xl font-display font-bold text-emerald-400 stat-number">
                  {formatCurrency(totalIncome)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-rose-400" />
              </div>
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wider">TDS Deducted</p>
                <p className="text-xl font-display font-bold text-rose-400 stat-number">
                  {formatCurrency(totalTds)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wider">GST Collected</p>
                <p className="text-xl font-display font-bold text-blue-400 stat-number">
                  {formatCurrency(totalGst)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gold/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-gold" />
              </div>
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wider">Projected Annual</p>
                <p className="text-xl font-display font-bold text-gold stat-number">
                  {formatCurrency(projectedAnnual)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ---- Filter Bar ---- */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-white/50">
                <Filter className="h-4 w-4" />
                <span className="text-sm font-medium">Filters</span>
              </div>
              <Select
                options={[{ value: "", label: "All Types" }, ...INCOME_TYPES.map((t) => ({ value: t.value, label: t.label }))]}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-48"
              />
              <div className="flex items-center gap-2">
                <Label className="text-white/50 text-sm">From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-white/50 text-sm">To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-40"
                />
              </div>
              {(typeFilter || dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTypeFilter("");
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="text-white/50 hover:text-white"
                >
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ---- Income Entries Table ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-white font-display">Income Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/50 text-left">
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 pr-4 font-medium">Type</th>
                    <th className="pb-3 pr-4 font-medium">Description</th>
                    <th className="pb-3 pr-4 font-medium text-right">Amount</th>
                    <th className="pb-3 pr-4 font-medium text-right">TDS</th>
                    <th className="pb-3 pr-4 font-medium text-right">GST</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => {
                    const badge = TYPE_BADGE_MAP[entry.type] ?? TYPE_BADGE_MAP.other;
                    return (
                      <tr
                        key={entry.id}
                        className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-3 pr-4 text-white/70">{formatDate(entry.date)}</td>
                        <td className="py-3 pr-4">
                          <Badge className={badge.color}>{badge.label}</Badge>
                        </td>
                        <td className="py-3 pr-4 text-white">{entry.description}</td>
                        <td className="py-3 pr-4 text-right font-semibold text-emerald-400 stat-number">
                          {formatCurrency(entry.amount)}
                        </td>
                        <td className="py-3 pr-4 text-right text-white/50 stat-number">
                          {entry.tds ? formatCurrency(entry.tds) : "-"}
                        </td>
                        <td className="py-3 pr-4 text-right text-white/50 stat-number">
                          {entry.gst ? formatCurrency(entry.gst) : "-"}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
                              <Edit className="h-4 w-4" />
                            </button>
                            <button className="p-1.5 rounded-lg hover:bg-rose-500/10 text-white/40 hover:text-rose-400 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-white/30">
                        No income entries match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ---- Monthly Income by Category Chart ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-white font-display">Income by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) =>
                      v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${(v / 1000).toFixed(0)}K`
                    }
                    tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
                    axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15,23,42,0.95)",
                      border: "1px solid rgba(240,165,0,0.2)",
                      borderRadius: "0.75rem",
                      color: "#fff",
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => formatCurrency(Number(value))}
                  />
                  <Bar dataKey="salary" stackId="a" fill={CATEGORY_COLORS.salary} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="freelance" stackId="a" fill={CATEGORY_COLORS.freelance} />
                  <Bar dataKey="rental" stackId="a" fill={CATEGORY_COLORS.rental} />
                  <Bar dataKey="interest" stackId="a" fill={CATEGORY_COLORS.interest} />
                  <Bar dataKey="dividend" stackId="a" fill={CATEGORY_COLORS.dividend} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
              {["salary", "freelance", "rental", "interest", "dividend"].map((key) => (
                <div key={key} className="flex items-center gap-2 text-xs text-white/60">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{ backgroundColor: CATEGORY_COLORS[key] }}
                  />
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ---- Add Income Dialog ---- */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Income</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" required />
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" placeholder="0" min={0} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    options={INCOME_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                    placeholder="Select type"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Invoice Number</Label>
                  <Input type="text" placeholder="INV-2026-XXX (optional)" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input type="text" placeholder="e.g. Monthly Salary - Infosys" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>TDS Deducted</Label>
                  <Input type="number" placeholder="0" min={0} />
                </div>
                <div className="space-y-2">
                  <Label>GST Collected</Label>
                  <Input type="number" placeholder="0" min={0} />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDialogOpen(false)}
                  className="text-white/50 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-gold to-amber-600 hover:from-gold/90 hover:to-amber-600/90 text-navy font-semibold"
                >
                  Save Income
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
