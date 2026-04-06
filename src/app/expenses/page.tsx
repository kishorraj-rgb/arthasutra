"use client";

import { useState } from "react";
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
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

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
// Types
// ---------------------------------------------------------------------------
interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  gstPaid: number;
  isBusiness: boolean;
  receiptUrl?: string;
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------
const DEMO_EXPENSES: Expense[] = [
  {
    id: "1",
    date: "2026-04-01",
    category: "housing",
    description: "Monthly Rent - 3BHK Indiranagar",
    amount: 35000,
    gstPaid: 0,
    isBusiness: false,
  },
  {
    id: "2",
    date: "2026-04-02",
    category: "food",
    description: "BigBasket Groceries",
    amount: 12000,
    gstPaid: 600,
    isBusiness: false,
  },
  {
    id: "3",
    date: "2026-04-03",
    category: "transport",
    description: "Petrol - Honda City",
    amount: 5500,
    gstPaid: 0,
    isBusiness: false,
  },
  {
    id: "4",
    date: "2026-04-03",
    category: "school_fees",
    description: "DPS School Fees - Q1",
    amount: 15000,
    gstPaid: 2700,
    isBusiness: false,
  },
  {
    id: "5",
    date: "2026-04-04",
    category: "driver_salary",
    description: "Driver Raju - April Salary",
    amount: 12000,
    gstPaid: 0,
    isBusiness: false,
  },
  {
    id: "6",
    date: "2026-04-04",
    category: "utilities",
    description: "BESCOM Electricity Bill",
    amount: 3200,
    gstPaid: 576,
    isBusiness: false,
  },
  {
    id: "7",
    date: "2026-04-05",
    category: "insurance",
    description: "Star Health Insurance Premium",
    amount: 2500,
    gstPaid: 450,
    isBusiness: false,
  },
  {
    id: "8",
    date: "2026-04-05",
    category: "entertainment",
    description: "Netflix Subscription",
    amount: 649,
    gstPaid: 117,
    isBusiness: false,
  },
  {
    id: "9",
    date: "2026-04-05",
    category: "food",
    description: "Dining Out - Toit Brewpub",
    amount: 4500,
    gstPaid: 225,
    isBusiness: false,
  },
  {
    id: "10",
    date: "2026-04-06",
    category: "other",
    description: "Office Supplies - Amazon Business",
    amount: 8000,
    gstPaid: 1440,
    isBusiness: true,
  },
  {
    id: "11",
    date: "2026-04-06",
    category: "other",
    description: "Cloud Hosting - AWS",
    amount: 6200,
    gstPaid: 1116,
    isBusiness: true,
  },
  {
    id: "12",
    date: "2026-04-06",
    category: "medical",
    description: "Apollo Pharmacy - Medicines",
    amount: 1850,
    gstPaid: 222,
    isBusiness: false,
  },
];

// ---------------------------------------------------------------------------
// Budget vs Actual data
// ---------------------------------------------------------------------------
const BUDGET_DATA = [
  { category: "Housing", budget: 40000, actual: 35000 },
  { category: "Food", budget: 15000, actual: 16500 },
  { category: "Transport", budget: 8000, actual: 5500 },
  { category: "Education", budget: 18000, actual: 15000 },
  { category: "Utilities", budget: 5000, actual: 3200 },
  { category: "Entertainment", budget: 3000, actual: 5149 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getCategoryLabel(value: string): string {
  const cat = EXPENSE_CATEGORIES.find((c) => c.value === value);
  return cat ? cat.label : value;
}

function getCategoryIcon(value: string) {
  return CATEGORY_ICON_MAP[value] || MoreHorizontal;
}

function buildPieData(expenses: Expense[]) {
  const map: Record<string, number> = {};
  for (const e of expenses) {
    map[e.category] = (map[e.category] || 0) + e.amount;
  }
  return Object.entries(map).map(([key, value]) => ({
    name: getCategoryLabel(key),
    value,
    color: CATEGORY_COLORS[key] || "#6B7280",
  }));
}

// ---------------------------------------------------------------------------
// Custom tooltip for the pie chart
// ---------------------------------------------------------------------------
function CustomPieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null;
  const data = payload[0];
  return (
    <div className="rounded-lg border border-white/10 bg-navy/95 backdrop-blur-xl px-3 py-2 shadow-xl">
      <p className="text-xs text-white/70">{data.name}</p>
      <p className="font-display text-sm font-semibold text-white">
        {formatCurrency(data.value)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------
export default function ExpensesPage() {
  const [expenses] = useState<Expense[]>(DEMO_EXPENSES);
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

  // Derived
  const filtered = expenses.filter((e) => {
    if (showBusinessOnly && !e.isBusiness) return false;
    if (categoryFilter && e.category !== categoryFilter) return false;
    return true;
  });

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const businessExpenses = expenses
    .filter((e) => e.isBusiness)
    .reduce((s, e) => s + e.amount, 0);
  const personalExpenses = totalExpenses - businessExpenses;
  const totalGst = expenses.reduce((s, e) => s + e.gstPaid, 0);

  const pieData = buildPieData(expenses);

  const categoryOptions = [
    { value: "", label: "All Categories" },
    ...EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
  ];

  const formCategoryOptions = EXPENSE_CATEGORIES.map((c) => ({
    value: c.value,
    label: c.label,
  }));

  function handleAddExpense() {
    // In a real app this would persist data
    setDialogOpen(false);
    setFormDate("");
    setFormAmount("");
    setFormCategory("");
    setFormDescription("");
    setFormGst("");
    setFormIsBusiness(false);
    setFormReceiptUrl("");
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
            <h1 className="font-display text-2xl font-bold text-white">
              Expenses
            </h1>
            <p className="mt-1 text-sm text-white/50">
              Track and categorise every rupee spent
            </p>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white gap-2"
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
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">
                Total Expenses This Month
              </p>
              <p className="mt-2 font-display text-2xl font-bold text-rose-400 stat-number">
                {formatCurrency(totalExpenses)}
              </p>
              <p className="mt-1 text-xs text-white/40">
                {expenses.length} transactions
              </p>
            </CardContent>
          </Card>

          {/* Business */}
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">
                Business Expenses
              </p>
              <p className="mt-2 font-display text-2xl font-bold text-blue-400 stat-number">
                {formatCurrency(businessExpenses)}
              </p>
              <p className="mt-1 text-xs text-white/40">Tax deductible</p>
            </CardContent>
          </Card>

          {/* Personal */}
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">
                Personal Expenses
              </p>
              <p className="mt-2 font-display text-2xl font-bold text-purple-400 stat-number">
                {formatCurrency(personalExpenses)}
              </p>
              <p className="mt-1 text-xs text-white/40">Non-deductible</p>
            </CardContent>
          </Card>

          {/* GST Input Credit */}
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-white/50">
                GST Input Credit
              </p>
              <p className="mt-2 font-display text-2xl font-bold text-gold stat-number">
                {formatCurrency(totalGst)}
              </p>
              <p className="mt-1 text-xs text-white/40">Claimable this quarter</p>
            </CardContent>
          </Card>
        </div>

        {/* ---- Filters Row ---- */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-white/40" />
              <Select
                options={categoryOptions}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-48"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-white/50">All</span>
            <Switch
              checked={showBusinessOnly}
              onCheckedChange={setShowBusinessOnly}
            />
            <span className="text-sm text-white/50">Business Only</span>
          </div>
        </div>

        {/* ---- Expense Entries List ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-5 w-5 text-gold" />
              Expense Entries
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3 text-right">GST Paid</th>
                    <th className="px-5 py-3 text-center">Type</th>
                    <th className="px-5 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((expense) => {
                    const Icon = getCategoryIcon(expense.category);
                    return (
                      <tr
                        key={expense.id}
                        className="border-b border-white/5 transition-colors hover:bg-white/[0.02]"
                      >
                        <td className="whitespace-nowrap px-5 py-3.5 text-white/70">
                          {new Date(expense.date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div
                              className="flex h-7 w-7 items-center justify-center rounded-lg"
                              style={{
                                backgroundColor: `${CATEGORY_COLORS[expense.category] || "#6B7280"}20`,
                              }}
                            >
                              <Icon
                                className="h-3.5 w-3.5"
                                style={{
                                  color: CATEGORY_COLORS[expense.category] || "#6B7280",
                                }}
                              />
                            </div>
                            <span className="text-white/80">
                              {getCategoryLabel(expense.category)}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-white/60">
                          {expense.description}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right font-display font-semibold text-rose-400 stat-number">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right text-white/50 stat-number">
                          {expense.gstPaid > 0
                            ? formatCurrency(expense.gstPaid)
                            : "-"}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {expense.isBusiness ? (
                            <Badge variant="default">Business</Badge>
                          ) : (
                            <Badge variant="secondary">Personal</Badge>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-center gap-1">
                            <button className="rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/5 hover:text-white/70">
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button className="rounded-lg p-1.5 text-white/30 transition-colors hover:bg-rose-500/10 hover:text-rose-400">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-white/30">
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
              {BUDGET_DATA.map((row) => {
                const pct = Math.min(
                  Math.round((row.actual / row.budget) * 100),
                  100
                );
                const isOver = row.actual > row.budget;
                return (
                  <div key={row.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/70">{row.category}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-display font-semibold stat-number ${
                            isOver ? "text-rose-400" : "text-emerald-400"
                          }`}
                        >
                          {formatCurrency(row.actual)}
                        </span>
                        <span className="text-white/30">/</span>
                        <span className="text-white/40 stat-number">
                          {formatCurrency(row.budget)}
                        </span>
                        {isOver && (
                          <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">
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
                        <span className="text-xs text-white/60">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ---- Add Expense Dialog ---- */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
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
                <Label htmlFor="expense-receipt">Receipt URL (optional)</Label>
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
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddExpense}
                className="bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white"
              >
                Save Expense
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
