"use client";

import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import {
  Calculator,
  Receipt,
  Home,
  FileText,
  CheckCircle,
  AlertTriangle,
  IndianRupee,
  ArrowRight,
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
// Component
// ---------------------------------------------------------------------------

export default function TaxPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-text-primary">
            Tax Planning & Compliance
          </h1>
          <p className="text-text-secondary mt-1">
            FY 2024-25 (AY 2025-26) &mdash; Comprehensive tax management
          </p>
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
            <IncomeTaxCalculator />
          </TabsContent>

          {/* ================================================================
              TAB 2 - Advance Tax Planner
          ================================================================ */}
          <TabsContent value="advance">
            <AdvanceTaxPlanner />
          </TabsContent>

          {/* ================================================================
              TAB 3 - GST Calculator & Tracker
          ================================================================ */}
          <TabsContent value="gst">
            <GSTTracker />
          </TabsContent>

          {/* ================================================================
              TAB 4 - HRA Calculator
          ================================================================ */}
          <TabsContent value="hra">
            <HRACalculator />
          </TabsContent>

          {/* ================================================================
              TAB 5 - TDS Reconciliation
          ================================================================ */}
          <TabsContent value="tds">
            <TDSReconciliation />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// ===========================================================================
// TAB 1 : Income Tax Calculator
// ===========================================================================

function IncomeTaxCalculator() {
  const [grossIncome, setGrossIncome] = useState(1500000);
  const [hraClaimed, setHraClaimed] = useState(0);
  const [sec80C, setSec80C] = useState(0);
  const [sec80D_self, setSec80D_self] = useState(0);
  const [sec80D_parents, setSec80D_parents] = useState(0);
  const [sec80CCD1B, setSec80CCD1B] = useState(0);
  const [homeLoanInterest, setHomeLoanInterest] = useState(0);
  const [otherDeductions, setOtherDeductions] = useState(0);

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

  const newEffective =
    grossIncome > 0 ? ((newResult.totalTax / grossIncome) * 100).toFixed(2) : "0.00";
  const oldEffective =
    grossIncome > 0 ? ((oldResult.totalTax / grossIncome) * 100).toFixed(2) : "0.00";

  return (
    <div className="space-y-6">
      {/* Recommendation Box */}
      <Card className="border-accent/30 bg-gradient-to-r from-purple-grad-from/10 to-amber-900/10">
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
            <div className="space-y-2">
              <Label>Gross Annual Income</Label>
              <Input
                type="number"
                value={grossIncome}
                onChange={(e) => setGrossIncome(Number(e.target.value) || 0)}
                placeholder="e.g. 1500000"
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
                <p className="text-xs text-text-tertiary">FY 2024-25 slabs</p>
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
// TAB 2 : Advance Tax Planner
// ===========================================================================

function AdvanceTaxPlanner() {
  const annualTaxLiability = 234000;

  const [quarters, setQuarters] = useState([
    {
      quarter: "Q1",
      dueDate: "15 June 2024",
      cumulativePercent: 15,
      amountDue: Math.round(annualTaxLiability * 0.15),
      amountPaid: Math.round(annualTaxLiability * 0.15),
      status: "paid" as "paid" | "pending" | "overdue",
    },
    {
      quarter: "Q2",
      dueDate: "15 September 2024",
      cumulativePercent: 45,
      amountDue: Math.round(annualTaxLiability * 0.3),
      amountPaid: Math.round(annualTaxLiability * 0.3),
      status: "paid" as "paid" | "pending" | "overdue",
    },
    {
      quarter: "Q3",
      dueDate: "15 December 2024",
      cumulativePercent: 75,
      amountDue: Math.round(annualTaxLiability * 0.3),
      amountPaid: 0,
      status: "overdue" as "paid" | "pending" | "overdue",
    },
    {
      quarter: "Q4",
      dueDate: "15 March 2025",
      cumulativePercent: 100,
      amountDue: Math.round(annualTaxLiability * 0.25),
      amountPaid: 0,
      status: "pending" as "paid" | "pending" | "overdue",
    },
  ]);

  const totalPaid = quarters.reduce((s, q) => s + q.amountPaid, 0);
  const totalDue = quarters.reduce((s, q) => s + q.amountDue, 0);

  function markAsPaid(index: number) {
    setQuarters((prev) =>
      prev.map((q, i) =>
        i === index ? { ...q, amountPaid: q.amountDue, status: "paid" as const } : q
      )
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-text-secondary">Annual Tax Liability</p>
            <p className="text-2xl font-bold font-mono text-text-primary mt-1">
              {formatCurrency(annualTaxLiability)}
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
              value={(totalPaid / annualTaxLiability) * 100}
              className="mt-3"
              indicatorClassName="bg-emerald-500"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-text-secondary">Balance Due</p>
            <p className="text-2xl font-bold font-mono text-amber-400 mt-1">
              {formatCurrency(totalDue - totalPaid)}
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
                  {q.status === "paid" && (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  )}
                  {q.status === "overdue" && (
                    <AlertTriangle className="h-3 w-3 mr-1" />
                  )}
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
                  <span className="text-text-primary font-mono">
                    {formatCurrency(q.amountDue)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Amount Paid</span>
                  <span
                    className={`font-mono ${
                      q.amountPaid >= q.amountDue ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {formatCurrency(q.amountPaid)}
                  </span>
                </div>
              </div>

              {q.status !== "paid" && (
                <Button
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => markAsPaid(i)}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Mark as Paid
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Interest Warning */}
      <Card className="border-accent/100/20 bg-accent/100/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-400">
                Interest on Late Payment
              </h4>
              <p className="text-text-secondary text-sm mt-1">
                <strong>Sec 234B:</strong> Interest at 1% per month on shortfall
                if advance tax paid is less than 90% of assessed tax.
              </p>
              <p className="text-text-secondary text-sm mt-1">
                <strong>Sec 234C:</strong> Interest at 1% per month on deferment
                of individual quarterly installments.
              </p>
              <p className="text-text-tertiary text-xs mt-2">
                Interest is calculated on simple interest basis from due date to
                date of payment.
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

function GSTTracker() {
  const [gstRate, setGstRate] = useState(18);

  const gstData = [
    {
      month: "Oct 2024",
      revenue: 850000,
      outputGST: 153000,
      inputGST: 98000,
      netLiability: 55000,
      gstr1Filed: true,
      gstr3bFiled: true,
    },
    {
      month: "Nov 2024",
      revenue: 920000,
      outputGST: 165600,
      inputGST: 112000,
      netLiability: 53600,
      gstr1Filed: true,
      gstr3bFiled: true,
    },
    {
      month: "Dec 2024",
      revenue: 1050000,
      outputGST: 189000,
      inputGST: 125000,
      netLiability: 64000,
      gstr1Filed: true,
      gstr3bFiled: true,
    },
    {
      month: "Jan 2025",
      revenue: 980000,
      outputGST: 176400,
      inputGST: 108000,
      netLiability: 68400,
      gstr1Filed: true,
      gstr3bFiled: false,
    },
    {
      month: "Feb 2025",
      revenue: 1100000,
      outputGST: 198000,
      inputGST: 132000,
      netLiability: 66000,
      gstr1Filed: false,
      gstr3bFiled: false,
    },
    {
      month: "Mar 2025",
      revenue: 1200000,
      outputGST: 216000,
      inputGST: 140000,
      netLiability: 76000,
      gstr1Filed: false,
      gstr3bFiled: false,
    },
  ];

  const totalRevenue = gstData.reduce((s, d) => s + d.revenue, 0);
  const totalOutput = gstData.reduce((s, d) => s + d.outputGST, 0);
  const totalInput = gstData.reduce((s, d) => s + d.inputGST, 0);
  const totalNet = gstData.reduce((s, d) => s + d.netLiability, 0);

  return (
    <div className="space-y-6">
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-text-secondary">Total Output GST</p>
            <p className="text-2xl font-bold font-mono text-rose-400 mt-1">
              {formatCurrency(totalOutput)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-text-secondary">Total Input GST (ITC)</p>
            <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {formatCurrency(totalInput)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-text-secondary">Net GST Liability</p>
            <p className="text-2xl font-bold font-mono text-accent-light mt-1">
              {formatCurrency(totalNet)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Label className="mb-2 block">GST Rate (%)</Label>
            <Input
              type="number"
              value={gstRate}
              onChange={(e) => setGstRate(Number(e.target.value) || 18)}
              className="font-mono"
            />
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
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-tertiary">
                  <th className="text-left p-3 text-text-secondary font-medium">Month</th>
                  <th className="text-right p-3 text-text-secondary font-medium">Revenue</th>
                  <th className="text-right p-3 text-text-secondary font-medium">Output GST</th>
                  <th className="text-right p-3 text-text-secondary font-medium">Input GST</th>
                  <th className="text-right p-3 text-text-secondary font-medium">Net Liability</th>
                  <th className="text-center p-3 text-text-secondary font-medium">GSTR-1</th>
                  <th className="text-center p-3 text-text-secondary font-medium">GSTR-3B</th>
                </tr>
              </thead>
              <tbody>
                {gstData.map((row, i) => (
                  <tr key={i} className="border-t border-border-light">
                    <td className="p-3 text-text-primary">{row.month}</td>
                    <td className="p-3 text-right text-text-primary font-mono">
                      {formatCurrency(row.revenue)}
                    </td>
                    <td className="p-3 text-right text-rose-400 font-mono">
                      {formatCurrency(row.outputGST)}
                    </td>
                    <td className="p-3 text-right text-emerald-400 font-mono">
                      {formatCurrency(row.inputGST)}
                    </td>
                    <td className="p-3 text-right text-accent-light font-mono">
                      {formatCurrency(row.netLiability)}
                    </td>
                    <td className="p-3 text-center">
                      {row.gstr1Filed ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400 mx-auto" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-400 mx-auto" />
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {row.gstr3bFiled ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400 mx-auto" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-400 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-surface-tertiary font-semibold">
                  <td className="p-3 text-text-primary">Total</td>
                  <td className="p-3 text-right text-text-primary font-mono">
                    {formatCurrency(totalRevenue)}
                  </td>
                  <td className="p-3 text-right text-rose-400 font-mono">
                    {formatCurrency(totalOutput)}
                  </td>
                  <td className="p-3 text-right text-emerald-400 font-mono">
                    {formatCurrency(totalInput)}
                  </td>
                  <td className="p-3 text-right text-accent-light font-mono">
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

function HRACalculator() {
  const [basicSalary, setBasicSalary] = useState(60000);
  const [hraReceived, setHraReceived] = useState(24000);
  const [rentPaid, setRentPaid] = useState(30000);
  const [isMetro, setIsMetro] = useState(true);

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

function TDSReconciliation() {
  const tdsEntries = [
    {
      source: "ABC Technologies Pvt. Ltd.",
      type: "Salary",
      tan: "DELA12345F",
      amountCredited: 180000,
      amountIn26AS: 180000,
      match: true,
    },
    {
      source: "XYZ Consulting LLP",
      type: "Professional Fees",
      tan: "MUMX67890G",
      amountCredited: 45000,
      amountIn26AS: 45000,
      match: true,
    },
    {
      source: "State Bank of India",
      type: "Interest (10% TDS)",
      tan: "SBID11111A",
      amountCredited: 8500,
      amountIn26AS: 8500,
      match: true,
    },
    {
      source: "Reliance Digital Services",
      type: "Contract Payment",
      tan: "RELH22222B",
      amountCredited: 32000,
      amountIn26AS: 28000,
      match: false,
    },
    {
      source: "HDFC Bank Ltd.",
      type: "FD Interest",
      tan: "HDFC33333C",
      amountCredited: 12000,
      amountIn26AS: 12000,
      match: true,
    },
    {
      source: "Infoway Solutions",
      type: "Freelance",
      tan: "INFW44444D",
      amountCredited: 25000,
      amountIn26AS: 20000,
      match: false,
    },
  ];

  const totalCredited = tdsEntries.reduce((s, e) => s + e.amountCredited, 0);
  const totalIn26AS = tdsEntries.reduce((s, e) => s + e.amountIn26AS, 0);
  const mismatchCount = tdsEntries.filter((e) => !e.match).length;
  const mismatchAmount = tdsEntries
    .filter((e) => !e.match)
    .reduce((s, e) => s + (e.amountCredited - e.amountIn26AS), 0);

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
              {formatCurrency(mismatchAmount)}
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
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-tertiary">
                  <th className="text-left p-3 text-text-secondary font-medium">Source</th>
                  <th className="text-left p-3 text-text-secondary font-medium">Type</th>
                  <th className="text-left p-3 text-text-secondary font-medium">TAN</th>
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
                    <td className="p-3 text-text-secondary font-mono text-xs">
                      {entry.tan}
                    </td>
                    <td className="p-3 text-right text-text-primary font-mono">
                      {formatCurrency(entry.amountCredited)}
                    </td>
                    <td
                      className={`p-3 text-right font-mono ${
                        entry.match ? "text-text-primary" : "text-amber-400"
                      }`}
                    >
                      {formatCurrency(entry.amountIn26AS)}
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
                          Mismatch ({formatCurrency(entry.amountCredited - entry.amountIn26AS)})
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
                  A total of {formatCurrency(mismatchAmount)} is not reflected in
                  Form 26AS/AIS. Contact the deductor(s) to ensure TDS is
                  deposited with the government and the correct PAN is quoted.
                  You can raise a grievance on the TRACES portal if the issue
                  persists.
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
