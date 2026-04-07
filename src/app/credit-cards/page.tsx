"use client";

import { useState, useCallback } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { CreditCardVisual } from "@/components/credit-card-visual";
import { parseCCStatement, CC_FORMAT_OPTIONS } from "@/lib/bank-statement/cc-parser";
import type { CCTransaction } from "@/lib/bank-statement/cc-parser";
import {
  Plus,
  CreditCard,
  IndianRupee,
  Wallet,
  Hash,
  Upload,
  FileSpreadsheet,
  Trash2,
  Edit3,
  Loader2,
  Check,
  X,
  Eye,
  EyeOff,
  Link2,
  Unlink,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────────────

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

  // Convex queries
  const creditCards = useQuery(
    api.creditCards.getCreditCards,
    user ? { userId: user.userId } : "skip"
  );
  const summary = useQuery(
    api.creditCards.getCCSummary,
    user ? { userId: user.userId } : "skip"
  );

  // Convex mutations
  const addCreditCard = useMutation(api.creditCards.addCreditCard);
  const updateCreditCard = useMutation(api.creditCards.updateCreditCard);
  const deleteCreditCard = useMutation(api.creditCards.deleteCreditCard);
  const importCCTransactions = useMutation(api.creditCards.importCCTransactions);
  const autoMatchTransactions = useMutation(api.creditCards.autoMatchTransactions);
  const matchCCTransaction = useMutation(api.creditCards.matchCCTransaction);
  const unmatchCCTransaction = useMutation(api.creditCards.unmatchCCTransaction);
  const ignoreCCTransaction = useMutation(api.creditCards.ignoreCCTransaction);

  // State
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardForm, setCardForm] = useState(emptyCardForm);
  const [submitting, setSubmitting] = useState(false);

  // Import state
  const [importCardId, setImportCardId] = useState<string | null>(null);
  const [importMonth, setImportMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [importFormat, setImportFormat] = useState("");
  const [parsedTransactions, setParsedTransactions] = useState<CCTransaction[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    autoMatched: number;
    needReview: number;
    unmatched: number;
  } | null>(null);
  const [parseError, setParseError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // Transaction view state
  const [viewCardId, setViewCardId] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState<string>("all");

  // Manual match state
  const [matchingTxId, setMatchingTxId] = useState<string | null>(null);

  // Dynamic queries based on state
  const ccTransactions = useQuery(
    api.creditCards.getCCTransactions,
    viewCardId
      ? {
          creditCardId: viewCardId as never,
          statementMonth: viewMonth !== "all" ? viewMonth : undefined,
        }
      : "skip"
  );

  const ccStatements = useQuery(
    api.creditCards.getCCStatements,
    viewCardId ? { creditCardId: viewCardId as never } : "skip"
  );

  const expenseCandidates = useQuery(
    api.creditCards.getExpenseCandidates,
    user && matchingTxId
      ? { userId: user.userId, ccTransactionId: matchingTxId as never }
      : "skip"
  );

  // ─── Handlers ─────────────────────────────────────────────────────────

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
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await deleteCreditCard({ id: id as any });
      if (viewCardId === id) setViewCardId(null);
    } catch (error) {
      console.error("Failed to delete credit card:", error);
    }
  }

  const handleFileDrop = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      setParseError("");
      setParsedTransactions([]);
      setImportResult(null);

      const result = await parseCCStatement(
        file,
        importFormat || undefined
      );
      if (result.error) {
        setParseError(result.error);
      } else {
        setParsedTransactions(result.transactions);
      }
    },
    [importFormat]
  );

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
      const matchResult = await autoMatchTransactions({
        userId: user.userId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        creditCardId: importCardId as any,
        statementMonth: importMonth,
      });

      setImportResult(matchResult);
      setParsedTransactions([]);

      // Switch to view the imported transactions
      setViewCardId(importCardId);
      setViewMonth(importMonth);
    } catch (error) {
      console.error("Import failed:", error);
    } finally {
      setImporting(false);
    }
  }

  async function handleManualMatch(expenseId: string) {
    if (!matchingTxId) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await matchCCTransaction({ ccTransactionId: matchingTxId as any, expenseEntryId: expenseId as any });
      setMatchingTxId(null);
    } catch (error) {
      console.error("Match failed:", error);
    }
  }

  async function handleUnmatch(txId: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await unmatchCCTransaction({ ccTransactionId: txId as any });
    } catch (error) {
      console.error("Unmatch failed:", error);
    }
  }

  async function handleIgnore(txId: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ignoreCCTransaction({ ccTransactionId: txId as any });
    } catch (error) {
      console.error("Ignore failed:", error);
    }
  }

  function toggleTransactionSelection(id: string) {
    setParsedTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────

  if (!user) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-text-secondary">Loading...</p>
        </div>
      </AppLayout>
    );
  }

  const isLoading = creditCards === undefined;

  return (
    <AppLayout>
      <div className="space-y-6 animate-enter">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">Credit Cards</h1>
            <p className="text-text-secondary text-sm mt-1">
              Manage cards, import statements & match expenses
            </p>
          </div>
          <Button onClick={openAddCard}>
            <Plus className="h-4 w-4 mr-2" />
            Add Card
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            {summary && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <IndianRupee className="h-4 w-4 text-rose-400" />
                      <p className="text-text-secondary text-xs uppercase">Total Outstanding</p>
                    </div>
                    <p className="stat-number text-2xl font-bold text-rose-500">
                      {formatCurrency(summary.totalOutstanding)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet className="h-4 w-4 text-blue-400" />
                      <p className="text-text-secondary text-xs uppercase">Total Credit Limit</p>
                    </div>
                    <p className="stat-number text-2xl font-bold text-blue-500">
                      {formatCurrency(summary.totalLimit)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="h-4 w-4 text-emerald-400" />
                      <p className="text-text-secondary text-xs uppercase">Available Credit</p>
                    </div>
                    <p className="stat-number text-2xl font-bold text-emerald-500">
                      {formatCurrency(summary.availableCredit)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="h-4 w-4 text-accent-light" />
                      <p className="text-text-secondary text-xs uppercase">Cards</p>
                    </div>
                    <p className="stat-number text-2xl font-bold text-accent">{summary.cardCount}</p>
                    <p className="text-text-tertiary text-xs mt-1">
                      {summary.totalCards > summary.cardCount
                        ? `${summary.totalCards - summary.cardCount} closed`
                        : "active"}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Cards Grid */}
            {creditCards.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 mb-4">
                    <CreditCard className="h-8 w-8 text-accent-light" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">No credit cards added</h3>
                  <p className="text-text-secondary text-sm max-w-md mb-6">
                    Add your credit cards to import statements and match transactions with your expenses.
                  </p>
                  <Button onClick={openAddCard}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Credit Card
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {creditCards.map((card) => {
                  const limitUsed = card.credit_limit
                    ? Math.min(100, ((summary?.totalOutstanding ?? 0) / card.credit_limit) * 100)
                    : 0;

                  return (
                    <div key={card._id} className="space-y-3">
                      <CreditCardVisual
                        cardName={card.card_name}
                        last4={card.card_last4}
                        network={card.card_network}
                        issuer={card.issuer}
                        color={card.color ?? undefined}
                      />
                      {/* Info below card */}
                      <div className="px-1 space-y-2">
                        {card.credit_limit && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-text-tertiary">Limit Usage</span>
                              <span className="font-mono text-text-secondary">
                                {formatCurrency(card.credit_limit)}
                              </span>
                            </div>
                            <Progress value={limitUsed} className="h-1.5" />
                          </div>
                        )}
                        {card.payment_due_date && (
                          <p className="text-xs text-text-tertiary">
                            Payment due: {card.payment_due_date}th of each month
                          </p>
                        )}
                        {/* Actions */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2"
                            onClick={() => {
                              setImportCardId(card._id);
                              setImportResult(null);
                              setParsedTransactions([]);
                              setParseError("");
                            }}
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Import
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2"
                            onClick={() => {
                              setViewCardId(card._id);
                              setViewMonth("all");
                            }}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Transactions
                          </Button>
                          <button
                            onClick={() => openEditCard(card)}
                            className="rounded p-1.5 text-text-tertiary hover:text-accent hover:bg-accent/10 transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCard(card._id)}
                            className="rounded p-1.5 text-text-tertiary hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ─── Import Statement Section ────────────────────────────── */}
            {importCardId && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileSpreadsheet className="h-5 w-5 text-accent-light" />
                      Import Statement
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setImportCardId(null);
                        setParsedTransactions([]);
                        setParseError("");
                        setImportResult(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Month + Format selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Statement Month</Label>
                      <Input
                        type="month"
                        value={importMonth}
                        onChange={(e) => setImportMonth(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Format (optional)</Label>
                      <Select
                        options={[
                          { value: "", label: "Auto-detect" },
                          ...CC_FORMAT_OPTIONS,
                        ]}
                        value={importFormat}
                        onChange={(e) => setImportFormat(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* File Upload */}
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                      dragOver
                        ? "border-accent bg-accent/5"
                        : "border-border-light hover:border-accent/50"
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      handleFileDrop(e.dataTransfer.files);
                    }}
                  >
                    <Upload className="h-8 w-8 text-text-tertiary mx-auto mb-3" />
                    <p className="text-sm text-text-secondary mb-2">
                      Drag & drop your credit card statement CSV here
                    </p>
                    <label className="cursor-pointer">
                      <span className="text-accent text-sm font-medium hover:underline">
                        or click to browse
                      </span>
                      <input
                        type="file"
                        accept=".csv,.CSV"
                        className="hidden"
                        onChange={(e) => handleFileDrop(e.target.files)}
                      />
                    </label>
                  </div>

                  {parseError && (
                    <div className="flex items-center gap-2 text-sm text-rose-500 bg-rose-50 rounded-lg p-3">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {parseError}
                    </div>
                  )}

                  {/* Import result */}
                  {importResult && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
                      <p className="text-sm font-medium text-emerald-800">Import Complete!</p>
                      <div className="flex gap-4 text-sm">
                        <span className="text-emerald-700">
                          <Check className="h-3.5 w-3.5 inline mr-1" />
                          {importResult.autoMatched} auto-matched
                        </span>
                        <span className="text-amber-700">
                          <AlertCircle className="h-3.5 w-3.5 inline mr-1" />
                          {importResult.needReview} need review
                        </span>
                        <span className="text-gray-600">
                          <X className="h-3.5 w-3.5 inline mr-1" />
                          {importResult.unmatched} unmatched
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Parsed transactions preview */}
                  {parsedTransactions.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-text-primary">
                          {parsedTransactions.length} transactions found
                        </p>
                        <Button onClick={handleImport} disabled={importing}>
                          {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Import & Auto-Match
                        </Button>
                      </div>
                      <div className="max-h-72 overflow-y-auto rounded-lg border border-border-light">
                        <table className="w-full text-sm">
                          <thead className="bg-surface-tertiary/50 sticky top-0">
                            <tr>
                              <th className="text-left p-2 w-8"></th>
                              <th className="text-left p-2">Date</th>
                              <th className="text-left p-2">Merchant</th>
                              <th className="text-left p-2">Category</th>
                              <th className="text-right p-2">Amount</th>
                              <th className="text-center p-2">Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsedTransactions.map((tx) => (
                              <tr
                                key={tx.id}
                                className="border-t border-border-light hover:bg-surface-tertiary/30"
                              >
                                <td className="p-2">
                                  <input
                                    type="checkbox"
                                    checked={tx.selected}
                                    onChange={() => toggleTransactionSelection(tx.id)}
                                    className="rounded"
                                  />
                                </td>
                                <td className="p-2 font-mono text-xs">{tx.date}</td>
                                <td className="p-2 truncate max-w-[200px]" title={tx.description}>
                                  {tx.merchant_name}
                                </td>
                                <td className="p-2">
                                  <span className="text-xs bg-gray-100 rounded px-1.5 py-0.5">
                                    {tx.category}
                                  </span>
                                </td>
                                <td className="p-2 text-right font-mono">
                                  {formatCurrency(tx.amount)}
                                </td>
                                <td className="p-2 text-center">
                                  <Badge
                                    variant={tx.type === "credit" ? "success" : "secondary"}
                                    className="text-[10px]"
                                  >
                                    {tx.type === "credit" ? "CR" : "DR"}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ─── Transactions View ────────────────────────────────────── */}
            {viewCardId && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Hash className="h-5 w-5 text-accent-light" />
                      Transactions
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setViewCardId(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Month tabs */}
                  <Tabs
                    value={viewMonth}
                    onValueChange={setViewMonth}
                    className="space-y-4"
                  >
                    <TabsList>
                      <TabsTrigger value="all">All</TabsTrigger>
                      {ccStatements?.map((stmt) => (
                        <TabsTrigger key={stmt.statement_month} value={stmt.statement_month}>
                          {stmt.statement_month}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    <TabsContent value={viewMonth} forceMount>
                      {ccTransactions === undefined ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin text-accent-light" />
                        </div>
                      ) : ccTransactions.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-text-secondary text-sm">
                            No transactions found for this period.
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-border-light">
                          <table className="w-full text-sm">
                            <thead className="bg-surface-tertiary/50">
                              <tr>
                                <th className="text-left p-3">Date</th>
                                <th className="text-left p-3">Merchant</th>
                                <th className="text-left p-3">Category</th>
                                <th className="text-right p-3">Amount</th>
                                <th className="text-center p-3">Status</th>
                                <th className="text-center p-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ccTransactions.map((tx) => (
                                <tr
                                  key={tx._id}
                                  className="border-t border-border-light hover:bg-surface-tertiary/30"
                                >
                                  <td className="p-3 font-mono text-xs">{tx.date}</td>
                                  <td className="p-3">
                                    <div className="truncate max-w-[200px]" title={tx.description}>
                                      {tx.merchant_name || tx.description}
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <span className="text-xs bg-gray-100 rounded px-1.5 py-0.5">
                                      {tx.category}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right font-mono">
                                    <span className={tx.type === "credit" ? "text-emerald-600" : ""}>
                                      {tx.type === "credit" ? "+" : ""}
                                      {formatCurrency(tx.amount)}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center">
                                    <MatchBadge status={tx.match_status} />
                                  </td>
                                  <td className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      {tx.match_status === "unmatched" && tx.type === "debit" && (
                                        <>
                                          <button
                                            onClick={() => setMatchingTxId(tx._id)}
                                            className="rounded p-1 text-text-tertiary hover:text-accent hover:bg-accent/10 transition-colors"
                                            title="Find Match"
                                          >
                                            <Link2 className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleIgnore(tx._id)}
                                            className="rounded p-1 text-text-tertiary hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                            title="Ignore"
                                          >
                                            <EyeOff className="h-3.5 w-3.5" />
                                          </button>
                                        </>
                                      )}
                                      {(tx.match_status === "matched" ||
                                        tx.match_status === "manual_match") && (
                                        <button
                                          onClick={() => handleUnmatch(tx._id)}
                                          className="rounded p-1 text-text-tertiary hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                                          title="Unmatch"
                                        >
                                          <Unlink className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ─── Add/Edit Card Dialog ────────────────────────────────────── */}
        <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCardId ? "Edit Credit Card" : "Add Credit Card"}
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cc-name">Card Name</Label>
                <Input
                  id="cc-name"
                  placeholder="e.g. HDFC Millennia"
                  value={cardForm.card_name}
                  onChange={(e) => handleCardFormChange("card_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc-last4">Last 4 Digits</Label>
                <Input
                  id="cc-last4"
                  placeholder="1234"
                  maxLength={4}
                  value={cardForm.card_last4}
                  onChange={(e) =>
                    handleCardFormChange("card_last4", e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc-network">Card Network</Label>
                <Select
                  id="cc-network"
                  options={NETWORK_OPTIONS}
                  value={cardForm.card_network}
                  onChange={(e) => handleCardFormChange("card_network", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc-issuer">Issuer</Label>
                <Select
                  id="cc-issuer"
                  options={ISSUER_OPTIONS}
                  value={cardForm.issuer}
                  onChange={(e) => handleCardFormChange("issuer", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc-limit">Credit Limit</Label>
                <Input
                  id="cc-limit"
                  type="number"
                  placeholder="e.g. 200000"
                  value={cardForm.credit_limit}
                  onChange={(e) => handleCardFormChange("credit_limit", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc-billing">Billing Cycle Date</Label>
                <Input
                  id="cc-billing"
                  type="number"
                  placeholder="1-31"
                  min={1}
                  max={31}
                  value={cardForm.billing_cycle_date}
                  onChange={(e) => handleCardFormChange("billing_cycle_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc-due">Payment Due Date</Label>
                <Input
                  id="cc-due"
                  type="number"
                  placeholder="1-31"
                  min={1}
                  max={31}
                  value={cardForm.payment_due_date}
                  onChange={(e) => handleCardFormChange("payment_due_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc-color">Custom Color (optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="cc-color"
                    type="color"
                    className="h-9 w-12 p-1"
                    value={cardForm.color || "#1e293b"}
                    onChange={(e) => handleCardFormChange("color", e.target.value)}
                  />
                  <Input
                    placeholder="#1e293b"
                    value={cardForm.color}
                    onChange={(e) => handleCardFormChange("color", e.target.value)}
                    className="flex-1"
                  />
                  {cardForm.color && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCardFormChange("color", "")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setCardDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCardSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingCardId ? "Update" : "Add"} Card
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Manual Match Dialog ──────────────────────────────────────── */}
        <Dialog open={!!matchingTxId} onOpenChange={() => setMatchingTxId(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-accent-light" />
                Find Matching Expense
              </DialogTitle>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* CC Transaction details */}
              {matchingTxId && ccTransactions && (
                <div className="bg-surface-tertiary/50 rounded-lg p-4">
                  {(() => {
                    const tx = ccTransactions.find((t) => t._id === matchingTxId);
                    if (!tx) return null;
                    return (
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium text-text-primary">
                            {tx.merchant_name || tx.description}
                          </p>
                          <p className="text-xs text-text-tertiary">{tx.date}</p>
                        </div>
                        <p className="font-mono font-semibold">{formatCurrency(tx.amount)}</p>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-text-tertiary">
                <ArrowRight className="h-4 w-4" />
                <span>Select an expense entry to match with this transaction</span>
              </div>

              {/* Expense candidates */}
              {expenseCandidates === undefined ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-accent-light" />
                  <span className="ml-2 text-text-secondary text-sm">Finding matches...</span>
                </div>
              ) : expenseCandidates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-text-secondary text-sm">
                    No matching expenses found. Try importing the expense first.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {expenseCandidates.map((candidate) => {
                    if (!candidate) return null;
                    return (
                      <button
                        key={candidate._id}
                        onClick={() => handleManualMatch(candidate._id)}
                        className="w-full flex items-center justify-between rounded-lg border border-border-light p-3 hover:bg-accent/5 hover:border-accent/30 transition-colors text-left"
                      >
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-text-primary">
                            {candidate.description}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-text-tertiary">
                            <span>{candidate.date}</span>
                            <span className="bg-gray-100 rounded px-1.5 py-0.5">
                              {candidate.category}
                            </span>
                            <Badge
                              variant={
                                candidate.matchScore >= 80
                                  ? "success"
                                  : candidate.matchScore >= 50
                                    ? "warning"
                                    : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {candidate.matchScore}% match
                            </Badge>
                          </div>
                        </div>
                        <p className="font-mono text-sm font-semibold text-text-primary">
                          {formatCurrency(candidate.amount)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setMatchingTxId(null)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
