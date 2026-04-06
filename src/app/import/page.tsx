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
  ArrowRight, RotateCcw, FileText, X,
} from "lucide-react";
import { cn, formatCurrency, EXPENSE_CATEGORIES, INCOME_TYPES } from "@/lib/utils";
import {
  parseCSV, parseXLSX, parsePDF, categorizeAll, markDuplicates,
  ALL_BANK_FORMATS,
} from "@/lib/bank-statement";
import type { ParsedTransaction } from "@/lib/bank-statement";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const batchImport = useMutation(api.importData.batchImportTransactions);

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

    const ext = file.name.split(".").pop()?.toLowerCase();
    const selectedBank = bankId || undefined;

    let result: { transactions: ParsedTransaction[]; bankName: string; error?: string };

    if (ext === "csv") {
      result = await parseCSV(file, selectedBank);
    } else if (ext === "xlsx" || ext === "xls") {
      result = await parseXLSX(file, selectedBank);
    } else if (ext === "pdf") {
      result = await parsePDF(file, selectedBank);
    } else {
      setParsing(false);
      setError("Unsupported file format");
      return;
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
    setDetectedBank(result.bankName);
    setTransactions(txns);
    setParsing(false);
    setStep("review");
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
                  "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200",
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

              {/* Bank selector */}
              <div className="max-w-xs">
                <label className="text-sm font-medium text-text-primary block mb-2">
                  Bank (auto-detected if possible)
                </label>
                <Select
                  value={bankId}
                  onChange={(e) => setBankId(e.target.value)}
                  placeholder="Auto-detect"
                  options={ALL_BANK_FORMATS.map((f) => ({ value: f.id, label: f.name }))}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-rose text-sm bg-rose/5 rounded-xl px-4 py-3">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                onClick={handleParse}
                disabled={!file || parsing}
                className="bg-gradient-to-r from-purple-grad-from to-purple-grad-to text-white hover:opacity-90"
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
              <Badge className="bg-surface-secondary text-text-primary">
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
                        <th className="px-3 py-3 font-medium">Description</th>
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
                          <td className="px-3 py-3 max-w-[300px] truncate" title={tx.description}>
                            {tx.description}
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
                      className="bg-gradient-to-r from-purple-grad-from to-purple-grad-to text-white hover:opacity-90"
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
                  className="bg-gradient-to-r from-purple-grad-from to-purple-grad-to text-white hover:opacity-90"
                  onClick={() => (window.location.href = "/dashboard")}
                >
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
