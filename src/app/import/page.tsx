"use client";

import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload, FileSpreadsheet, AlertCircle, CheckCircle2, ArrowLeft,
  ArrowRight, RotateCcw, FileText, X, Landmark,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatCurrency, EXPENSE_CATEGORIES, INCOME_TYPES } from "@/lib/utils";
import { parseDescription, getMethodColor } from "@/lib/bank-statement/description-parser";
import {
  parseCSV, parseXLSX, parsePDF, categorizeAll, markDuplicates,
  ALL_BANK_FORMATS,
} from "@/lib/bank-statement";
import { parseXLSXWithPassword } from "@/lib/bank-statement/parser-xlsx";
import type { ParsedTransaction } from "@/lib/bank-statement";
import { BankLogo, BankChip, resolveBankPresetId, BANK_PRESETS, BANK_PRESET_IDS } from "@/components/bank-logo";

type Step = "upload" | "review" | "importing" | "done";

export default function ImportPage() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [bankId, setBankId] = useState("");
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [detectedBank, setDetectedBank] = useState("");
  const [error, setError] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ income: number; expenses: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [filePassword, setFilePassword] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const batchImport = useMutation(api.importData.batchImportTransactions);

  // Bank master data for validation
  const bankAccounts = useQuery(api.bankAccounts.getBankAccounts, user ? { userId: user.userId } : "skip");
  const addBankAccount = useMutation(api.bankAccounts.addBankAccount);

  // Bank validation state
  const [showBankMismatch, setShowBankMismatch] = useState(false);
  const [unmatchedBankName, setUnmatchedBankName] = useState("");
  const [bankMismatchAction, setBankMismatchAction] = useState<"map" | "add">("map");
  const [mapToBankId, setMapToBankId] = useState("");
  const [newBankDisplayName, setNewBankDisplayName] = useState("");
  const [newBankLogoId, setNewBankLogoId] = useState("");
  const [bankValidationSaving, setBankValidationSaving] = useState(false);

  // Pending transactions held until bank validation passes
  const [pendingTransactions, setPendingTransactions] = useState<ParsedTransaction[]>([]);
  const [pendingDetectedBank, setPendingDetectedBank] = useState("");

  // Get date range for duplicate detection
  const dateRange = transactions.length > 0
    ? {
        start: transactions.reduce((min, t) => (t.date < min ? t.date : min), transactions[0].date),
        end: transactions.reduce((max, t) => (t.date > max ? t.date : max), transactions[0].date),
      }
    : null;

  const existingData = useQuery(
    api.importData.getExistingTransactionsInRange,
    user && dateRange
      ? { userId: user.userId, startDate: dateRange.start, endDate: dateRange.end }
      : "skip"
  );

  // ---- File handling ----

  const handleFile = useCallback((f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!ext || !["csv", "xlsx", "xls", "pdf"].includes(ext)) {
      setError("Please upload a CSV, Excel (.xlsx), or PDF file.");
      return;
    }
    setFile(f);
    setError("");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  // ---- Parsing ----

  const handleParse = async () => {
    if (!file) return;
    setParsing(true);
    setError("");
    setNeedsPassword(false);

    const ext = file.name.split(".").pop()?.toLowerCase();
    const selectedBank = bankId || undefined;

    let result: { transactions: ParsedTransaction[]; bankName: string; error?: string; needsPassword?: boolean };

    if (ext === "csv") {
      result = await parseCSV(file, selectedBank);
    } else if (ext === "xlsx" || ext === "xls") {
      // If user has entered a password, use server-side decryption
      if (filePassword) {
        result = await parseXLSXWithPassword(file, filePassword, selectedBank);
      } else {
        result = await parseXLSX(file, selectedBank);
      }

      // If file needs a password, show the password input
      if (result.needsPassword) {
        setNeedsPassword(true);
        setParsing(false);
        if (!filePassword) {
          setError("This file is password-protected. Please enter the password below.");
        } else {
          setError("Incorrect password. Please try again.");
        }
        return;
      }
    } else if (ext === "pdf") {
      result = await parsePDF(file, selectedBank);
    } else {
      setParsing(false);
      setError("Unsupported file format");
      return;
    }

    // If client-side parsing failed or returned 0 transactions, fall back to AI
    if (result.transactions.length === 0 || result.error) {
      result = await parsePDF(file, selectedBank); // AI-powered API route handles all file types
    }

    if (result.error) {
      setError(result.error);
      setParsing(false);
      return;
    }

    if (result.transactions.length === 0) {
      setError("No transactions found in file. Try selecting your bank manually.");
      setParsing(false);
      return;
    }

    const txns = categorizeAll(result.transactions);
    setParsing(false);

    // Validate detected bank against master data
    const detectedName = result.bankName;
    const masterBanks = bankAccounts ?? [];
    const bankExists = masterBanks.some(
      (b) => b.bank_name.toLowerCase() === detectedName.toLowerCase() ||
             b.logo_id === resolveBankPresetId(detectedName)
    );

    if (masterBanks.length > 0 && !bankExists && detectedName) {
      // Bank not in master data — prompt user
      setPendingTransactions(txns);
      setPendingDetectedBank(detectedName);
      setUnmatchedBankName(detectedName);
      setNewBankLogoId(resolveBankPresetId(detectedName));
      setNewBankDisplayName("");
      setBankMismatchAction("add");
      setShowBankMismatch(true);
    } else {
      // Bank is valid or no master data yet — proceed
      setDetectedBank(detectedName);
      setTransactions(txns);
      setStep("review");
    }
  };

  // Handle bank mismatch resolution
  const handleBankMismatchResolve = async () => {
    setBankValidationSaving(true);
    try {
      if (bankMismatchAction === "add" && user) {
        // Add this new bank to master data
        await addBankAccount({
          userId: user.userId,
          bank_name: unmatchedBankName,
          display_name: newBankDisplayName || unmatchedBankName,
          logo_id: newBankLogoId || resolveBankPresetId(unmatchedBankName),
          account_type: "internal" as const,
          sort_order: (bankAccounts?.length ?? 0),
        });
      }
      // Proceed with import
      setDetectedBank(bankMismatchAction === "map" && mapToBankId
        ? (bankAccounts?.find((b) => b._id === mapToBankId)?.bank_name ?? pendingDetectedBank)
        : pendingDetectedBank
      );
      setTransactions(pendingTransactions);
      setPendingTransactions([]);
      setPendingDetectedBank("");
      setShowBankMismatch(false);
      setStep("review");
    } finally {
      setBankValidationSaving(false);
    }
  };

  // Apply duplicate detection when existing data loads
  if (existingData && transactions.length > 0 && step === "review") {
    const hasDuplicates = transactions.some((t) => t.isDuplicate);
    if (!hasDuplicates && (existingData.income.length > 0 || existingData.expenses.length > 0)) {
      const updated = markDuplicates(transactions, existingData.income, existingData.expenses);
      if (updated.some((t) => t.isDuplicate)) {
        setTransactions(updated);
      }
    }
  }

  // ---- Import ----

  const handleImport = async () => {
    if (!user) return;
    const selected = transactions.filter((t) => t.selected);
    if (selected.length === 0) return;

    setStep("importing");
    setImportProgress(0);

    const BATCH_SIZE = 50;
    let totalIncome = 0;
    let totalExpenses = 0;

    for (let i = 0; i < selected.length; i += BATCH_SIZE) {
      const batch = selected.slice(i, i + BATCH_SIZE);
      const result = await batchImport({
        userId: user.userId,
        sourceBank: detectedBank || undefined,
        transactions: batch.map((t) => ({
          date: t.date,
          amount: t.amount,
          type: t.type,
          description: t.description,
          incomeType: t.incomeType,
          expenseCategory: t.expenseCategory,
        })),
      });
      totalIncome += result.incomeCount;
      totalExpenses += result.expenseCount;
      setImportProgress(Math.min(100, Math.round(((i + batch.length) / selected.length) * 100)));
    }

    setImportResult({ income: totalIncome, expenses: totalExpenses });
    setStep("done");
  };

  // ---- Helpers ----

  const toggleAll = (selected: boolean) => {
    setTransactions((prev) => prev.map((t) => ({ ...t, selected: t.isDuplicate ? false : selected })));
  };

  const toggleRow = (id: string) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const updateCategory = (id: string, field: "incomeType" | "expenseCategory", value: string) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const resetAll = () => {
    setStep("upload");
    setFile(null);
    setBankId("");
    setTransactions([]);
    setDetectedBank("");
    setError("");
    setImportProgress(0);
    setImportResult(null);
  };

  const selectedCount = transactions.filter((t) => t.selected).length;
  const duplicateCount = transactions.filter((t) => t.isDuplicate).length;
  const creditCount = transactions.filter((t) => t.type === "credit" && t.selected).length;
  const debitCount = transactions.filter((t) => t.type === "debit" && t.selected).length;
  const totalCredit = transactions.filter((t) => t.type === "credit" && t.selected).reduce((s, t) => s + t.amount, 0);
  const totalDebit = transactions.filter((t) => t.type === "debit" && t.selected).reduce((s, t) => s + t.amount, 0);

  return (
    <AppLayout>
      <div className="space-y-6 animate-page-enter">
        <div>
          <h1 className="text-3xl font-display font-bold text-text-primary">Import Statements</h1>
          <p className="text-text-secondary mt-1">
            Upload your bank statement and we&apos;ll auto-categorize everything
          </p>
        </div>

        {/* ---- STEP 1: Upload ---- */}
        {step === "upload" && (
          <Card className="border border-border rounded-2xl shadow-card">
            <CardHeader>
              <CardTitle className="text-lg font-display">Upload Bank Statement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300",
                  dragOver
                    ? "border-accent bg-accent/5"
                    : file
                    ? "border-emerald-300 bg-emerald/10/50"
                    : "border-border hover:border-accent/50 hover:bg-surface-secondary"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                {file ? (
                  <div className="space-y-2">
                    <FileSpreadsheet className="h-12 w-12 mx-auto text-emerald-500" />
                    <p className="text-sm font-medium text-text-primary">{file.name}</p>
                    <p className="text-xs text-text-tertiary">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="text-xs text-rose hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="h-12 w-12 mx-auto text-text-tertiary" />
                    <p className="text-sm text-text-secondary">
                      Drag & drop your bank statement here, or click to browse
                    </p>
                    <p className="text-xs text-text-tertiary">
                      Supports CSV, Excel (.xlsx), and PDF formats
                    </p>
                  </div>
                )}
              </div>

              {/* Bank selector with logos */}
              <div>
                <label className="text-sm font-medium text-text-primary block mb-2">
                  Bank (auto-detected if possible)
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setBankId("")}
                    className={cn(
                      "rounded-xl px-4 py-2.5 text-xs font-medium border transition-all",
                      !bankId
                        ? "border-accent bg-accent/5 text-accent shadow-sm"
                        : "border-gray-200 bg-white text-text-secondary hover:border-gray-300"
                    )}
                  >
                    Auto-detect
                  </button>
                  {ALL_BANK_FORMATS.map((f) => (
                    <BankChip
                      key={f.id}
                      bankId={f.id}
                      active={bankId === f.id}
                      onClick={() => setBankId(bankId === f.id ? "" : f.id)}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-rose text-sm bg-rose/5 rounded-xl px-4 py-3">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Password input for encrypted files (e.g. SBI) */}
              {needsPassword && (
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 max-w-xs">
                    <input
                      type="password"
                      placeholder="File password"
                      value={filePassword}
                      onChange={(e) => setFilePassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && filePassword) handleParse(); }}
                      className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10"
                      autoFocus
                    />
                  </div>
                  <span className="text-xs text-text-tertiary">
                    SBI uses first 5 chars of name (caps) + DOB (DDMMYYYY)
                  </span>
                </div>
              )}

              <Button
                onClick={handleParse}
                disabled={!file || parsing || (needsPassword && !filePassword)}
                className="bg-accent text-white hover:bg-accent/90"
              >
                {parsing ? (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Parse Statement
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ---- STEP 2: Review ---- */}
        {step === "review" && (
          <>
            {/* Summary bar */}
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-surface-secondary text-text-primary gap-1.5 pr-3">
                <BankLogo bankId={resolveBankPresetId(detectedBank)} size="xs" />
                {detectedBank}
              </Badge>
              <Badge className="bg-emerald/10 text-emerald">
                {transactions.length} transactions found
              </Badge>
              {duplicateCount > 0 && (
                <Badge className="bg-accent/10 text-amber-400">
                  {duplicateCount} potential duplicates
                </Badge>
              )}
              <Badge className="bg-blue-500/10 text-blue-400">
                {creditCount} income ({formatCurrency(totalCredit)})
              </Badge>
              <Badge className="bg-rose/10 text-rose">
                {debitCount} expenses ({formatCurrency(totalDebit)})
              </Badge>
            </div>

            <Card className="border border-border rounded-2xl shadow-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-display">Review Transactions</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => toggleAll(true)}>
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleAll(false)}>
                    Deselect All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-text-tertiary">
                        <th className="px-6 py-3 font-medium w-10"></th>
                        <th className="px-3 py-3 font-medium">Date</th>
                        <th className="px-3 py-3 font-medium">Payee / Method</th>
                        <th className="px-3 py-3 font-medium">Type</th>
                        <th className="px-3 py-3 font-medium text-right">Amount</th>
                        <th className="px-3 py-3 font-medium">Category</th>
                        <th className="px-6 py-3 font-medium w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr
                          key={tx.id}
                          className={cn(
                            "border-b border-border/50 transition-colors",
                            tx.isDuplicate && "bg-amber-500/10",
                            !tx.selected && "opacity-50"
                          )}
                        >
                          <td className="px-6 py-3">
                            <input
                              type="checkbox"
                              checked={tx.selected}
                              onChange={() => toggleRow(tx.id)}
                              className="rounded border-border text-accent-light focus:ring-accent/20"
                            />
                          </td>
                          <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">
                            {tx.date}
                          </td>
                          <td className="px-3 py-3 max-w-[350px]" title={tx.description}>
                            {(() => {
                              const parsed = parseDescription(tx.description);
                              return (
                                <div className="flex items-center gap-2">
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-text-primary font-medium truncate">{parsed.payee}</span>
                                    {parsed.bank && <span className="text-xs text-text-tertiary truncate">{parsed.bank}</span>}
                                  </div>
                                  <span className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${getMethodColor(parsed.method)}`}>
                                    {parsed.method}
                                  </span>
                                </div>
                              );
                            })()}
                            {tx.isDuplicate && (
                              <Badge className="ml-2 bg-amber-100 text-amber-400 text-[10px]">
                                Duplicate?
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <Badge
                              className={
                                tx.type === "credit"
                                  ? "bg-emerald/10 text-emerald"
                                  : "bg-rose/10 text-rose"
                              }
                            >
                              {tx.type === "credit" ? "Income" : "Expense"}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-medium">
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="px-3 py-3">
                            {tx.type === "credit" ? (
                              <select
                                value={tx.incomeType}
                                onChange={(e) => updateCategory(tx.id, "incomeType", e.target.value)}
                                className="text-xs rounded-lg border border-border px-2 py-1 bg-white focus:border-accent/50 focus:outline-none"
                              >
                                {INCOME_TYPES.map((t) => (
                                  <option key={t.value} value={t.value}>
                                    {t.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <select
                                value={tx.expenseCategory}
                                onChange={(e) => updateCategory(tx.id, "expenseCategory", e.target.value)}
                                className="text-xs rounded-lg border border-border px-2 py-1 bg-white focus:border-accent/50 focus:outline-none"
                              >
                                {EXPENSE_CATEGORIES.map((c) => (
                                  <option key={c.value} value={c.value}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            <button
                              onClick={() =>
                                setTransactions((prev) => prev.filter((t) => t.id !== tx.id))
                              }
                              className="text-text-tertiary hover:text-rose transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                  <Button variant="ghost" onClick={resetAll}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-text-secondary">
                      {selectedCount} of {transactions.length} selected
                    </span>
                    <Button
                      onClick={handleImport}
                      disabled={selectedCount === 0}
                      className="bg-accent text-white hover:bg-accent/90"
                    >
                      Import {selectedCount} Transactions
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ---- STEP 3: Importing ---- */}
        {step === "importing" && (
          <Card className="border border-border rounded-2xl shadow-card">
            <CardContent className="py-16 text-center space-y-6">
              <RotateCcw className="h-12 w-12 mx-auto text-accent-light animate-spin" />
              <div>
                <p className="text-lg font-medium text-text-primary">
                  Importing transactions...
                </p>
                <p className="text-sm text-text-secondary mt-1">
                  {Math.round((importProgress / 100) * selectedCount)} of {selectedCount} done
                </p>
              </div>
              <div className="max-w-md mx-auto">
                <Progress value={importProgress} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ---- STEP 4: Done ---- */}
        {step === "done" && importResult && (
          <Card className="border border-border rounded-2xl shadow-card">
            <CardContent className="py-16 text-center space-y-6">
              <CheckCircle2 className="h-16 w-16 mx-auto text-emerald-500" />
              <div>
                <p className="text-2xl font-display font-bold text-text-primary">
                  Import Complete!
                </p>
                <p className="text-text-secondary mt-2">
                  Successfully imported {importResult.income + importResult.expenses} transactions
                </p>
              </div>
              <div className="flex justify-center gap-6">
                {importResult.income > 0 && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-600">{importResult.income}</p>
                    <p className="text-sm text-text-secondary">Income entries</p>
                  </div>
                )}
                {importResult.expenses > 0 && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-rose">{importResult.expenses}</p>
                    <p className="text-sm text-text-secondary">Expense entries</p>
                  </div>
                )}
              </div>
              <div className="flex justify-center gap-3 pt-4">
                <Button variant="outline" onClick={resetAll}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Another
                </Button>
                <Button
                  className="bg-accent text-white hover:bg-accent/90"
                  onClick={() => (window.location.href = "/dashboard")}
                >
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {/* ---- Bank Mismatch Dialog ---- */}
        <Dialog open={showBankMismatch} onOpenChange={setShowBankMismatch}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-amber-500" />
                Unknown Bank Detected
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="text-sm text-amber-800">
                  The bank <strong>&quot;{unmatchedBankName}&quot;</strong> was detected in this statement but is not in your Bank Accounts master data.
                </p>
              </div>

              {/* Action selector */}
              <div className="flex gap-2">
                <button
                  onClick={() => setBankMismatchAction("add")}
                  className={cn(
                    "flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition-all text-left",
                    bankMismatchAction === "add"
                      ? "border-accent bg-accent/5 text-accent"
                      : "border-gray-200 bg-white text-text-secondary hover:border-gray-300"
                  )}
                >
                  <div className="font-semibold">Add New Bank</div>
                  <div className="text-xs mt-0.5 opacity-70">Add this bank to your master data</div>
                </button>
                <button
                  onClick={() => setBankMismatchAction("map")}
                  className={cn(
                    "flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition-all text-left",
                    bankMismatchAction === "map"
                      ? "border-accent bg-accent/5 text-accent"
                      : "border-gray-200 bg-white text-text-secondary hover:border-gray-300"
                  )}
                >
                  <div className="font-semibold">Map to Existing</div>
                  <div className="text-xs mt-0.5 opacity-70">Link to an existing bank account</div>
                </button>
              </div>

              {bankMismatchAction === "add" && (
                <div className="space-y-3 animate-page-enter">
                  {/* Logo picker */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Bank Logo</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {BANK_PRESET_IDS.map((id) => (
                        <button
                          key={id}
                          onClick={() => setNewBankLogoId(id)}
                          className={cn(
                            "rounded-lg p-1.5 border transition-all",
                            newBankLogoId === id
                              ? "border-accent bg-accent/5 shadow-sm"
                              : "border-gray-200 hover:border-gray-300"
                          )}
                        >
                          <BankLogo bankId={id} size="sm" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Display Name</Label>
                    <Input
                      value={newBankDisplayName}
                      onChange={(e) => setNewBankDisplayName(e.target.value)}
                      placeholder="e.g. Primary Savings"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              )}

              {bankMismatchAction === "map" && (
                <div className="space-y-2 animate-page-enter">
                  <Label className="text-xs">Select existing bank account</Label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {(bankAccounts ?? []).map((bank) => (
                      <button
                        key={bank._id}
                        onClick={() => setMapToBankId(bank._id)}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
                          mapToBankId === bank._id
                            ? "border-accent bg-accent/5"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        )}
                      >
                        <BankLogo bankId={bank.logo_id} size="sm" customColor={bank.logo_color || undefined} />
                        <div>
                          <div className="text-sm font-medium text-text-primary">{bank.bank_name}</div>
                          <div className="text-xs text-text-tertiary">{bank.display_name}</div>
                        </div>
                      </button>
                    ))}
                    {(bankAccounts ?? []).length === 0 && (
                      <p className="text-sm text-text-tertiary text-center py-4">No bank accounts in master data. Choose &quot;Add New Bank&quot; instead.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                // Skip validation and proceed anyway
                setDetectedBank(pendingDetectedBank);
                setTransactions(pendingTransactions);
                setPendingTransactions([]);
                setShowBankMismatch(false);
                setStep("review");
              }}>
                Skip
              </Button>
              <Button
                onClick={handleBankMismatchResolve}
                disabled={
                  bankValidationSaving ||
                  (bankMismatchAction === "map" && !mapToBankId) ||
                  (bankMismatchAction === "add" && !newBankLogoId)
                }
                className="bg-accent text-white hover:bg-accent/90"
              >
                {bankValidationSaving ? (
                  <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                {bankMismatchAction === "add" ? "Add & Continue" : "Map & Continue"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
