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
import { formatCurrency, INVESTMENT_TYPES, CHART_COLORS } from "@/lib/utils";
import {
  Plus,
  TrendingUp,
  PieChart as PieChartIcon,
  Target,
  GraduationCap,
  Home,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// --------------- Mock Data ---------------

const portfolioOverview = {
  totalInvested: 3250000,
  currentValue: 3875000,
  totalGain: 625000,
  totalGainPercent: 19.2,
  xirr: 14.8,
};

const categoryBreakdown = [
  { name: "Mutual Funds", key: "mutual_fund", invested: 1200000, current: 1440000 },
  { name: "Stocks", key: "stocks", invested: 800000, current: 1020000 },
  { name: "PPF", key: "ppf", invested: 450000, current: 510000 },
  { name: "NPS", key: "nps", invested: 300000, current: 345000 },
  { name: "FD", key: "fd", invested: 200000, current: 214000 },
  { name: "ELSS", key: "elss", invested: 150000, current: 186000 },
  { name: "Gold", key: "gold", invested: 150000, current: 160000 },
];

const PIE_COLORS = [
  CHART_COLORS.blue,
  CHART_COLORS.purple,
  CHART_COLORS.income,
  CHART_COLORS.cyan,
  CHART_COLORS.orange,
  CHART_COLORS.indigo,
  CHART_COLORS.gold,
];

const pieData = categoryBreakdown.map((c, i) => ({
  name: c.name,
  value: c.current,
  color: PIE_COLORS[i],
}));

const taxSaving80C = {
  limit: 150000,
  utilized: 135000,
  sections: [
    { label: "PPF", amount: 50000 },
    { label: "ELSS", amount: 50000 },
    { label: "LIC Premium", amount: 25000 },
    { label: "Home Loan Principal", amount: 10000 },
  ],
};

interface Investment {
  id: string;
  name: string;
  type: string;
  invested: number;
  current: number;
  returnPercent: number;
  dateInvested: string;
  maturityDate: string | null;
}

const investments: Investment[] = [
  { id: "1", name: "Axis Bluechip Fund", type: "mutual_fund", invested: 400000, current: 492000, returnPercent: 23.0, dateInvested: "2022-03-15", maturityDate: null },
  { id: "2", name: "Parag Parikh Flexi Cap", type: "mutual_fund", invested: 350000, current: 413000, returnPercent: 18.0, dateInvested: "2021-06-10", maturityDate: null },
  { id: "3", name: "Mirae Asset Large Cap", type: "mutual_fund", invested: 450000, current: 535000, returnPercent: 18.9, dateInvested: "2021-01-05", maturityDate: null },
  { id: "4", name: "Reliance Industries", type: "stocks", invested: 300000, current: 405000, returnPercent: 35.0, dateInvested: "2022-01-20", maturityDate: null },
  { id: "5", name: "HDFC Bank", type: "stocks", invested: 250000, current: 290000, returnPercent: 16.0, dateInvested: "2022-05-12", maturityDate: null },
  { id: "6", name: "Infosys", type: "stocks", invested: 250000, current: 325000, returnPercent: 30.0, dateInvested: "2021-09-18", maturityDate: null },
  { id: "7", name: "Public Provident Fund", type: "ppf", invested: 450000, current: 510000, returnPercent: 7.1, dateInvested: "2019-04-01", maturityDate: "2034-04-01" },
  { id: "8", name: "National Pension System", type: "nps", invested: 300000, current: 345000, returnPercent: 15.0, dateInvested: "2020-07-01", maturityDate: "2050-07-01" },
  { id: "9", name: "SBI FD - 5 Year", type: "fd", invested: 200000, current: 214000, returnPercent: 7.0, dateInvested: "2023-01-10", maturityDate: "2028-01-10" },
  { id: "10", name: "Axis ELSS Tax Saver", type: "elss", invested: 150000, current: 186000, returnPercent: 24.0, dateInvested: "2022-02-25", maturityDate: "2025-02-25" },
  { id: "11", name: "Sovereign Gold Bond 2028", type: "gold", invested: 150000, current: 160000, returnPercent: 6.7, dateInvested: "2023-06-15", maturityDate: "2031-06-15" },
  { id: "12", name: "Tata Digital India Fund", type: "mutual_fund", invested: 100000, current: 88000, returnPercent: -12.0, dateInvested: "2024-01-08", maturityDate: null },
];

const goals = [
  {
    id: "1",
    name: "Child Education",
    icon: GraduationCap,
    target: 5000000,
    years: 15,
    status: "On track",
    statusColor: "text-emerald-400",
    progress: 78,
  },
  {
    id: "2",
    name: "Retirement",
    icon: Briefcase,
    target: 50000000,
    years: 25,
    status: "Need to increase SIP by \u20B95,000",
    statusColor: "text-amber-400",
    progress: 42,
  },
  {
    id: "3",
    name: "Home Purchase",
    icon: Home,
    target: 10000000,
    years: 5,
    status: "65% achieved",
    statusColor: "text-emerald-400",
    progress: 65,
  },
];

const TAX_SECTIONS = [
  { value: "none", label: "None" },
  { value: "80C", label: "Section 80C" },
  { value: "80D", label: "Section 80D" },
  { value: "80CCD", label: "Section 80CCD" },
];

// --------------- Custom Tooltip ---------------

function CustomPieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { color: string } }> }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gold/20 bg-navy/95 backdrop-blur-xl px-4 py-3 shadow-xl">
        <p className="text-sm font-medium text-white">{payload[0].name}</p>
        <p className="font-mono text-sm text-gold">{formatCurrency(payload[0].value)}</p>
      </div>
    );
  }
  return null;
}

function CustomLegend({ payload }: { payload?: Array<{ value: string; color: string }> }) {
  if (!payload) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs text-white/70">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.value}
        </div>
      ))}
    </div>
  );
}

// --------------- Helper ---------------

function getTypeLabel(type: string) {
  return INVESTMENT_TYPES.find((t) => t.value === type)?.label ?? type;
}

// --------------- Page ---------------

export default function InvestmentsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: "",
    name: "",
    investedAmount: "",
    currentValue: "",
    dateInvested: "",
    maturityDate: "",
    expectedReturn: "",
    lockInPeriod: "",
    taxSaving: false,
    taxSection: "none",
  });

  function handleFormChange(field: string, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit() {
    setDialogOpen(false);
    setFormData({
      type: "",
      name: "",
      investedAmount: "",
      currentValue: "",
      dateInvested: "",
      maturityDate: "",
      expectedReturn: "",
      lockInPeriod: "",
      taxSaving: false,
      taxSection: "none",
    });
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* ---- Page Header ---- */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-white tracking-tight">
              Investments
            </h1>
            <p className="mt-1 text-white/50 text-sm">
              Track your portfolio, tax savings &amp; financial goals
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Investment
          </Button>
        </div>

        {/* ---- Portfolio Overview ---- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/50">
                Total Invested
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-2xl font-bold text-white">
                {formatCurrency(portfolioOverview.totalInvested)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/50">
                Current Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-2xl font-bold text-gold">
                {formatCurrency(portfolioOverview.currentValue)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/50">
                Total Gain
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <p className="font-mono text-2xl font-bold text-emerald-400">
                  +{formatCurrency(portfolioOverview.totalGain)}
                </p>
                <span className="flex items-center text-sm text-emerald-400">
                  <ArrowUpRight className="h-4 w-4" />
                  {portfolioOverview.totalGainPercent}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/50">
                XIRR
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <p className="font-mono text-2xl font-bold text-emerald-400">
                  {portfolioOverview.xirr}%
                </p>
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ---- Category Breakdown + Pie Chart ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Category cards */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {categoryBreakdown.map((cat, idx) => {
              const gain = cat.current - cat.invested;
              const gainPercent = ((gain / cat.invested) * 100).toFixed(1);
              const isPositive = gain >= 0;
              return (
                <Card key={cat.key}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-white/70">
                        {cat.name}
                      </CardTitle>
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[idx] }}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-white/40">Invested</span>
                      <span className="font-mono text-sm text-white/70">
                        {formatCurrency(cat.invested)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-white/40">Current</span>
                      <span className="font-mono text-sm font-semibold text-white">
                        {formatCurrency(cat.current)}
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-1 pt-1">
                      {isPositive ? (
                        <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5 text-rose-400" />
                      )}
                      <span
                        className={`font-mono text-xs font-semibold ${
                          isPositive ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {formatCurrency(gain)} ({gainPercent}%)
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pie Chart */}
          <Card className="flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-gold" />
                <CardTitle>Portfolio Allocation</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend content={<CustomLegend />} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* ---- 80C Tax Saving Progress ---- */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-gold" />
                Section 80C Tax Saving
              </CardTitle>
              <Badge variant={taxSaving80C.utilized >= taxSaving80C.limit ? "success" : "warning"}>
                {formatCurrency(taxSaving80C.utilized)} of {formatCurrency(taxSaving80C.limit)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress
              value={(taxSaving80C.utilized / taxSaving80C.limit) * 100}
              indicatorClassName="bg-gradient-to-r from-gold to-amber-500"
              className="h-3"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {taxSaving80C.sections.map((s) => (
                <div
                  key={s.label}
                  className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-center"
                >
                  <p className="text-xs text-white/40 mb-1">{s.label}</p>
                  <p className="font-mono text-sm font-semibold text-white">
                    {formatCurrency(s.amount)}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs text-white/40 text-right">
              Remaining: {formatCurrency(taxSaving80C.limit - taxSaving80C.utilized)}
            </p>
          </CardContent>
        </Card>

        {/* ---- Individual Investment Cards ---- */}
        <div>
          <h2 className="font-display text-xl font-semibold text-white mb-4">
            Your Investments
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {investments.map((inv) => {
              const isPositive = inv.returnPercent >= 0;
              return (
                <Card key={inv.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">
                        {inv.name}
                      </CardTitle>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {getTypeLabel(inv.type)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <p className="text-white/40 text-xs">Invested</p>
                        <p className="font-mono text-white/80">
                          {formatCurrency(inv.invested)}
                        </p>
                      </div>
                      <div>
                        <p className="text-white/40 text-xs">Current Value</p>
                        <p className="font-mono font-semibold text-white">
                          {formatCurrency(inv.current)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-3">
                      <div className="flex items-center gap-1">
                        {isPositive ? (
                          <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-rose-400" />
                        )}
                        <span
                          className={`font-mono text-sm font-bold ${
                            isPositive ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {inv.returnPercent}%
                        </span>
                      </div>
                      <div className="text-right text-xs text-white/40">
                        <p>Invested: {inv.dateInvested}</p>
                        {inv.maturityDate && <p>Maturity: {inv.maturityDate}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* ---- Goal-Based Planning ---- */}
        <div>
          <h2 className="font-display text-xl font-semibold text-white mb-4">
            Goal-Based Planning
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {goals.map((goal) => {
              const GoalIcon = goal.icon;
              return (
                <Card key={goal.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10">
                        <GoalIcon className="h-5 w-5 text-gold" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{goal.name}</CardTitle>
                        <p className="text-xs text-white/40 mt-0.5">
                          Target: {formatCurrency(goal.target)} in {goal.years} yrs
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Progress
                      value={goal.progress}
                      indicatorClassName="bg-gradient-to-r from-gold to-amber-500"
                      className="h-2"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-white/50">
                        {goal.progress}%
                      </span>
                      <span className={`text-xs font-medium ${goal.statusColor}`}>
                        {goal.status}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* ---- Add Investment Dialog ---- */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Investment</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="inv-type">Investment Type</Label>
                <Select
                  id="inv-type"
                  options={[...INVESTMENT_TYPES]}
                  placeholder="Select type"
                  value={formData.type}
                  onChange={(e) => handleFormChange("type", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-name">Name</Label>
                <Input
                  id="inv-name"
                  placeholder="e.g. Axis Bluechip Fund"
                  value={formData.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-invested">Invested Amount</Label>
                <Input
                  id="inv-invested"
                  type="number"
                  placeholder="0"
                  value={formData.investedAmount}
                  onChange={(e) =>
                    handleFormChange("investedAmount", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-current">Current Value</Label>
                <Input
                  id="inv-current"
                  type="number"
                  placeholder="0"
                  value={formData.currentValue}
                  onChange={(e) =>
                    handleFormChange("currentValue", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-date">Date Invested</Label>
                <Input
                  id="inv-date"
                  type="date"
                  value={formData.dateInvested}
                  onChange={(e) =>
                    handleFormChange("dateInvested", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-maturity">Maturity Date (optional)</Label>
                <Input
                  id="inv-maturity"
                  type="date"
                  value={formData.maturityDate}
                  onChange={(e) =>
                    handleFormChange("maturityDate", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-return">Expected Return Rate (%)</Label>
                <Input
                  id="inv-return"
                  type="number"
                  placeholder="12"
                  value={formData.expectedReturn}
                  onChange={(e) =>
                    handleFormChange("expectedReturn", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inv-lockin">Lock-in Period (years)</Label>
                <Input
                  id="inv-lockin"
                  type="number"
                  placeholder="0"
                  value={formData.lockInPeriod}
                  onChange={(e) =>
                    handleFormChange("lockInPeriod", e.target.value)
                  }
                />
              </div>

              <div className="flex items-center justify-between sm:col-span-2 rounded-lg border border-white/5 bg-white/[0.02] p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="inv-tax">Tax Saving Investment</Label>
                  <p className="text-xs text-white/40">
                    Mark if this qualifies for tax deduction
                  </p>
                </div>
                <Switch
                  id="inv-tax"
                  checked={formData.taxSaving}
                  onCheckedChange={(checked) =>
                    handleFormChange("taxSaving", checked)
                  }
                />
              </div>

              {formData.taxSaving && (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="inv-section">Tax Section</Label>
                  <Select
                    id="inv-section"
                    options={TAX_SECTIONS}
                    value={formData.taxSection}
                    onChange={(e) =>
                      handleFormChange("taxSection", e.target.value)
                    }
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit}>Add Investment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
