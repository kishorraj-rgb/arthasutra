"use client";

import { useState, useMemo } from "react";
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
// Helpers
// ---------------------------------------------------------------------------

const TYPE_BADGE_MAP: Record<string, { label: string; color: string }> = {
  salary: { label: "Salary", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  freelance: { label: "Freelance", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  rental: { label: "Rental", color: "bg-accent/100/10 text-amber-400 border-accent/100/30" },
  interest: { label: "Interest", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  dividend: { label: "Dividend", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  other: { label: "Other", color: "bg-surface-tertiary text-text-secondary border-border" },
};

const MONTH_LABELS = [
  "Apr", "May", "Jun", "Jul", "Aug", "Sep",
  "Oct", "Nov", "Dec", "Jan", "Feb", "Mar",
];

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
  const { user } = useAuth();

  // Convex data
  const entries = useQuery(
    api.income.getIncomeEntries,
    user ? { userId: user.userId } : "skip"
  );
  const addIncome = useMutation(api.income.addIncomeEntry);
  const deleteIncome = useMutation(api.income.deleteIncomeEntry);

  // Dialog + form state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formType, setFormType] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTDS, setFormTDS] = useState("");
  const [formGST, setFormGST] = useState("");
  const [formInvoice, setFormInvoice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Filter state
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const safeEntries = useMemo(() => entries ?? [], [entries]);

  // Stats
  const totalIncome = safeEntries.reduce((s, e) => s + e.amount, 0);
  const totalTds = safeEntries.reduce((s, e) => s + e.tds_deducted, 0);
  const totalGst = safeEntries.reduce((s, e) => s + e.gst_collected, 0);

  // Determine how many distinct months are present
  const distinctMonths = useMemo(() => {
    const set = new Set<string>();
    for (const e of safeEntries) {
      set.add(e.date.slice(0, 7)); // "YYYY-MM"
    }
    return Math.max(set.size, 1);
  }, [safeEntries]);

  const projectedAnnual = Math.round(totalIncome * (12 / distinctMonths));

  // Filtered entries
  const filtered = useMemo(() => {
    return safeEntries.filter((e) => {
      if (typeFilter && e.type !== typeFilter) return false;
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      return true;
    });
  }, [safeEntries, typeFilter, dateFrom, dateTo]);

  // Monthly chart data grouped by month (FY order: Apr-Mar)
  const monthlyChartData = useMemo(() => {
    const buckets: Record<string, Record<string, number>> = {};
    for (const label of MONTH_LABELS) {
      buckets[label] = { salary: 0, freelance: 0, rental: 0, interest: 0, dividend: 0, other: 0 };
    }

    for (const e of safeEntries) {
      const d = new Date(e.date);
      const monthIndex = d.getMonth(); // 0=Jan
      // Map calendar month to FY month label: Apr=0..Mar=11
      const fyIndex = (monthIndex + 9) % 12; // Apr(3)->0, May(4)->1, ..., Mar(2)->11
      const label = MONTH_LABELS[fyIndex];
      if (buckets[label]) {
        const key = e.type in buckets[label] ? e.type : "other";
        buckets[label][key] += e.amount;
      }
    }

    return MONTH_LABELS.map((month) => ({
      month,
      ...buckets[month],
    }));
  }, [safeEntries]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function resetForm() {
    setFormDate("");
    setFormAmount("");
    setFormType("");
    setFormDescription("");
    setFormTDS("");
    setFormGST("");
    setFormInvoice("");
  }

  function handleDialogChange(open: boolean) {
    setDialogOpen(open);
    if (!open) resetForm();
  }

  async function handleFormSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      await addIncome({
        userId: user.userId,
        date: formDate,
        amount: Number(formAmount),
        type: formType as "salary" | "freelance" | "rental" | "interest" | "dividend" | "other",
        description: formDescription,
        tds_deducted: Number(formTDS) || 0,
        gst_collected: Number(formGST) || 0,
        invoice_number: formInvoice || undefined,
      });
      setDialogOpen(false);
      resetForm();
    } catch (err) {
      console.error("Failed to add income entry:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: typeof safeEntries[number]["_id"]) {
    try {
      await deleteIncome({ id });
    } catch (err) {
      console.error("Failed to delete income entry:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Loading / auth guard
  // ---------------------------------------------------------------------------

  if (!user) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-text-secondary">Loading user data...</p>
        </div>
      </AppLayout>
    );
  }

  if (entries === undefined) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold text-text-primary">Income</h1>
              <p className="text-text-secondary text-sm mt-1">
                Track all income sources, TDS and GST for FY 2025-26
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-gray-100 animate-pulse" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 w-24 bg-gray-100 animate-pulse rounded" />
                    <div className="h-6 w-32 bg-gray-100 animate-pulse rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-text-tertiary">Loading income data...</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-text-primary">Income</h1>
            <p className="text-text-secondary text-sm mt-1">
              Track all income sources, TDS and GST for FY 2025-26
            </p>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-gradient-to-r from-purple-grad-from to-amber-600 hover:from-purple-grad-from/90 hover:to-amber-600/90 text-navy font-semibold"
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
                <p className="text-xs text-text-secondary uppercase tracking-wider">Total Income YTD</p>
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
                <p className="text-xs text-text-secondary uppercase tracking-wider">TDS Deducted</p>
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
                <p className="text-xs text-text-secondary uppercase tracking-wider">GST Collected</p>
                <p className="text-xl font-display font-bold text-blue-400 stat-number">
                  {formatCurrency(totalGst)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-accent-light" />
              </div>
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider">Projected Annual</p>
                <p className="text-xl font-display font-bold text-accent-light stat-number">
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
              <div className="flex items-center gap-2 text-text-secondary">
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
                <Label className="text-text-secondary text-sm">From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-text-secondary text-sm">To</Label>
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
                  className="text-text-secondary hover:text-text-primary"
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
            <CardTitle className="text-text-primary font-display">Income Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {safeEntries.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-text-tertiary">
                  No income entries yet. Add your first income entry.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-text-secondary text-left">
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
                          key={entry._id}
                          className="border-b border-border-light hover:bg-surface-tertiary/50 transition-colors"
                        >
                          <td className="py-3 pr-4 text-text-secondary">{formatDate(entry.date)}</td>
                          <td className="py-3 pr-4">
                            <Badge className={badge.color}>{badge.label}</Badge>
                          </td>
                          <td className="py-3 pr-4 text-text-primary">{entry.description}</td>
                          <td className="py-3 pr-4 text-right font-semibold text-emerald-400 stat-number">
                            {formatCurrency(entry.amount)}
                          </td>
                          <td className="py-3 pr-4 text-right text-text-secondary stat-number">
                            {entry.tds_deducted ? formatCurrency(entry.tds_deducted) : "-"}
                          </td>
                          <td className="py-3 pr-4 text-right text-text-secondary stat-number">
                            {entry.gst_collected ? formatCurrency(entry.gst_collected) : "-"}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button className="p-1.5 rounded-lg hover:bg-surface-tertiary text-text-tertiary hover:text-text-primary transition-colors">
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(entry._id)}
                                className="p-1.5 rounded-lg hover:bg-rose-500/10 text-text-tertiary hover:text-rose-400 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-text-tertiary">
                          No income entries match the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---- Monthly Income by Category Chart ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-text-primary font-display">Income by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "rgba(107,114,128,0.5)", fontSize: 12 }}
                    axisLine={{ stroke: "rgba(107,114,128,0.3)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) =>
                      v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${(v / 1000).toFixed(0)}K`
                    }
                    tick={{ fill: "rgba(107,114,128,0.5)", fontSize: 12 }}
                    axisLine={{ stroke: "rgba(107,114,128,0.3)" }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255,255,255,0.98)",
                      border: "1px solid rgba(229,231,235,1)",
                      borderRadius: "0.75rem",
                      color: "#1f2937",
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
                <div key={key} className="flex items-center gap-2 text-xs text-text-secondary">
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
        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Income</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    min={0}
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    options={INCOME_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                    placeholder="Select type"
                    required
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Invoice Number</Label>
                  <Input
                    type="text"
                    placeholder="INV-2026-XXX (optional)"
                    value={formInvoice}
                    onChange={(e) => setFormInvoice(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  type="text"
                  placeholder="e.g. Monthly Salary - Infosys"
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>TDS Deducted</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    min={0}
                    value={formTDS}
                    onChange={(e) => setFormTDS(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>GST Collected</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    min={0}
                    value={formGST}
                    onChange={(e) => setFormGST(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleDialogChange(false)}
                  className="text-text-secondary hover:text-text-primary"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-gradient-to-r from-purple-grad-from to-amber-600 hover:from-purple-grad-from/90 hover:to-amber-600/90 text-navy font-semibold"
                >
                  {submitting ? "Saving..." : "Save Income"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
