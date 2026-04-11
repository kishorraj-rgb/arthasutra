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
  CalendarCheck,
  Target,
  Zap,
  IndianRupee,
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
// Amortization & Foreclosure Calculators
// ---------------------------------------------------------------------------

interface AmortRow {
  month: number;
  emiDate: string;
  emi: number;
  principal: number;
  interest: number;
  balance: number;
}

/** Generate full amortization schedule from current outstanding */
function generateAmortization(
  outstanding: number,
  annualRate: number,
  emi: number,
  tenureMonths: number,
  startDate?: string
): AmortRow[] {
  const monthlyRate = annualRate / 100 / 12;
  const rows: AmortRow[] = [];
  let balance = outstanding;
  const start = startDate ? new Date(startDate) : new Date();
  // Move to next EMI date
  const emiStart = new Date(start);
  if (emiStart < new Date()) {
    emiStart.setMonth(new Date().getMonth() + 1);
  }

  for (let i = 1; i <= tenureMonths && balance > 0; i++) {
    const interest = Math.round(balance * monthlyRate);
    const principalPart = Math.min(balance, Math.max(0, emi - interest));
    balance = Math.max(0, balance - principalPart);
    const emiDate = new Date(emiStart);
    emiDate.setMonth(emiStart.getMonth() + i - 1);

    rows.push({
      month: i,
      emiDate: emiDate.toISOString().split("T")[0],
      emi: interest + principalPart,
      principal: principalPart,
      interest,
      balance,
    });

    if (balance <= 0) break;
  }
  return rows;
}

/** Calculate foreclosure details */
function calcForeclosure(
  outstanding: number,
  annualRate: number,
  emi: number,
  tenureRemaining: number,
  loanStartDate?: string
) {
  const monthlyRate = annualRate / 100 / 12;
  // Total payable without foreclosure
  const totalPayable = emi * tenureRemaining;
  const totalInterest = totalPayable - outstanding;

  // Foreclosure: pay outstanding today
  // Check if within 2 years of disbursement (SBI policy)
  const startDate = loanStartDate ? new Date(loanStartDate) : null;
  const now = new Date();
  const monthsSinceDisbursement = startDate
    ? (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth())
    : 999;
  const withinLockIn = monthsSinceDisbursement < 24;

  // SBI: 3% foreclosure charge within 2 years, 0 after
  const foreclosureChargeRate = withinLockIn ? 0.03 : 0;
  const foreclosureCharge = Math.round(outstanding * foreclosureChargeRate);
  const gstOnCharge = Math.round(foreclosureCharge * 0.18);
  const totalForeclosureCost = outstanding + foreclosureCharge + gstOnCharge;
  const interestSaved = Math.max(0, totalInterest);

  return {
    totalPayable,
    totalInterest,
    foreclosureAmount: outstanding,
    foreclosureCharge,
    gstOnCharge,
    totalForeclosureCost,
    interestSaved,
    withinLockIn,
    monthsSinceDisbursement,
  };
}

/** Calculate impact of a bullet/part payment */
function calcPartPayment(
  outstanding: number,
  annualRate: number,
  emi: number,
  tenureRemaining: number,
  partPaymentAmount: number,
  mode: "reduce_tenure" | "reduce_emi",
  loanStartDate?: string
) {
  const monthlyRate = annualRate / 100 / 12;
  const newOutstanding = outstanding - partPaymentAmount;
  if (newOutstanding <= 0) return { newTenure: 0, newEmi: 0, interestSaved: 0, monthsSaved: 0, partPaymentCharge: 0 };

  // SBI: 1% prepayment charge on floating rate within 24 months (actually 0 for floating rate new cars)
  // Conservative: show charge if within 24 months
  const startDate = loanStartDate ? new Date(loanStartDate) : null;
  const now = new Date();
  const monthsSinceDisbursement = startDate
    ? (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth())
    : 999;
  const partPaymentCharge = monthsSinceDisbursement < 24 ? Math.round(partPaymentAmount * 0.01) : 0;

  if (mode === "reduce_tenure") {
    // Same EMI, fewer months
    let balance = newOutstanding;
    let months = 0;
    while (balance > 0 && months < 600) {
      const interest = balance * monthlyRate;
      const principalPart = emi - interest;
      if (principalPart <= 0) break;
      balance -= principalPart;
      months++;
    }
    const monthsSaved = tenureRemaining - months;
    const originalTotalInterest = emi * tenureRemaining - outstanding;
    const newTotalInterest = emi * months - newOutstanding;
    const interestSaved = Math.max(0, originalTotalInterest - newTotalInterest);
    return { newTenure: months, newEmi: emi, interestSaved: Math.round(interestSaved), monthsSaved, partPaymentCharge };
  } else {
    // Same tenure, lower EMI
    const newEmi = monthlyRate > 0
      ? Math.round((newOutstanding * monthlyRate * Math.pow(1 + monthlyRate, tenureRemaining)) / (Math.pow(1 + monthlyRate, tenureRemaining) - 1))
      : Math.round(newOutstanding / tenureRemaining);
    const originalTotalInterest = emi * tenureRemaining - outstanding;
    const newTotalInterest = newEmi * tenureRemaining - newOutstanding;
    const interestSaved = Math.max(0, originalTotalInterest - newTotalInterest);
    return { newTenure: tenureRemaining, newEmi, interestSaved: Math.round(interestSaved), monthsSaved: 0, partPaymentCharge };
  }
}

/** Recursively strip null values (Convex rejects null for optional fields) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripNulls(obj: any): any {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) return obj.map(stripNulls).filter((v: unknown) => v !== undefined);
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const cleaned = stripNulls(v);
      if (cleaned !== undefined) result[k] = cleaned;
    }
    return result;
  }
  return obj;
}

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

      // Safely coerce numbers (avoid NaN)
      const safeNum = (v: unknown, fallback = 0) => {
        const n = Number(v);
        return isNaN(n) ? fallback : n;
      };

      if (existingLoan) {
        loanId = existingLoan._id;
        await updateLoan({
          id: loanId,
          outstanding: safeNum(details.outstanding),
          emi_amount: safeNum(details.emi_amount),
          tenure_remaining: safeNum(details.remaining_tenure),
          interest_rate: safeNum(details.interest_rate),
        });
      } else {
        const loanType = (["home", "car", "personal", "education"] as const).includes(details.loan_type)
          ? details.loan_type as "home" | "car" | "personal" | "education"
          : "personal";
        loanId = await addLoan({
          userId: user.userId,
          type: loanType,
          lender: details.lender || "Unknown",
          principal: safeNum(details.sanctioned_amount) || safeNum(details.outstanding),
          outstanding: safeNum(details.outstanding),
          emi_amount: safeNum(details.emi_amount),
          interest_rate: safeNum(details.interest_rate),
          emi_date: safeNum(details.emi_date, 10),
          tenure_remaining: safeNum(details.remaining_tenure),
          account_number: details.account_number || undefined,
          sanctioned_amount: details.sanctioned_amount ? safeNum(details.sanctioned_amount) : undefined,
          product_type: details.product_type || undefined,
          start_date: details.start_date || undefined,
          loan_term: details.loan_term ? safeNum(details.loan_term) : undefined,
          ifsc_code: details.ifsc_code || undefined,
          branch_name: details.branch_name || undefined,
        });
      }

      // Validate and normalize transaction types
      const VALID_TYPES = new Set([
        "interest", "principal_repayment", "compound_repayment",
        "interest_repayment", "charges", "deposit", "other",
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allTxns = importPreview.transactions.map((t: any) => stripNulls({
        date: t.post_date || t.date || "",
        value_date: t.value_date || undefined,
        description: String(t.description || ""),
        debit: Number(t.debit) || 0,
        credit: Number(t.credit) || 0,
        balance: Number(t.balance) || 0,
        type: VALID_TYPES.has(t.type) ? t.type : "other",
        reference: t.reference || undefined,
      })).filter((t: { date: string; description: string; debit: number; credit: number }) =>
        t.date && t.description && (t.debit > 0 || t.credit > 0)
      );

      // Batch in groups of 25 to avoid Convex size/time limits
      const BATCH_SIZE = 25;
      let totalInserted = 0;
      let totalSkipped = 0;

      for (let i = 0; i < allTxns.length; i += BATCH_SIZE) {
        const batch = allTxns.slice(i, i + BATCH_SIZE);
        const result = await importLoanTxns({
          loanId,
          userId: user.userId,
          transactions: batch,
          // Only update loan metadata on the first batch
          loanUpdates: i === 0 ? {
            outstanding: safeNum(details.outstanding),
            emi_amount: safeNum(details.emi_amount),
            tenure_remaining: safeNum(details.remaining_tenure),
            interest_rate: safeNum(details.interest_rate),
          } : undefined,
        });
        totalInserted += result.inserted;
        totalSkipped += result.skipped;
      }

      setImportResult({ inserted: totalInserted, skipped: totalSkipped });
      setExpandedLoanId(loanId);
    } catch (err) {
      console.error("Loan import error:", err);
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
          <Card className="card-enter card-enter-4">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Target className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider">
                  Total Payable
                </p>
                <p className="text-xl font-display font-bold text-amber-500 stat-number tabular-nums">
                  {formatCurrency(totalEMI * Math.max(...(loansData?.map(l => l.tenure_remaining) ?? [0])))}
                </p>
                <p className="text-[10px] text-text-tertiary">
                  Last EMI: {(() => {
                    const maxTenure = Math.max(...(loansData?.map(l => l.tenure_remaining) ?? [0]));
                    const lastEmi = new Date();
                    lastEmi.setMonth(lastEmi.getMonth() + maxTenure);
                    return lastEmi.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
                  })()}
                </p>
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

      {/* Expanded section with tabs */}
      {expanded && (
        <ExpandedLoanSection
          loan={loan}
          txns={txns}
          totalInterestPaid={totalInterestPaid}
          totalPrincipalPaid={totalPrincipalPaid}
          nextEMI={nextEMI}
        />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ExpandedLoanSection — Tabs for Transaction History, Schedule, Calculator
// ---------------------------------------------------------------------------

function ExpandedLoanSection({
  loan,
  txns,
  totalInterestPaid,
  totalPrincipalPaid,
  nextEMI,
}: {
  loan: LoanDoc;
  txns: LoanDoc[] | undefined;
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  nextEMI: Date;
}) {
  const [activeTab, setActiveTab] = useState<"history" | "schedule" | "calculator">("history");
  const [partPaymentAmt, setPartPaymentAmt] = useState("100000");
  const [partPaymentMode, setPartPaymentMode] = useState<"reduce_tenure" | "reduce_emi">("reduce_tenure");

  // Amortization schedule
  const schedule = useMemo(
    () => generateAmortization(loan.outstanding, loan.interest_rate, loan.emi_amount, loan.tenure_remaining),
    [loan.outstanding, loan.interest_rate, loan.emi_amount, loan.tenure_remaining]
  );

  // Total payable & last EMI
  const totalPayable = schedule.reduce((s, r) => s + r.emi, 0);
  const totalFutureInterest = schedule.reduce((s, r) => s + r.interest, 0);
  const lastEmiDate = schedule.length > 0 ? schedule[schedule.length - 1].emiDate : null;

  // Foreclosure calc
  const foreclosure = useMemo(
    () => calcForeclosure(loan.outstanding, loan.interest_rate, loan.emi_amount, loan.tenure_remaining, loan.start_date),
    [loan.outstanding, loan.interest_rate, loan.emi_amount, loan.tenure_remaining, loan.start_date]
  );

  // Part payment calc
  const partPayment = useMemo(
    () => calcPartPayment(loan.outstanding, loan.interest_rate, loan.emi_amount, loan.tenure_remaining, Number(partPaymentAmt) || 0, partPaymentMode, loan.start_date),
    [loan.outstanding, loan.interest_rate, loan.emi_amount, loan.tenure_remaining, partPaymentAmt, partPaymentMode, loan.start_date]
  );

  const tabClass = (t: string) =>
    `px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
      activeTab === t
        ? "bg-accent text-white shadow-sm"
        : "text-text-secondary hover:bg-gray-100"
    }`;

  return (
    <div className="border-t border-gray-100 animate-page-enter">
      <CardContent className="pt-4 space-y-4">
        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-lg bg-rose-50 p-3">
            <p className="text-[10px] text-rose-400 uppercase tracking-wider">Interest Paid</p>
            <p className="stat-number text-sm text-rose-500 mt-0.5">{formatCurrency(totalInterestPaid)}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3">
            <p className="text-[10px] text-emerald-500 uppercase tracking-wider">Principal Repaid</p>
            <p className="stat-number text-sm text-emerald-600 mt-0.5">{formatCurrency(totalPrincipalPaid)}</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-3">
            <p className="text-[10px] text-amber-500 uppercase tracking-wider">Total Payable</p>
            <p className="stat-number text-sm text-amber-600 mt-0.5">{formatCurrency(totalPayable)}</p>
          </div>
          <div className="rounded-lg bg-blue-50 p-3">
            <p className="text-[10px] text-blue-500 uppercase tracking-wider">Future Interest</p>
            <p className="stat-number text-sm text-blue-600 mt-0.5">{formatCurrency(totalFutureInterest)}</p>
          </div>
          <div className="rounded-lg bg-purple-50 p-3">
            <p className="text-[10px] text-purple-500 uppercase tracking-wider">Last EMI</p>
            <p className="stat-number text-sm text-purple-600 mt-0.5">{lastEmiDate ? formatDate(lastEmiDate) : "-"}</p>
          </div>
        </div>

        {/* Loan info bar */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
          <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-text-tertiary" />Next EMI: {nextEMI.toLocaleDateString("en-IN")}</span>
          {loan.start_date && <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-text-tertiary" />Started: {formatDate(loan.start_date)}</span>}
          {loan.ifsc_code && <span className="font-mono text-text-tertiary">IFSC: {loan.ifsc_code}</span>}
          {txns && <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />{txns.length} transactions</span>}
        </div>

        {loan.type === "home" && (
          <div className="bg-accent/5 rounded-lg p-3 border border-accent/15">
            <p className="text-xs text-accent-light font-medium mb-1">Tax Benefits</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-text-tertiary">80C (Principal): </span><span className="text-text-primary stat-number">₹1,50,000</span></div>
              <div><span className="text-text-tertiary">24(b) (Interest): </span><span className="text-text-primary stat-number">₹2,00,000</span></div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button className={tabClass("history")} onClick={() => setActiveTab("history")}>
            <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />Transactions</span>
          </button>
          <button className={tabClass("schedule")} onClick={() => setActiveTab("schedule")}>
            <span className="flex items-center gap-1.5"><CalendarCheck className="h-3.5 w-3.5" />Repayment Schedule</span>
          </button>
          <button className={tabClass("calculator")} onClick={() => setActiveTab("calculator")}>
            <span className="flex items-center gap-1.5"><Calculator className="h-3.5 w-3.5" />Calculator</span>
          </button>
        </div>

        {/* Tab Content: Transaction History */}
        {activeTab === "history" && (
          <div>
            {txns === undefined ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-text-tertiary" /></div>
            ) : txns.length === 0 ? (
              <p className="text-xs text-text-tertiary py-4 text-center">No transactions yet. Import a loan statement.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50 text-text-tertiary text-left">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium text-right">Debit</th>
                    <th className="px-3 py-2 font-medium text-right">Credit</th>
                    <th className="px-3 py-2 font-medium text-right">Balance</th>
                  </tr></thead>
                  <tbody>
                    {txns.map((t) => (
                      <tr key={t._id} className="border-t border-gray-50 hover:bg-gray-50/50">
                        <td className="px-3 py-2 text-text-secondary whitespace-nowrap">{formatDate(t.date)}</td>
                        <td className="px-3 py-2 text-text-primary max-w-[250px] truncate" title={t.description}>{t.description}</td>
                        <td className="px-3 py-2"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${txnTypeColors[t.type] || txnTypeColors.other}`}>{txnTypeLabels[t.type] || t.type}</span></td>
                        <td className="px-3 py-2 text-right text-rose-400 stat-number">{t.debit > 0 ? formatCurrency(t.debit) : "-"}</td>
                        <td className="px-3 py-2 text-right text-emerald-500 stat-number">{t.credit > 0 ? formatCurrency(t.credit) : "-"}</td>
                        <td className="px-3 py-2 text-right text-text-primary stat-number font-medium">{formatCurrency(t.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Repayment Schedule */}
        {activeTab === "schedule" && (
          <div>
            <p className="text-xs text-text-tertiary mb-3">
              Projected repayment schedule from current outstanding of {formatCurrency(loan.outstanding)} at {loan.interest_rate}% p.a.
            </p>
            <div className="overflow-x-auto rounded-lg border border-gray-100 max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0"><tr className="bg-gray-50 text-text-tertiary text-left">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">EMI Date</th>
                  <th className="px-3 py-2 font-medium text-right">EMI</th>
                  <th className="px-3 py-2 font-medium text-right">Principal</th>
                  <th className="px-3 py-2 font-medium text-right">Interest</th>
                  <th className="px-3 py-2 font-medium text-right">Balance</th>
                </tr></thead>
                <tbody>
                  {schedule.map((r) => (
                    <tr key={r.month} className="border-t border-gray-50 hover:bg-gray-50/50">
                      <td className="px-3 py-2 text-text-tertiary">{r.month}</td>
                      <td className="px-3 py-2 text-text-secondary whitespace-nowrap">{formatDate(r.emiDate)}</td>
                      <td className="px-3 py-2 text-right text-text-primary stat-number">{formatCurrency(r.emi)}</td>
                      <td className="px-3 py-2 text-right text-emerald-500 stat-number">{formatCurrency(r.principal)}</td>
                      <td className="px-3 py-2 text-right text-rose-400 stat-number">{formatCurrency(r.interest)}</td>
                      <td className="px-3 py-2 text-right text-text-primary stat-number font-medium">{formatCurrency(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t-2 border-gray-200 bg-gray-50 font-medium">
                  <td className="px-3 py-2" colSpan={2}>Total</td>
                  <td className="px-3 py-2 text-right stat-number">{formatCurrency(totalPayable)}</td>
                  <td className="px-3 py-2 text-right text-emerald-500 stat-number">{formatCurrency(schedule.reduce((s, r) => s + r.principal, 0))}</td>
                  <td className="px-3 py-2 text-right text-rose-400 stat-number">{formatCurrency(totalFutureInterest)}</td>
                  <td className="px-3 py-2 text-right stat-number">₹0</td>
                </tr></tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: Calculator */}
        {activeTab === "calculator" && (
          <div className="space-y-6">
            {/* Foreclosure Section */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/30 p-4">
              <h4 className="text-sm font-semibold text-rose-600 mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4" />Foreclosure Analysis
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-text-tertiary">Outstanding</span>
                  <p className="font-medium stat-number text-text-primary">{formatCurrency(foreclosure.foreclosureAmount)}</p>
                </div>
                <div>
                  <span className="text-text-tertiary">Foreclosure Charge</span>
                  <p className="font-medium stat-number text-rose-500">
                    {foreclosure.foreclosureCharge > 0
                      ? `${formatCurrency(foreclosure.foreclosureCharge)} (3%)`
                      : "₹0 (Free)"}
                  </p>
                </div>
                <div>
                  <span className="text-text-tertiary">GST on Charge</span>
                  <p className="font-medium stat-number text-text-secondary">{formatCurrency(foreclosure.gstOnCharge)}</p>
                </div>
                <div>
                  <span className="text-text-tertiary">Total to Close</span>
                  <p className="font-medium stat-number text-rose-600 text-sm">{formatCurrency(foreclosure.totalForeclosureCost)}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs">
                <div className="rounded-lg bg-emerald-100 text-emerald-700 px-3 py-1.5 font-medium">
                  Interest Saved: {formatCurrency(foreclosure.interestSaved)}
                </div>
                <span className="text-text-tertiary">
                  {foreclosure.withinLockIn
                    ? `⚠️ Within 2-year lock-in (${foreclosure.monthsSinceDisbursement} months since disbursement)`
                    : `✅ Past 2-year lock-in — No foreclosure charges (SBI policy)`}
                </span>
              </div>
              <p className="text-[10px] text-text-tertiary mt-2">
                SBI Auto Loan: 3% + GST foreclosure charge within 2 years of disbursement. Free after 2 years.
              </p>
            </div>

            {/* Part Payment / Bullet Payment Section */}
            <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
              <h4 className="text-sm font-semibold text-accent-light mb-3 flex items-center gap-2">
                <IndianRupee className="h-4 w-4" />Part Payment / Bullet Payment
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Part Payment Amount</Label>
                  <Input
                    type="number"
                    value={partPaymentAmt}
                    onChange={(e) => setPartPaymentAmt(e.target.value)}
                    placeholder="100000"
                    className="text-sm"
                  />
                  <div className="flex gap-1.5">
                    {[50000, 100000, 200000, 500000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setPartPaymentAmt(String(amt))}
                        className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                          partPaymentAmt === String(amt)
                            ? "bg-accent/10 border-accent/30 text-accent"
                            : "border-gray-200 text-text-tertiary hover:bg-gray-50"
                        }`}
                      >
                        {amt >= 100000 ? `₹${amt / 100000}L` : `₹${amt / 1000}K`}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Impact Mode</Label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPartPaymentMode("reduce_tenure")}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        partPaymentMode === "reduce_tenure"
                          ? "bg-accent text-white border-accent"
                          : "border-gray-200 text-text-secondary hover:bg-gray-50"
                      }`}
                    >
                      Reduce Tenure
                    </button>
                    <button
                      onClick={() => setPartPaymentMode("reduce_emi")}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        partPaymentMode === "reduce_emi"
                          ? "bg-accent text-white border-accent"
                          : "border-gray-200 text-text-secondary hover:bg-gray-50"
                      }`}
                    >
                      Reduce EMI
                    </button>
                  </div>
                </div>
              </div>

              {Number(partPaymentAmt) > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div className="rounded-lg bg-white p-3 border border-gray-100">
                    <span className="text-text-tertiary">New {partPaymentMode === "reduce_tenure" ? "Tenure" : "EMI"}</span>
                    <p className="font-medium stat-number text-text-primary text-sm mt-0.5">
                      {partPaymentMode === "reduce_tenure"
                        ? `${partPayment.newTenure} months`
                        : formatCurrency(partPayment.newEmi)}
                    </p>
                  </div>
                  {partPaymentMode === "reduce_tenure" && (
                    <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100">
                      <span className="text-emerald-600">Months Saved</span>
                      <p className="font-medium stat-number text-emerald-700 text-sm mt-0.5">{partPayment.monthsSaved} months</p>
                    </div>
                  )}
                  {partPaymentMode === "reduce_emi" && (
                    <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100">
                      <span className="text-emerald-600">EMI Reduction</span>
                      <p className="font-medium stat-number text-emerald-700 text-sm mt-0.5">{formatCurrency(loan.emi_amount - partPayment.newEmi)}/mo</p>
                    </div>
                  )}
                  <div className="rounded-lg bg-green-50 p-3 border border-green-100">
                    <span className="text-green-600">Interest Saved</span>
                    <p className="font-medium stat-number text-green-700 text-sm mt-0.5">{formatCurrency(partPayment.interestSaved)}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-gray-100">
                    <span className="text-text-tertiary">Prepay Charge</span>
                    <p className="font-medium stat-number text-text-primary text-sm mt-0.5">
                      {partPayment.partPaymentCharge > 0 ? formatCurrency(partPayment.partPaymentCharge) : "₹0 (Free)"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3 border border-amber-100">
                    <span className="text-amber-600">New Outstanding</span>
                    <p className="font-medium stat-number text-amber-700 text-sm mt-0.5">{formatCurrency(loan.outstanding - Number(partPaymentAmt))}</p>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-text-tertiary mt-3">
                SBI Auto Loan (floating rate): No prepayment charges for new car loans. Fixed rate: 1% + GST within 24 months.
                Part payment reduces either tenure (same EMI) or EMI (same tenure) based on your choice.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </div>
  );
}
