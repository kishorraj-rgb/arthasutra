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
import { formatCurrency, amountInWords, EXPENSE_CATEGORIES, CATEGORY_COLORS, getCurrentFinancialYear, getFinancialYearDates } from "@/lib/utils";
import { parseDescription, getMethodColor } from "@/lib/bank-statement/description-parser";
import {
  Plus,
  Home,
  UtensilsCrossed,
  Car,
  Heart,
  GraduationCap,
  Shield,
  TrendingUp,
  Zap,
  Film,
  MoreHorizontal,
  Edit,
  Trash2,
  Receipt,
  User,
  School,
  Loader2,
  Search,
  Download,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { exportExpensesToExcel } from "@/lib/export-excel";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { Id } from "../../../convex/_generated/dataModel";

const FY_MONTHS = [
  { label: "Apr", month: 3 }, { label: "May", month: 4 }, { label: "Jun", month: 5 },
  { label: "Jul", month: 6 }, { label: "Aug", month: 7 }, { label: "Sep", month: 8 },
  { label: "Oct", month: 9 }, { label: "Nov", month: 10 }, { label: "Dec", month: 11 },
  { label: "Jan", month: 0 }, { label: "Feb", month: 1 }, { label: "Mar", month: 2 },
];

// ---------------------------------------------------------------------------
// Category icon map
// ---------------------------------------------------------------------------
const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  housing: Home,
  food: UtensilsCrossed,
  transport: Car,
  medical: Heart,
  education: GraduationCap,
  insurance: Shield,
  investment: TrendingUp,
  driver_salary: User,
  school_fees: School,
  utilities: Zap,
  entertainment: Film,
  other: MoreHorizontal,
};

// ---------------------------------------------------------------------------
// Category type (mirrors Convex schema)
// ---------------------------------------------------------------------------
type ExpenseCategory =
  | "housing"
  | "food"
  | "transport"
  | "medical"
  | "education"
  | "insurance"
  | "investment"
  | "driver_salary"
  | "school_fees"
  | "utilities"
  | "entertainment"
  | "other";

// ---------------------------------------------------------------------------
// Monthly budget constants (editable)
// ---------------------------------------------------------------------------
const MONTHLY_BUDGETS: Record<string, number> = {
  housing: 40000,
  food: 15000,
  transport: 8000,
  education: 18000,
  utilities: 5000,
  entertainment: 3000,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getCategoryLabel(value: string): string {
  const cat = EXPENSE_CATEGORIES.find((c) => c.value === value);
  return cat ? cat.label : value;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getCategoryIcon(value: string) {
  return CATEGORY_ICON_MAP[value] || MoreHorizontal;
}

// ---------------------------------------------------------------------------
// Custom tooltip for the pie chart
// ---------------------------------------------------------------------------
function CustomPieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
}) {
  if (!active || !payload?.length) return null;
  const data = payload[0];
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 shadow-sm">
      <p className="text-xs text-text-secondary">{data.name}</p>
      <p className="font-display text-sm font-semibold text-text-primary">
        {formatCurrency(data.value)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------
export default function ExpensesPage() {
  const { user } = useAuth();

  // Convex queries & mutations
  const expenses = useQuery(
    api.expenses.getExpenseEntries,
    user ? { userId: user.userId } : "skip"
  );
  const addExpense = useMutation(api.expenses.addExpenseEntry);
  const updateExpense = useMutation(api.expenses.updateExpenseEntry);
  const deleteExpense = useMutation(api.expenses.deleteExpenseEntry);

  // Category preferences (for subcategories)
  const catPrefs = useQuery(
    api.categories.getCategoryPreferences,
    user ? { userId: user.userId, scope: "expense" as const } : "skip"
  );

  // Build subcategory lookup: { "food": ["Swiggy", "Zomato", ...], ... }
  const subcategoryMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (catPrefs) {
      for (const pref of catPrefs) {
        if (pref.subcategories && pref.subcategories.length > 0) {
          map[pref.slug] = pref.subcategories;
        }
      }
    }
    return map;
  }, [catPrefs]);

  // Filter state
  const [showBusinessOnly, setShowBusinessOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFY, setSelectedFY] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [bankFilter, setBankFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Mobile filter panel toggle
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((e) => e._id)));
    }
  };
  const handleBulkCategoryChange = async (cat: string) => {
    for (const id of Array.from(selectedIds)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updateExpense({ id: id as any, category: cat as any });
    }
    setSelectedIds(new Set());
    setBulkCategory("");
  };
  const handleBulkToggleBusiness = async (isBusiness: boolean) => {
    for (const id of Array.from(selectedIds)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updateExpense({ id: id as any, is_business_expense: isBusiness });
    }
    setSelectedIds(new Set());
  };
  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} entries?`)) return;
    for (const id of Array.from(selectedIds)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await deleteExpense({ id: id as any });
    }
    setSelectedIds(new Set());
  };

  // Sort state
  const [sortField, setSortField] = useState<"date" | "amount" | "category" | "payee">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  // Form state
  const [formDate, setFormDate] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formSubcategory, setFormSubcategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formGst, setFormGst] = useState("");
  const [formIsBusiness, setFormIsBusiness] = useState(false);
  const [formReceiptUrl, setFormReceiptUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derived data
  const allExpenses = useMemo(() => expenses ?? [], [expenses]);

  // Available FYs from data
  const availableFYs = useMemo(() => {
    const fySet = new Set<string>();
    for (const e of allExpenses) {
      const d = new Date(e.date);
      const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
      fySet.add(`${year}-${(year + 1).toString().slice(-2)}`);
    }
    const sorted = Array.from(fySet).sort().reverse();
    if (sorted.length === 0) sorted.push(getCurrentFinancialYear());
    return sorted;
  }, [allExpenses]);

  // Auto-select FY with most data on load, or re-select if current FY has no data
  useEffect(() => {
    if (availableFYs.length > 0) {
      if (!selectedFY || !availableFYs.includes(selectedFY)) {
        setSelectedFY(availableFYs[0]);
      }
    }
  }, [availableFYs, selectedFY]);

  // Available banks from data
  const availableBanks = useMemo(() => {
    const bankSet = new Set<string>();
    for (const e of allExpenses) {
      const parsed = parseDescription(e.description);
      if (parsed.bank) bankSet.add(parsed.bank);
    }
    return Array.from(bankSet).sort();
  }, [allExpenses]);

  const filtered = useMemo(() => {
    const fyDates = selectedFY ? getFinancialYearDates(selectedFY) : null;
    const query = searchQuery.toLowerCase().trim();

    return allExpenses.filter((e) => {
      if (fyDates && (e.date < fyDates.start || e.date > fyDates.end)) return false;
      if (selectedMonth && selectedFY) {
        const monthObj = FY_MONTHS.find((m) => m.label === selectedMonth);
        if (monthObj && new Date(e.date).getMonth() !== monthObj.month) return false;
      }
      if (showBusinessOnly && !e.is_business_expense) return false;
      if (categoryFilter && e.category !== categoryFilter) return false;
      if (bankFilter) {
        const parsed = parseDescription(e.description);
        if (parsed.bank !== bankFilter) return false;
      }
      if (query) {
        const haystack = `${e.description} ${e.category} ${e.date}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [allExpenses, showBusinessOnly, categoryFilter, selectedFY, selectedMonth, searchQuery, bankFilter]);

  // Sorted entries
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = a.date.localeCompare(b.date);
      else if (sortField === "amount") cmp = a.amount - b.amount;
      else if (sortField === "category") cmp = a.category.localeCompare(b.category);
      else if (sortField === "payee") cmp = a.description.localeCompare(b.description);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  // Pagination
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, currentPage]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [categoryFilter, searchQuery, selectedFY, selectedMonth, bankFilter, showBusinessOnly]);

  const totalExpenses = useMemo(
    () => allExpenses.reduce((s, e) => s + e.amount, 0),
    [allExpenses]
  );
  const businessExpenses = useMemo(
    () =>
      allExpenses
        .filter((e) => e.is_business_expense)
        .reduce((s, e) => s + e.amount, 0),
    [allExpenses]
  );
  const personalExpenses = totalExpenses - businessExpenses;
  const totalGst = useMemo(
    () => allExpenses.reduce((s, e) => s + e.gst_paid, 0),
    [allExpenses]
  );

  // Filtered totals for summary bar
  const filteredTotal = useMemo(
    () => filtered.reduce((s, e) => s + e.amount, 0),
    [filtered]
  );
  const filteredBusiness = useMemo(
    () => filtered.filter((e) => e.is_business_expense).reduce((s, e) => s + e.amount, 0),
    [filtered]
  );
  const filteredPersonal = filteredTotal - filteredBusiness;

  // Pie chart data from real entries
  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of allExpenses) {
      map[e.category] = (map[e.category] || 0) + e.amount;
    }
    return Object.entries(map).map(([key, value]) => ({
      name: getCategoryLabel(key),
      value,
      color: CATEGORY_COLORS[key] || "#6B7280",
    }));
  }, [allExpenses]);

  // Budget vs Actual - compute actuals from current month real data
  const budgetData = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    const currentMonthEntries = allExpenses.filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    const actualsByCategory: Record<string, number> = {};
    for (const e of currentMonthEntries) {
      actualsByCategory[e.category] =
        (actualsByCategory[e.category] || 0) + e.amount;
    }

    return Object.entries(MONTHLY_BUDGETS).map(([cat, budget]) => ({
      category: getCategoryLabel(cat),
      budget,
      actual: actualsByCategory[cat] || 0,
    }));
  }, [allExpenses]);

  const categoryOptions = [
    { value: "", label: "All Categories" },
    ...EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
  ];

  const formCategoryOptions = EXPENSE_CATEGORIES.map((c) => ({
    value: c.value,
    label: c.label,
  }));

  const hasActiveFilters = !!(categoryFilter || searchQuery || selectedMonth || bankFilter || showBusinessOnly);

  function clearAllFilters() {
    setCategoryFilter("");
    setSearchQuery("");
    setSelectedMonth("");
    setBankFilter("");
    setShowBusinessOnly(false);
  }

  function resetForm() {
    setFormDate("");
    setFormAmount("");
    setFormCategory("");
    setFormSubcategory("");
    setFormDescription("");
    setFormGst("");
    setFormIsBusiness(false);
    setFormReceiptUrl("");
  }

  async function handleAddExpense() {
    if (!user || !formDate || !formAmount || !formCategory || !formDescription) {
      return;
    }
    setIsSubmitting(true);
    try {
      await addExpense({
        userId: user.userId,
        date: formDate,
        amount: parseFloat(formAmount),
        category: formCategory as ExpenseCategory,
        description: formDescription,
        subcategory: formSubcategory || undefined,
        gst_paid: formGst ? parseFloat(formGst) : 0,
        is_business_expense: formIsBusiness,
        ...(formReceiptUrl ? { receipt_url: formReceiptUrl } : {}),
      });
      setDialogOpen(false);
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: Id<"expense_entries">) {
    await deleteExpense({ id });
  }

  function handleDialogChange(open: boolean) {
    setDialogOpen(open);
    if (!open) resetForm();
  }

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------
  if (!user || expenses === undefined) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
        </div>
      </AppLayout>
    );
  }

  // -------------------------------------------------------------------------
  // Filter Panel (shared between desktop sidebar and mobile overlay)
  // -------------------------------------------------------------------------
  const filterPanelContent = (
    <div className="space-y-5">
      {/* Search */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Search</label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
          <input
            type="text"
            placeholder="Payee, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 rounded-lg border border-gray-200 bg-white text-xs placeholder:text-text-tertiary transition-all duration-200 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
          />
        </div>
      </div>

      {/* FY selector */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Financial Year</label>
        <Select
          options={availableFYs.map((fy) => ({ value: fy, label: `FY ${fy}` }))}
          value={selectedFY}
          onChange={(e) => { setSelectedFY(e.target.value); setSelectedMonth(""); }}
          className="w-full"
        />
      </div>

      {/* Category filter */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Category</label>
        <Select
          options={categoryOptions}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Bank filter */}
      {availableBanks.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Bank</label>
          <Select
            options={[{ value: "", label: "All Banks" }, ...availableBanks.map((b) => ({ value: b, label: b }))]}
            value={bankFilter}
            onChange={(e) => setBankFilter(e.target.value)}
            className="w-full"
          />
        </div>
      )}

      {/* Business toggle */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Type</label>
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
          <Switch checked={showBusinessOnly} onCheckedChange={setShowBusinessOnly} />
          <span className="text-xs text-text-secondary">Business Only</span>
        </div>
      </div>

      {/* Month chips */}
      {selectedFY && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Month</label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => setSelectedMonth("")}
              className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                !selectedMonth ? "bg-accent text-white" : "bg-white border border-gray-200 text-text-secondary hover:bg-gray-100"
              }`}
            >
              All
            </button>
            {FY_MONTHS.map((m) => (
              <button
                key={m.label}
                onClick={() => setSelectedMonth(selectedMonth === m.label ? "" : m.label)}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  selectedMonth === m.label ? "bg-accent text-white" : "bg-white border border-gray-200 text-text-secondary hover:bg-gray-100"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Clear All */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={clearAllFilters}
          className="w-full text-xs text-text-secondary hover:text-text-primary"
        >
          Clear All Filters
        </Button>
      )}
    </div>
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <AppLayout>
      <div className="space-y-4 animate-page-enter">
        {/* ---- Page Header ---- */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">
              Expenses
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Track and categorise every rupee spent
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile filter toggle */}
            <Button
              variant="outline"
              className="lg:hidden gap-2"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] text-white font-semibold">
                  !
                </span>
              )}
            </Button>
            <Button
              onClick={() => exportExpensesToExcel(filtered, selectedFY || "2025-26")}
              variant="outline"
              className="gap-2"
              disabled={filtered.length === 0}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export Excel</span>
            </Button>
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-rose text-white hover:bg-rose/90 gap-2"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Expense</span>
            </Button>
          </div>
        </div>

        {/* ---- Main Layout: Sidebar + Content ---- */}
        <div className="flex gap-6">
          {/* ---- Left Filter Panel (desktop) ---- */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-4 rounded-xl border border-gray-200 bg-gray-50/80 p-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-4">Filters</h2>
              {filterPanelContent}
            </div>
          </aside>

          {/* ---- Mobile Filter Overlay ---- */}
          {filtersOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/30" onClick={() => setFiltersOpen(false)} />
              <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl overflow-y-auto animate-page-enter">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <h2 className="text-sm font-bold text-text-primary">Filters</h2>
                  <button onClick={() => setFiltersOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-4">
                  {filterPanelContent}
                </div>
              </div>
            </div>
          )}

          {/* ---- Right Content Area ---- */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* ---- Top Summary Bar ---- */}
            <div className="rounded-xl border border-gray-200 bg-white px-5 py-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-xl font-bold text-rose-400 stat-number tabular-nums">
                    {formatCurrency(filteredTotal)}
                  </span>
                  <span className="text-xs text-text-tertiary">total</span>
                </div>
                <div className="h-6 w-px bg-gray-200 hidden sm:block" />
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-text-primary tabular-nums">{filtered.length}</span>
                  <span className="text-xs text-text-tertiary">entries</span>
                </div>
                <div className="h-6 w-px bg-gray-200 hidden sm:block" />
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-blue-400 tabular-nums">{formatCurrency(filteredBusiness)}</span>
                  <span className="text-xs text-text-tertiary">business</span>
                </div>
                <div className="h-6 w-px bg-gray-200 hidden sm:block" />
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-purple-400 tabular-nums">{formatCurrency(filteredPersonal)}</span>
                  <span className="text-xs text-text-tertiary">personal</span>
                </div>
                <div className="h-6 w-px bg-gray-200 hidden sm:block" />
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-accent-light tabular-nums">{formatCurrency(totalGst)}</span>
                  <span className="text-xs text-text-tertiary">GST credit</span>
                </div>
                {filteredTotal > 0 && (
                  <>
                    <div className="h-6 w-px bg-gray-200 hidden md:block" />
                    <span className="text-[11px] text-text-tertiary truncate max-w-[200px] hidden md:block" title={amountInWords(filteredTotal)}>
                      {amountInWords(filteredTotal)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* ---- Expense Table ---- */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Receipt className="h-5 w-5 text-accent-light" />
                  Expense Entries
                </CardTitle>
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2 text-sm animate-page-enter">
                    <span className="text-text-secondary font-medium">{selectedIds.size} selected</span>
                    <select
                      value={bulkCategory}
                      onChange={(e) => { if (e.target.value) handleBulkCategoryChange(e.target.value); }}
                      className="text-xs rounded-lg border border-gray-200 px-2 py-1.5 bg-white focus:border-accent focus:outline-none cursor-pointer"
                    >
                      <option value="">Change Category...</option>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    <Button size="sm" variant="outline" onClick={() => handleBulkToggleBusiness(true)} className="text-xs h-7">
                      Mark Business
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleBulkToggleBusiness(false)} className="text-xs h-7">
                      Mark Personal
                    </Button>
                    <Button size="sm" variant="destructive" onClick={handleBulkDelete} className="text-xs h-7">
                      <Trash2 className="h-3 w-3 mr-1" /> Delete
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-tertiary">
                        <th className="px-3 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={selectedIds.size === sorted.length && sorted.length > 0}
                            onChange={toggleSelectAll}
                            className="rounded border-gray-300 text-accent focus:ring-accent/20"
                          />
                        </th>
                        <th className="px-5 py-3 cursor-pointer select-none hover:text-text-primary transition-colors" onClick={() => toggleSort("date")}>
                          Date {sortField === "date" && (sortDir === "asc" ? "\u2191" : "\u2193")}
                        </th>
                        <th className="px-5 py-3 cursor-pointer select-none hover:text-text-primary transition-colors" onClick={() => toggleSort("category")}>
                          Category {sortField === "category" && (sortDir === "asc" ? "\u2191" : "\u2193")}
                        </th>
                        <th className="px-5 py-3 cursor-pointer select-none hover:text-text-primary transition-colors" onClick={() => toggleSort("payee")}>
                          Payee {sortField === "payee" && (sortDir === "asc" ? "\u2191" : "\u2193")}
                        </th>
                        <th className="px-5 py-3">Method</th>
                        <th className="px-5 py-3 text-right cursor-pointer select-none hover:text-text-primary transition-colors" onClick={() => toggleSort("amount")}>
                          Amount {sortField === "amount" && (sortDir === "asc" ? "\u2191" : "\u2193")}
                        </th>
                        <th className="px-5 py-3 text-right">GST Paid</th>
                        <th className="px-5 py-3 text-center">Type</th>
                        <th className="px-5 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((expense) => {
                        const parsed = parseDescription(expense.description);
                        return (
                          <tr
                            key={expense._id}
                            className="border-b border-border-light transition-colors duration-150 hover:bg-accent/[0.02] hover:border-l-2 hover:border-l-accent"
                          >
                            <td className="px-3 py-3.5">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(expense._id)}
                                onChange={() => toggleSelect(expense._id)}
                                className="rounded border-gray-300 text-accent focus:ring-accent/20"
                              />
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-text-secondary">
                              {new Date(expense.date).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                              })}
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex flex-col gap-1">
                                <select
                                  value={expense.category}
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  onChange={(e) => {
                                    updateExpense({ id: expense._id, category: e.target.value as any, subcategory: "" });
                                  }}
                                  className="text-xs rounded-lg border border-gray-200 px-2 py-1 bg-white focus:border-accent focus:outline-none cursor-pointer"
                                >
                                  {EXPENSE_CATEGORIES.map((c) => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                  ))}
                                </select>
                                {subcategoryMap[expense.category] && subcategoryMap[expense.category].length > 0 && (
                                  <select
                                    value={(expense as Record<string, unknown>).subcategory as string || ""}
                                    onChange={(e) => updateExpense({ id: expense._id, subcategory: e.target.value })}
                                    className="text-[11px] rounded-md border border-dashed border-gray-200 px-1.5 py-0.5 bg-gray-50 focus:border-accent focus:outline-none cursor-pointer text-text-secondary"
                                  >
                                    <option value="">— subcategory —</option>
                                    {subcategoryMap[expense.category].map((sub) => (
                                      <option key={sub} value={sub}>{sub}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3.5" title={parsed.rawDescription}>
                              <div className="flex flex-col">
                                <span className="text-text-primary font-medium">{parsed.payee}</span>
                                {parsed.bank && (
                                  <span className="text-xs text-text-tertiary">{parsed.bank}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${getMethodColor(parsed.method)}`}>
                                {parsed.method}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-right font-display font-semibold text-rose-400 stat-number">
                              {formatCurrency(expense.amount)}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-right text-text-secondary stat-number">
                              {expense.gst_paid > 0
                                ? formatCurrency(expense.gst_paid)
                                : "-"}
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              {expense.is_business_expense ? (
                                <Badge variant="default">Business</Badge>
                              ) : (
                                <Badge variant="secondary">Personal</Badge>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center justify-center gap-1">
                                <button className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-secondary">
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleDelete(
                                      expense._id as Id<"expense_entries">
                                    )
                                  }
                                  className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {allExpenses.length === 0 && (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-5 py-10 text-center text-text-tertiary"
                          >
                            No expenses recorded yet. Add your first expense.
                          </td>
                        </tr>
                      )}
                      {allExpenses.length > 0 && filtered.length === 0 && (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-5 py-10 text-center text-text-tertiary"
                          >
                            No expenses match the current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                    <span className="text-xs text-text-tertiary">
                      Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, sorted.length)} of {sorted.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        let page: number;
                        if (totalPages <= 7) page = i + 1;
                        else if (currentPage <= 4) page = i + 1;
                        else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
                        else page = currentPage - 3 + i;
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 text-xs rounded-lg transition-colors ${
                              currentPage === page
                                ? "bg-accent text-white"
                                : "hover:bg-gray-50 text-text-secondary"
                            }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ---- Bottom Grid: Budget vs Actual + Donut ---- */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Budget vs Actual */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Monthly Budget vs Actual
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {budgetData.map((row) => {
                    const pct = Math.min(
                      Math.round((row.actual / row.budget) * 100),
                      100
                    );
                    const isOver = row.actual > row.budget;
                    return (
                      <div key={row.category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-text-secondary">{row.category}</span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-display font-semibold stat-number ${
                                isOver ? "text-rose-400" : "text-emerald-400"
                              }`}
                            >
                              {formatCurrency(row.actual)}
                            </span>
                            <span className="text-text-tertiary">/</span>
                            <span className="text-text-tertiary stat-number">
                              {formatCurrency(row.budget)}
                            </span>
                            {isOver && (
                              <Badge
                                variant="destructive"
                                className="ml-1 text-[10px] px-1.5 py-0"
                              >
                                Over
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Progress
                          value={pct}
                          indicatorClassName={
                            isOver ? "bg-rose-500" : "bg-emerald-500"
                          }
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Expense by Category Donut */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Expense by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[320px]">
                    {pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={110}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="none"
                          >
                            {pieData.map((entry, idx) => (
                              <Cell key={idx} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomPieTooltip />} />
                          <Legend
                            verticalAlign="bottom"
                            height={36}
                            formatter={(value: string) => (
                              <span className="text-xs text-text-secondary">{value}</span>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
                        No expense data to display
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* ---- Add Expense Dialog ---- */}
        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Expense</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="expense-date">Date</Label>
                <Input
                  id="expense-date"
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="expense-amount">Amount (INR)</Label>
                <Input
                  id="expense-amount"
                  type="number"
                  placeholder="0"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="expense-category">Category</Label>
                <Select
                  id="expense-category"
                  options={formCategoryOptions}
                  placeholder="Select category"
                  value={formCategory}
                  onChange={(e) => { setFormCategory(e.target.value); setFormSubcategory(""); }}
                />
              </div>

              {/* Subcategory (dependent) */}
              {formCategory && subcategoryMap[formCategory] && subcategoryMap[formCategory].length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="expense-subcategory">Subcategory</Label>
                  <Select
                    id="expense-subcategory"
                    options={subcategoryMap[formCategory].map((s) => ({ value: s, label: s }))}
                    placeholder="Select subcategory (optional)"
                    value={formSubcategory}
                    onChange={(e) => setFormSubcategory(e.target.value)}
                  />
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="expense-desc">Description</Label>
                <Input
                  id="expense-desc"
                  placeholder="e.g. Swiggy order"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              {/* GST Paid */}
              <div className="space-y-2">
                <Label htmlFor="expense-gst">GST Paid (INR)</Label>
                <Input
                  id="expense-gst"
                  type="number"
                  placeholder="0"
                  value={formGst}
                  onChange={(e) => setFormGst(e.target.value)}
                />
              </div>

              {/* Business toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface-tertiary/50 px-4 py-3">
                <Label htmlFor="expense-business" className="cursor-pointer">
                  Is Business Expense?
                </Label>
                <Switch
                  id="expense-business"
                  checked={formIsBusiness}
                  onCheckedChange={setFormIsBusiness}
                />
              </div>

              {/* Receipt URL */}
              <div className="space-y-2">
                <Label htmlFor="expense-receipt">
                  Receipt URL (optional)
                </Label>
                <Input
                  id="expense-receipt"
                  placeholder="https://..."
                  value={formReceiptUrl}
                  onChange={(e) => setFormReceiptUrl(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleDialogChange(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddExpense}
                disabled={
                  isSubmitting ||
                  !formDate ||
                  !formAmount ||
                  !formCategory ||
                  !formDescription
                }
                className="bg-rose text-white hover:bg-rose/90"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save Expense
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
