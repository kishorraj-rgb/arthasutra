"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency, amountInWords, INCOME_TYPES, CATEGORY_COLORS, getCurrentFinancialYear, getFinancialYearDates } from "@/lib/utils";
import { parseDescription, getMethodColor } from "@/lib/bank-statement/description-parser";
import {
  Plus,
  TrendingUp,
  IndianRupee,
  FileText,
  Edit,
  Trash2,
  Search,
  Download,
} from "lucide-react";
import { exportIncomeToExcel } from "@/lib/export-excel";
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


const FY_MONTHS = [
  { label: "Apr", month: 3 }, { label: "May", month: 4 }, { label: "Jun", month: 5 },
  { label: "Jul", month: 6 }, { label: "Aug", month: 7 }, { label: "Sep", month: 8 },
  { label: "Oct", month: 9 }, { label: "Nov", month: 10 }, { label: "Dec", month: 11 },
  { label: "Jan", month: 0 }, { label: "Feb", month: 1 }, { label: "Mar", month: 2 },
];

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
  const updateIncome = useMutation(api.income.updateIncomeEntry);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFY, setSelectedFY] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkType, setBulkType] = useState("");

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((e) => e._id)));
  };
  const handleBulkTypeChange = async (type: string) => {
    for (const id of Array.from(selectedIds)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updateIncome({ id: id as any, type: type as any });
    }
    setSelectedIds(new Set());
    setBulkType("");
  };
  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} entries?`)) return;
    for (const id of Array.from(selectedIds)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await deleteIncome({ id: id as any });
    }
    setSelectedIds(new Set());
  };

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

  // Available FYs from data
  const availableFYs = useMemo(() => {
    const fySet = new Set<string>();
    for (const e of safeEntries) {
      const d = new Date(e.date);
      const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
      fySet.add(`${year}-${(year + 1).toString().slice(-2)}`);
    }
    const sorted = Array.from(fySet).sort().reverse();
    if (sorted.length === 0) sorted.push(getCurrentFinancialYear());
    return sorted;
  }, [safeEntries]);

  // Auto-select FY with most data on load, or re-select if current FY has no data
  useEffect(() => {
    if (availableFYs.length > 0) {
      if (!selectedFY || !availableFYs.includes(selectedFY)) {
        setSelectedFY(availableFYs[0]);
      }
    }
  }, [availableFYs, selectedFY]);

  // Filtered entries
  const filtered = useMemo(() => {
    const fyDates = selectedFY ? getFinancialYearDates(selectedFY) : null;
    const query = searchQuery.toLowerCase().trim();

    return safeEntries.filter((e) => {
      // FY filter
      if (fyDates && (e.date < fyDates.start || e.date > fyDates.end)) return false;
      // Month filter
      if (selectedMonth && selectedFY) {
        const monthObj = FY_MONTHS.find((m) => m.label === selectedMonth);
        if (monthObj) {
          const d = new Date(e.date);
          if (d.getMonth() !== monthObj.month) return false;
        }
      }
      // Type filter
      if (typeFilter && e.type !== typeFilter) return false;
      // Search
      if (query) {
        const haystack = `${e.description} ${e.type} ${e.date}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [safeEntries, typeFilter, selectedFY, selectedMonth, searchQuery]);

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
                Track all income sources, TDS and GST
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
      <div className="space-y-6 animate-page-enter">
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-text-primary">Income</h1>
            <p className="text-text-secondary text-sm mt-1">
              Track all income sources, TDS and GST{selectedFY ? ` for FY ${selectedFY}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => exportIncomeToExcel(filtered, selectedFY || "2025-26")}
              variant="outline"
              className="gap-2"
              disabled={filtered.length === 0}
            >
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-accent text-white hover:bg-accent/90 font-semibold"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Income
            </Button>
          </div>
        </div>

        {/* ---- Stats Row ---- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="card-enter card-enter-1">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <IndianRupee className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider">Total Income YTD</p>
                <p className="text-xl font-display font-bold text-emerald-400 stat-number tabular-nums">
                  {formatCurrency(totalIncome)}
                </p>
                <p className="text-[10px] text-text-tertiary truncate max-w-[180px]" title={amountInWords(totalIncome)}>
                  {amountInWords(totalIncome)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="card-enter card-enter-2">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-rose-400" />
              </div>
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider">TDS Deducted</p>
                <p className="text-xl font-display font-bold text-rose-400 stat-number tabular-nums">
                  {formatCurrency(totalTds)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="card-enter card-enter-3">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider">GST Collected</p>
                <p className="text-xl font-display font-bold text-blue-400 stat-number tabular-nums">
                  {formatCurrency(totalGst)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="card-enter card-enter-4">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-accent-light" />
              </div>
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider">Projected Annual</p>
                <p className="text-xl font-display font-bold text-accent-light stat-number tabular-nums">
                  {formatCurrency(projectedAnnual)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ---- Filter Bar ---- */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search payee, description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-sm placeholder:text-text-tertiary transition-all duration-200 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10 focus:shadow-sm"
                />
              </div>
              {/* FY selector */}
              <Select
                options={availableFYs.map((fy) => ({ value: fy, label: `FY ${fy}` }))}
                value={selectedFY}
                onChange={(e) => { setSelectedFY(e.target.value); setSelectedMonth(""); }}
                className="w-36"
              />
              {/* Type filter */}
              <Select
                options={[{ value: "", label: "All Types" }, ...INCOME_TYPES.map((t) => ({ value: t.value, label: t.label }))]}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-44"
              />
              {(typeFilter || searchQuery || selectedMonth) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setTypeFilter(""); setSearchQuery(""); setSelectedMonth(""); }}
                  className="text-text-secondary hover:text-text-primary text-xs"
                >
                  Clear
                </Button>
              )}
            </div>
            {/* Month chips */}
            {selectedFY && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedMonth("")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    !selectedMonth
                      ? "bg-accent text-white"
                      : "bg-gray-100 text-text-secondary hover:bg-gray-200"
                  }`}
                >
                  All
                </button>
                {FY_MONTHS.map((m) => (
                  <button
                    key={m.label}
                    onClick={() => setSelectedMonth(selectedMonth === m.label ? "" : m.label)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                      selectedMonth === m.label
                        ? "bg-accent text-white"
                        : "bg-gray-100 text-text-secondary hover:bg-gray-200"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---- Income Entries Table ---- */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-text-primary font-display">Income Entries</CardTitle>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 text-sm animate-page-enter">
                <span className="text-text-secondary font-medium">{selectedIds.size} selected</span>
                <select
                  value={bulkType}
                  onChange={(e) => { if (e.target.value) handleBulkTypeChange(e.target.value); }}
                  className="text-xs rounded-lg border border-gray-200 px-2 py-1.5 bg-white focus:border-accent focus:outline-none cursor-pointer"
                >
                  <option value="">Change Type...</option>
                  {INCOME_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <Button size="sm" variant="destructive" onClick={handleBulkDelete} className="text-xs h-7">
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              </div>
            )}
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
                      <th className="pb-3 pr-2 font-medium w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === filtered.length && filtered.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 text-accent focus:ring-accent/20"
                        />
                      </th>
                      <th className="pb-3 pr-4 font-medium">Date</th>
                      <th className="pb-3 pr-4 font-medium">Type</th>
                      <th className="pb-3 pr-4 font-medium">Payee</th>
                      <th className="pb-3 pr-4 font-medium">Method</th>
                      <th className="pb-3 pr-4 font-medium text-right">Amount</th>
                      <th className="pb-3 pr-4 font-medium text-right">TDS</th>
                      <th className="pb-3 pr-4 font-medium text-right">GST</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((entry) => {
                      const parsed = parseDescription(entry.description);
                      return (
                        <tr
                          key={entry._id}
                          className="border-b border-border-light transition-colors duration-150 hover:bg-accent/[0.02] hover:border-l-2 hover:border-l-accent"
                        >
                          <td className="py-3 pr-2">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(entry._id)}
                              onChange={() => toggleSelect(entry._id)}
                              className="rounded border-gray-300 text-accent focus:ring-accent/20"
                            />
                          </td>
                          <td className="py-3 pr-4 text-text-secondary">{formatDate(entry.date)}</td>
                          <td className="py-3 pr-4">
                            <select
                              value={entry.type}
                              onChange={(e) => updateIncome({ id: entry._id, type: e.target.value as "salary" | "freelance" | "rental" | "interest" | "dividend" | "transfer" | "other" })}
                              className="text-xs rounded-lg border border-gray-200 px-2 py-1 bg-white focus:border-accent focus:outline-none cursor-pointer"
                            >
                              {INCOME_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 pr-4" title={parsed.rawDescription}>
                            <div className="flex flex-col">
                              <span className="text-text-primary font-medium">{parsed.payee}</span>
                              {parsed.bank && (
                                <span className="text-xs text-text-tertiary">{parsed.bank}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${getMethodColor(parsed.method)}`}>
                              {parsed.method}
                            </span>
                          </td>
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
                        <td colSpan={9} className="py-8 text-center text-text-tertiary">
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
                  className="bg-accent text-white hover:bg-accent/90 font-semibold"
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
