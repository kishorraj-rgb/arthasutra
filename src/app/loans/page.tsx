"use client";

import { useState } from "react";
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
import { Plus, Home, Car, GraduationCap, Calendar, Calculator } from "lucide-react";

const loansData = [
  {
    id: "1",
    type: "home" as const,
    lender: "SBI Home Loans",
    principal: 5000000,
    outstanding: 3800000,
    emi_amount: 42000,
    interest_rate: 8.5,
    emi_date: 5,
    tenure_remaining: 180,
    icon: Home,
    color: "text-blue-400",
  },
  {
    id: "2",
    type: "car" as const,
    lender: "HDFC Bank",
    principal: 800000,
    outstanding: 350000,
    emi_amount: 16500,
    interest_rate: 9.2,
    emi_date: 10,
    tenure_remaining: 24,
    icon: Car,
    color: "text-purple-400",
  },
  {
    id: "3",
    type: "education" as const,
    lender: "Bank of Baroda",
    principal: 1200000,
    outstanding: 900000,
    emi_amount: 15000,
    interest_rate: 7.5,
    emi_date: 15,
    tenure_remaining: 72,
    icon: GraduationCap,
    color: "text-emerald",
  },
];

export default function LoansPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prepayCalc, setPrepayCalc] = useState({ loanId: "", extraPayment: 100000 });

  const totalOutstanding = loansData.reduce((s, l) => s + l.outstanding, 0);
  const totalEMI = loansData.reduce((s, l) => s + l.emi_amount, 0);
  const totalPrincipal = loansData.reduce((s, l) => s + l.principal, 0);
  const totalPaid = totalPrincipal - totalOutstanding;

  // Simple prepayment savings calc
  const calculatePrepaymentSavings = (loan: typeof loansData[0], extra: number) => {
    const monthlyRate = loan.interest_rate / 100 / 12;
    const currentInterest = loan.outstanding * monthlyRate * loan.tenure_remaining;
    const newOutstanding = loan.outstanding - extra;
    const newInterest = newOutstanding * monthlyRate * (loan.tenure_remaining - Math.floor(extra / loan.emi_amount));
    return Math.max(0, currentInterest - newInterest);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-enter">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Loans</h1>
            <p className="text-white/50 text-sm mt-1">EMI tracking & prepayment planning</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Loan
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-white/50 text-xs uppercase tracking-wider">Total Outstanding</p>
              <p className="stat-number text-2xl text-rose mt-1">{formatCurrency(totalOutstanding)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-white/50 text-xs uppercase tracking-wider">Monthly EMI</p>
              <p className="stat-number text-2xl text-gold mt-1">{formatCurrency(totalEMI)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-white/50 text-xs uppercase tracking-wider">Total Borrowed</p>
              <p className="stat-number text-2xl text-white mt-1">{formatCurrency(totalPrincipal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-white/50 text-xs uppercase tracking-wider">Repaid</p>
              <p className="stat-number text-2xl text-emerald mt-1">{formatCurrency(totalPaid)}</p>
              <Progress value={(totalPaid / totalPrincipal) * 100} className="mt-2" indicatorClassName="bg-emerald" />
            </CardContent>
          </Card>
        </div>

        {/* Loan Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {loansData.map((loan) => {
            const Icon = loan.icon;
            const repaidPercent = ((loan.principal - loan.outstanding) / loan.principal) * 100;
            const nextEMI = new Date();
            nextEMI.setDate(loan.emi_date);
            if (nextEMI < new Date()) nextEMI.setMonth(nextEMI.getMonth() + 1);

            return (
              <Card key={loan.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-lg bg-white/5 ${loan.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle>{loan.lender}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge>{loan.type}</Badge>
                          <span className="text-white/30 text-xs font-mono">{loan.interest_rate}% p.a.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-white/40 text-xs">Principal</p>
                      <p className="stat-number text-sm text-white">{formatCurrency(loan.principal)}</p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs">Outstanding</p>
                      <p className="stat-number text-sm text-rose">{formatCurrency(loan.outstanding)}</p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs">Monthly EMI</p>
                      <p className="stat-number text-sm text-gold">{formatCurrency(loan.emi_amount)}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-white/40">Repayment Progress</span>
                      <span className="text-white/60 stat-number">{repaidPercent.toFixed(1)}%</span>
                    </div>
                    <Progress value={repaidPercent} indicatorClassName="bg-emerald" />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-white/30" />
                      <span className="text-xs text-white/50">
                        Next EMI: {nextEMI.toLocaleDateString("en-IN")} | {loan.tenure_remaining} months left
                      </span>
                    </div>
                  </div>

                  {/* Prepayment Calculator */}
                  <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Calculator className="h-3.5 w-3.5 text-gold" />
                      <span className="text-xs text-gold font-medium">Prepayment Calculator</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="h-8 text-xs"
                        placeholder="Extra payment"
                        value={prepayCalc.loanId === loan.id ? prepayCalc.extraPayment : 100000}
                        onChange={(e) => setPrepayCalc({ loanId: loan.id, extraPayment: Number(e.target.value) })}
                      />
                      <div className="text-xs text-white/50 whitespace-nowrap">
                        Save ~<span className="text-emerald stat-number">
                          {formatCurrency(calculatePrepaymentSavings(loan, prepayCalc.loanId === loan.id ? prepayCalc.extraPayment : 100000))}
                        </span> in interest
                      </div>
                    </div>
                  </div>

                  {/* Tax benefit for home loan */}
                  {loan.type === "home" && (
                    <div className="bg-gold/5 rounded-lg p-3 border border-gold/10">
                      <p className="text-xs text-gold font-medium mb-1">Tax Benefits</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-white/40">80C (Principal): </span>
                          <span className="text-white stat-number">₹1,50,000</span>
                        </div>
                        <div>
                          <span className="text-white/40">24(b) (Interest): </span>
                          <span className="text-white stat-number">₹2,00,000</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Add Loan Dialog */}
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
                    options={[
                      { value: "home", label: "Home Loan" },
                      { value: "car", label: "Car Loan" },
                      { value: "personal", label: "Personal Loan" },
                      { value: "education", label: "Education Loan" },
                    ]}
                    placeholder="Select type"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lender</Label>
                  <Input placeholder="Bank / NBFC name" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Principal Amount</Label>
                  <Input type="number" placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Outstanding</Label>
                  <Input type="number" placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>EMI Amount</Label>
                  <Input type="number" placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Interest Rate (%)</Label>
                  <Input type="number" placeholder="8.5" step="0.1" />
                </div>
                <div className="space-y-2">
                  <Label>EMI Date</Label>
                  <Input type="number" placeholder="5" min="1" max="28" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Remaining Tenure (months)</Label>
                <Input type="number" placeholder="180" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => setDialogOpen(false)}>Add Loan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
