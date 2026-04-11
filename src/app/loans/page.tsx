"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { formatCurrency } from "@/lib/utils";
import {
  Plus,
  Home,
  Car,
  GraduationCap,
  Calendar,
  Calculator,
  Landmark,
  User,
  Loader2,
  Upload,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  Banknote,
  Clock,
  Percent,
} from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const typeIcons: Record<string, typeof Home> = {
  home: Home,
  car: Car,
  education: GraduationCap,
  personal: User,
};
const typeColors: Record<string, string> = {
  home: "text-blue-400",
  car: "text-purple-400",
  education: "text-emerald-400",
  personal: "text-accent-light",
};
const txnTypeColors: Record<string, string> = {
  interest: "bg-rose-500/10 text-rose-500",
  principal_repayment: "bg-emerald-500/10 text-emerald-600",
  compound_repayment: "bg-amber-500/10 text-amber-600",
  interest_repayment: "bg-blue-500/10 text-blue-600",
  charges: "bg-red-500/10 text-red-500",
  deposit: "bg-green-500/10 text-green-600",
  other: "bg-gray-200 text-gray-600",
};
const txnTypeLabels: Record<string, string> = {
  interest: "Interest",
  principal_repayment: "Principal",
  compound_repayment: "Compound",
  interest_repayment: "Int. Repay",
  charges: "Charges",
  deposit: "Deposit",
  other: "Other",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LoanDoc = any;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LoansPage() {
  const { user } = useAuth();
  const loansData = useQuery(
    api.loans.getLoans,
    user ? { userId: user.userId } : "skip"
  );
  const addLoan = useMutation(api.loans.addLoan);
  const updateLoan = useMutation(api.loans.updateLoan);
  const deleteLoan = useMutation(api.loans.deleteLoan);
  const importLoanTxns = useMutation(api.loans.importLoanTransactions);

  // Manual add dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: "home",
    lender: "",
    principal: "",
    outstanding: "",
    emi_amount: "",
    interest_rate: "",
    emi_date: "5",
    tenure_remaining: "",
  });

  // Import dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState("");
  const [importParsing, setImportParsing] = useState(false);
  const [importError, setImportError] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importSaving, setImportSaving] = useState(false);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    skipped: number;
  } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Expanded loan (show transactions)
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Manual Add
  // ---------------------------------------------------------------------------

  const handleSubmit = async () => {
    if (!user || !form.lender || !form.principal) return;
    setSaving(true);
    try {
      await addLoan({
        userId: user.userId,
        type: form.type as "home" | "car" | "personal" | "education",
        lender: form.lender,
        principal: Number(form.principal),
        outstanding: Number(form.outstanding) || Number(form.principal),
        emi_amount: Number(form.emi_amount) || 0,
        interest_rate: Number(form.interest_rate) || 0,
        emi_date: Number(form.emi_date) || 5,
        tenure_remaining: Number(form.tenure_remaining) || 0,
      });
      setDialogOpen(false);
      setForm({
        type: "home",
        lender: "",
        principal: "",
        outstanding: "",
        emi_amount: "",
        interest_rate: "",
        emi_date: "5",
        tenure_remaining: "",
      });
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Import Statement
  // ---------------------------------------------------------------------------

  const handleImportFile = useCallback((f: File) => {
    setImportFile(f);
    setImportError("");
    setImportPreview(null);
    setImportResult(null);
  }, []);

  const handleImportParse = async () => {
    if (!importFile) return;
    setImportParsing(true);
    setImportError("");
    setImportPreview(null);

    try {
      const formData = new FormData();
      formData.append("file", importFile);
      if (importPassword) formData.append("password", importPassword);

      const resp = await fetch("/api/parse-loan", {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({ error: "Parse failed" }));
        setImportError(data.error || "Failed to parse loan statement");
        setImportParsing(false);
        return;
      }

      const data = await resp.json();

      if (!data.loanDetails || !data.transactions?.length) {
        setImportError(
          "Could not extract loan details or transactions from the file."
        );
        setImportParsing(false);
        return;
      }

      setImportPreview(data);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Unexpected error"
      );
    } finally {
      setImportParsing(false);
    }
  };

  const handleImportConfirm = async () => {
    if (!user || !importPreview) return;
    setImportSaving(true);

    try {
      const details = importPreview.loanDetails;

      // Check if loan with this account number already exists
      const existingLoans = loansData ?? [];
      const existingLoan = details.account_number
        ? existingLoans.find(
            (l: LoanDoc) => l.account_number === details.account_number
          )
        : null;

      let loanId: Id<"loans">;

      if (existingLoan) {
        // Update existing loan metadata
        loanId = existingLoan._id;
        await updateLoan({
          id: loanId,
          outstanding: details.outstanding,
          emi_amount: details.emi_amount,
          tenure_remaining: details.remaining_tenure,
          interest_rate: details.interest_rate,
        });
      } else {
        // Create new loan
        loanId = await addLoan({
          userId: user.userId,
          type: (details.loan_type as "home" | "car" | "personal" | "education") || "personal",
          lender: details.lender || "Unknown",
          principal: details.sanctioned_amount || details.outstanding || 0,
          outstanding: details.outstanding || 0,
          emi_amount: details.emi_amount || 0,
          interest_rate: details.interest_rate || 0,
          emi_date: details.emi_date || 10,
          tenure_remaining: details.remaining_tenure || 0,
          account_number: details.account_number,
          sanctioned_amount: details.sanctioned_amount,
          product_type: details.product_type,
          start_date: details.start_date,
          loan_term: details.loan_term,
          ifsc_code: details.ifsc_code,
          branch_name: details.branch_name,
        });
      }

      // Import transactions with dedup
      const result = await importLoanTxns({
        loanId,
        userId: user.userId,
        transactions: importPreview.transactions.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (t: any) => ({
            date: t.post_date,
            value_date: t.value_date || undefined,
            description: t.description,
            debit: Number(t.debit) || 0,
            credit: Number(t.credit) || 0,
            balance: Number(t.balance) || 0,
            type: t.type || "other",
            reference: t.reference || undefined,
          })
        ),
        loanUpdates: {
          outstanding: details.outstanding,
          emi_amount: details.emi_amount,
          tenure_remaining: details.remaining_tenure,
          interest_rate: details.interest_rate,
        },
      });

      setImportResult(result);
      setExpandedLoanId(loanId);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Import failed"
      );
    } finally {
      setImportSaving(false);
    }
  };

  const resetImport = () => {
    setImportOpen(false);
    setImportFile(null);
    setImportPassword("");
    setImportError("");
    setImportPreview(null);
    setImportResult(null);
  };

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  const totalOutstanding =
    loansData?.reduce((s, l) => s + l.outstanding, 0) ?? 0;
  const totalEMI = loansData?.reduce((s, l) => s + l.emi_amount, 0) ?? 0;
  const totalPrincipal =
    loansData?.reduce((s, l) => s + (l.sanctioned_amount ?? l.principal), 0) ?? 0;
  const totalPaid = totalPrincipal - totalOutstanding;

  const calculatePrepaymentSavings = (
    loan: {
      outstanding: number;
      interest_rate: number;
      tenure_remaining: number;
    },
    extra: number
  ) => {
    const monthlyRate = loan.interest_rate / 100 / 12;
    const savings =
      extra *
      monthlyRate *
      Math.max(
        0,
        loan.tenure_remaining -
          Math.floor(extra / (loan.outstanding * monthlyRate + 1))
      );
    return Math.max(0, Math.round(savings));
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppLayout>
      <div className="space-y-6 animate-page-enter">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">
              Loans
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              EMI tracking, repayment history & prepayment planning
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Import Statement</span>
            </Button>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Loan</span>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="card-enter card-enter-1">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-rose-400" />
              </div>
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider">
                  Total Outstanding
                </p>
                <p className="text-xl font-display font-bold text-rose-400 stat-number tabular-nums">
                  {formatCurrency(totalOutstanding)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-enter card-enter-2">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Banknote className="h-6 w-6 text-accent-light" />
              </div>
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider">
                  Monthly EMI
                </p>
                <p className="text-xl font-display font-bold text-accent-light stat-number tabular-nums">
                  {formatCurrency(totalEMI)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-enter card-enter-3">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Landmark className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider">
                  Total Borrowed
                </p>
                <p className="text-xl font-display font-bold text-text-primary stat-number tabular-nums">
                  {formatCurrency(totalPrincipal)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-enter card-enter-4">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider">
                  Repaid
                </p>
                <p className="text-xl font-display font-bold text-emerald-400 stat-number tabular-nums">
                  {formatCurrency(Math.max(0, totalPaid))}
                </p>
                {totalPrincipal > 0 && (
                  <Progress
                    value={Math.max(0, (totalPaid / totalPrincipal) * 100)}
                    className="mt-1.5 h-1.5"
                    indicatorClassName="bg-emerald-400"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Loan Cards */}
        {loansData === undefined ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-64 rounded-xl bg-gray-100 animate-pulse"
              />
            ))}
          </div>
        ) : loansData.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Landmark className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-text-secondary">
                No loans tracked yet. Import a statement or add a loan manually.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {loansData.map((loan) => (
              <LoanCard
                key={loan._id}
                loan={loan}
                expanded={expandedLoanId === loan._id}
                onToggle={() =>
                  setExpandedLoanId(
                    expandedLoanId === loan._id ? null : loan._id
                  )
                }
                onDelete={() => deleteLoan({ id: loan._id })}
                calculatePrepaymentSavings={calculatePrepaymentSavings}
              />
            ))}
          </div>
        )}

        {/* Import Statement Dialog */}
        <Dialog open={importOpen} onOpenChange={(open) => !open && resetImport()}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Import Loan Statement</DialogTitle>
            </DialogHeader>

            {importResult ? (
              // Success state
              <div className="py-6 text-center space-y-4">
                <CheckCircle2 className="h-16 w-16 text-emerald-400 mx-auto" />
                <div>
                  <p className="text-lg font-semibold text-text-primary">
                    Import Complete
                  </p>
                  <p className="text-sm text-text-secondary mt-1">
                    <span className="text-emerald-500 font-semibold">
                      {importResult.inserted}
                    </span>{" "}
                    transactions imported
                    {importResult.skipped > 0 && (
                      <>
                        ,{" "}
                        <span className="text-text-tertiary">
                          {importResult.skipped} duplicates skipped
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <Button onClick={resetImport}>Done</Button>
              </div>
            ) : importPreview ? (
              // Preview state
              <div className="space-y-4">
                <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
                  <h3 className="text-sm font-semibold text-text-primary mb-3">
                    Loan Details Extracted
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-text-tertiary">Lender</span>
                      <p className="font-medium text-text-primary">
                        {importPreview.loanDetails.lender}
                      </p>
                    </div>
                    <div>
                      <span className="text-text-tertiary">Product</span>
                      <p className="font-medium text-text-primary">
                        {importPreview.loanDetails.product_type}
                      </p>
                    </div>
                    <div>
                      <span className="text-text-tertiary">Account</span>
                      <p className="font-medium text-text-primary font-mono">
                        {importPreview.loanDetails.account_number}
                      </p>
                    </div>
                    <div>
                      <span className="text-text-tertiary">Sanctioned</span>
                      <p className="font-medium text-text-primary stat-number">
                        {formatCurrency(
                          importPreview.loanDetails.sanctioned_amount || 0
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-text-tertiary">Outstanding</span>
                      <p className="font-medium text-rose-400 stat-number">
                        {formatCurrency(
                          importPreview.loanDetails.outstanding || 0
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-text-tertiary">EMI</span>
                      <p className="font-medium text-accent-light stat-number">
                        {formatCurrency(
                          importPreview.loanDetails.emi_amount || 0
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-text-tertiary">Interest Rate</span>
                      <p className="font-medium text-text-primary">
                        {importPreview.loanDetails.interest_rate}% p.a.
                      </p>
                    </div>
                    <div>
                      <span className="text-text-tertiary">Tenure</span>
                      <p className="font-medium text-text-primary">
                        {importPreview.loanDetails.remaining_tenure} /{" "}
                        {importPreview.loanDetails.loan_term} months
                      </p>
                    </div>
                    <div>
                      <span className="text-text-tertiary">Start Date</span>
                      <p className="font-medium text-text-primary">
                        {importPreview.loanDetails.start_date
                          ? formatDate(importPreview.loanDetails.start_date)
                          : "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Existing loan match */}
                {importPreview.loanDetails.account_number &&
                  loansData?.some(
                    (l: LoanDoc) =>
                      l.account_number ===
                      importPreview.loanDetails.account_number
                  ) && (
                    <div className="flex items-center gap-2 text-sm bg-amber-50 text-amber-700 rounded-xl px-4 py-3 border border-amber-200">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      Loan already exists — will update metadata and append new
                      transactions only
                    </div>
                  )}

                <div className="text-sm text-text-secondary">
                  <span className="font-semibold text-text-primary">
                    {importPreview.transactions.length}
                  </span>{" "}
                  transactions found
                </div>

                <DialogFooter>
                  <Button
                    variant="secondary"
                    onClick={() => setImportPreview(null)}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleImportConfirm}
                    disabled={importSaving}
                    className="gap-2"
                  >
                    {importSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Confirm Import
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              // Upload state
              <div className="space-y-4">
                {/* File upload */}
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                    importFile
                      ? "border-accent/40 bg-accent/5"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => importFileRef.current?.click()}
                >
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".pdf,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImportFile(f);
                    }}
                  />
                  {importFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="h-8 w-8 text-accent-light" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-text-primary">
                          {importFile.name}
                        </p>
                        <p className="text-xs text-text-tertiary">
                          {(importFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setImportFile(null);
                        }}
                        className="p-1 rounded hover:bg-gray-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-text-secondary">
                        Upload loan statement (PDF or Excel)
                      </p>
                      <p className="text-xs text-text-tertiary mt-1">
                        SBI, HDFC, ICICI and other bank loan statements
                      </p>
                    </>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    File Password{" "}
                    <span className="text-text-tertiary">(if encrypted)</span>
                  </Label>
                  <Input
                    type="password"
                    placeholder="e.g. KISHO04061985"
                    value={importPassword}
                    onChange={(e) => setImportPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && importFile) handleImportParse();
                    }}
                  />
                  <p className="text-[10px] text-text-tertiary">
                    SBI: First 5 chars of name (CAPS) + DOB (DDMMYYYY)
                  </p>
                </div>

                {importError && (
                  <div className="flex items-center gap-2 text-rose text-sm bg-rose/5 rounded-xl px-4 py-3">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {importError}
                  </div>
                )}

                <DialogFooter>
                  <Button variant="secondary" onClick={resetImport}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImportParse}
                    disabled={!importFile || importParsing}
                    className="gap-2"
                  >
                    {importParsing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        Parse Statement
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Manual Add Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Loan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Loan Type</Label>
                  <Select
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value })
                    }
                    options={[
                      { value: "home", label: "Home Loan" },
                      { value: "car", label: "Car Loan" },
                      { value: "personal", label: "Personal Loan" },
                      { value: "education", label: "Education Loan" },
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lender</Label>
                  <Input
                    value={form.lender}
                    onChange={(e) =>
                      setForm({ ...form, lender: e.target.value })
                    }
                    placeholder="Bank / NBFC"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Principal Amount</Label>
                  <Input
                    type="number"
                    value={form.principal}
                    onChange={(e) =>
                      setForm({ ...form, principal: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Outstanding</Label>
                  <Input
                    type="number"
                    value={form.outstanding}
                    onChange={(e) =>
                      setForm({ ...form, outstanding: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>EMI Amount</Label>
                  <Input
                    type="number"
                    value={form.emi_amount}
                    onChange={(e) =>
                      setForm({ ...form, emi_amount: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Interest Rate %</Label>
                  <Input
                    type="number"
                    value={form.interest_rate}
                    onChange={(e) =>
                      setForm({ ...form, interest_rate: e.target.value })
                    }
                    placeholder="8.5"
                    step="0.1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>EMI Date</Label>
                  <Input
                    type="number"
                    value={form.emi_date}
                    onChange={(e) =>
                      setForm({ ...form, emi_date: e.target.value })
                    }
                    min="1"
                    max="28"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Remaining Tenure (months)</Label>
                <Input
                  type="number"
                  value={form.tenure_remaining}
                  onChange={(e) =>
                    setForm({ ...form, tenure_remaining: e.target.value })
                  }
                  placeholder="180"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Add Loan"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// LoanCard sub-component
// ---------------------------------------------------------------------------

function LoanCard({
  loan,
  expanded,
  onToggle,
  onDelete,
  calculatePrepaymentSavings,
}: {
  loan: LoanDoc;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  calculatePrepaymentSavings: (
    loan: { outstanding: number; interest_rate: number; tenure_remaining: number },
    extra: number
  ) => number;
}) {
  const Icon = typeIcons[loan.type] || Landmark;
  const color = typeColors[loan.type] || "text-text-secondary";
  const repaidPercent =
    (loan.sanctioned_amount ?? loan.principal) > 0
      ? (((loan.sanctioned_amount ?? loan.principal) - loan.outstanding) /
          (loan.sanctioned_amount ?? loan.principal)) *
        100
      : 0;
  const nextEMI = new Date();
  nextEMI.setDate(loan.emi_date);
  if (nextEMI < new Date()) nextEMI.setMonth(nextEMI.getMonth() + 1);

  // Transaction data (only fetched when expanded)
  const txns = useQuery(
    api.loans.getLoanTransactions,
    expanded ? { loanId: loan._id } : "skip"
  );

  const totalInterestPaid = useMemo(() => {
    if (!txns) return 0;
    return txns
      .filter((t) => t.type === "interest")
      .reduce((s, t) => s + t.debit, 0);
  }, [txns]);

  const totalPrincipalPaid = useMemo(() => {
    if (!txns) return 0;
    return txns
      .filter((t) => t.type === "principal_repayment")
      .reduce((s, t) => s + t.credit, 0);
  }, [txns]);

  return (
    <Card className="group relative">
      <button
        onClick={onDelete}
        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary hover:text-rose text-xs z-10"
      >
        Remove
      </button>

      {/* Clickable header */}
      <div className="cursor-pointer" onClick={onToggle}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-lg bg-surface-tertiary ${color}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>{loan.lender}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge>{loan.product_type || loan.type}</Badge>
                  <span className="text-text-tertiary text-xs font-mono">
                    {loan.interest_rate}% p.a.
                  </span>
                  {loan.account_number && (
                    <span className="text-text-tertiary text-xs font-mono">
                      A/C: {loan.account_number}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-text-tertiary">
              {expanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pb-4">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
            <div>
              <p className="text-text-tertiary text-xs">Sanctioned</p>
              <p className="stat-number text-sm text-text-primary">
                {formatCurrency(loan.sanctioned_amount ?? loan.principal)}
              </p>
            </div>
            <div>
              <p className="text-text-tertiary text-xs">Outstanding</p>
              <p className="stat-number text-sm text-rose-400">
                {formatCurrency(loan.outstanding)}
              </p>
            </div>
            <div>
              <p className="text-text-tertiary text-xs">Monthly EMI</p>
              <p className="stat-number text-sm text-accent-light">
                {formatCurrency(loan.emi_amount)}
              </p>
            </div>
            <div className="hidden sm:block">
              <p className="text-text-tertiary text-xs">Tenure Left</p>
              <p className="text-sm text-text-primary flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {loan.tenure_remaining} months
              </p>
            </div>
            <div className="hidden sm:block">
              <p className="text-text-tertiary text-xs">Rate</p>
              <p className="text-sm text-text-primary flex items-center gap-1">
                <Percent className="h-3 w-3" />
                {loan.interest_rate}%
              </p>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-text-tertiary">Repayment Progress</span>
              <span className="text-text-secondary stat-number">
                {repaidPercent.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={repaidPercent}
              indicatorClassName="bg-emerald-400"
            />
          </div>
        </CardContent>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-gray-100 animate-page-enter">
          <CardContent className="pt-4 space-y-4">
            {/* Quick stats from transactions */}
            {txns && txns.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-rose-50 p-3">
                  <p className="text-[10px] text-rose-400 uppercase tracking-wider">
                    Total Interest Paid
                  </p>
                  <p className="stat-number text-sm text-rose-500 mt-0.5">
                    {formatCurrency(totalInterestPaid)}
                  </p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3">
                  <p className="text-[10px] text-emerald-500 uppercase tracking-wider">
                    Principal Repaid
                  </p>
                  <p className="stat-number text-sm text-emerald-600 mt-0.5">
                    {formatCurrency(totalPrincipalPaid)}
                  </p>
                </div>
                <div className="rounded-lg bg-accent/5 p-3">
                  <p className="text-[10px] text-accent-light uppercase tracking-wider">
                    Transactions
                  </p>
                  <p className="stat-number text-sm text-accent-light mt-0.5">
                    {txns.length}
                  </p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3">
                  <p className="text-[10px] text-amber-500 uppercase tracking-wider">
                    Prepay ₹1L Saves
                  </p>
                  <p className="stat-number text-sm text-amber-600 mt-0.5">
                    ~{formatCurrency(calculatePrepaymentSavings(loan, 100000))}
                  </p>
                </div>
              </div>
            )}

            {/* Next EMI + loan info */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-text-tertiary" />
                Next EMI: {nextEMI.toLocaleDateString("en-IN")}
              </div>
              {loan.start_date && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-text-tertiary" />
                  Started: {formatDate(loan.start_date)}
                </div>
              )}
              {loan.ifsc_code && (
                <span className="font-mono text-text-tertiary">
                  IFSC: {loan.ifsc_code}
                </span>
              )}
            </div>

            {loan.type === "home" && (
              <div className="bg-accent/5 rounded-lg p-3 border border-accent/15">
                <p className="text-xs text-accent-light font-medium mb-1">
                  Tax Benefits
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-text-tertiary">
                      80C (Principal):{" "}
                    </span>
                    <span className="text-text-primary stat-number">
                      ₹1,50,000
                    </span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">
                      24(b) (Interest):{" "}
                    </span>
                    <span className="text-text-primary stat-number">
                      ₹2,00,000
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Transaction History */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3">
                Transaction History
              </h3>
              {txns === undefined ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
                </div>
              ) : txns.length === 0 ? (
                <p className="text-xs text-text-tertiary py-4 text-center">
                  No transactions yet. Import a loan statement to see history.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-text-tertiary text-left">
                        <th className="px-3 py-2 font-medium">Date</th>
                        <th className="px-3 py-2 font-medium">Description</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium text-right">
                          Debit
                        </th>
                        <th className="px-3 py-2 font-medium text-right">
                          Credit
                        </th>
                        <th className="px-3 py-2 font-medium text-right">
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {txns.map((t) => (
                        <tr
                          key={t._id}
                          className="border-t border-gray-50 hover:bg-gray-50/50"
                        >
                          <td className="px-3 py-2 text-text-secondary whitespace-nowrap">
                            {formatDate(t.date)}
                          </td>
                          <td
                            className="px-3 py-2 text-text-primary max-w-[250px] truncate"
                            title={t.description}
                          >
                            {t.description}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${txnTypeColors[t.type] || txnTypeColors.other}`}
                            >
                              {txnTypeLabels[t.type] || t.type}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-rose-400 stat-number">
                            {t.debit > 0 ? formatCurrency(t.debit) : "-"}
                          </td>
                          <td className="px-3 py-2 text-right text-emerald-500 stat-number">
                            {t.credit > 0 ? formatCurrency(t.credit) : "-"}
                          </td>
                          <td className="px-3 py-2 text-right text-text-primary stat-number font-medium">
                            {formatCurrency(t.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </div>
      )}
    </Card>
  );
}
