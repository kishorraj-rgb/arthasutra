"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  formatCurrency,
  getCurrentFinancialYear,
  getFinancialYearDates,
} from "@/lib/utils";
import {
  Calculator,
  Receipt,
  Home,
  FileText,
  CheckCircle,
  AlertTriangle,
  IndianRupee,
  ArrowRight,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Tax Calculation Helpers
// ---------------------------------------------------------------------------

interface SlabBreakdown {
  slab: string;
  rate: number;
  taxableAmount: number;
  tax: number;
}

function calculateNewRegimeTax(taxableIncome: number): {
  slabs: SlabBreakdown[];
  baseTax: number;
  rebate: number;
  taxAfterRebate: number;
  surcharge: number;
  cess: number;
  totalTax: number;
} {
  const slabs: SlabBreakdown[] = [];
  let remaining = taxableIncome;

  const brackets: [number, number, string][] = [
    [300000, 0, "0 - 3,00,000"],
    [400000, 5, "3,00,001 - 7,00,000"],
    [300000, 10, "7,00,001 - 10,00,000"],
    [200000, 15, "10,00,001 - 12,00,000"],
    [300000, 20, "12,00,001 - 15,00,000"],
    [Infinity, 30, "Above 15,00,000"],
  ];

  for (const [width, rate, label] of brackets) {
    const taxableAmount = Math.min(Math.max(remaining, 0), width);
    const tax = Math.round(taxableAmount * (rate / 100));
    slabs.push({ slab: label, rate, taxableAmount, tax });
    remaining -= width;
    if (remaining <= 0) break;
  }

  const baseTax = slabs.reduce((s, b) => s + b.tax, 0);

  // Rebate u/s 87A: up to 25,000 if total income <= 7,00,000 (new regime)
  let rebate = 0;
  if (taxableIncome <= 700000) {
    rebate = Math.min(baseTax, 25000);
  }

  const taxAfterRebate = baseTax - rebate;

  // Surcharge on income (new regime has marginal relief but simplified here)
  let surchargeRate = 0;
  if (taxableIncome > 50000000) surchargeRate = 0.25; // 25% cap for new regime
  else if (taxableIncome > 20000000) surchargeRate = 0.25;
  else if (taxableIncome > 10000000) surchargeRate = 0.15;
  else if (taxableIncome > 5000000) surchargeRate = 0.10;
  const surcharge = Math.round(taxAfterRebate * surchargeRate);

  const cess = Math.round((taxAfterRebate + surcharge) * 0.04);
  const totalTax = taxAfterRebate + surcharge + cess;

  return { slabs, baseTax, rebate, taxAfterRebate, surcharge, cess, totalTax };
}

function calculateOldRegimeTax(taxableIncome: number): {
  slabs: SlabBreakdown[];
  baseTax: number;
  rebate: number;
  taxAfterRebate: number;
  surcharge: number;
  cess: number;
  totalTax: number;
} {
  const slabs: SlabBreakdown[] = [];
  let remaining = taxableIncome;

  const brackets: [number, number, string][] = [
    [250000, 0, "0 - 2,50,000"],
    [250000, 5, "2,50,001 - 5,00,000"],
    [500000, 20, "5,00,001 - 10,00,000"],
    [Infinity, 30, "Above 10,00,000"],
  ];

  for (const [width, rate, label] of brackets) {
    const taxableAmount = Math.min(Math.max(remaining, 0), width);
    const tax = Math.round(taxableAmount * (rate / 100));
    slabs.push({ slab: label, rate, taxableAmount, tax });
    remaining -= width;
    if (remaining <= 0) break;
  }

  const baseTax = slabs.reduce((s, b) => s + b.tax, 0);

  // Rebate u/s 87A: up to 12,500 if total income <= 5,00,000 (old regime)
  let rebate = 0;
  if (taxableIncome <= 500000) {
    rebate = Math.min(baseTax, 12500);
  }

  const taxAfterRebate = baseTax - rebate;

  // Surcharge (old regime rates)
  let surchargeRate = 0;
  if (taxableIncome > 50000000) surchargeRate = 0.37;
  else if (taxableIncome > 20000000) surchargeRate = 0.25;
  else if (taxableIncome > 10000000) surchargeRate = 0.15;
  else if (taxableIncome > 5000000) surchargeRate = 0.10;
  const surcharge = Math.round(taxAfterRebate * surchargeRate);

  const cess = Math.round((taxAfterRebate + surcharge) * 0.04);
  const totalTax = taxAfterRebate + surcharge + cess;

  return { slabs, baseTax, rebate, taxAfterRebate, surcharge, cess, totalTax };
}

// ---------------------------------------------------------------------------
// FY month helpers: Apr(index 0) = calendar month 3, ..., Mar(index 11) = calendar month 2
// ---------------------------------------------------------------------------

const FY_MONTHS = [
  { label: "Apr", calMonth: 3 },
  { label: "May", calMonth: 4 },
  { label: "Jun", calMonth: 5 },
  { label: "Jul", calMonth: 6 },
  { label: "Aug", calMonth: 7 },
  { label: "Sep", calMonth: 8 },
  { label: "Oct", calMonth: 9 },
  { label: "Nov", calMonth: 10 },
  { label: "Dec", calMonth: 11 },
  { label: "Jan", calMonth: 0 },
  { label: "Feb", calMonth: 1 },
  { label: "Mar", calMonth: 2 },
];


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TaxPage() {
  const { user } = useAuth();
  const currentFY = getCurrentFinancialYear();

  // Available FYs: current + 2 previous
  const availableFYs = useMemo(() => {
    const [yearStr] = currentFY.split("-");
    const year = parseInt(yearStr);
    return [
      `${year}-${String(year + 1).slice(-2)}`,
      `${year - 1}-${String(year).slice(-2)}`,
      `${year - 2}-${String(year - 1).slice(-2)}`,
    ];
  }, [currentFY]);

  const [selectedFY, setSelectedFY] = useState(currentFY);
  const fy = selectedFY;
  const [startYearStr] = fy.split("-");
  const startYear = parseInt(startYearStr);
  const ayYear = `${startYear + 1}-${String(startYear + 2).slice(-2)}`;

  // Regime choice shared across tabs
  const [selectedRegime, setSelectedRegime] = useState<"new" | "old">("new");

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-text-primary">
            Tax Planning & Compliance
          </h1>
          <p className="text-text-secondary mt-1">
            FY {fy} (AY {ayYear}) &mdash; Comprehensive tax management
          </p>
        </div>

        {/* Sticky tab bar with FY selector */}
        <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-[#F5F6FA]/95 backdrop-blur-sm border-b border-border-light">
          <div className="flex items-center justify-between gap-4 max-w-7xl">
            {/* FY Selector */}
            <div className="flex gap-1.5 shrink-0">
              {availableFYs.map((f) => (
                <button
                  key={f}
                  onClick={() => setSelectedFY(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedFY === f
                      ? "text-white shadow-sm"
                      : "border border-border-light bg-surface text-text-secondary hover:border-border"
                  }`}
                  style={selectedFY === f ? { backgroundColor: "#6366f1" } : undefined}
                >
                  FY {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Tabs defaultValue="calculator" className="space-y-4">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="calculator" className="gap-2">
              <Calculator className="h-4 w-4" />
              Income Tax Calculator
            </TabsTrigger>
            <TabsTrigger value="advance" className="gap-2">
              <IndianRupee className="h-4 w-4" />
              Advance Tax
            </TabsTrigger>
            <TabsTrigger value="gst" className="gap-2">
              <Receipt className="h-4 w-4" />
              GST Tracker
            </TabsTrigger>
            <TabsTrigger value="hra" className="gap-2">
              <Home className="h-4 w-4" />
              HRA Calculator
            </TabsTrigger>
            <TabsTrigger value="tds" className="gap-2">
              <FileText className="h-4 w-4" />
              TDS Reconciliation
            </TabsTrigger>
          </TabsList>

          {/* ================================================================
              TAB 1 - Income Tax Calculator
          ================================================================ */}
          <TabsContent value="calculator">
            {user ? <IncomeTaxCalculator userId={user.userId} fy={fy} onRegimeChange={setSelectedRegime} /> : null}
          </TabsContent>

          {/* ================================================================
              TAB 2 - Advance Tax Planner
          ================================================================ */}
          <TabsContent value="advance">
            {user ? <AdvanceTaxPlanner userId={user.userId} fy={fy} selectedRegime={selectedRegime} onRegimeChange={setSelectedRegime} /> : null}
          </TabsContent>

          {/* ================================================================
              TAB 3 - GST Calculator & Tracker
          ================================================================ */}
          <TabsContent value="gst">
            {user ? <GSTTracker userId={user.userId} fy={fy} /> : null}
          </TabsContent>

          {/* ================================================================
              TAB 4 - HRA Calculator
          ================================================================ */}
          <TabsContent value="hra">
            <HRACalculator monthlySalary={user?.monthly_salary} />
          </TabsContent>

          {/* ================================================================
              TAB 5 - TDS Reconciliation
          ================================================================ */}
          <TabsContent value="tds">
            {user ? <TDSReconciliation userId={user.userId} fy={fy} /> : null}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// ===========================================================================
// TAB 1 : Income Tax Calculator
// ===========================================================================

function IncomeTaxCalculator({
  userId,
  fy,
  onRegimeChange,
}: {
  userId: Id<"users">;
  fy: string;
  onRegimeChange?: (regime: "old" | "new") => void;
}) {
  const { start: fyStart, end: fyEnd } = getFinancialYearDates(fy);

  // Fetch real data
  const incomeEntries = useQuery(api.income.getAnnualIncome, {
    userId,
    financialYear: fy,
  });
  const investments = useQuery(api.investments.getInvestments, { userId });
  const insurancePolicies = useQuery(api.insurance.getInsurancePolicies, {
    userId,
  });
  const loans = useQuery(api.loans.getLoans, { userId });

  // Compute auto-fill values from real data
  const autoValues = useMemo(() => {
    const totalIncome =
      incomeEntries?.reduce((sum, e) => sum + e.amount, 0) ?? 0;

    const sec80C = Math.min(
      (investments ?? [])
        .filter((i) => i.section === "80C")
        .reduce((sum, i) => sum + i.invested_amount, 0),
      150000
    );

    const healthPolicies = (insurancePolicies ?? []).filter(
      (p) => p.type === "health"
    );
    // Simplified: total health premiums capped at 25k self + 25k parents = 50k total
    const totalHealthPremium = healthPolicies.reduce(
      (sum, p) => sum + p.annual_premium,
      0
    );
    const sec80D_self = Math.min(totalHealthPremium, 25000);
    const sec80D_parents = Math.min(
      Math.max(totalHealthPremium - 25000, 0),
      25000
    );

    const sec80CCD1B = Math.min(
      (investments ?? [])
        .filter((i) => i.section === "80CCD")
        .reduce((sum, i) => sum + i.invested_amount, 0),
      50000
    );

    const homeLoans = (loans ?? []).filter((l) => l.type === "home");
    const annualHomeLoanInterest = homeLoans.reduce(
      (sum, l) => sum + Math.round((l.outstanding * l.interest_rate) / 100),
      0
    );
    const homeLoanInterest = Math.min(annualHomeLoanInterest, 200000);

    return {
      totalIncome,
      sec80C,
      sec80D_self,
      sec80D_parents,
      sec80CCD1B,
      homeLoanInterest,
    };
  }, [incomeEntries, investments, insurancePolicies, loans]);

  // Income sources — selectable by type + subcategory
  const [incomeSources, setIncomeSources] = useState<Array<{ type: string; subcat: string }>>([
    { type: "salary", subcat: "" },
    { type: "freelance", subcat: "" },
  ]);

  // Fetch invoices for GST cross-reference
  const allInvoices = useQuery(api.invoices.getInvoices, { userId });

  // Compute income breakdown by type — GST comes ONLY from invoices
  const incomeByType = useMemo(() => {
    const map: Record<string, {
      total: number; gstCollected: number; netOfGst: number;
      count: number; subcats: Record<string, number>;
      subcatGst: Record<string, number>;
    }> = {};

    // Build a lookup: incomeEntryId → invoice GST amount
    const incomeToInvoiceGst: Record<string, number> = {};
    if (allInvoices) {
      for (const inv of allInvoices) {
        if (inv.status === "cancelled" || !inv.linkedIncomeId) continue;
        if (inv.gstTotal > 0) {
          // Sum in case multiple invoices link to same income entry
          incomeToInvoiceGst[inv.linkedIncomeId] =
            (incomeToInvoiceGst[inv.linkedIncomeId] || 0) + inv.gstTotal;
        }
      }
    }

    for (const e of (incomeEntries ?? [])) {
      if (e.date < fyStart || e.date > fyEnd) continue;
      const t = e.type || "other";
      if (!map[t]) map[t] = { total: 0, gstCollected: 0, netOfGst: 0, count: 0, subcats: {}, subcatGst: {} };
      map[t].total += e.amount;
      // GST only from linked invoices, NOT from income entry's gst_collected
      const invoiceGst = incomeToInvoiceGst[(e as any)._id] || 0;
      map[t].gstCollected += invoiceGst;
      map[t].count++;
      const sub = (e as Record<string, unknown>).subcategory as string || "";
      if (sub) {
        map[t].subcats[sub] = (map[t].subcats[sub] || 0) + e.amount;
        map[t].subcatGst[sub] = (map[t].subcatGst[sub] || 0) + invoiceGst;
      }
    }

    // Also account for invoices in the FY that are NOT linked to any income entry
    // (e.g. unpaid invoices with GST — still count for GST exclusion)
    if (allInvoices) {
      for (const inv of allInvoices) {
        if (inv.status === "cancelled" || inv.linkedIncomeId) continue; // skip linked ones (already counted)
        if (inv.gstTotal > 0 && inv.invoiceDate >= fyStart && inv.invoiceDate <= fyEnd) {
          // These are unlinked invoices — attribute GST to "freelance" by default
          const t = "freelance";
          if (!map[t]) map[t] = { total: 0, gstCollected: 0, netOfGst: 0, count: 0, subcats: {}, subcatGst: {} };
          map[t].gstCollected += inv.gstTotal;
        }
      }
    }

    // Calculate net of GST for each type
    for (const [, data] of Object.entries(map)) {
      data.netOfGst = data.total - data.gstCollected;
    }

    return map;
  }, [incomeEntries, allInvoices, fyStart, fyEnd]);

  const INCOME_TYPE_OPTIONS = [
    { value: "salary", label: "Salary" },
    { value: "freelance", label: "Freelance/Consulting" },
    { value: "rental", label: "Rental Income" },
    { value: "interest", label: "Interest" },
    { value: "dividend", label: "Dividend" },
    { value: "other", label: "Other" },
  ];

  const [excludeGst, setExcludeGst] = useState(true); // Default: exclude GST from taxable income

  // Calculate gross income from selected sources
  const { selectedGrossIncome, totalGstInIncome } = useMemo(() => {
    let total = 0;
    let gst = 0;
    for (const src of incomeSources) {
      const typeData = incomeByType[src.type];
      if (!typeData) continue;
      if (src.subcat) {
        total += typeData.subcats[src.subcat] || 0;
        gst += typeData.subcatGst[src.subcat] || 0;
      } else {
        total += typeData.total;
        gst += typeData.gstCollected;
      }
    }
    return {
      selectedGrossIncome: excludeGst ? total - gst : total,
      totalGstInIncome: gst,
    };
  }, [incomeSources, incomeByType, excludeGst]);

  // Editable state - seeded from autoValues
  const [grossIncome, setGrossIncome] = useState(0);
  const [hraClaimed, setHraClaimed] = useState(0);
  const [sec80C, setSec80C] = useState(0);
  const [sec80D_self, setSec80D_self] = useState(0);
  const [sec80D_parents, setSec80D_parents] = useState(0);
  const [sec80CCD1B, setSec80CCD1B] = useState(0);
  const [homeLoanInterest, setHomeLoanInterest] = useState(0);
  const [otherDeductions, setOtherDeductions] = useState(0);
  const [seeded, setSeeded] = useState(false);

  // Seed once when data arrives
  useEffect(() => {
    if (!seeded && incomeEntries !== undefined) {
      setSec80C(autoValues.sec80C);
      setSec80D_self(autoValues.sec80D_self);
      setSec80D_parents(autoValues.sec80D_parents);
      setSec80CCD1B(autoValues.sec80CCD1B);
      setHomeLoanInterest(autoValues.homeLoanInterest);
      setSeeded(true);
    }
  }, [seeded, incomeEntries, autoValues]);

  // Update grossIncome when income sources change
  useEffect(() => {
    if (selectedGrossIncome > 0) {
      setGrossIncome(selectedGrossIncome);
    }
  }, [selectedGrossIncome]);

  const taxComparison = useMemo(() => {
    // --- New Regime ---
    const newStdDeduction = 75000;
    const newTaxableIncome = Math.max(grossIncome - newStdDeduction, 0);
    const newResult = calculateNewRegimeTax(newTaxableIncome);

    // --- Old Regime ---
    const oldStdDeduction = 50000;
    const capped80C = Math.min(sec80C, 150000);
    const capped80D = Math.min(sec80D_self, 25000) + Math.min(sec80D_parents, 25000);
    const capped80CCD1B = Math.min(sec80CCD1B, 50000);
    const cappedHomeLoan = Math.min(homeLoanInterest, 200000);

    const totalOldDeductions =
      oldStdDeduction +
      hraClaimed +
      capped80C +
      capped80D +
      capped80CCD1B +
      cappedHomeLoan +
      otherDeductions;

    const oldTaxableIncome = Math.max(grossIncome - totalOldDeductions, 0);
    const oldResult = calculateOldRegimeTax(oldTaxableIncome);

    const savings = newResult.totalTax - oldResult.totalTax; // positive = old is cheaper

    return {
      newStdDeduction,
      newTaxableIncome,
      newResult,
      oldStdDeduction,
      totalOldDeductions,
      oldTaxableIncome,
      oldResult,
      savings,
    };
  }, [
    grossIncome,
    hraClaimed,
    sec80C,
    sec80D_self,
    sec80D_parents,
    sec80CCD1B,
    homeLoanInterest,
    otherDeductions,
  ]);

  const {
    newStdDeduction,
    newTaxableIncome,
    newResult,
    totalOldDeductions,
    oldTaxableIncome,
    oldResult,
    savings,
  } = taxComparison;

  // Sync recommended regime to parent
  useEffect(() => {
    if (!onRegimeChange) return;
    onRegimeChange(savings > 0 ? "old" : "new");
  }, [onRegimeChange, savings]);

  const newEffective =
    grossIncome > 0 ? ((newResult.totalTax / grossIncome) * 100).toFixed(2) : "0.00";
  const oldEffective =
    grossIncome > 0 ? ((oldResult.totalTax / grossIncome) * 100).toFixed(2) : "0.00";

  if (incomeEntries === undefined) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-text-secondary">
          Loading tax data...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Recommendation Box */}
      <Card className="border-accent/20 bg-accent/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <Calculator className="h-6 w-6 text-accent-light" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-lg font-semibold text-accent-light">
                {savings > 0
                  ? "Old Regime Saves You More!"
                  : savings < 0
                  ? "New Regime Saves You More!"
                  : "Both Regimes Are Equal"}
              </h3>
              <p className="text-text-secondary text-sm mt-1">
                {savings !== 0 ? (
                  <>
                    You save{" "}
                    <span className="text-accent-light font-semibold">
                      {formatCurrency(Math.abs(savings))}
                    </span>{" "}
                    by choosing the{" "}
                    <span className="text-accent-light font-semibold">
                      {savings > 0 ? "Old" : "New"} Regime
                    </span>
                    . Effective tax rate:{" "}
                    {savings > 0 ? oldEffective : newEffective}% vs{" "}
                    {savings > 0 ? newEffective : oldEffective}%.
                  </>
                ) : (
                  "Tax liability is the same under both regimes."
                )}
              </p>
            </div>
            <Badge variant="default" className="text-base px-4 py-2">
              Save {formatCurrency(Math.abs(savings))}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Input Form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-accent-light" />
              Income & Deductions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Income Sources Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Income Sources</Label>
                {incomeSources.length < 10 && (
                  <button
                    onClick={() => setIncomeSources([...incomeSources, { type: "other", subcat: "" }])}
                    className="text-xs text-accent-light hover:underline"
                  >
                    + Add Source
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {incomeSources.map((src, idx) => {
                  const typeData = incomeByType[src.type];
                  const subcats = typeData ? Object.keys(typeData.subcats) : [];
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-text-tertiary w-4">{idx + 1}.</span>
                      <select
                        value={src.type}
                        onChange={(e) => {
                          const updated = [...incomeSources];
                          updated[idx] = { type: e.target.value, subcat: "" };
                          setIncomeSources(updated);
                        }}
                        className="flex-1 text-xs rounded-lg border border-gray-200 px-2 py-1.5 bg-white focus:border-accent focus:outline-none cursor-pointer"
                      >
                        {INCOME_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label} {incomeByType[opt.value] ? `(${formatCurrency(incomeByType[opt.value].total)})` : ""}
                          </option>
                        ))}
                      </select>
                      {subcats.length > 0 && (
                        <select
                          value={src.subcat}
                          onChange={(e) => {
                            const updated = [...incomeSources];
                            updated[idx] = { ...updated[idx], subcat: e.target.value };
                            setIncomeSources(updated);
                          }}
                          className="flex-1 text-xs rounded-lg border border-dashed border-gray-200 px-2 py-1.5 bg-gray-50 focus:border-accent focus:outline-none cursor-pointer"
                        >
                          <option value="">All subcategories</option>
                          {subcats.map((sub) => (
                            <option key={sub} value={sub}>
                              {sub} ({formatCurrency(typeData!.subcats[sub])})
                            </option>
                          ))}
                        </select>
                      )}
                      <span className="text-xs text-text-tertiary stat-number w-20 text-right">
                        {typeData ? formatCurrency(src.subcat ? (typeData.subcats[src.subcat] || 0) : typeData.total) : "₹0"}
                      </span>
                      {incomeSources.length > 1 && (
                        <button
                          onClick={() => setIncomeSources(incomeSources.filter((_, i) => i !== idx))}
                          className="text-text-tertiary hover:text-rose-500 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* GST Exclusion */}
              {totalGstInIncome > 0 && (
                <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={excludeGst}
                      onChange={(e) => setExcludeGst(e.target.checked)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-400/20"
                      id="exclude-gst"
                    />
                    <label htmlFor="exclude-gst" className="text-xs font-medium text-purple-700 cursor-pointer">
                      Exclude GST from taxable income
                    </label>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-purple-500">GST collected (pass-through to govt)</span>
                    <span className="text-purple-700 stat-number font-medium">{formatCurrency(totalGstInIncome)}</span>
                  </div>
                  {allInvoices && allInvoices.filter((i: any) => i.status === "paid" && i.gstTotal > 0).length > 0 && (
                    <p className="text-[10px] text-purple-400">
                      Cross-verified with {allInvoices.filter((i: any) => i.status === "paid" && i.gstTotal > 0).length} paid invoices
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-xs font-semibold text-text-primary">Gross Taxable Income</span>
                <span className="text-sm font-bold text-accent-light stat-number">{formatCurrency(grossIncome)}</span>
              </div>
              <Input
                type="number"
                value={grossIncome}
                onChange={(e) => setGrossIncome(Number(e.target.value) || 0)}
                className="text-xs"
                placeholder="Override manually if needed"
              />
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs text-accent-light/70 uppercase tracking-wider font-semibold mb-3">
                Old Regime Deductions
              </p>
            </div>

            <div className="space-y-2">
              <Label>HRA Exemption Claimed</Label>
              <Input
                type="number"
                value={hraClaimed}
                onChange={(e) => setHraClaimed(Number(e.target.value) || 0)}
                placeholder="0"
              />
              <p className="text-xs text-text-tertiary">Use HRA tab to calculate</p>
            </div>

            <div className="space-y-2">
              <Label>Sec 80C (PPF, ELSS, LIC, etc.)</Label>
              <Input
                type="number"
                value={sec80C}
                onChange={(e) => setSec80C(Number(e.target.value) || 0)}
                placeholder="Max 1,50,000"
              />
              <p className="text-xs text-text-tertiary">
                Max {formatCurrency(150000)}
                {autoValues.sec80C > 0 &&
                  ` | Auto: ${formatCurrency(autoValues.sec80C)} from investments`}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Sec 80D - Self & Family</Label>
              <Input
                type="number"
                value={sec80D_self}
                onChange={(e) => setSec80D_self(Number(e.target.value) || 0)}
                placeholder="Max 25,000"
              />
            </div>

            <div className="space-y-2">
              <Label>Sec 80D - Parents</Label>
              <Input
                type="number"
                value={sec80D_parents}
                onChange={(e) => setSec80D_parents(Number(e.target.value) || 0)}
                placeholder="Max 25,000"
              />
            </div>

            <div className="space-y-2">
              <Label>Sec 80CCD(1B) - NPS</Label>
              <Input
                type="number"
                value={sec80CCD1B}
                onChange={(e) => setSec80CCD1B(Number(e.target.value) || 0)}
                placeholder="Max 50,000"
              />
              <p className="text-xs text-text-tertiary">
                Max {formatCurrency(50000)}
                {autoValues.sec80CCD1B > 0 &&
                  ` | Auto: ${formatCurrency(autoValues.sec80CCD1B)} from NPS`}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Home Loan Interest - Sec 24(b)</Label>
              <Input
                type="number"
                value={homeLoanInterest}
                onChange={(e) => setHomeLoanInterest(Number(e.target.value) || 0)}
                placeholder="Max 2,00,000"
              />
              <p className="text-xs text-text-tertiary">
                Max {formatCurrency(200000)}
                {autoValues.homeLoanInterest > 0 &&
                  ` | Auto: ${formatCurrency(autoValues.homeLoanInterest)} estimated from loans`}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Other Deductions</Label>
              <Input
                type="number"
                value={otherDeductions}
                onChange={(e) => setOtherDeductions(Number(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
          </CardContent>
        </Card>

        {/* Right: Side-by-Side Comparison */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* New Regime */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-emerald-400">New Regime</CardTitle>
                  <Badge variant={savings <= 0 ? "success" : "secondary"}>
                    {savings <= 0 ? "Recommended" : ""}
                  </Badge>
                </div>
                <p className="text-xs text-text-tertiary">FY {fy} slabs</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-text-secondary">
                    <span>Gross Income</span>
                    <span className="text-text-primary">{formatCurrency(grossIncome)}</span>
                  </div>
                  <div className="flex justify-between text-text-secondary">
                    <span>Standard Deduction</span>
                    <span className="text-text-primary">
                      - {formatCurrency(newStdDeduction)}
                    </span>
                  </div>
                  <div className="flex justify-between text-text-primary font-semibold border-t border-border pt-1">
                    <span>Taxable Income</span>
                    <span>{formatCurrency(newTaxableIncome)}</span>
                  </div>
                </div>

                {/* Slab breakdown */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-surface-tertiary">
                        <th className="text-left p-2 text-text-secondary font-medium">Slab</th>
                        <th className="text-right p-2 text-text-secondary font-medium">Rate</th>
                        <th className="text-right p-2 text-text-secondary font-medium">Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newResult.slabs.map((s, i) => (
                        <tr key={i} className="border-t border-border-light">
                          <td className="p-2 text-text-secondary">{s.slab}</td>
                          <td className="p-2 text-right text-text-secondary">{s.rate}%</td>
                          <td className="p-2 text-right text-text-primary font-mono">
                            {formatCurrency(s.tax)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-text-secondary">
                    <span>Tax on Income</span>
                    <span className="text-text-primary">{formatCurrency(newResult.baseTax)}</span>
                  </div>
                  {newResult.rebate > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Less: Rebate u/s 87A</span>
                      <span>- {formatCurrency(newResult.rebate)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-text-secondary">
                    <span>Tax after Rebate</span>
                    <span className="text-text-primary">
                      {formatCurrency(newResult.taxAfterRebate)}
                    </span>
                  </div>
                  {newResult.surcharge > 0 && (
                    <div className="flex justify-between text-text-secondary">
                      <span>Surcharge</span>
                      <span className="text-text-primary">
                        {formatCurrency(newResult.surcharge)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-text-secondary">
                    <span>Health & Education Cess (4%)</span>
                    <span className="text-text-primary">{formatCurrency(newResult.cess)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t border-border pt-2 mt-2">
                    <span className="text-text-primary">Total Tax</span>
                    <span className="text-emerald-400">
                      {formatCurrency(newResult.totalTax)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-text-tertiary">
                    <span>Effective Rate</span>
                    <span>{newEffective}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Old Regime */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-blue-400">Old Regime</CardTitle>
                  <Badge variant={savings > 0 ? "success" : "secondary"}>
                    {savings > 0 ? "Recommended" : ""}
                  </Badge>
                </div>
                <p className="text-xs text-text-tertiary">With deductions</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-text-secondary">
                    <span>Gross Income</span>
                    <span className="text-text-primary">{formatCurrency(grossIncome)}</span>
                  </div>
                  <div className="flex justify-between text-text-secondary">
                    <span>Total Deductions</span>
                    <span className="text-text-primary">
                      - {formatCurrency(totalOldDeductions)}
                    </span>
                  </div>
                  <div className="flex justify-between text-text-primary font-semibold border-t border-border pt-1">
                    <span>Taxable Income</span>
                    <span>{formatCurrency(oldTaxableIncome)}</span>
                  </div>
                </div>

                {/* Slab breakdown */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-surface-tertiary">
                        <th className="text-left p-2 text-text-secondary font-medium">Slab</th>
                        <th className="text-right p-2 text-text-secondary font-medium">Rate</th>
                        <th className="text-right p-2 text-text-secondary font-medium">Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {oldResult.slabs.map((s, i) => (
                        <tr key={i} className="border-t border-border-light">
                          <td className="p-2 text-text-secondary">{s.slab}</td>
                          <td className="p-2 text-right text-text-secondary">{s.rate}%</td>
                          <td className="p-2 text-right text-text-primary font-mono">
                            {formatCurrency(s.tax)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-text-secondary">
                    <span>Tax on Income</span>
                    <span className="text-text-primary">{formatCurrency(oldResult.baseTax)}</span>
                  </div>
                  {oldResult.rebate > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Less: Rebate u/s 87A</span>
                      <span>- {formatCurrency(oldResult.rebate)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-text-secondary">
                    <span>Tax after Rebate</span>
                    <span className="text-text-primary">
                      {formatCurrency(oldResult.taxAfterRebate)}
                    </span>
                  </div>
                  {oldResult.surcharge > 0 && (
                    <div className="flex justify-between text-text-secondary">
                      <span>Surcharge</span>
                      <span className="text-text-primary">
                        {formatCurrency(oldResult.surcharge)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-text-secondary">
                    <span>Health & Education Cess (4%)</span>
                    <span className="text-text-primary">{formatCurrency(oldResult.cess)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t border-border pt-2 mt-2">
                    <span className="text-text-primary">Total Tax</span>
                    <span className="text-blue-400">
                      {formatCurrency(oldResult.totalTax)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-text-tertiary">
                    <span>Effective Rate</span>
                    <span>{oldEffective}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Deduction Summary for Old Regime */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Old Regime - Deduction Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {[
                  { label: "Standard Deduction", value: 50000, max: 50000 },
                  { label: "HRA Exemption", value: hraClaimed, max: null },
                  { label: "Sec 80C", value: Math.min(sec80C, 150000), max: 150000 },
                  {
                    label: "Sec 80D",
                    value: Math.min(sec80D_self, 25000) + Math.min(sec80D_parents, 25000),
                    max: 50000,
                  },
                  { label: "80CCD(1B) NPS", value: Math.min(sec80CCD1B, 50000), max: 50000 },
                  {
                    label: "Home Loan 24(b)",
                    value: Math.min(homeLoanInterest, 200000),
                    max: 200000,
                  },
                  { label: "Other", value: otherDeductions, max: null },
                ].map((d, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-surface-tertiary p-3 border border-border-light"
                  >
                    <p className="text-text-tertiary text-xs">{d.label}</p>
                    <p className="text-text-primary font-semibold font-mono mt-1">
                      {formatCurrency(d.value)}
                    </p>
                    {d.max !== null && (
                      <Progress
                        value={Math.min((d.value / d.max) * 100, 100)}
                        className="mt-2 h-1"
                      />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 2 : Advance Tax Planner (self-contained — computes from real data)
// ===========================================================================

function AdvanceTaxPlanner({
  userId,
  fy,
  selectedRegime,
  onRegimeChange,
}: {
  userId: Id<"users">;
  fy: string;
  selectedRegime: "old" | "new";
  onRegimeChange: (r: "old" | "new") => void;
}) {
  const { start: fyStart, end: fyEnd } = getFinancialYearDates(fy);

  // Fetch all data this tab needs
  const incomeEntries = useQuery(api.income.getAnnualIncome, {
    userId,
    financialYear: fy,
  });
  const allInvoices = useQuery(api.invoices.getInvoices, { userId });
  const advanceTaxPayments = useQuery(api.tax.getAdvanceTaxPayments, {
    userId,
    financial_year: fy,
  });
  const investments = useQuery(api.investments.getInvestments, { userId });
  const insurancePolicies = useQuery(api.insurance.getInsurancePolicies, { userId });
  const loans = useQuery(api.loans.getLoans, { userId });

  const markPaid = useMutation(api.tax.markAdvanceTaxPaid);
  const addPayment = useMutation(api.tax.addAdvanceTaxPayment);

  const [startYearStr] = fy.split("-");
  const startYear = parseInt(startYearStr);

  // ── Compute income from TWO sources: ─────────────────────────────────
  // 1. Salary — from Income Tracker (category = salary)
  // 2. Freelance/Consulting — from INVOICES (paid ones), NOT income tracker
  //    Invoices have proper GST breakdown + TDS breakdown
  const taxComputation = useMemo(() => {
    if (!incomeEntries || !allInvoices) return null;

    // ─── Source 1: Salary from Income Tracker ───
    const fyIncome = incomeEntries.filter(
      (e) => e.date >= fyStart && e.date <= fyEnd
    );
    const salaryIncome = fyIncome
      .filter((e) => e.type === "salary")
      .reduce((s, e) => s + e.amount, 0);
    const salaryTDS = fyIncome
      .filter((e) => e.type === "salary")
      .reduce((s, e) => s + (e.tds_deducted ?? 0), 0);

    // ─── Source 2: Freelance/Consulting from Invoices (paid) ───
    const fyPaidInvoices = allInvoices.filter(
      (inv) =>
        inv.status === "paid" &&
        inv.invoiceDate >= fyStart &&
        inv.invoiceDate <= fyEnd
    );

    const invoiceSubtotal = fyPaidInvoices.reduce((s, inv) => s + inv.subtotal, 0); // taxable value
    const invoiceGstTotal = fyPaidInvoices.reduce((s, inv) => s + inv.gstTotal, 0);
    const invoiceTdsTotal = fyPaidInvoices.reduce((s, inv) => s + (inv.tdsAmount ?? 0), 0);
    const invoiceNetTotal = fyPaidInvoices.reduce((s, inv) => s + inv.netTotal, 0);

    // ─── Combined ───
    // Gross taxable = salary + invoice subtotal (excluding GST)
    // GST is pass-through, NOT income. Invoice subtotal already excludes GST.
    const grossTaxableIncome = salaryIncome + invoiceSubtotal;
    const totalGst = invoiceGstTotal;
    const totalTDS = salaryTDS + invoiceTdsTotal;

    // Deductions for old regime
    const sec80C = Math.min(
      150000,
      (investments ?? [])
        .filter((i) => i.section === "80C")
        .reduce((s, i) => s + i.invested_amount, 0)
    );
    const sec80CCD = Math.min(
      50000,
      (investments ?? [])
        .filter((i) => i.section === "80CCD")
        .reduce((s, i) => s + i.invested_amount, 0)
    );
    const sec80D = Math.min(
      50000,
      (insurancePolicies ?? [])
        .filter((p) => p.type === "health")
        .reduce((s, p) => s + p.annual_premium, 0)
    );
    const homeLoanInterest = Math.min(
      200000,
      (loans ?? [])
        .filter((l) => l.type === "home")
        .reduce((s, l) => s + Math.round((l.outstanding * l.interest_rate) / 100), 0)
    );
    const totalOldDeductions = 50000 + sec80C + sec80CCD + sec80D + homeLoanInterest;

    // New regime: standard deduction 75k, no other deductions
    const newTaxableIncome = Math.max(0, grossTaxableIncome - 75000);
    const newResult = calculateNewRegimeTax(newTaxableIncome);

    // Old regime: with deductions
    const oldTaxableIncome = Math.max(0, grossTaxableIncome - totalOldDeductions);
    const oldResult = calculateOldRegimeTax(oldTaxableIncome);

    return {
      salaryIncome,
      salaryTDS,
      invoiceSubtotal,
      invoiceGstTotal,
      invoiceTdsTotal,
      invoiceNetTotal,
      invoiceCount: fyPaidInvoices.length,
      grossTaxableIncome,
      totalGst,
      totalTDS,
      newTaxableIncome,
      newTax: newResult.totalTax,
      oldTaxableIncome,
      oldTax: oldResult.totalTax,
      totalOldDeductions,
      deductions: { sec80C, sec80CCD, sec80D, homeLoanInterest },
    };
  }, [incomeEntries, allInvoices, investments, insurancePolicies, loans, fyStart, fyEnd]);

  // Selected regime determines the numbers
  const chosenTax = taxComputation
    ? selectedRegime === "new" ? taxComputation.newTax : taxComputation.oldTax
    : 0;
  const chosenTaxableIncome = taxComputation
    ? selectedRegime === "new" ? taxComputation.newTaxableIncome : taxComputation.oldTaxableIncome
    : 0;
  const tdsDeducted = taxComputation?.totalTDS ?? 0;
  const annualTaxLiability = Math.max(0, chosenTax - tdsDeducted);

  // Build quarter data
  const quarters = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const defs = [
      { quarter: "Q1" as const, dueDate: `15 June ${startYear}`, cumulativePercent: 15, percentThisQ: 0.15 },
      { quarter: "Q2" as const, dueDate: `15 September ${startYear}`, cumulativePercent: 45, percentThisQ: 0.30 },
      { quarter: "Q3" as const, dueDate: `15 December ${startYear}`, cumulativePercent: 75, percentThisQ: 0.30 },
      { quarter: "Q4" as const, dueDate: `15 March ${startYear + 1}`, cumulativePercent: 100, percentThisQ: 0.25 },
    ];
    const dueDateMap: Record<string, string> = {
      Q1: `${startYear}-06-15`, Q2: `${startYear}-09-15`,
      Q3: `${startYear}-12-15`, Q4: `${startYear + 1}-03-15`,
    };
    return defs.map((qd) => {
      const payment = (advanceTaxPayments ?? []).find((p) => p.quarter === qd.quarter);
      const amountDue = Math.round(annualTaxLiability * qd.percentThisQ);
      const amountPaid = payment?.amount_paid ?? 0;
      const dueDateISO = dueDateMap[qd.quarter];
      const status: "paid" | "pending" | "overdue" =
        payment?.status === "paid" ? "paid" : today > dueDateISO ? "overdue" : "pending";
      return { ...qd, amountDue, amountPaid, status, paymentId: payment?._id };
    });
  }, [advanceTaxPayments, annualTaxLiability, startYear]);

  const totalPaid = quarters.reduce((s, q) => s + q.amountPaid, 0);

  async function handleMarkPaid(q: (typeof quarters)[number]) {
    const today = new Date().toISOString().slice(0, 10);
    if (q.paymentId) {
      await markPaid({ id: q.paymentId, amount_paid: q.amountDue, paid_date: today });
    } else {
      await addPayment({
        userId, financial_year: fy, quarter: q.quarter, due_date: q.dueDate,
        amount_due: q.amountDue, amount_paid: q.amountDue, paid_date: today, status: "paid",
      });
    }
  }

  if (incomeEntries === undefined || advanceTaxPayments === undefined) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-text-secondary">
          Loading advance tax data...
        </CardContent>
      </Card>
    );
  }

  const tc = taxComputation;

  return (
    <div className="space-y-6">
      {/* Regime Selector + Tax Breakdown */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            {/* Regime Toggle */}
            <div className="space-y-3 lg:min-w-[220px]">
              <p className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Tax Regime</p>
              <div className="flex gap-2">
                <button
                  onClick={() => onRegimeChange("new")}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all border ${
                    selectedRegime === "new"
                      ? "text-white border-transparent shadow-sm"
                      : "border-gray-200 bg-white text-text-secondary hover:border-gray-300"
                  }`}
                  style={selectedRegime === "new" ? { backgroundColor: "#6366f1" } : undefined}
                >
                  New Regime
                </button>
                <button
                  onClick={() => onRegimeChange("old")}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all border ${
                    selectedRegime === "old"
                      ? "text-white border-transparent shadow-sm"
                      : "border-gray-200 bg-white text-text-secondary hover:border-gray-300"
                  }`}
                  style={selectedRegime === "old" ? { backgroundColor: "#6366f1" } : undefined}
                >
                  Old Regime
                </button>
              </div>
              {tc && tc.newTax !== tc.oldTax && (
                <p className="text-xs text-text-tertiary">
                  {tc.newTax < tc.oldTax
                    ? `New regime saves ${formatCurrency(tc.oldTax - tc.newTax)}`
                    : `Old regime saves ${formatCurrency(tc.newTax - tc.oldTax)}`}
                </p>
              )}
            </div>

            {/* Income Breakdown */}
            {tc && (
              <div className="flex-1 space-y-4">
                {/* Income Sources */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg bg-surface-tertiary/50 p-3 border border-border-light">
                    <p className="text-text-tertiary text-xs">Salary Income</p>
                    <p className="font-mono font-semibold text-text-primary">{formatCurrency(tc.salaryIncome)}</p>
                    <p className="text-[10px] text-text-tertiary">From Income Tracker</p>
                  </div>
                  <div className="rounded-lg bg-surface-tertiary/50 p-3 border border-border-light">
                    <p className="text-text-tertiary text-xs">Invoice Revenue</p>
                    <p className="font-mono font-semibold text-text-primary">{formatCurrency(tc.invoiceSubtotal)}</p>
                    <p className="text-[10px] text-text-tertiary">{tc.invoiceCount} paid invoices (excl. GST)</p>
                  </div>
                  <div className="rounded-lg bg-accent/5 p-3 border border-accent/20">
                    <p className="text-text-tertiary text-xs">Gross Taxable Income</p>
                    <p className="font-mono font-bold text-accent-light">{formatCurrency(tc.grossTaxableIncome)}</p>
                  </div>
                </div>
                {/* Tax Computation */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-text-tertiary text-xs">GST (pass-through)</p>
                    <p className="font-mono text-text-tertiary">{formatCurrency(tc.totalGst)}</p>
                    <p className="text-[10px] text-text-tertiary">Excluded from income</p>
                  </div>
                  <div>
                    <p className="text-text-tertiary text-xs">Taxable Income</p>
                    <p className="font-mono font-semibold text-text-primary">{formatCurrency(chosenTaxableIncome)}</p>
                    <p className="text-[10px] text-text-tertiary">
                      {selectedRegime === "new" ? "After ₹75K std deduction" : `After ₹${Math.round(tc.totalOldDeductions / 1000)}K deductions`}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-tertiary text-xs">Tax ({selectedRegime === "new" ? "New" : "Old"})</p>
                    <p className="font-mono font-semibold text-rose-400">{formatCurrency(chosenTax)}</p>
                  </div>
                  <div>
                    <p className="text-text-tertiary text-xs">TDS Deducted</p>
                    <p className="font-mono font-semibold text-emerald-400">-{formatCurrency(tdsDeducted)}</p>
                    <p className="text-[10px] text-text-tertiary">
                      Salary: {formatCurrency(tc.salaryTDS)} + Invoice: {formatCurrency(tc.invoiceTdsTotal)}
                    </p>
                  </div>
                </div>
                {/* Net Result */}
                <div className="rounded-lg bg-surface-tertiary p-3 border border-border">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-text-secondary">Net Advance Tax Payable</p>
                    <p className="font-mono font-bold text-xl text-text-primary">{formatCurrency(annualTaxLiability)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-text-secondary">Annual Tax Liability</p>
            <p className="text-2xl font-bold font-mono text-text-primary mt-1">
              {formatCurrency(annualTaxLiability)}
            </p>
            <p className="text-xs text-text-tertiary mt-1">
              After TDS &amp; GST exclusion ({selectedRegime === "old" ? "Old" : "New"} Regime)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-text-secondary">Total Paid</p>
            <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {formatCurrency(totalPaid)}
            </p>
            <Progress
              value={annualTaxLiability > 0 ? (totalPaid / annualTaxLiability) * 100 : 0}
              className="mt-3"
              indicatorClassName="bg-emerald-500"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-text-secondary">Balance Due</p>
            <p className="text-2xl font-bold font-mono text-amber-400 mt-1">
              {formatCurrency(Math.max(annualTaxLiability - totalPaid, 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quarter Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quarters.map((q, i) => (
          <Card
            key={i}
            className={
              q.status === "overdue"
                ? "border-rose/30"
                : q.status === "paid"
                ? "border-emerald-500/20"
                : ""
            }
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>{q.quarter}</CardTitle>
                <Badge
                  variant={
                    q.status === "paid"
                      ? "success"
                      : q.status === "overdue"
                      ? "destructive"
                      : "warning"
                  }
                >
                  {q.status === "paid" && <CheckCircle className="h-3 w-3 mr-1" />}
                  {q.status === "overdue" && <AlertTriangle className="h-3 w-3 mr-1" />}
                  {q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-text-tertiary">Due: {q.dueDate}</div>
              <div className="text-xs text-text-tertiary">
                Cumulative: {q.cumulativePercent}% of liability
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Amount Due</span>
                  <span className="text-text-primary font-mono">{formatCurrency(q.amountDue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Amount Paid</span>
                  <span className={`font-mono ${q.amountPaid >= q.amountDue ? "text-emerald-400" : "text-amber-400"}`}>
                    {formatCurrency(q.amountPaid)}
                  </span>
                </div>
              </div>
              {q.status !== "paid" && (
                <Button size="sm" className="w-full mt-2" onClick={() => handleMarkPaid(q)}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Mark as Paid
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Interest Warning */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-400">Interest on Late Payment</h4>
              <p className="text-text-secondary text-sm mt-1">
                <strong>Sec 234B:</strong> Interest at 1% per month on shortfall if advance tax paid is less than 90% of assessed tax.
              </p>
              <p className="text-text-secondary text-sm mt-1">
                <strong>Sec 234C:</strong> Interest at 1% per month on deferment of individual quarterly installments.
              </p>
              <p className="text-text-tertiary text-xs mt-2">
                Interest is calculated on simple interest basis from due date to date of payment.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===========================================================================
// TAB 3 : GST Calculator & Tracker
// ===========================================================================

function GSTTracker({
  userId,
  fy,
}: {
  userId: Id<"users">;
  fy: string;
}) {
  // Primary source: Invoices (for Output GST + Revenue)
  const allInvoices = useQuery(api.invoices.getInvoices, { userId });
  const expenseEntries = useQuery(api.expenses.getExpenseEntries, { userId });
  const gstFilings = useQuery(api.tax.getGSTFilings, { userId });
  const markFiled = useMutation(api.tax.markGSTFiled);

  const [startYearStr] = fy.split("-");
  const startYear = parseInt(startYearStr);
  const { start: fyStart, end: fyEnd } = getFinancialYearDates(fy);

  // Filter expenses to FY for Input GST (ITC)
  const fyExpenses = useMemo(() => {
    if (!expenseEntries) return [];
    return expenseEntries.filter((e) => e.date >= fyStart && e.date <= fyEnd);
  }, [expenseEntries, fyStart, fyEnd]);

  // Filter invoices to FY (non-cancelled, non-draft)
  const fyInvoices = useMemo(() => {
    if (!allInvoices) return [];
    return allInvoices.filter(
      (inv) =>
        inv.invoiceDate >= fyStart &&
        inv.invoiceDate <= fyEnd &&
        inv.status !== "cancelled"
    );
  }, [allInvoices, fyStart, fyEnd]);

  // Build monthly GST data from invoices
  const gstData = useMemo(() => {
    const months: {
      month: string;
      monthStr: string;
      revenue: number;
      taxableAmount: number;
      igst: number;
      cgst: number;
      sgst: number;
      totalGst: number;
      inputGST: number;
      netLiability: number;
      invoiceCount: number;
      gstr1Filed: boolean;
      gstr3bFiled: boolean;
      filingId?: Id<"gst_filings">;
    }[] = [];

    for (const fm of FY_MONTHS) {
      const calYear = fm.calMonth >= 3 ? startYear : startYear + 1;
      const monthStr = `${calYear}-${String(fm.calMonth + 1).padStart(2, "0")}`;
      const label = `${fm.label} ${calYear}`;

      // Invoices for this month
      const monthInvoices = fyInvoices.filter((inv) =>
        inv.invoiceDate.startsWith(monthStr)
      );
      const revenue = monthInvoices.reduce((sum, inv) => sum + inv.netTotal, 0);
      const taxableAmount = monthInvoices.reduce((sum, inv) => sum + inv.subtotal, 0);

      // GST breakdown from invoices: determine IGST vs CGST+SGST
      let igst = 0;
      let cgst = 0;
      let sgst = 0;
      for (const inv of monthInvoices) {
        const sellerGstin = (inv.sellerData as Record<string, string>)?.gstin || "";
        const buyerGstin = (inv.buyerData as Record<string, string>)?.gstin || "";
        const buyerAddr = (inv.buyerData as Record<string, string>)?.address || "";

        // Inter-state if: different state codes, or foreign buyer, or no buyer GSTIN
        const sellerState = sellerGstin.substring(0, 2);
        const buyerState = buyerGstin.substring(0, 2);
        const isForeign = ["dubai", "uae", "singapore", "usa", "uk", "london", "australia"].some(
          (f) => buyerAddr.toLowerCase().includes(f)
        );
        const isInterState = isForeign || !buyerGstin || sellerState !== buyerState;

        if (isInterState) {
          igst += inv.gstTotal;
        } else {
          cgst += Math.round(inv.gstTotal / 2);
          sgst += Math.round(inv.gstTotal / 2);
        }
      }

      const totalGst = igst + cgst + sgst;

      // Input GST from expenses
      const monthExpenses = fyExpenses.filter((e) =>
        e.date.startsWith(monthStr)
      );
      const inputGST = monthExpenses.reduce(
        (sum, e) => sum + (e.gst_paid ?? 0),
        0
      );

      const netLiability = Math.max(totalGst - inputGST, 0);

      // Filing status
      const filing = (gstFilings ?? []).find((f) => f.period === label);

      months.push({
        month: label,
        monthStr,
        revenue,
        taxableAmount,
        igst,
        cgst,
        sgst,
        totalGst,
        inputGST,
        netLiability,
        invoiceCount: monthInvoices.length,
        gstr1Filed: filing?.status === "filed",
        gstr3bFiled: filing?.status === "filed",
        filingId: filing?._id,
      });
    }

    return months;
  }, [fyInvoices, fyExpenses, gstFilings, startYear]);

  const totalRevenue = gstData.reduce((s, d) => s + d.revenue, 0);
  const totalTaxable = gstData.reduce((s, d) => s + d.taxableAmount, 0);
  const totalIgst = gstData.reduce((s, d) => s + d.igst, 0);
  const totalCgst = gstData.reduce((s, d) => s + d.cgst, 0);
  const totalSgst = gstData.reduce((s, d) => s + d.sgst, 0);
  const totalOutput = gstData.reduce((s, d) => s + d.totalGst, 0);
  const totalInput = gstData.reduce((s, d) => s + d.inputGST, 0);
  const totalNet = gstData.reduce((s, d) => s + d.netLiability, 0);
  const totalInvoiceCount = gstData.reduce((s, d) => s + d.invoiceCount, 0);

  async function handleMarkFiled(row: (typeof gstData)[number]) {
    const today = new Date().toISOString().slice(0, 10);
    if (row.filingId) {
      await markFiled({
        id: row.filingId,
        filing_date: today,
      });
    }
  }

  if (allInvoices === undefined || expenseEntries === undefined) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-text-secondary">
          Loading GST data...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Source Info */}
      <Card className="border-accent/20 bg-accent/5">
        <CardContent className="p-4 flex items-center gap-3">
          <ArrowRight className="h-4 w-4 text-accent-light shrink-0" />
          <span className="text-text-secondary text-sm">
            GST data sourced from <span className="font-semibold text-accent-light">{totalInvoiceCount} invoices</span> raised in FY {fy}.
            Revenue &amp; Output GST come from your Invoice section.
            {totalInput > 0 && <> Input GST (ITC) from expense entries with GST paid.</>}
          </span>
        </CardContent>
      </Card>

      {/* Threshold Warning */}
      {totalRevenue > 2000000 && (
        <Card className="border-accent/100/20 bg-accent/100/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-amber-400 font-semibold text-sm">
                GST Registration Threshold Exceeded
              </p>
              <p className="text-text-secondary text-xs">
                Your aggregate turnover of {formatCurrency(totalRevenue)} exceeds
                the {formatCurrency(2000000)} threshold. GST registration is
                mandatory.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-text-tertiary uppercase">Taxable Value</p>
            <p className="text-lg font-bold font-mono text-text-primary mt-1">
              {formatCurrency(totalTaxable)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-text-tertiary uppercase">IGST</p>
            <p className="text-lg font-bold font-mono text-blue-400 mt-1">
              {formatCurrency(totalIgst)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-text-tertiary uppercase">CGST</p>
            <p className="text-lg font-bold font-mono text-indigo-400 mt-1">
              {formatCurrency(totalCgst)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-text-tertiary uppercase">SGST</p>
            <p className="text-lg font-bold font-mono text-purple-400 mt-1">
              {formatCurrency(totalSgst)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-text-tertiary uppercase">Total GST</p>
            <p className="text-lg font-bold font-mono text-rose-400 mt-1">
              {formatCurrency(totalOutput)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-text-tertiary uppercase">Input ITC</p>
            <p className="text-lg font-bold font-mono text-emerald-400 mt-1">
              {formatCurrency(totalInput)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-text-tertiary uppercase">Net Liability</p>
            <p className="text-lg font-bold font-mono text-amber-400 mt-1">
              {formatCurrency(totalNet)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Revenue Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-text-secondary">FY Invoice Revenue (incl. GST)</p>
            <p className="text-2xl font-bold font-mono text-text-primary mt-1">
              {formatCurrency(totalRevenue)}
            </p>
            <p className="text-xs text-text-tertiary mt-1">
              From {totalInvoiceCount} invoices
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-text-secondary">FY Revenue (excl. GST)</p>
            <p className="text-2xl font-bold font-mono text-accent-light mt-1">
              {formatCurrency(totalTaxable)}
            </p>
            <p className="text-xs text-text-tertiary mt-1">
              Taxable turnover for IT purposes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filing Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-accent-light" />
            Filing Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="rounded-lg bg-surface-tertiary p-4 border border-border-light flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-text-primary font-semibold text-sm">GSTR-1</p>
                <p className="text-text-tertiary text-xs">
                  Outward supplies &mdash; Due by 11th of next month
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-surface-tertiary p-4 border border-border-light flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <FileText className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-text-primary font-semibold text-sm">GSTR-3B</p>
                <p className="text-text-tertiary text-xs">
                  Summary return &mdash; Due by 20th of next month
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Table */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly GST Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-tertiary">
                  <th className="text-left p-3 text-text-secondary font-medium">Month</th>
                  <th className="text-right p-3 text-text-secondary font-medium">Invoices</th>
                  <th className="text-right p-3 text-text-secondary font-medium">Taxable</th>
                  <th className="text-right p-3 text-text-secondary font-medium">IGST</th>
                  <th className="text-right p-3 text-text-secondary font-medium">CGST</th>
                  <th className="text-right p-3 text-text-secondary font-medium">SGST</th>
                  <th className="text-right p-3 text-text-secondary font-medium">Total GST</th>
                  <th className="text-right p-3 text-text-secondary font-medium">ITC</th>
                  <th className="text-right p-3 text-text-secondary font-medium">Net</th>
                  <th className="text-center p-3 text-text-secondary font-medium">GSTR-1</th>
                  <th className="text-center p-3 text-text-secondary font-medium">3B</th>
                </tr>
              </thead>
              <tbody>
                {gstData.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-t border-border-light ${
                      row.invoiceCount === 0 ? "opacity-40" : ""
                    }`}
                  >
                    <td className="p-3 text-text-primary whitespace-nowrap">{row.month}</td>
                    <td className="p-3 text-right text-text-tertiary font-mono">
                      {row.invoiceCount || "-"}
                    </td>
                    <td className="p-3 text-right text-text-primary font-mono">
                      {row.taxableAmount > 0 ? formatCurrency(row.taxableAmount) : "-"}
                    </td>
                    <td className="p-3 text-right text-blue-400 font-mono">
                      {row.igst > 0 ? formatCurrency(row.igst) : "-"}
                    </td>
                    <td className="p-3 text-right text-indigo-400 font-mono">
                      {row.cgst > 0 ? formatCurrency(row.cgst) : "-"}
                    </td>
                    <td className="p-3 text-right text-purple-400 font-mono">
                      {row.sgst > 0 ? formatCurrency(row.sgst) : "-"}
                    </td>
                    <td className="p-3 text-right text-rose-400 font-mono">
                      {row.totalGst > 0 ? formatCurrency(row.totalGst) : "-"}
                    </td>
                    <td className="p-3 text-right text-emerald-400 font-mono">
                      {row.inputGST > 0 ? formatCurrency(row.inputGST) : "-"}
                    </td>
                    <td className="p-3 text-right text-amber-400 font-mono font-semibold">
                      {row.netLiability > 0 ? formatCurrency(row.netLiability) : "-"}
                    </td>
                    <td className="p-3 text-center">
                      {row.invoiceCount === 0 ? (
                        <span className="text-text-tertiary text-xs">-</span>
                      ) : row.gstr1Filed ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400 mx-auto" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-400 mx-auto" />
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {row.invoiceCount === 0 ? (
                        <span className="text-text-tertiary text-xs">-</span>
                      ) : row.gstr3bFiled ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400 mx-auto" />
                      ) : row.filingId ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => handleMarkFiled(row)}
                        >
                          Filed
                        </Button>
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-400 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-surface-tertiary font-semibold">
                  <td className="p-3 text-text-primary">Total</td>
                  <td className="p-3 text-right text-text-primary font-mono">{totalInvoiceCount}</td>
                  <td className="p-3 text-right text-text-primary font-mono">
                    {formatCurrency(totalTaxable)}
                  </td>
                  <td className="p-3 text-right text-blue-400 font-mono">
                    {formatCurrency(totalIgst)}
                  </td>
                  <td className="p-3 text-right text-indigo-400 font-mono">
                    {formatCurrency(totalCgst)}
                  </td>
                  <td className="p-3 text-right text-purple-400 font-mono">
                    {formatCurrency(totalSgst)}
                  </td>
                  <td className="p-3 text-right text-rose-400 font-mono">
                    {formatCurrency(totalOutput)}
                  </td>
                  <td className="p-3 text-right text-emerald-400 font-mono">
                    {formatCurrency(totalInput)}
                  </td>
                  <td className="p-3 text-right text-amber-400 font-mono">
                    {formatCurrency(totalNet)}
                  </td>
                  <td className="p-3" />
                  <td className="p-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===========================================================================
// TAB 4 : HRA Calculator
// ===========================================================================

function HRACalculator({ monthlySalary }: { monthlySalary?: number }) {
  const [basicSalary, setBasicSalary] = useState(monthlySalary ?? 60000);
  const [hraReceived, setHraReceived] = useState(
    Math.round((monthlySalary ?? 60000) * 0.4)
  );
  const [rentPaid, setRentPaid] = useState(30000);
  const [isMetro, setIsMetro] = useState(true);

  // Update when user profile loads
  useEffect(() => {
    if (monthlySalary && monthlySalary > 0) {
      setBasicSalary(monthlySalary);
      setHraReceived(Math.round(monthlySalary * 0.4));
    }
  }, [monthlySalary]);

  const hraCalc = useMemo(() => {
    const annualBasic = basicSalary * 12;
    const annualHRA = hraReceived * 12;
    const annualRent = rentPaid * 12;

    // Condition 1: Actual HRA received
    const condition1 = annualHRA;

    // Condition 2: 50% (metro) or 40% (non-metro) of Basic
    const condition2 = isMetro
      ? Math.round(annualBasic * 0.5)
      : Math.round(annualBasic * 0.4);

    // Condition 3: Rent paid - 10% of Basic
    const condition3 = Math.max(annualRent - Math.round(annualBasic * 0.1), 0);

    const exempt = Math.min(condition1, condition2, condition3);
    const taxable = annualHRA - exempt;

    // Which condition is minimum
    let minCondition = 1;
    if (exempt === condition2) minCondition = 2;
    if (exempt === condition3) minCondition = 3;

    return {
      annualBasic,
      annualHRA,
      annualRent,
      condition1,
      condition2,
      condition3,
      exempt,
      taxable,
      minCondition,
    };
  }, [basicSalary, hraReceived, rentPaid, isMetro]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5 text-accent-light" />
              HRA Details (Monthly)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Basic Salary (per month)</Label>
              <Input
                type="number"
                value={basicSalary}
                onChange={(e) => setBasicSalary(Number(e.target.value) || 0)}
              />
              {monthlySalary && monthlySalary > 0 && (
                <p className="text-xs text-accent-light/70">
                  Pre-filled from your profile
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>HRA Received (per month)</Label>
              <Input
                type="number"
                value={hraReceived}
                onChange={(e) => setHraReceived(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Rent Paid (per month)</Label>
              <Input
                type="number"
                value={rentPaid}
                onChange={(e) => setRentPaid(Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-tertiary p-4 border border-border-light">
              <div>
                <p className="text-text-primary text-sm font-medium">Metro City</p>
                <p className="text-text-tertiary text-xs">
                  Delhi, Mumbai, Kolkata, Chennai
                </p>
              </div>
              <Switch checked={isMetro} onCheckedChange={setIsMetro} />
            </div>
          </CardContent>
        </Card>

        {/* Result */}
        <Card>
          <CardHeader>
            <CardTitle>HRA Exemption Calculation</CardTitle>
            <p className="text-xs text-text-tertiary">Annual amounts</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Three conditions */}
            <div className="space-y-3">
              {[
                {
                  label: "Actual HRA Received",
                  value: hraCalc.condition1,
                  detail: `${formatCurrency(hraReceived)} x 12`,
                  condNum: 1,
                },
                {
                  label: `${isMetro ? "50%" : "40%"} of Basic Salary`,
                  value: hraCalc.condition2,
                  detail: `${isMetro ? "50%" : "40%"} of ${formatCurrency(hraCalc.annualBasic)}`,
                  condNum: 2,
                },
                {
                  label: "Rent Paid - 10% of Basic",
                  value: hraCalc.condition3,
                  detail: `${formatCurrency(hraCalc.annualRent)} - ${formatCurrency(
                    Math.round(hraCalc.annualBasic * 0.1)
                  )}`,
                  condNum: 3,
                },
              ].map((c) => (
                <div
                  key={c.condNum}
                  className={`rounded-lg p-4 border ${
                    hraCalc.minCondition === c.condNum
                      ? "border-accent/30 bg-accent/10"
                      : "border-border-light bg-surface-tertiary"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-text-secondary">
                        Condition {c.condNum}: {c.label}
                      </p>
                      <p className="text-xs text-text-tertiary mt-0.5">{c.detail}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-text-primary font-mono font-semibold">
                        {formatCurrency(c.value)}
                      </p>
                      {hraCalc.minCondition === c.condNum && (
                        <Badge variant="default" className="mt-1 text-xs">
                          Minimum
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">HRA Exempt</span>
                <span className="text-emerald-400 font-mono font-bold text-lg">
                  {formatCurrency(hraCalc.exempt)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">HRA Taxable</span>
                <span className="text-rose-400 font-mono font-bold text-lg">
                  {formatCurrency(hraCalc.taxable)}
                </span>
              </div>
              <Progress
                value={
                  hraCalc.annualHRA > 0
                    ? (hraCalc.exempt / hraCalc.annualHRA) * 100
                    : 0
                }
                className="h-3 mt-2"
                indicatorClassName="bg-emerald-500"
              />
              <div className="flex justify-between text-xs text-text-tertiary">
                <span>
                  Exempt:{" "}
                  {hraCalc.annualHRA > 0
                    ? ((hraCalc.exempt / hraCalc.annualHRA) * 100).toFixed(1)
                    : 0}
                  %
                </span>
                <span>
                  Taxable:{" "}
                  {hraCalc.annualHRA > 0
                    ? ((hraCalc.taxable / hraCalc.annualHRA) * 100).toFixed(1)
                    : 0}
                  %
                </span>
              </div>
            </div>

            <div className="rounded-lg bg-accent/5 border border-accent/15 p-3 mt-2">
              <p className="text-xs text-accent-light/80">
                <strong>Tip:</strong> You can claim{" "}
                {formatCurrency(hraCalc.exempt)} as HRA exemption in the Income
                Tax Calculator under Old Regime deductions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 5 : TDS Reconciliation
// ===========================================================================

function TDSReconciliation({
  userId,
  fy,
}: {
  userId: Id<"users">;
  fy: string;
}) {
  const incomeEntries = useQuery(api.income.getAnnualIncome, {
    userId,
    financialYear: fy,
  });

  // Build TDS entries from income entries with tds_deducted > 0
  const tdsEntriesRaw = useMemo(() => {
    if (!incomeEntries) return [];
    return incomeEntries
      .filter((e) => (e.tds_deducted ?? 0) > 0)
      .map((e) => ({
        id: e._id,
        source: e.description || "Unknown",
        type: e.type.charAt(0).toUpperCase() + e.type.slice(1),
        amountCredited: e.tds_deducted ?? 0,
        date: e.date,
        incomeAmount: e.amount,
      }));
  }, [incomeEntries]);

  // Group by source (description) and sum TDS
  const groupedTDS = useMemo(() => {
    const map = new Map<
      string,
      {
        source: string;
        type: string;
        totalTDS: number;
        entryCount: number;
      }
    >();

    for (const entry of tdsEntriesRaw) {
      const existing = map.get(entry.source);
      if (existing) {
        existing.totalTDS += entry.amountCredited;
        existing.entryCount += 1;
      } else {
        map.set(entry.source, {
          source: entry.source,
          type: entry.type,
          totalTDS: entry.amountCredited,
          entryCount: 1,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalTDS - a.totalTDS);
  }, [tdsEntriesRaw]);

  // Editable 26AS amounts
  const [amountsIn26AS, setAmountsIn26AS] = useState<Record<string, number>>(
    {}
  );

  // Seed 26AS amounts once data arrives (default to matching)
  useEffect(() => {
    if (groupedTDS.length > 0 && Object.keys(amountsIn26AS).length === 0) {
      const initial: Record<string, number> = {};
      for (const entry of groupedTDS) {
        initial[entry.source] = entry.totalTDS;
      }
      setAmountsIn26AS(initial);
    }
  }, [groupedTDS, amountsIn26AS]);

  const tdsEntries = useMemo(() => {
    return groupedTDS.map((entry) => {
      const in26AS = amountsIn26AS[entry.source] ?? entry.totalTDS;
      return {
        ...entry,
        amountIn26AS: in26AS,
        match: Math.abs(entry.totalTDS - in26AS) < 1,
      };
    });
  }, [groupedTDS, amountsIn26AS]);

  const totalCredited = tdsEntries.reduce((s, e) => s + e.totalTDS, 0);
  const totalIn26AS = tdsEntries.reduce((s, e) => s + e.amountIn26AS, 0);
  const mismatchCount = tdsEntries.filter((e) => !e.match).length;
  const mismatchAmount = tdsEntries
    .filter((e) => !e.match)
    .reduce((s, e) => s + (e.totalTDS - e.amountIn26AS), 0);

  if (incomeEntries === undefined) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-text-secondary">
          Loading TDS data...
        </CardContent>
      </Card>
    );
  }

  if (tdsEntries.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-text-secondary">
          <FileText className="h-10 w-10 text-text-tertiary mx-auto mb-3" />
          <p className="text-lg font-semibold text-text-primary">No TDS Entries</p>
          <p className="text-sm mt-1">
            No income entries with TDS deducted found for FY {fy}. TDS entries
            will appear here once you add income with TDS.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-text-secondary">Total TDS Claimed</p>
            <p className="text-2xl font-bold font-mono text-text-primary mt-1">
              {formatCurrency(totalCredited)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-text-secondary">Total in 26AS/AIS</p>
            <p className="text-2xl font-bold font-mono text-text-primary mt-1">
              {formatCurrency(totalIn26AS)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-text-secondary">Mismatches</p>
            <p className="text-2xl font-bold font-mono text-amber-400 mt-1">
              {mismatchCount}
            </p>
          </CardContent>
        </Card>
        <Card className={mismatchAmount > 0 ? "border-accent/100/20" : ""}>
          <CardContent className="p-6">
            <p className="text-sm text-text-secondary">Difference Amount</p>
            <p className="text-2xl font-bold font-mono text-amber-400 mt-1">
              {formatCurrency(Math.abs(mismatchAmount))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent-light" />
            TDS Entries
          </CardTitle>
          <p className="text-xs text-text-tertiary">
            Edit the &quot;In 26AS&quot; column to match your Form 26AS/AIS
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-tertiary">
                  <th className="text-left p-3 text-text-secondary font-medium">Source</th>
                  <th className="text-left p-3 text-text-secondary font-medium">Type</th>
                  <th className="text-center p-3 text-text-secondary font-medium">Entries</th>
                  <th className="text-right p-3 text-text-secondary font-medium">
                    TDS Credited
                  </th>
                  <th className="text-right p-3 text-text-secondary font-medium">
                    In 26AS
                  </th>
                  <th className="text-center p-3 text-text-secondary font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {tdsEntries.map((entry, i) => (
                  <tr
                    key={i}
                    className={`border-t border-border-light ${
                      !entry.match ? "bg-accent/100/5" : ""
                    }`}
                  >
                    <td className="p-3 text-text-primary">{entry.source}</td>
                    <td className="p-3 text-text-secondary">{entry.type}</td>
                    <td className="p-3 text-center text-text-secondary">
                      {entry.entryCount}
                    </td>
                    <td className="p-3 text-right text-text-primary font-mono">
                      {formatCurrency(entry.totalTDS)}
                    </td>
                    <td className="p-3 text-right">
                      <Input
                        type="number"
                        value={amountsIn26AS[entry.source] ?? entry.totalTDS}
                        onChange={(e) =>
                          setAmountsIn26AS((prev) => ({
                            ...prev,
                            [entry.source]: Number(e.target.value) || 0,
                          }))
                        }
                        className="w-28 ml-auto text-right font-mono h-8 text-sm"
                      />
                    </td>
                    <td className="p-3 text-center">
                      {entry.match ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Match
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Mismatch ({formatCurrency(Math.abs(entry.totalTDS - entry.amountIn26AS))})
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Action Note */}
      {mismatchCount > 0 && (
        <Card className="border-accent/100/20 bg-accent/100/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-400">
                  Action Required: {mismatchCount} TDS Mismatch
                  {mismatchCount > 1 ? "es" : ""}
                </h4>
                <p className="text-text-secondary text-sm mt-1">
                  A total of {formatCurrency(Math.abs(mismatchAmount))} is not
                  reflected in Form 26AS/AIS. Contact the deductor(s) to ensure
                  TDS is deposited with the government and the correct PAN is
                  quoted. You can raise a grievance on the TRACES portal if the
                  issue persists.
                </p>
                <div className="flex gap-3 mt-3">
                  <Button variant="outline" size="sm">
                    <ArrowRight className="h-4 w-4 mr-1" />
                    View on TRACES
                  </Button>
                  <Button variant="ghost" size="sm">
                    Download 26AS
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
