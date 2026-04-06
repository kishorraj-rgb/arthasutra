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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { Shield, Plus, Heart, Car, Home, Plane, Clock, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

const typeIcons: Record<string, typeof Shield> = { term: Shield, health: Heart, vehicle: Car, home: Home, travel: Plane };
const typeColors: Record<string, string> = { term: "text-blue-400", health: "text-rose", vehicle: "text-purple-400", home: "text-emerald", travel: "text-accent-light" };

function getDaysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(dateStr).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function InsurancePage() {
  const { user } = useAuth();
  const policies = useQuery(api.insurance.getInsurancePolicies, user ? { userId: user.userId } : "skip");
  const addPolicy = useMutation(api.insurance.addInsurancePolicy);
  const deletePolicy = useMutation(api.insurance.deleteInsurancePolicy);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: "term", provider: "", policy_number: "", sum_assured: "", annual_premium: "", next_due_date: "", nominee: "" });

  const handleSubmit = async () => {
    if (!user || !form.provider || !form.sum_assured) return;
    setSaving(true);
    try {
      await addPolicy({
        userId: user.userId,
        type: form.type as "term" | "health" | "vehicle" | "home" | "travel",
        provider: form.provider,
        policy_number: form.policy_number,
        sum_assured: Number(form.sum_assured),
        annual_premium: Number(form.annual_premium) || 0,
        next_due_date: form.next_due_date || new Date().toISOString().split("T")[0],
        nominee: form.nominee || undefined,
      });
      setDialogOpen(false);
      setForm({ type: "term", provider: "", policy_number: "", sum_assured: "", annual_premium: "", next_due_date: "", nominee: "" });
    } finally { setSaving(false); }
  };

  const totalPremium = policies?.reduce((s, p) => s + p.annual_premium, 0) ?? 0;
  const totalCover = policies?.reduce((s, p) => s + p.sum_assured, 0) ?? 0;
  const annualIncome = user?.annual_ctc || 3000000;
  const recommendedCover = annualIncome * 10;
  const coverAdequacy = Math.min(100, totalCover > 0 ? (totalCover / recommendedCover) * 100 : 0);

  return (
    <AppLayout>
      <div className="space-y-6 animate-enter">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">Insurance</h1>
            <p className="text-text-secondary text-sm mt-1">Policy management & premium tracking</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Policy</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-5"><p className="text-text-secondary text-xs uppercase tracking-wider">Total Policies</p><p className="stat-number text-2xl text-text-primary mt-1">{policies?.length ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-text-secondary text-xs uppercase tracking-wider">Annual Premium</p><p className="stat-number text-2xl text-accent-light mt-1">{formatCurrency(totalPremium)}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-text-secondary text-xs uppercase tracking-wider">Total Cover</p><p className="stat-number text-2xl text-emerald mt-1">{formatCurrency(totalCover)}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-text-secondary text-xs uppercase tracking-wider">Cover Adequacy</p><p className="stat-number text-2xl text-text-primary mt-1">{coverAdequacy.toFixed(0)}%</p><Progress value={coverAdequacy} className="mt-2" indicatorClassName={coverAdequacy >= 80 ? "bg-emerald" : "bg-accent/100"} /><p className="text-text-tertiary text-xs mt-1">Recommended: 10x income</p></CardContent></Card>
        </div>

        {policies === undefined ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-48 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : policies.length === 0 ? (
          <Card><CardContent className="p-12 text-center"><Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" /><p className="text-text-secondary">No insurance policies yet. Add your first policy to track premiums and renewals.</p></CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {policies.map((policy) => {
              const daysUntil = getDaysUntil(policy.next_due_date);
              const Icon = typeIcons[policy.type] || Shield;
              const color = typeColors[policy.type] || "text-text-secondary";
              return (
                <Card key={policy._id} className="relative overflow-hidden group">
                  <button onClick={() => deletePolicy({ id: policy._id })} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary hover:text-rose text-xs">Remove</button>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-surface-tertiary ${color}`}><Icon className="h-5 w-5" /></div>
                      <div>
                        <CardTitle className="text-base">{policy.provider}</CardTitle>
                        <p className="text-text-tertiary text-xs font-mono mt-0.5">{policy.policy_number}</p>
                      </div>
                      <Badge className="ml-auto">{policy.type}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="text-text-tertiary text-xs">Sum Assured</p><p className="stat-number text-sm text-text-primary">{formatCurrency(policy.sum_assured)}</p></div>
                      <div><p className="text-text-tertiary text-xs">Annual Premium</p><p className="stat-number text-sm text-accent-light">{formatCurrency(policy.annual_premium)}</p></div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border-light">
                      <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-text-tertiary" /><span className="text-xs text-text-secondary">Next: {policy.next_due_date}</span></div>
                      {daysUntil < 0 ? <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Overdue</Badge>
                        : daysUntil <= 30 ? <Badge variant="warning">{daysUntil}d</Badge>
                        : <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" />{daysUntil}d</Badge>}
                    </div>
                    {policy.nominee && <p className="text-text-tertiary text-xs">Nominee: {policy.nominee}</p>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Insurance Policy</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Policy Type</Label><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={[{ value: "term", label: "Term Life" }, { value: "health", label: "Health" }, { value: "vehicle", label: "Vehicle" }, { value: "home", label: "Home" }, { value: "travel", label: "Travel" }]} /></div>
                <div className="space-y-2"><Label>Provider</Label><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="Insurance company" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Policy Number</Label><Input value={form.policy_number} onChange={(e) => setForm({ ...form, policy_number: e.target.value })} placeholder="Policy number" /></div>
                <div className="space-y-2"><Label>Sum Assured</Label><Input type="number" value={form.sum_assured} onChange={(e) => setForm({ ...form, sum_assured: e.target.value })} placeholder="0" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Annual Premium</Label><Input type="number" value={form.annual_premium} onChange={(e) => setForm({ ...form, annual_premium: e.target.value })} placeholder="0" /></div>
                <div className="space-y-2"><Label>Next Due Date</Label><Input type="date" value={form.next_due_date} onChange={(e) => setForm({ ...form, next_due_date: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Nominee</Label><Input value={form.nominee} onChange={(e) => setForm({ ...form, nominee: e.target.value })} placeholder="Nominee name" /></div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Add Policy"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
