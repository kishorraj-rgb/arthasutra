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
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency, EXPENSE_CATEGORIES, CATEGORY_COLORS } from "@/lib/utils";
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
  Filter,
  Receipt,
  User,
  School,
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
import type { Id } from "../../../convex/_generated/dataModel";

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

  // Filter state
  const [showBusinessOnly, setShowBusinessOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formDate, setFormDate] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formGst, setFormGst] = useState("");
  const [formIsBusiness, setFormIsBusiness] = useState(false);
  const [formReceiptUrl, setFormReceiptUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derived data
  const allExpenses = useMemo(() => expenses ?? [], [expenses]);

  const filtered = useMemo(
    () =>
      allExpenses.filter((e) => {
        if (showBusinessOnly && !e.is_business_expense) return false;
        if (categoryFilter && e.category !== categoryFilter) return false;
        return true;
      }),
    [allExpenses, showBusinessOnly, categoryFilter]
  );

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

  function resetForm() {
    setFormDate("");
    setFormAmount("");
    setFormCategory("");
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
  // Render
  // -------------------------------------------------------------------------
  return (
    <AppLayout>
      <div className="space-y-6">
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
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-rose text-white hover:bg-rose/90 gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
        </div>

        {/* ---- Stats Row ---- */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Expenses */}
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Total Expenses This Month
              </p>
              <p className="mt-2 font-display text-2xl font-bold text-rose-400 stat-number">
                {formatCurrency(totalExpenses)}
              </p>
              <p className="mt-1 text-xs text-text-tertiary">
                {allExpenses.length} transactions
              </p>
            </CardContent>
          </Card>

          {/* Business */}
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Business Expenses
              </p>
              <p className="mt-2 font-display text-2xl font-bold text-blue-400 stat-number">
                {formatCurrency(businessExpenses)}
              </p>
              <p className="mt-1 text-xs text-text-tertiary">Tax deductible</p>
            </CardContent>
          </Card>

          {/* Personal */}
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Personal Expenses
              </p>
              <p className="mt-2 font-display text-2xl font-bold text-purple-400 stat-number">
                {formatCurrency(personalExpenses)}
              </p>
              <p className="mt-1 text-xs text-text-tertiary">Non-deductible</p>
            </CardContent>
          </Card>

          {/* GST Input Credit */}
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                GST Input Credit
              </p>
              <p className="mt-2 font-display text-2xl font-bold text-accent-light stat-number">
                {formatCurrency(totalGst)}
              </p>
              <p className="mt-1 text-xs text-text-tertiary">
                Claimable this quarter
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ---- Filters Row ---- */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-text-tertiary" />
              <Select
                options={categoryOptions}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-48"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">All</span>
            <Switch
              checked={showBusinessOnly}
              onCheckedChange={setShowBusinessOnly}
            />
            <span className="text-sm text-text-secondary">Business Only</span>
          </div>
        </div>

        {/* ---- Expense Entries List ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-5 w-5 text-accent-light" />
              Expense Entries
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-tertiary">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Payee</th>
                    <th className="px-5 py-3">Method</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3 text-right">GST Paid</th>
                    <th className="px-5 py-3 text-center">Type</th>
                    <th className="px-5 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((expense) => {
                    const parsed = parseDescription(expense.description);
                    return (
                      <tr
                        key={expense._id}
                        className="border-b border-border-light transition-colors hover:bg-surface-tertiary/50"
                      >
                        <td className="whitespace-nowrap px-5 py-3.5 text-text-secondary">
                          {new Date(expense.date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </td>
                        <td className="px-5 py-3.5">
                          <select
                            value={expense.category}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            onChange={(e) => updateExpense({ id: expense._id, category: e.target.value as any })}
                            className="text-xs rounded-lg border border-gray-200 px-2 py-1 bg-white focus:border-accent focus:outline-none cursor-pointer"
                          >
                            {EXPENSE_CATEGORIES.map((c) => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
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
                        colSpan={7}
                        className="px-5 py-10 text-center text-text-tertiary"
                      >
                        No expenses recorded yet. Add your first expense.
                      </td>
                    </tr>
                  )}
                  {allExpenses.length > 0 && filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-10 text-center text-text-tertiary"
                      >
                        No expenses match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
                  onChange={(e) => setFormCategory(e.target.value)}
                />
              </div>

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
