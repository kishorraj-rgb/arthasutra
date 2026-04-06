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
import { Shield, Plus, Heart, Car, Home, Plane, Clock, AlertTriangle, CheckCircle } from "lucide-react";

const policies = [
  {
    id: "1",
    type: "term" as const,
    provider: "HDFC Life",
    policy_number: "TRM-2024-001",
    sum_assured: 10000000,
    annual_premium: 12500,
    next_due_date: "2026-06-15",
    maturity_date: undefined,
    nominee: "Priya Kumar",
    icon: Shield,
    color: "text-blue-400",
  },
  {
    id: "2",
    type: "health" as const,
    provider: "Star Health",
    policy_number: "HLT-2024-045",
    sum_assured: 1000000,
    annual_premium: 18500,
    next_due_date: "2026-05-01",
    maturity_date: undefined,
    nominee: "Family Floater",
    icon: Heart,
    color: "text-rose",
  },
  {
    id: "3",
    type: "vehicle" as const,
    provider: "ICICI Lombard",
    policy_number: "VEH-2024-789",
    sum_assured: 800000,
    annual_premium: 8200,
    next_due_date: "2026-08-20",
    maturity_date: undefined,
    nominee: "N/A",
    icon: Car,
    color: "text-purple-400",
  },
  {
    id: "4",
    type: "home" as const,
    provider: "Bajaj Allianz",
    policy_number: "HOM-2024-234",
    sum_assured: 5000000,
    annual_premium: 4500,
    next_due_date: "2026-09-10",
    maturity_date: undefined,
    nominee: "Priya Kumar",
    icon: Home,
    color: "text-emerald",
  },
  {
    id: "5",
    type: "travel" as const,
    provider: "Tata AIG",
    policy_number: "TRV-2024-567",
    sum_assured: 2500000,
    annual_premium: 3200,
    next_due_date: "2026-12-01",
    maturity_date: undefined,
    nominee: "Self",
    icon: Plane,
    color: "text-gold",
  },
];

function getDaysUntil(dateStr: string): number {
  const today = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function InsurancePage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const totalPremium = policies.reduce((sum, p) => sum + p.annual_premium, 0);
  const totalCover = policies.reduce((sum, p) => sum + p.sum_assured, 0);
  const annualIncome = 3420000;
  const recommendedCover = annualIncome * 10;
  const coverAdequacy = Math.min(100, (totalCover / recommendedCover) * 100);

  return (
    <AppLayout>
      <div className="space-y-6 animate-enter">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Insurance</h1>
            <p className="text-white/50 text-sm mt-1">Policy management & premium tracking</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Policy
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-white/50 text-xs uppercase tracking-wider">Total Policies</p>
              <p className="stat-number text-2xl text-white mt-1">{policies.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-white/50 text-xs uppercase tracking-wider">Annual Premium</p>
              <p className="stat-number text-2xl text-gold mt-1">{formatCurrency(totalPremium)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-white/50 text-xs uppercase tracking-wider">Total Cover</p>
              <p className="stat-number text-2xl text-emerald mt-1">{formatCurrency(totalCover)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-white/50 text-xs uppercase tracking-wider">Cover Adequacy</p>
              <p className="stat-number text-2xl text-white mt-1">{coverAdequacy.toFixed(0)}%</p>
              <Progress value={coverAdequacy} className="mt-2" indicatorClassName={coverAdequacy >= 80 ? "bg-emerald" : "bg-amber-500"} />
              <p className="text-white/30 text-xs mt-1">Recommended: 10x income = {formatCurrency(recommendedCover)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Policy Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {policies.map((policy) => {
            const daysUntil = getDaysUntil(policy.next_due_date);
            const Icon = policy.icon;
            return (
              <Card key={policy.id} className="relative overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-white/5 ${policy.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{policy.provider}</CardTitle>
                        <p className="text-white/40 text-xs font-mono mt-0.5">{policy.policy_number}</p>
                      </div>
                    </div>
                    <Badge variant={
                      policy.type === "term" ? "default" :
                      policy.type === "health" ? "destructive" :
                      policy.type === "vehicle" ? "secondary" :
                      "success"
                    }>
                      {policy.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-white/40 text-xs">Sum Assured</p>
                      <p className="stat-number text-sm text-white">{formatCurrency(policy.sum_assured)}</p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs">Annual Premium</p>
                      <p className="stat-number text-sm text-gold">{formatCurrency(policy.annual_premium)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-white/30" />
                      <span className="text-xs text-white/50">Next due: {policy.next_due_date}</span>
                    </div>
                    {daysUntil <= 7 ? (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {daysUntil}d
                      </Badge>
                    ) : daysUntil <= 30 ? (
                      <Badge variant="warning">
                        {daysUntil}d
                      </Badge>
                    ) : (
                      <Badge variant="success">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {daysUntil}d
                      </Badge>
                    )}
                  </div>
                  {policy.nominee && (
                    <p className="text-white/30 text-xs">Nominee: {policy.nominee}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Add Policy Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Insurance Policy</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Policy Type</Label>
                  <Select
                    options={[
                      { value: "term", label: "Term Life" },
                      { value: "health", label: "Health" },
                      { value: "vehicle", label: "Vehicle" },
                      { value: "home", label: "Home" },
                      { value: "travel", label: "Travel" },
                    ]}
                    placeholder="Select type"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Input placeholder="Insurance company" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Policy Number</Label>
                  <Input placeholder="Policy number" />
                </div>
                <div className="space-y-2">
                  <Label>Sum Assured</Label>
                  <Input type="number" placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Annual Premium</Label>
                  <Input type="number" placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Next Due Date</Label>
                  <Input type="date" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nominee</Label>
                <Input placeholder="Nominee name" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => setDialogOpen(false)}>Add Policy</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
