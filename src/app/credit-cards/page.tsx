"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
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
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency, EXPENSE_CATEGORIES, getCurrentFinancialYear, getFinancialYearDates } from "@/lib/utils";
import { CreditCardVisual } from "@/components/credit-card-visual";
import { parseCCStatement, CC_FORMAT_OPTIONS } from "@/lib/bank-statement/cc-parser";
import { exportCCToExcel } from "@/lib/export-excel";
import type { CCTransaction } from "@/lib/bank-statement/cc-parser";
import {
  Plus,
  CreditCard,
  IndianRupee,
  Wallet,
  Hash,
  Upload,
  Trash2,
  Edit3,
  Loader2,
  Check,
  X,
  EyeOff,
  AlertCircle,
  Wand2,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  TrendingDown,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

const FY_MONTHS = [
  { label: "Apr", month: 3 }, { label: "May", month: 4 }, { label: "Jun", month: 5 },
  { label: "Jul", month: 6 }, { label: "Aug", month: 7 }, { label: "Sep", month: 8 },
  { label: "Oct", month: 9 }, { label: "Nov", month: 10 }, { label: "Dec", month: 11 },
  { label: "Jan", month: 0 }, { label: "Feb", month: 1 }, { label: "Mar", month: 2 },
];

const NETWORK_OPTIONS = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "rupay", label: "RuPay" },
  { value: "amex", label: "American Express" },
];

const ISSUER_OPTIONS = [
  { value: "HDFC Bank", label: "HDFC Bank" },
  { value: "ICICI Bank", label: "ICICI Bank" },
  { value: "SBI", label: "SBI" },
  { value: "Axis Bank", label: "Axis Bank" },
  { value: "Kotak Mahindra", label: "Kotak Mahindra" },
  { value: "IDFC First", label: "IDFC First" },
  { value: "IndusInd", label: "IndusInd Bank" },
  { value: "Yes Bank", label: "Yes Bank" },
  { value: "RBL Bank", label: "RBL Bank" },
  { value: "American Express", label: "American Express" },
  { value: "Citi", label: "Citi Bank" },
  { value: "HSBC", label: "HSBC" },
  { value: "Standard Chartered", label: "Standard Chartered" },
  { value: "AU Small Finance", label: "AU Small Finance" },
  { value: "Bank of Baroda", label: "Bank of Baroda" },
  { value: "Federal Bank", label: "Federal Bank" },
  { value: "OneCard", label: "OneCard" },
  { value: "Other", label: "Other" },
];

const emptyCardForm = {
  card_name: "",
  card_last4: "",
  card_network: "visa",
  issuer: "HDFC Bank",
  credit_limit: "",
  billing_cycle_date: "",
  payment_due_date: "",
  color: "",
};

// ─── Helper Components ──────────────────────────────────────────────────

function MatchBadge({ status }: { status: string }) {
  if (status === "matched" || status === "manual_match") {
    return (
      <Badge variant="success" className="text-[10px] gap-1">
        <Check className="h-3 w-3" /> Matched
      </Badge>
    );
  }
  if (status === "ignored") {
    return (
      <Badge variant="secondary" className="text-[10px] gap-1">
        <EyeOff className="h-3 w-3" /> Ignored
      </Badge>
    );
  }
  return (
    <Badge variant="warning" className="text-[10px] gap-1">
      <AlertCircle className="h-3 w-3" /> Unmatched
    </Badge>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────

export default function CreditCardsPage() {
  const { user } = useAuth();

  // ── Convex Queries ────────────────────────────────────────────────────
  const creditCards = useQuery(
    api.creditCards.getCreditCards,
    user ? { userId: user.userId } : "skip"
  );
  const allTransactions = useQuery(
    api.creditCards.getAllCCTransactions,
    user ? { userId: user.userId } : "skip"
  );
  const summary = useQuery(
    api.creditCards.getCCSummary,
    user ? { userId: user.userId } : "skip"
  );

  // Category preferences (for custom categories + subcategories)
  const catPrefs = useQuery(
    api.categories.getCategoryPreferences,
    user ? { userId: user.userId, scope: "expense" as const } : "skip"
  );

  const allCategories = useMemo(() => {
    const base: { value: string; label: string }[] = EXPENSE_CATEGORIES.map((c) => ({
      value: c.value as string,
      label: c.label as string,
    }));
    if (catPrefs) {
      const defaultSlugs = new Set(base.map((c) => c.value));
      for (const pref of catPrefs) {
        const existing = base.find((c) => c.value === pref.slug);
        if (existing) {
          existing.label = pref.label;
        } else if (!defaultSlugs.has(pref.slug) && !pref.hidden) {
          base.push({ value: pref.slug, label: pref.label });
        }
      }
    }
    return base;
  }, [catPrefs]);

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

  // ── Convex Mutations ──────────────────────────────────────────────────
  const addCreditCard = useMutation(api.creditCards.addCreditCard);
  const updateCreditCard = useMutation(api.creditCards.updateCreditCard);
  const deleteCreditCard = useMutation(api.creditCards.deleteCreditCard);
  const importCCTransactions = useMutation(api.creditCards.importCCTransactions);
  const autoMatchTransactions = useMutation(api.creditCards.autoMatchTransactions);
  const updateCCTx = useMutation(api.creditCards.updateCCTransaction);
  const purgeTxns = useMutation(api.creditCards.purgeCCTransactions);
  const dedupTxns = useMutation(api.creditCards.dedupCCTransactions);
  const crossCardDupes = useQuery(api.creditCards.findCrossCardDupes, user ? { userId: user.userId } : "skip");

  // ── Filter State ──────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFYs, setSelectedFYs] = useState<Set<string>>(new Set());
  const [cardFilter, setCardFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [matchStatusFilter, setMatchStatusFilter] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cardsExpanded, setCardsExpanded] = useState(true);

  // ── Sort State ────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<"date" | "amount" | "category" | "merchant">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  // ── Pagination ────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);

  // ── Bulk Selection ────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkSubcategory, setBulkSubcategory] = useState("");

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Card Dialog State ─────────────────────────────────────────────────
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardForm, setCardForm] = useState(emptyCardForm);
  const [submitting, setSubmitting] = useState(false);

  // ── Import Dialog State ───────────────────────────────────────────────
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importCardId, setImportCardId] = useState<string>("");
  const [importMonth, setImportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [importFormat, setImportFormat] = useState("");
  const [parsedTransactions, setParsedTransactions] = useState<CCTransaction[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ autoMatched: number; needReview: number; unmatched: number } | null>(null);
  const [parseError, setParseError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // ── AI Categorize State ───────────────────────────────────────────────
  const [aiCategorizing, setAiCategorizing] = useState(false);
  const [aiProgress, setAiProgress] = useState({ done: 0, total: 0 });
  const [aiSummary, setAiSummary] = useState<{ changed: number; errors: string[] } | null>(null);

  // ── Derived Data ──────────────────────────────────────────────────────
  const allTxns = useMemo(() => allTransactions ?? [], [allTransactions]);
  const cards = useMemo(() => creditCards ?? [], [creditCards]);

  // Available FYs from data
  const availableFYs = useMemo(() => {
    const fySet = new Set<string>();
    for (const t of allTxns) {
      const d = new Date(t.date);
      const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
      fySet.add(`${year}-${(year + 1).toString().slice(-2)}`);
    }
    const sorted = Array.from(fySet).sort().reverse();
    if (sorted.length === 0) sorted.push(getCurrentFinancialYear());
    return sorted;
  }, [allTxns]);

  // Auto-select FY
  useEffect(() => {
    if (availableFYs.length > 0 && selectedFYs.size === 0) {
      setSelectedFYs(new Set([availableFYs[0]]));
    }
  }, [availableFYs, selectedFYs.size]);

  const toggleFY = (fy: string) => {
    setSelectedFYs((prev) => {
      const next = new Set(prev);
      if (next.has(fy)) {
        next.delete(fy);
        if (next.size === 0) next.add(fy); // Keep at least one
      } else {
        next.add(fy);
      }
      return next;
    });
    setSelectedMonth("");
  };

  // ── Filtering ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return allTxns.filter((t) => {
      // FY date range
      // FY filter (multi-select)
      if (selectedFYs.size > 0) {
        const fyArray = Array.from(selectedFYs);
        let inAnyFY = false;
        for (const fy of fyArray) {
          const fyDates = getFinancialYearDates(fy);
          if (t.date >= fyDates.start && t.date <= fyDates.end) { inAnyFY = true; break; }
        }
        if (!inAnyFY) return false;
      }
      // Month filter
      if (selectedMonth) {
        const monthObj = FY_MONTHS.find((m) => m.label === selectedMonth);
        if (monthObj && new Date(t.date).getMonth() !== monthObj.month) return false;
      }
      // Card filter
      if (cardFilter && t.credit_card_id !== cardFilter) return false;
      // Category filter
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (subcategoryFilter) {
        const sub = (t as Record<string, unknown>).subcategory as string | undefined;
        if (subcategoryFilter === "__none__") { if (sub) return false; }
        else { if (sub !== subcategoryFilter) return false; }
      }
      // Match status filter
      if (matchStatusFilter) {
        if (matchStatusFilter === "matched" && t.match_status !== "matched" && t.match_status !== "manual_match") return false;
        if (matchStatusFilter === "unmatched" && t.match_status !== "unmatched") return false;
        if (matchStatusFilter === "ignored" && t.match_status !== "ignored") return false;
      }
      // Search
      if (query) {
        const haystack = `${t.description} ${t.merchant_name || ""} ${t.category || ""} ${(t as Record<string,unknown>).subcategory || ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [allTxns, selectedFYs, selectedMonth, cardFilter, categoryFilter, subcategoryFilter, matchStatusFilter, searchQuery]);

  // ── Sorting ───────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = a.date.localeCompare(b.date);
      else if (sortField === "amount") cmp = a.amount - b.amount;
      else if (sortField === "category") cmp = (a.category || "").localeCompare(b.category || "");
      else if (sortField === "merchant") cmp = (a.merchant_name || a.description).localeCompare(b.merchant_name || b.description);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  // ── Pagination ────────────────────────────────────────────────────────
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, currentPage]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [categoryFilter, subcategoryFilter, searchQuery, selectedFYs, selectedMonth, cardFilter, matchStatusFilter]);

  // ── KPI Stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const debits = filtered.filter((t) => t.type === "debit");
    const credits = filtered.filter((t) => t.type === "credit");
    const totalSpends = debits.reduce((s, t) => s + t.amount, 0);
    const totalPayments = credits.reduce((s, t) => s + t.amount, 0);
    const matched = filtered.filter((t) => t.match_status === "matched" || t.match_status === "manual_match").length;
    const unmatched = filtered.filter((t) => t.match_status === "unmatched").length;
    return {
      totalSpends,
      totalPayments,
      outstanding: totalSpends - totalPayments,
      count: filtered.length,
      matched,
      unmatched,
      matchedPct: filtered.length > 0 ? Math.round((matched / filtered.length) * 100) : 0,
    };
  }, [filtered]);

  // ── Analytics Insights ────────────────────────────────────────────────
  const [insightsOpen, setInsightsOpen] = useState(true);

  const insights = useMemo(() => {
    const debits = filtered.filter((t) => t.type === "debit");
    const credits = filtered.filter((t) => t.type === "credit");
    if (debits.length === 0) return null;

    // For spend analytics, exclude EMI principal amortization (already counted in original purchase)
    const realSpends = debits.filter((t) => {
      const desc = t.description.toLowerCase();
      return !desc.includes("principal amount amortization") && !desc.includes("principal amortization");
    });

    // Top category (using real spends to avoid EMI double-count)
    const catMap = new Map<string, number>();
    for (const t of realSpends) { catMap.set(t.category, (catMap.get(t.category) || 0) + t.amount); }
    const catSorted = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);
    const topCat = catSorted[0] || ["other", 0];
    const topCatLabel = allCategories.find((c) => c.value === topCat[0])?.label || topCat[0];
    const totalSpends = realSpends.reduce((s, t) => s + t.amount, 0);
    const totalAllDebits = debits.reduce((s, t) => s + t.amount, 0); // includes EMI (for KPI)

    // Top merchant (from real spends only)
    const merchMap = new Map<string, { total: number; count: number }>();
    for (const t of realSpends) {
      const name = t.merchant_name || t.description.substring(0, 25);
      const cur = merchMap.get(name) || { total: 0, count: 0 };
      cur.total += t.amount; cur.count++;
      merchMap.set(name, cur);
    }
    const merchSorted = Array.from(merchMap.entries()).sort((a, b) => b[1].total - a[1].total);
    const topMerch = merchSorted[0];
    const mostFrequent = Array.from(merchMap.entries()).sort((a, b) => b[1].count - a[1].count)[0];

    // Top subcategory
    const subMap = new Map<string, number>();
    for (const t of realSpends) {
      const sub = (t as Record<string, unknown>).subcategory as string;
      if (sub) subMap.set(sub, (subMap.get(sub) || 0) + t.amount);
    }
    const subSorted = Array.from(subMap.entries()).sort((a, b) => b[1] - a[1]);
    const topSub = subSorted[0];

    // Avg + biggest (from real spends)
    const amounts = realSpends.map((t) => t.amount).sort((a, b) => a - b);
    const avg = realSpends.length > 0 ? totalSpends / realSpends.length : 0;
    const median = amounts[Math.floor(amounts.length / 2)] || 0;
    const biggest = realSpends.length > 0 ? realSpends.reduce((max, t) => (t.amount > max.amount ? t : max), realSpends[0]) : debits[0];

    // Monthly trend (real spends only)
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastDate = new Date(now); lastDate.setMonth(lastDate.getMonth() - 1);
    const lastMonth = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, "0")}`;
    const thisMonthSpend = realSpends.filter((t) => t.date.startsWith(thisMonth)).reduce((s, t) => s + t.amount, 0);
    const lastMonthSpend = realSpends.filter((t) => t.date.startsWith(lastMonth)).reduce((s, t) => s + t.amount, 0);
    const trendPct = lastMonthSpend > 0 ? Math.round(((thisMonthSpend - lastMonthSpend) / lastMonthSpend) * 100) : 0;

    // EMI summary
    const emiPrincipal = debits.filter((t) => t.description.toLowerCase().includes("principal amount amortization")).reduce((s, t) => s + t.amount, 0);
    const emiInterest = debits.filter((t) => t.description.toLowerCase().includes("interest amount amortization")).reduce((s, t) => s + t.amount, 0);

    // Payment coverage
    const totalPayments = credits.reduce((s, t) => s + t.amount, 0);
    const coveragePct = totalAllDebits > 0 ? Math.min(100, Math.round((totalPayments / totalAllDebits) * 100)) : 0;

    // Category count
    const catCount = catMap.size;

    return {
      topCat: { label: topCatLabel, amount: topCat[1], pct: totalSpends > 0 ? Math.round((topCat[1] / totalSpends) * 100) : 0 },
      topMerch: topMerch ? { name: topMerch[0], total: topMerch[1].total, count: topMerch[1].count } : null,
      topSub: topSub ? { name: topSub[0], amount: topSub[1] } : null,
      avg: Math.round(avg), median: Math.round(median),
      biggest: { merchant: biggest.merchant_name || biggest.description.substring(0, 20), amount: biggest.amount, date: biggest.date },
      mostFrequent: mostFrequent ? { name: mostFrequent[0], count: mostFrequent[1].count, total: mostFrequent[1].total } : null,
      trend: { thisMonth: thisMonthSpend, lastMonth: lastMonthSpend, pct: trendPct },
      coverage: coveragePct, catCount, totalSpends, totalPayments,
      emi: { principal: emiPrincipal, interest: emiInterest, total: emiPrincipal + emiInterest },
    };
  }, [filtered, allCategories]);

  const hasActiveFilters = !!(categoryFilter || subcategoryFilter || searchQuery || selectedMonth || cardFilter || matchStatusFilter);

  function clearAllFilters() {
    setCategoryFilter("");
    setSubcategoryFilter("");
    setSearchQuery("");
    setSelectedMonth("");
    setCardFilter("");
    setMatchStatusFilter("");
  }

  // ── Toggle Select All (current page) ──────────────────────────────────
  const toggleSelectAll = () => {
    const pageIds = paginated.map((t) => t._id);
    const allPageSelected = pageIds.every((id) => selectedIds.has(id));
    if (allPageSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pageIds));
    }
  };

  const [bulkUpdating, setBulkUpdating] = useState(false);

  // ── Bulk Category / Subcategory Change ─────────────────────────────────
  const handleBulkCategoryChange = async (cat: string, sub?: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkUpdating(true);
    try {
      for (const id of ids) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await updateCCTx({ id: id as any, category: cat, subcategory: sub || "" });
      }
    } finally {
      setBulkUpdating(false);
      setSelectedIds(new Set());
      setBulkCategory("");
      setBulkSubcategory("");
    }
  };

  const handleBulkSubcategoryChange = async (sub: string) => {
    for (const id of Array.from(selectedIds)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updateCCTx({ id: id as any, subcategory: sub });
    }
    setSelectedIds(new Set());
    setBulkSubcategory("");
  };

  const deleteCCTxns = useMutation(api.creditCards.deleteCCTransactions);

  const handleBulkDelete = async () => {
    if (!confirm(`Permanently delete ${selectedIds.size} transaction(s)? This cannot be undone.`)) return;
    setBulkUpdating(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await deleteCCTxns({ transactionIds: Array.from(selectedIds) as any });
    } finally {
      setBulkUpdating(false);
      setSelectedIds(new Set());
    }
  };

  // ── Card Dialog Handlers ──────────────────────────────────────────────
  function handleCardFormChange(field: string, value: string) {
    setCardForm((prev) => ({ ...prev, [field]: value }));
  }

  function openAddCard() {
    setEditingCardId(null);
    setCardForm(emptyCardForm);
    setCardDialogOpen(true);
  }

  function openEditCard(card: NonNullable<typeof creditCards>[number]) {
    setEditingCardId(card._id);
    setCardForm({
      card_name: card.card_name,
      card_last4: card.card_last4,
      card_network: card.card_network,
      issuer: card.issuer,
      credit_limit: card.credit_limit?.toString() ?? "",
      billing_cycle_date: card.billing_cycle_date?.toString() ?? "",
      payment_due_date: card.payment_due_date?.toString() ?? "",
      color: card.color ?? "",
    });
    setCardDialogOpen(true);
  }

  async function handleCardSubmit() {
    if (!user || !cardForm.card_name || !cardForm.card_last4) return;
    setSubmitting(true);
    try {
      const data = {
        card_name: cardForm.card_name,
        card_last4: cardForm.card_last4,
        card_network: cardForm.card_network as "visa" | "mastercard" | "rupay" | "amex",
        issuer: cardForm.issuer,
        credit_limit: cardForm.credit_limit ? parseFloat(cardForm.credit_limit) : undefined,
        billing_cycle_date: cardForm.billing_cycle_date ? parseInt(cardForm.billing_cycle_date) : undefined,
        payment_due_date: cardForm.payment_due_date ? parseInt(cardForm.payment_due_date) : undefined,
        color: cardForm.color || undefined,
      };
      if (editingCardId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await updateCreditCard({ id: editingCardId as any, ...data });
      } else {
        await addCreditCard({ userId: user.userId, ...data });
      }
      setCardDialogOpen(false);
      setCardForm(emptyCardForm);
      setEditingCardId(null);
    } catch (error) {
      console.error("Failed to save credit card:", error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteCard(id: string) {
    if (!confirm("Delete this card and all its transactions?")) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await deleteCreditCard({ id: id as any });
      if (cardFilter === id) setCardFilter("");
    } catch (error) {
      console.error("Failed to delete credit card:", error);
    }
  }

  // ── Import Dialog Handlers ────────────────────────────────────────────
  function openImportDialog() {
    setImportDialogOpen(true);
    setImportCardId(cards.length > 0 ? cards[0]._id : "");
    setImportMonth(new Date().toISOString().slice(0, 7));
    setImportFormat("");
    setParsedTransactions([]);
    setParseError("");
    setImportResult(null);
  }

  const handleFileDrop = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setParseError("");
      setParsedTransactions([]);
      setImportResult(null);

      const allTxns: CCTransaction[] = [];
      const errors: string[] = [];
      let successCount = 0;

      for (let f = 0; f < files.length; f++) {
        const file = files[f];
        try {
          const result = await parseCCStatement(file, importFormat || undefined);
          if (result.error) {
            errors.push(`${file.name}: ${result.error}`);
          } else if (result.transactions.length === 0) {
            errors.push(`${file.name}: No transactions found`);
          } else {
            allTxns.push(...result.transactions);
            successCount++;
          }
        } catch (err) {
          errors.push(`${file.name}: ${err instanceof Error ? err.message : "Parse failed"}`);
        }
      }

      if (errors.length > 0 && allTxns.length === 0) {
        setParseError(errors.join("\n"));
      } else {
        if (errors.length > 0) {
          setParseError(`✓ ${successCount} file(s) parsed (${allTxns.length} txns). ✗ ${errors.length} failed:\n${errors.join("\n")}`);
        }

        // Dedup across files: same date + description prefix + amount
        const seen = new Set<string>();
        const deduped = allTxns.filter((t) => {
          const key = `${t.date}|${t.description.substring(0, 40)}|${t.amount}|${t.type}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setParsedTransactions(deduped);

        // Auto-detect statement month from latest transaction date
        if (deduped.length > 0 && !importMonth) {
          const dates = deduped.map((t) => t.date).filter(Boolean).sort();
          if (dates.length > 0) {
            const latest = dates[dates.length - 1];
            setImportMonth(latest.substring(0, 7));
          }
        }
      }
    },
    [importFormat, importMonth]
  );

  function toggleTransactionSelection(id: string) {
    setParsedTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  }

  async function handleImport() {
    if (!user || !importCardId || parsedTransactions.length === 0) return;
    setImporting(true);
    try {
      const selected = parsedTransactions.filter((t) => t.selected);
      await importCCTransactions({
        userId: user.userId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        creditCardId: importCardId as any,
        statementMonth: importMonth,
        transactions: selected.map((t) => ({
          date: t.date,
          amount: t.amount,
          type: t.type,
          description: t.description,
          merchant_name: t.merchant_name,
          category: t.category,
        })),
      });
      // Auto-match
      await autoMatchTransactions({
        userId: user.userId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        creditCardId: importCardId as any,
        statementMonth: importMonth,
      });
      setImportDialogOpen(false);
      setParsedTransactions([]);
      setCardFilter(importCardId);
      // Switch FY to match imported data so transactions are visible
      if (importMonth) {
        const [year, month] = importMonth.split("-").map(Number);
        const fy = month >= 4 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`;
        setSelectedFYs(new Set([fy]));
      }
    } catch (error) {
      console.error("Import failed:", error);
    } finally {
      setImporting(false);
    }
  }

  // ── AI Categorize ─────────────────────────────────────────────────────
  async function handleAiCategorize() {
    const entriesToProcess =
      selectedIds.size > 0
        ? filtered.filter((t) => selectedIds.has(t._id) && t.type === "debit")
        : filtered.filter((t) => t.type === "debit" && t.match_status === "unmatched");

    if (entriesToProcess.length === 0) return;

    if (selectedIds.size === 0) {
      if (!confirm(`AI Categorize ${entriesToProcess.length} unmatched debit transaction(s)? This uses API quota.`)) return;
    }

    setAiCategorizing(true);
    setAiProgress({ done: 0, total: entriesToProcess.length });
    setAiSummary(null);

    const transactions = entriesToProcess.map((t) => ({
      id: t._id,
      description: t.description,
      amount: t.amount,
      currentCategory: t.category,
    }));

    try {
      const resp = await fetch("/api/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions, mode: "expense" }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setAiSummary({ changed: 0, errors: [data.error || "API call failed"] });
        setAiCategorizing(false);
        return;
      }

      const results: Array<{ id: string; category: string; subcategory: string }> = data.results || [];
      let changed = 0;

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const original = entriesToProcess.find((t) => t._id === r.id);
        if (original && (original.category !== r.category || (original as Record<string, unknown>).subcategory !== r.subcategory)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await updateCCTx({ id: r.id as any, category: r.category, subcategory: r.subcategory });
          changed++;
        }
        setAiProgress({ done: i + 1, total: entriesToProcess.length });
      }

      setAiSummary({ changed, errors: data.errors || [] });
    } catch (err) {
      setAiSummary({ changed: 0, errors: [err instanceof Error ? err.message : "Unknown error"] });
    } finally {
      setAiCategorizing(false);
      setSelectedIds(new Set());
    }
  }

  // ── Card lookup helper ────────────────────────────────────────────────
  const cardMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof creditCards>[number]>();
    for (const c of cards) map.set(c._id, c);
    return map;
  }, [cards]);

  function getCardLabel(cardId: string) {
    const c = cardMap.get(cardId);
    if (!c) return "???";
    return `${c.issuer.charAt(0)}..${c.card_last4}`;
  }

  // ── Loading State ─────────────────────────────────────────────────────
  if (!user || creditCards === undefined || allTransactions === undefined) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
        </div>
      </AppLayout>
    );
  }

  // ── Filter Panel Content (shared desktop sidebar + mobile overlay) ───
  const filterPanelContent = (
    <div className="space-y-5">
      {/* Search */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Search</label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
          <input
            type="text"
            placeholder="Merchant, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 rounded-lg border border-gray-200 bg-white text-xs placeholder:text-text-tertiary transition-all duration-200 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400/10"
          />
        </div>
      </div>

      {/* FY selector (multi-select chips) */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Financial Year</label>
        <div className="flex flex-wrap gap-1.5">
          {availableFYs.map((fy) => (
            <button
              key={fy}
              onClick={() => toggleFY(fy)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedFYs.has(fy)
                  ? "border-0 text-white shadow-sm"
                  : "border border-gray-200 bg-white text-text-secondary hover:border-gray-300"
              }`}
              style={selectedFYs.has(fy) ? { backgroundColor: "#f43f5e" } : undefined}
            >
              FY {fy}
            </button>
          ))}
        </div>
      </div>

      {/* Card filter chips */}
      {cards.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Card</label>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => setCardFilter("")}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all border ${
                !cardFilter
                  ? "bg-rose-50 border-rose-200 text-rose-600 shadow-sm"
                  : "border-gray-200 bg-white text-text-secondary hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              All Cards
            </button>
            {cards.map((card) => (
              <button
                key={card._id}
                onClick={() => setCardFilter(cardFilter === card._id ? "" : card._id)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  cardFilter === card._id
                    ? "border-0 text-white shadow-sm"
                    : "border border-gray-200 bg-white text-text-secondary hover:border-gray-300 hover:bg-gray-50"
                }`}
                style={cardFilter === card._id ? { backgroundColor: "#f43f5e" } : undefined}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  cardFilter === card._id ? "bg-white/30 text-white" : "bg-rose-100 text-rose-600"
                }`}>
                  {card.issuer.charAt(0)}
                </span>
                <span className="truncate">{card.issuer}</span>
                <span className="ml-auto font-mono text-[10px] text-text-tertiary">{card.card_last4}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Category</label>
        <Select
          options={[{ value: "", label: "All Categories" }, ...allCategories]}
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setSubcategoryFilter(""); }}
          className="w-full"
        />
      </div>

      {/* Subcategory filter — always visible */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Subcategory</label>
        {(() => {
          // Gather subcategories from transactions + subcategoryMap
          const subCounts = new Map<string, number>();
          let noSubCount = 0;
          for (const t of (allTxns || [])) {
            if (categoryFilter && t.category !== categoryFilter) continue;
            const sub = (t as Record<string, unknown>).subcategory as string || "";
            if (sub) subCounts.set(sub, (subCounts.get(sub) || 0) + 1);
            else noSubCount++;
          }
          // Also include subcategories from preferences that may not have transactions yet
          if (categoryFilter && subcategoryMap[categoryFilter]) {
            for (const name of subcategoryMap[categoryFilter]) {
              if (!subCounts.has(name)) subCounts.set(name, 0);
            }
          }
          const subs = Array.from(subCounts.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

          return (
            <select
              value={subcategoryFilter}
              onChange={(e) => setSubcategoryFilter(e.target.value)}
              className="w-full text-xs rounded-lg border border-gray-200 px-3 py-2 bg-white focus:border-rose-400 focus:outline-none cursor-pointer"
            >
              <option value="">All Subcategories</option>
              <option value="__none__">— No Subcategory — ({noSubCount})</option>
              {subs.map((sub) => (
                <option key={sub.name} value={sub.name}>
                  {sub.name} ({sub.count})
                </option>
              ))}
            </select>
          );
        })()}
      </div>

      {/* Match status chips */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Match Status</label>
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: "", label: "All" },
            { value: "matched", label: "Matched" },
            { value: "unmatched", label: "Unmatched" },
            { value: "ignored", label: "Ignored" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMatchStatusFilter(matchStatusFilter === opt.value ? "" : opt.value)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                matchStatusFilter === opt.value
                  ? "border-0 text-white shadow-sm"
                  : "border border-gray-200 bg-white text-text-secondary hover:border-gray-300 hover:bg-gray-50"
              }`}
              style={matchStatusFilter === opt.value ? { backgroundColor: "#f43f5e" } : undefined}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Month chips */}
      {selectedFYs.size > 0 && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Month</label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => setSelectedMonth("")}
              className="px-2 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={!selectedMonth ? { backgroundColor: "#f43f5e", color: "white" } : undefined}
            >
              All
            </button>
            {FY_MONTHS.map((m) => (
              <button
                key={m.label}
                onClick={() => setSelectedMonth(selectedMonth === m.label ? "" : m.label)}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  selectedMonth !== m.label ? "bg-white border border-gray-200 text-text-secondary hover:bg-gray-100" : ""
                }`}
                style={selectedMonth === m.label ? { backgroundColor: "#f43f5e", color: "white" } : undefined}
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

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="space-y-4 animate-page-enter">
        {/* ── Page Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">Credit Cards</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Import statements, categorise &amp; reconcile CC spends
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
                <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white font-semibold">
                  !
                </span>
              )}
            </Button>
            <Button
              onClick={handleAiCategorize}
              variant="outline"
              className="gap-2"
              disabled={aiCategorizing || filtered.length === 0}
            >
              {aiCategorizing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {aiCategorizing
                  ? `${aiProgress.done}/${aiProgress.total}`
                  : selectedIds.size > 0
                    ? `AI Categorize (${selectedIds.size})`
                    : "AI Categorize"}
              </span>
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                const entriesToExport = selectedIds.size > 0
                  ? filtered.filter((t) => selectedIds.has(t._id))
                  : filtered;
                if (entriesToExport.length === 0) return;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                exportCCToExcel(entriesToExport as any, cardMap, Array.from(selectedFYs).join(", "));
              }}
              disabled={filtered.length === 0}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export Excel</span>
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={openImportDialog}
              disabled={cards.length === 0}
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Import Statement</span>
            </Button>
            {allTxns && allTxns.length > 0 && (
              <>
                <Button
                  variant="outline"
                  className="gap-2 text-amber-500 border-amber-200 hover:bg-amber-50"
                  onClick={async () => {
                    if (!user) return;
                    // First do same-card dedup
                    const result = await dedupTxns({ userId: user.userId });
                    const crossCount = crossCardDupes?.length || 0;

                    if (crossCount > 0) {
                      // Cross-card dupes found — ask user which card to keep
                      const toDelete: string[] = [];
                      for (const dupe of crossCardDupes!) {
                        const cardNames = dupe.transactions.map((t) => {
                          const c = cardMap.get(t.credit_card_id);
                          return c ? `${c.issuer} ..${c.card_last4}` : t.credit_card_id;
                        });
                        const keepIdx = prompt(
                          `"${dupe.description.substring(0, 50)}" (₹${dupe.amount}) on ${dupe.date}\n` +
                          `Found on ${dupe.transactions.length} cards:\n` +
                          dupe.transactions.map((t, i) => `  ${i + 1}. ${cardNames[i]}`).join("\n") +
                          `\n\nEnter number to KEEP (others will be deleted):`,
                          "1"
                        );
                        if (keepIdx) {
                          const keep = parseInt(keepIdx) - 1;
                          dupe.transactions.forEach((t, i) => {
                            if (i !== keep) toDelete.push(t._id);
                          });
                        }
                      }

                      if (toDelete.length > 0 && confirm(`Delete ${toDelete.length} cross-card duplicate(s)?`)) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await deleteCCTxns({ transactionIds: toDelete as any });
                        alert(`Done! Same-card: ${result.removed} removed. Cross-card: ${toDelete.length} removed.`);
                      } else {
                        alert(`Same-card dedup: ${result.removed} removed, ${result.kept} kept. ${crossCount} cross-card dupes skipped.`);
                      }
                    } else {
                      alert(`Dedup complete: ${result.removed} duplicates removed, ${result.kept} kept. No cross-card dupes found.`);
                    }
                  }}
                >
                  <span className="hidden sm:inline">
                    Dedup{crossCardDupes && crossCardDupes.length > 0 ? ` (${crossCardDupes.length})` : ""}
                  </span>
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 text-rose-400 border-rose-200 hover:bg-rose-50"
                  onClick={async () => {
                    if (!user || !confirm(`Purge all ${allTxns.length} CC transactions? This cannot be undone.`)) return;
                    await purgeTxns({ userId: user.userId });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Purge All</span>
                </Button>
              </>
            )}
            <Button
              onClick={openAddCard}
              variant="destructive"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Card</span>
            </Button>
          </div>
        </div>

        {/* AI Categorize summary banner */}
        {aiSummary && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 flex items-center justify-between animate-page-enter">
            <p className="text-sm text-text-primary">
              AI Categorization complete: <strong>{aiSummary.changed}</strong> entries updated.
              {aiSummary.errors.length > 0 && (
                <span className="text-rose-500 ml-2">{aiSummary.errors.length} batch error(s).</span>
              )}
            </p>
            <button onClick={() => setAiSummary(null)} className="p-1 rounded hover:bg-gray-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Visual Cards Row (collapsible) ── */}
        {cards.length > 0 && (
          <div>
            <button
              onClick={() => setCardsExpanded(!cardsExpanded)}
              className="flex items-center gap-2 text-xs text-text-tertiary hover:text-text-secondary transition-colors mb-2"
            >
              {cardsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <span className="font-medium uppercase tracking-wider">
                {cardsExpanded ? "Hide Cards" : "Show Cards"}
              </span>
              <span className="text-text-tertiary">({cards.length})</span>
              {cardFilter && (
                <Badge className="text-[9px] ml-1" variant="secondary">
                  Filtered: {cards.find(c => c._id === cardFilter)?.card_last4}
                </Badge>
              )}
            </button>
            {cardsExpanded && (
              <div className="overflow-x-auto pb-2 animate-page-enter">
                <div className="flex gap-3 min-w-0">
                  <button
                    onClick={() => setCardFilter("")}
                    className={`flex-shrink-0 w-32 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-0.5 transition-all text-center ${
                      !cardFilter
                        ? "border-rose-400 bg-rose-50 ring-2 ring-rose-400"
                        : "border-gray-300 bg-gray-50 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <CreditCard className="h-4 w-4 text-rose-400" />
                    <span className="text-[10px] font-semibold text-rose-600">All Cards</span>
                    <span className="text-[9px] text-text-tertiary">{cards.length} cards</span>
                  </button>
                  {cards.map((card) => (
                    <div key={card._id} className="flex-shrink-0 relative group/card w-[160px]">
                      <button
                        onClick={() => setCardFilter(cardFilter === card._id ? "" : card._id)}
                        className={`w-full transition-all rounded-lg ${
                          cardFilter === card._id
                            ? "ring-2 ring-rose-400 ring-offset-1"
                            : cardFilter && cardFilter !== card._id
                              ? "opacity-60 hover:opacity-100"
                              : ""
                        }`}
                      >
                        <CreditCardVisual
                          cardName={card.card_name}
                          last4={card.card_last4}
                          network={card.card_network}
                          issuer={card.issuer}
                          color={card.color ?? undefined}
                          compact
                        />
                      </button>
                      {/* Edit + Purge + Delete overlay */}
                      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity z-10">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditCard(card); }}
                          className="p-1 rounded bg-black/40 text-white hover:bg-black/60 transition-colors"
                          title="Edit card"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!user) return;
                            const count = (allTxns || []).filter((t) => t.credit_card_id === card._id).length;
                            if (!confirm(`Purge all ${count} transactions for ${card.card_name} (..${card.card_last4})? The card itself will be kept.`)) return;
                            await purgeTxns({ userId: user.userId, creditCardId: card._id });
                          }}
                          className="p-1 rounded bg-black/40 text-white hover:bg-amber-500/80 transition-colors"
                          title="Purge transactions (keep card)"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete ${card.card_name}? Card + all transactions will be removed.`)) {
                              deleteCreditCard({ id: card._id });
                            }
                          }}
                          className="p-1 rounded bg-black/40 text-white hover:bg-red-500/80 transition-colors"
                          title="Delete card + transactions"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── KPI Stats Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingDown className="h-4 w-4 text-rose-400" />
                <p className="text-text-secondary text-[10px] uppercase tracking-wider">Total Spends</p>
              </div>
              <p className="stat-number text-xl font-bold text-rose-500 tabular-nums">
                {formatCurrency(stats.totalSpends)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <p className="text-text-secondary text-[10px] uppercase tracking-wider">Total Payments</p>
              </div>
              <p className="stat-number text-xl font-bold text-emerald-500 tabular-nums">
                {formatCurrency(stats.totalPayments)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Wallet className="h-4 w-4 text-amber-400" />
                <p className="text-text-secondary text-[10px] uppercase tracking-wider">Outstanding</p>
              </div>
              <p className="stat-number text-xl font-bold text-amber-500 tabular-nums">
                {formatCurrency(stats.outstanding)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Hash className="h-4 w-4 text-text-tertiary" />
                <p className="text-text-secondary text-[10px] uppercase tracking-wider">Transactions</p>
              </div>
              <p className="stat-number text-xl font-bold text-text-primary tabular-nums">
                {stats.count}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Insights Section ── */}
        {insights && (
          <div>
            <button
              onClick={() => setInsightsOpen(!insightsOpen)}
              className="flex items-center gap-2 text-xs text-text-tertiary hover:text-text-secondary transition-colors mb-2"
            >
              {insightsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <span className="font-medium uppercase tracking-wider">{insightsOpen ? "Hide Insights" : "Show Insights"}</span>
            </button>
            {insightsOpen && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-page-enter">
                {/* Top Category */}
                <div className="rounded-xl border border-rose-200/50 bg-gradient-to-br from-rose-50 to-white p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-400 mb-1">Top Category</p>
                  <p className="text-sm font-bold text-text-primary truncate">{insights.topCat.label}</p>
                  <p className="text-lg font-display font-bold text-rose-500 stat-number">{formatCurrency(insights.topCat.amount)}</p>
                  <div className="mt-1.5 h-1.5 rounded-full bg-rose-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${insights.topCat.pct}%`, backgroundColor: "#f43f5e" }} />
                  </div>
                  <p className="text-[10px] text-text-tertiary mt-1">{insights.topCat.pct}% of total spend</p>
                </div>

                {/* Top Merchant */}
                {insights.topMerch && (
                  <div className="rounded-xl border border-amber-200/50 bg-gradient-to-br from-amber-50 to-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 mb-1">Top Merchant</p>
                    <p className="text-sm font-bold text-text-primary truncate">{insights.topMerch.name}</p>
                    <p className="text-lg font-display font-bold text-amber-600 stat-number">{formatCurrency(insights.topMerch.total)}</p>
                    <p className="text-[10px] text-text-tertiary mt-1">{insights.topMerch.count} transactions</p>
                  </div>
                )}

                {/* Biggest Spend */}
                <div className="rounded-xl border border-purple-200/50 bg-gradient-to-br from-purple-50 to-white p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-500 mb-1">Biggest Spend</p>
                  <p className="text-sm font-bold text-text-primary truncate">{insights.biggest.merchant}</p>
                  <p className="text-lg font-display font-bold text-purple-600 stat-number">{formatCurrency(insights.biggest.amount)}</p>
                  <p className="text-[10px] text-text-tertiary mt-1">{new Date(insights.biggest.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</p>
                </div>

                {/* Monthly Trend */}
                <div className="rounded-xl border border-blue-200/50 bg-gradient-to-br from-blue-50 to-white p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-500 mb-1">Monthly Trend</p>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-lg font-display font-bold stat-number" style={{ color: insights.trend.pct > 0 ? "#f43f5e" : "#10b981" }}>
                      {insights.trend.pct > 0 ? "↑" : insights.trend.pct < 0 ? "↓" : "→"} {Math.abs(insights.trend.pct)}%
                    </p>
                  </div>
                  <p className="text-[10px] text-text-tertiary mt-1">
                    This month: {formatCurrency(insights.trend.thisMonth)}
                  </p>
                  <p className="text-[10px] text-text-tertiary">
                    Last month: {formatCurrency(insights.trend.lastMonth)}
                  </p>
                </div>

                {/* Most Frequent */}
                {insights.mostFrequent && (
                  <div className="rounded-xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500 mb-1">Most Frequent</p>
                    <p className="text-sm font-bold text-text-primary truncate">{insights.mostFrequent.name}</p>
                    <p className="text-lg font-display font-bold text-emerald-600 stat-number">{insights.mostFrequent.count}x</p>
                    <p className="text-[10px] text-text-tertiary mt-1">Total: {formatCurrency(insights.mostFrequent.total)}</p>
                  </div>
                )}

                {/* Top Subcategory */}
                {insights.topSub && (
                  <div className="rounded-xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50 to-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-1">Top Subcategory</p>
                    <p className="text-sm font-bold text-text-primary truncate">{insights.topSub.name}</p>
                    <p className="text-lg font-display font-bold text-indigo-600 stat-number">{formatCurrency(insights.topSub.amount)}</p>
                  </div>
                )}

                {/* Average Transaction */}
                <div className="rounded-xl border border-slate-200/50 bg-gradient-to-br from-slate-50 to-white p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Avg Transaction</p>
                  <p className="text-lg font-display font-bold text-text-primary stat-number">{formatCurrency(insights.avg)}</p>
                  <p className="text-[10px] text-text-tertiary mt-1">Median: {formatCurrency(insights.median)}</p>
                  <p className="text-[10px] text-text-tertiary">{insights.catCount} categories used</p>
                </div>

                {/* Payment Coverage */}
                <div className="rounded-xl border border-teal-200/50 bg-gradient-to-br from-teal-50 to-white p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-500 mb-1">Payment Coverage</p>
                  <p className="text-lg font-display font-bold stat-number" style={{ color: insights.coverage >= 80 ? "#10b981" : insights.coverage >= 50 ? "#f59e0b" : "#f43f5e" }}>
                    {insights.coverage}%
                  </p>
                  <div className="mt-1.5 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${insights.coverage}%`,
                        backgroundColor: insights.coverage >= 80 ? "#10b981" : insights.coverage >= 50 ? "#f59e0b" : "#f43f5e",
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-text-tertiary mt-1">Paid: {formatCurrency(insights.totalPayments)}</p>
                </div>

                {/* EMI Breakdown */}
                {insights.emi.total > 0 && (
                  <div className="rounded-xl border border-orange-200/50 bg-gradient-to-br from-orange-50 to-white p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-500 mb-1">EMI Breakdown</p>
                    <p className="text-lg font-display font-bold text-orange-600 stat-number">{formatCurrency(insights.emi.total)}</p>
                    <p className="text-[10px] text-text-tertiary mt-1">Principal: {formatCurrency(insights.emi.principal)}</p>
                    <p className="text-[10px] text-text-tertiary">Interest: {formatCurrency(insights.emi.interest)}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Main Layout: Sidebar + Content ── */}
        <div className="flex gap-6">
          {/* Left Filter Panel (desktop) */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-4 rounded-xl border border-gray-200 bg-gray-50/80 p-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-4">Filters</h2>
              {filterPanelContent}
            </div>
          </aside>

          {/* Mobile Filter Overlay */}
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

          {/* Right Content Area */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Summary Bar */}
            <div className="rounded-xl border border-gray-200 bg-white px-5 py-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-xl font-bold text-rose-400 stat-number tabular-nums">
                    {formatCurrency(stats.totalSpends)}
                  </span>
                  <span className="text-xs text-text-tertiary">spends</span>
                </div>
                <div className="h-6 w-px bg-gray-200 hidden sm:block" />
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-text-primary tabular-nums">{filtered.length}</span>
                  <span className="text-xs text-text-tertiary">entries</span>
                </div>
                <div className="h-6 w-px bg-gray-200 hidden sm:block" />
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-emerald-500 tabular-nums">{stats.matchedPct}%</span>
                  <span className="text-xs text-text-tertiary">matched</span>
                </div>
                <div className="h-6 w-px bg-gray-200 hidden sm:block" />
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-amber-500 tabular-nums">{stats.unmatched}</span>
                  <span className="text-xs text-text-tertiary">unmatched</span>
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="h-5 w-5 text-rose-400" />
                  Transactions
                </CardTitle>
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2 text-sm animate-page-enter flex-wrap">
                    {bulkUpdating && <Loader2 className="h-4 w-4 animate-spin text-rose-400" />}
                    <span className="text-text-secondary font-medium">{selectedIds.size} selected</span>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={bulkCategory}
                        disabled={bulkUpdating}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) { setBulkCategory(""); return; }
                          setBulkCategory(val);
                          setBulkSubcategory("");
                          // If no subcategories for this category, apply immediately
                          if (!subcategoryMap[val] || subcategoryMap[val].length === 0) {
                            handleBulkCategoryChange(val);
                          }
                        }}
                        className="text-xs rounded-lg border border-gray-200 px-2 py-1.5 bg-white focus:border-rose-400 focus:outline-none cursor-pointer"
                      >
                        <option value="">Category...</option>
                        {allCategories.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                      {/* Dependent subcategory dropdown when category has subcategories */}
                      {bulkCategory && subcategoryMap[bulkCategory]?.length > 0 && (
                        <>
                          <select
                            value={bulkSubcategory}
                            onChange={(e) => setBulkSubcategory(e.target.value)}
                            className="text-xs rounded-lg border border-dashed border-gray-200 px-2 py-1.5 bg-gray-50 focus:border-rose-400 focus:outline-none cursor-pointer"
                          >
                            <option value="">Subcategory...</option>
                            {subcategoryMap[bulkCategory].map((sub) => (
                              <option key={sub} value={sub}>{sub}</option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="text-xs h-7"
                            disabled={bulkUpdating}
                            onClick={() => handleBulkCategoryChange(bulkCategory, bulkSubcategory)}
                          >
                            {bulkUpdating ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Applying...</> : "Apply"}
                          </Button>
                        </>
                      )}
                    </div>
                    {/* Subcategory-only change when all selected share same category */}
                    {!bulkCategory && (() => {
                      const selectedTxns = filtered.filter((t) => selectedIds.has(t._id));
                      const cats = new Set(selectedTxns.map((t) => t.category));
                      if (cats.size === 1) {
                        const sharedCat = Array.from(cats)[0];
                        const subs = subcategoryMap[sharedCat];
                        if (subs?.length > 0) {
                          return (
                            <select
                              value={bulkSubcategory}
                              onChange={(e) => { if (e.target.value) handleBulkSubcategoryChange(e.target.value); }}
                              className="text-xs rounded-lg border border-dashed border-rose-300 px-2 py-1.5 bg-rose-50 focus:border-rose-400 focus:outline-none cursor-pointer text-rose-600"
                            >
                              <option value="">Subcategory...</option>
                              {subs.map((sub) => (
                                <option key={sub} value={sub}>{sub}</option>
                              ))}
                            </select>
                          );
                        }
                      }
                      return null;
                    })()}
                    <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={bulkUpdating} className="text-xs h-7">
                      {bulkUpdating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
                      Delete
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
                            checked={paginated.length > 0 && paginated.every((t) => selectedIds.has(t._id))}
                            onChange={toggleSelectAll}
                            className="rounded border-gray-300 text-rose-500 focus:ring-rose-400/20"
                          />
                        </th>
                        <th className="px-4 py-3 cursor-pointer select-none hover:text-text-primary transition-colors" onClick={() => toggleSort("date")}>
                          Date {sortField === "date" && (sortDir === "asc" ? "\u2191" : "\u2193")}
                        </th>
                        <th className="px-4 py-3 cursor-pointer select-none hover:text-text-primary transition-colors" onClick={() => toggleSort("category")}>
                          Category {sortField === "category" && (sortDir === "asc" ? "\u2191" : "\u2193")}
                        </th>
                        <th className="px-4 py-3 cursor-pointer select-none hover:text-text-primary transition-colors" onClick={() => toggleSort("merchant")}>
                          Merchant / Description {sortField === "merchant" && (sortDir === "asc" ? "\u2191" : "\u2193")}
                        </th>
                        <th className="px-4 py-3">Card</th>
                        <th className="px-4 py-3 text-right cursor-pointer select-none hover:text-text-primary transition-colors" onClick={() => toggleSort("amount")}>
                          Amount {sortField === "amount" && (sortDir === "asc" ? "\u2191" : "\u2193")}
                        </th>
                        <th className="px-4 py-3 text-center">Match</th>
                        <th className="px-4 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((tx) => {
                        const card = cardMap.get(tx.credit_card_id);
                        return (
                          <tr
                            key={tx._id}
                            className="border-b border-border-light transition-colors duration-150 hover:bg-rose-500/[0.02] hover:border-l-2 hover:border-l-rose-400"
                          >
                            <td className="px-3 py-3.5">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(tx._id)}
                                onChange={() => toggleSelect(tx._id)}
                                className="rounded border-gray-300 text-rose-500 focus:ring-rose-400/20"
                              />
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-text-secondary">
                              {new Date(tx.date).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "2-digit",
                              })}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex flex-col gap-0.5">
                                <select
                                  value={tx.category || ""}
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  onChange={(e) => updateCCTx({ id: tx._id as any, category: e.target.value, subcategory: "" })}
                                  className="text-xs rounded-lg border border-gray-200 px-2 py-1 bg-white focus:border-rose-400 focus:outline-none cursor-pointer"
                                >
                                  <option value="">Uncategorized</option>
                                  {allCategories.map((c) => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                  ))}
                                </select>
                                {subcategoryMap[tx.category]?.length > 0 ? (
                                  <select
                                    value={String((tx as Record<string, unknown>).subcategory || "")}
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    onChange={(e) => updateCCTx({ id: tx._id as any, subcategory: e.target.value })}
                                    className="text-[11px] rounded-md border border-dashed border-gray-200 px-1.5 py-0.5 bg-gray-50 focus:border-rose-400 focus:outline-none cursor-pointer text-text-secondary"
                                  >
                                    <option value="">— subcategory —</option>
                                    {subcategoryMap[tx.category].map((sub) => (
                                      <option key={sub} value={sub}>{sub}</option>
                                    ))}
                                  </select>
                                ) : (tx as Record<string, unknown>).subcategory ? (
                                  <span className="text-[10px] text-text-tertiary">{String((tx as Record<string, unknown>).subcategory)}</span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-3.5" title={tx.description}>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-text-primary font-medium truncate max-w-[200px]">
                                  {tx.merchant_name || tx.description}
                                </span>
                                {tx.merchant_name && tx.description !== tx.merchant_name && (
                                  <span className="text-[11px] text-text-tertiary truncate max-w-[200px]">
                                    {tx.description}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              {card && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                                  {card.issuer.charAt(0)}
                                  <span className="font-mono">{card.card_last4}</span>
                                </span>
                              )}
                            </td>
                            <td className={`whitespace-nowrap px-4 py-3.5 text-right font-display font-semibold stat-number ${
                              tx.type === "credit" ? "text-emerald-500" : "text-rose-400"
                            }`}>
                              {tx.type === "credit" ? "+" : "-"}{formatCurrency(tx.amount)}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <MatchBadge status={tx.match_status || "unmatched"} />
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => {
                                    const c = cardMap.get(tx.credit_card_id);
                                    if (c) openEditCard(c);
                                  }}
                                  className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-secondary"
                                  title="Edit card"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {allTxns.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-5 py-10 text-center text-text-tertiary">
                            No transactions yet. Import a CC statement to get started.
                          </td>
                        </tr>
                      )}
                      {allTxns.length > 0 && filtered.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-5 py-10 text-center text-text-tertiary">
                            No transactions match the current filters.
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
                              currentPage !== page ? "hover:bg-gray-50 text-text-secondary" : ""
                            }`}
                            style={currentPage === page ? { backgroundColor: "#f43f5e", color: "white" } : undefined}
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
          </div>
        </div>

        {/* ── Import Statement Dialog ── */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Import CC Statement</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              {/* Card selector */}
              <div className="space-y-2">
                <Label>Credit Card</Label>
                <Select
                  options={cards.map((c) => ({
                    value: c._id,
                    label: `${c.card_name} (${c.issuer} ..${c.card_last4})`,
                  }))}
                  value={importCardId}
                  onChange={(e) => setImportCardId(e.target.value)}
                />
              </div>

              {/* Month */}
              <div className="space-y-2">
                <Label>Statement Month</Label>
                <Input
                  type="month"
                  value={importMonth}
                  onChange={(e) => setImportMonth(e.target.value)}
                />
              </div>

              {/* Format */}
              <div className="space-y-2">
                <Label>Format (optional)</Label>
                <Select
                  options={[{ value: "", label: "Auto-detect" }, ...CC_FORMAT_OPTIONS]}
                  value={importFormat}
                  onChange={(e) => setImportFormat(e.target.value)}
                />
              </div>

              {/* File Upload Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFileDrop(e.dataTransfer.files);
                }}
                className={`rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
                  dragOver
                    ? "border-rose-400 bg-rose-50"
                    : "border-gray-300 bg-gray-50 hover:border-gray-400"
                }`}
              >
                <Upload className="h-8 w-8 mx-auto text-text-tertiary mb-2" />
                <p className="text-sm text-text-secondary mb-1">
                  Drag &amp; drop your statements here
                </p>
                <p className="text-xs text-text-tertiary mb-3">Multiple files supported — or</p>
                <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg bg-white border border-gray-200 px-4 py-2 text-xs font-medium text-text-secondary hover:bg-gray-50 transition-colors">
                  <Upload className="h-3.5 w-3.5" />
                  Browse Files
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv,.xlsx,.xls,.pdf"
                    multiple
                    onChange={(e) => handleFileDrop(e.target.files)}
                  />
                </label>
              </div>

              {/* Parse Error */}
              {parseError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600 whitespace-pre-line max-h-32 overflow-y-auto">
                  {parseError}
                </div>
              )}

              {/* Parsed Preview */}
              {parsedTransactions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-text-primary">
                      {parsedTransactions.filter((t) => t.selected).length} of {parsedTransactions.length} transactions selected
                    </p>
                    <button
                      onClick={() =>
                        setParsedTransactions((prev) => {
                          const allSelected = prev.every((t) => t.selected);
                          return prev.map((t) => ({ ...t, selected: !allSelected }));
                        })
                      }
                      className="text-xs text-rose-500 hover:underline"
                    >
                      Toggle All
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 text-text-tertiary">
                          <th className="px-2 py-1.5 w-8"></th>
                          <th className="px-2 py-1.5 text-left">Date</th>
                          <th className="px-2 py-1.5 text-left">Description</th>
                          <th className="px-2 py-1.5 text-right">Amount</th>
                          <th className="px-2 py-1.5 text-center">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedTransactions.map((tx) => (
                          <tr key={tx.id} className="border-b border-gray-50">
                            <td className="px-2 py-1.5">
                              <input
                                type="checkbox"
                                checked={tx.selected}
                                onChange={() => toggleTransactionSelection(tx.id)}
                                className="rounded border-gray-300 text-rose-500"
                              />
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap">{tx.date}</td>
                            <td className="px-2 py-1.5 truncate max-w-[200px]">{tx.description}</td>
                            <td className="px-2 py-1.5 text-right font-mono">{formatCurrency(tx.amount)}</td>
                            <td className="px-2 py-1.5 text-center">
                              <Badge variant={tx.type === "credit" ? "success" : "destructive"} className="text-[9px]">
                                {tx.type}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import Result */}
              {importResult && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  Import complete! Auto-matched: {importResult.autoMatched}, Unmatched: {importResult.unmatched}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || parsedTransactions.filter((t) => t.selected).length === 0 || !importCardId}
                variant="destructive"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {parsedTransactions.filter((t) => t.selected).length} Transactions
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Add/Edit Card Dialog ── */}
        <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingCardId ? "Edit Credit Card" : "Add Credit Card"}</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Card Name</Label>
                <Input
                  placeholder="e.g. HDFC Regalia"
                  value={cardForm.card_name}
                  onChange={(e) => handleCardFormChange("card_name", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Last 4 Digits</Label>
                  <Input
                    placeholder="1234"
                    maxLength={4}
                    value={cardForm.card_last4}
                    onChange={(e) => handleCardFormChange("card_last4", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Network</Label>
                  <Select
                    options={NETWORK_OPTIONS}
                    value={cardForm.card_network}
                    onChange={(e) => handleCardFormChange("card_network", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Issuer</Label>
                <Select
                  options={ISSUER_OPTIONS}
                  value={cardForm.issuer}
                  onChange={(e) => handleCardFormChange("issuer", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Credit Limit (INR)</Label>
                <Input
                  type="number"
                  placeholder="500000"
                  value={cardForm.credit_limit}
                  onChange={(e) => handleCardFormChange("credit_limit", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Billing Cycle Date</Label>
                  <Input
                    type="number"
                    placeholder="1-31"
                    min={1}
                    max={31}
                    value={cardForm.billing_cycle_date}
                    onChange={(e) => handleCardFormChange("billing_cycle_date", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Due Date</Label>
                  <Input
                    type="number"
                    placeholder="1-31"
                    min={1}
                    max={31}
                    value={cardForm.payment_due_date}
                    onChange={(e) => handleCardFormChange("payment_due_date", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Color (optional)</Label>
                <Input
                  placeholder="#1e3a5f or gradient class"
                  value={cardForm.color}
                  onChange={(e) => handleCardFormChange("color", e.target.value)}
                />
              </div>

              {/* Preview */}
              {cardForm.card_name && cardForm.card_last4 && (
                <div>
                  <Label className="mb-2 block">Preview</Label>
                  <CreditCardVisual
                    cardName={cardForm.card_name}
                    last4={cardForm.card_last4}
                    network={cardForm.card_network as "visa" | "mastercard" | "rupay" | "amex"}
                    issuer={cardForm.issuer}
                    color={cardForm.color || undefined}
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCardDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCardSubmit}
                disabled={submitting || !cardForm.card_name || !cardForm.card_last4}
                variant="destructive"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {editingCardId ? "Update Card" : "Add Card"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Empty State ── */}
        {cards.length === 0 && allTxns.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 mb-4">
                <CreditCard className="h-8 w-8 text-rose-400" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">No credit cards added</h3>
              <p className="text-text-secondary text-sm max-w-md mb-6">
                Add your credit cards to import statements and track CC spends alongside your expenses.
              </p>
              <Button onClick={openAddCard} variant="destructive">
                <Plus className="h-4 w-4 mr-2" />
                Add Credit Card
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
