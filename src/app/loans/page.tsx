"use client";

import { useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { Plus, Home, Car, GraduationCap, Calendar, Calculator, Landmark, User, Loader2 } from "lucide-react";

const typeIcons: Record<string, typeof Home> = { home: Home, car: Car, education: GraduationCap, personal: User };
const typeColors: Record<string, string> = { home: "text-blue-400", car: "text-purple-400", education: "text-emerald", personal: "text-gold" };

export default function LoansPage() {
  const { user } = useAuth();
  const loansData = useQuery(api.loans.getLoans, user ? { userId: user.userId } : "skip");
  const addLoan = useMutation(api.loans.addLoan);
  const deleteLoan = useMutation(api.loans.deleteLoan);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: "home", lender: "", principal: "", outstanding: "", emi_amount: "", interest_rate: "", emi_date: "5", tenure_remaining: "" });

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
      setForm({ type: "home", lender: "", principal: "", outstanding: "", emi_amount: "", interest_rate: "", emi_date: "5", tenure_remaining: "" });
    } finally { setSaving(false); }
  };

  const totalOutstanding = loansData?.reduce((s, l) => s + l.outstanding, 0) ?? 0;
  const totalEMI = loansData?.reduce((s, l) => s + l.emi_amount, 0) ?? 0;
  const totalPrincipal = loansData?.reduce((s, l) => s + l.principal, 0) ?? 0;
  const totalPaid = totalPrincipal - totalOutstanding;

  const calculatePrepaymentSavings = (loan: { outstanding: number; interest_rate: number; tenure_remaining: number }, extra: number) => {
    const monthlyRate = loan.interest_rate / 100 / 12;
    const savings = extra * monthlyRate * Math.max(0, loan.tenure_remaining - Math.floor(extra / (loan.outstanding * monthlyRate + 1)));
    return Math.max(0, Math.round(savings));
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-enter">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">Loans</h1>
            <p className="text-text-secondary text-sm mt-1">EMI tracking & prepayment planning</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Loan</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-5"><p className="text-text-secondary text-xs uppercase tracking-wider">Total Outstanding</p><p className="stat-number text-2xl text-rose mt-1">{formatCurrency(totalOutstanding)}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-text-secondary text-xs uppercase tracking-wider">Monthly EMI</p><p className="stat-number text-2xl text-gold mt-1">{formatCurrency(totalEMI)}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-text-secondary text-xs uppercase tracking-wider">Total Borrowed</p><p className="stat-number text-2xl text-text-primary mt-1">{formatCurrency(totalPrincipal)}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-text-secondary text-xs uppercase tracking-wider">Repaid</p><p className="stat-number text-2xl text-emerald mt-1">{formatCurrency(totalPaid)}</p>{totalPrincipal > 0 && <Progress value={(totalPaid / totalPrincipal) * 100} className="mt-2" indicatorClassName="bg-emerald" />}</CardContent></Card>
        </div>

        {loansData === undefined ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{[1, 2].map((i) => <div key={i} className="h-64 rounded-xl bg-gray-100 animate-pulse" />)}</div>
        ) : loansData.length === 0 ? (
          <Card><CardContent className="p-12 text-center"><Landmark className="h-12 w-12 text-gray-300 mx-auto mb-4" /><p className="text-text-secondary">No loans tracked yet. Add a loan to track EMIs and plan prepayments.</p></CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {loansData.map((loan) => {
              const Icon = typeIcons[loan.type] || Landmark;
              const color = typeColors[loan.type] || "text-text-secondary";
              const repaidPercent = loan.principal > 0 ? ((loan.principal - loan.outstanding) / loan.principal) * 100 : 0;
              const nextEMI = new Date(); nextEMI.setDate(loan.emi_date); if (nextEMI < new Date()) nextEMI.setMonth(nextEMI.getMonth() + 1);

              return (
                <Card key={loan._id} className="group relative">
                  <button onClick={() => deleteLoan({ id: loan._id })} className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary hover:text-rose text-xs">Remove</button>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-lg bg-surface-tertiary ${color}`}><Icon className="h-5 w-5" /></div>
                      <div>
                        <CardTitle>{loan.lender}</CardTitle>
                        <div className="flex items-center gap-2 mt-1"><Badge>{loan.type}</Badge><span className="text-text-tertiary text-xs font-mono">{loan.interest_rate}% p.a.</span></div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div><p className="text-text-tertiary text-xs">Principal</p><p className="stat-number text-sm text-text-primary">{formatCurrency(loan.principal)}</p></div>
                      <div><p className="text-text-tertiary text-xs">Outstanding</p><p className="stat-number text-sm text-rose">{formatCurrency(loan.outstanding)}</p></div>
                      <div><p className="text-text-tertiary text-xs">Monthly EMI</p><p className="stat-number text-sm text-gold">{formatCurrency(loan.emi_amount)}</p></div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1"><span className="text-text-tertiary">Repayment Progress</span><span className="text-text-secondary stat-number">{repaidPercent.toFixed(1)}%</span></div>
                      <Progress value={repaidPercent} indicatorClassName="bg-emerald" />
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-border-light">
                      <Calendar className="h-3.5 w-3.5 text-text-tertiary" />
                      <span className="text-xs text-text-secondary">Next EMI: {nextEMI.toLocaleDateString("en-IN")} | {loan.tenure_remaining} months left</span>
                    </div>
                    <div className="bg-surface-tertiary/50 rounded-lg p-3 border border-border-light">
                      <div className="flex items-center gap-2 mb-2"><Calculator className="h-3.5 w-3.5 text-gold" /><span className="text-xs text-gold font-medium">Prepayment Calculator</span></div>
                      <p className="text-xs text-text-tertiary">Pay ₹1,00,000 extra → Save ~<span className="text-emerald stat-number">{formatCurrency(calculatePrepaymentSavings(loan, 100000))}</span> in interest</p>
                    </div>
                    {loan.type === "home" && (
                      <div className="bg-gold/5 rounded-lg p-3 border border-gold/15">
                        <p className="text-xs text-gold font-medium mb-1">Tax Benefits</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className="text-text-tertiary">80C (Principal): </span><span className="text-text-primary stat-number">₹1,50,000</span></div>
                          <div><span className="text-text-tertiary">24(b) (Interest): </span><span className="text-text-primary stat-number">₹2,00,000</span></div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Loan</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Loan Type</Label><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={[{ value: "home", label: "Home Loan" }, { value: "car", label: "Car Loan" }, { value: "personal", label: "Personal Loan" }, { value: "education", label: "Education Loan" }]} /></div>
                <div className="space-y-2"><Label>Lender</Label><Input value={form.lender} onChange={(e) => setForm({ ...form, lender: e.target.value })} placeholder="Bank / NBFC" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Principal Amount</Label><Input type="number" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} placeholder="0" /></div>
                <div className="space-y-2"><Label>Outstanding</Label><Input type="number" value={form.outstanding} onChange={(e) => setForm({ ...form, outstanding: e.target.value })} placeholder="0" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label>EMI Amount</Label><Input type="number" value={form.emi_amount} onChange={(e) => setForm({ ...form, emi_amount: e.target.value })} placeholder="0" /></div>
                <div className="space-y-2"><Label>Interest Rate %</Label><Input type="number" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} placeholder="8.5" step="0.1" /></div>
                <div className="space-y-2"><Label>EMI Date</Label><Input type="number" value={form.emi_date} onChange={(e) => setForm({ ...form, emi_date: e.target.value })} min="1" max="28" /></div>
              </div>
              <div className="space-y-2"><Label>Remaining Tenure (months)</Label><Input type="number" value={form.tenure_remaining} onChange={(e) => setForm({ ...form, tenure_remaining: e.target.value })} placeholder="180" /></div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Add Loan"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
