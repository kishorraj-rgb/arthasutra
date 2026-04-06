"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import {
  Bell,
  Plus,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Clock,
  Calculator,
  Receipt,
  Shield,
  Landmark,
  PieChart,
  Check,
} from "lucide-react";

const remindersData = [
  { id: "1", type: "advance_tax" as const, title: "Advance Tax Q4 - FY 2025-26", due_date: "2026-03-15", amount: 58500, is_recurring: true, frequency: "quarterly", is_completed: false, notes: "Final installment - 100% of tax" },
  { id: "2", type: "gst_filing" as const, title: "GSTR-3B Filing - March 2026", due_date: "2026-04-20", amount: 18000, is_recurring: true, frequency: "monthly", is_completed: false, notes: "Monthly GST return" },
  { id: "3", type: "insurance_premium" as const, title: "Term Life Insurance - HDFC", due_date: "2026-06-15", amount: 12500, is_recurring: true, frequency: "yearly", is_completed: false, notes: "Annual premium" },
  { id: "4", type: "loan_emi" as const, title: "Home Loan EMI - SBI", due_date: "2026-04-05", amount: 42000, is_recurring: true, frequency: "monthly", is_completed: false, notes: "Monthly EMI" },
  { id: "5", type: "loan_emi" as const, title: "Car Loan EMI - HDFC", due_date: "2026-04-10", amount: 16500, is_recurring: true, frequency: "monthly", is_completed: false, notes: "Monthly EMI" },
  { id: "6", type: "investment_review" as const, title: "Quarterly Portfolio Review", due_date: "2026-04-01", amount: undefined, is_recurring: true, frequency: "quarterly", is_completed: true, notes: "Review MF, stocks performance" },
  { id: "7", type: "custom" as const, title: "ITR Filing Deadline", due_date: "2026-07-31", amount: undefined, is_recurring: false, frequency: undefined, is_completed: false, notes: "File income tax return for FY 2025-26" },
  { id: "8", type: "insurance_premium" as const, title: "Health Insurance Renewal - Star", due_date: "2026-05-01", amount: 18500, is_recurring: true, frequency: "yearly", is_completed: false, notes: "Family floater policy" },
  { id: "9", type: "advance_tax" as const, title: "Advance Tax Q1 - FY 2026-27", due_date: "2026-06-15", amount: 35100, is_recurring: true, frequency: "quarterly", is_completed: false, notes: "15% of estimated tax" },
  { id: "10", type: "gst_filing" as const, title: "GSTR-1 Filing - March 2026", due_date: "2026-04-11", amount: undefined, is_recurring: true, frequency: "monthly", is_completed: false, notes: "Outward supply details" },
];

function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const typeIcons: Record<string, typeof Bell> = {
  advance_tax: Calculator,
  gst_filing: Receipt,
  insurance_premium: Shield,
  loan_emi: Landmark,
  investment_review: PieChart,
  custom: Bell,
};

const typeColors: Record<string, string> = {
  advance_tax: "text-gold",
  gst_filing: "text-purple-400",
  insurance_premium: "text-blue-400",
  loan_emi: "text-rose",
  investment_review: "text-emerald",
  custom: "text-white/60",
};

export default function RemindersPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    new Set(remindersData.filter((r) => r.is_completed).map((r) => r.id))
  );
  const [filter, setFilter] = useState("all");

  const toggleComplete = (id: string) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = remindersData.filter((r) => {
    if (filter === "pending") return !completedIds.has(r.id);
    if (filter === "completed") return completedIds.has(r.id);
    if (filter !== "all") return r.type === filter;
    return true;
  });

  const sortedReminders = [...filtered].sort((a, b) => {
    if (completedIds.has(a.id) !== completedIds.has(b.id)) return completedIds.has(a.id) ? 1 : -1;
    return a.due_date.localeCompare(b.due_date);
  });

  const overdueCount = remindersData.filter((r) => !completedIds.has(r.id) && getDaysUntil(r.due_date) < 0).length;
  const dueSoonCount = remindersData.filter((r) => !completedIds.has(r.id) && getDaysUntil(r.due_date) >= 0 && getDaysUntil(r.due_date) <= 7).length;
  const upcomingCount = remindersData.filter((r) => !completedIds.has(r.id) && getDaysUntil(r.due_date) > 7).length;

  return (
    <AppLayout>
      <div className="space-y-6 animate-enter">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Reminders</h1>
            <p className="text-white/50 text-sm mt-1">Financial obligations & due dates</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Reminder
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose/10"><AlertTriangle className="h-5 w-5 text-rose" /></div>
              <div>
                <p className="text-white/50 text-xs">Overdue</p>
                <p className="stat-number text-xl text-rose">{overdueCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10"><Clock className="h-5 w-5 text-amber-400" /></div>
              <div>
                <p className="text-white/50 text-xs">Due in 7 days</p>
                <p className="stat-number text-xl text-amber-400">{dueSoonCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald/10"><Calendar className="h-5 w-5 text-emerald" /></div>
              <div>
                <p className="text-white/50 text-xs">Upcoming</p>
                <p className="stat-number text-xl text-emerald">{upcomingCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/5"><CheckCircle className="h-5 w-5 text-white/40" /></div>
              <div>
                <p className="text-white/50 text-xs">Completed</p>
                <p className="stat-number text-xl text-white/40">{completedIds.size}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {[
            { value: "all", label: "All" },
            { value: "pending", label: "Pending" },
            { value: "completed", label: "Completed" },
            { value: "advance_tax", label: "Tax" },
            { value: "gst_filing", label: "GST" },
            { value: "insurance_premium", label: "Insurance" },
            { value: "loan_emi", label: "Loan EMI" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f.value
                  ? "bg-gold/20 text-gold border border-gold/30"
                  : "text-white/40 hover:text-white/60 border border-white/5 hover:border-white/10"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Reminders List */}
        <div className="space-y-2">
          {sortedReminders.map((reminder) => {
            const days = getDaysUntil(reminder.due_date);
            const isCompleted = completedIds.has(reminder.id);
            const Icon = typeIcons[reminder.type] || Bell;
            const color = typeColors[reminder.type] || "text-white/60";

            return (
              <Card
                key={reminder.id}
                className={`transition-all ${isCompleted ? "opacity-50" : ""}`}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <button
                    onClick={() => toggleComplete(reminder.id)}
                    className={`shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      isCompleted
                        ? "bg-emerald border-emerald"
                        : "border-white/20 hover:border-gold"
                    }`}
                  >
                    {isCompleted && <Check className="h-3 w-3 text-white" />}
                  </button>

                  <div className={`p-1.5 rounded-lg bg-white/5 ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isCompleted ? "line-through text-white/30" : "text-white"}`}>
                      {reminder.title}
                    </p>
                    {reminder.notes && (
                      <p className="text-xs text-white/30 truncate">{reminder.notes}</p>
                    )}
                  </div>

                  {reminder.amount && (
                    <p className="stat-number text-sm text-gold shrink-0">
                      {formatCurrency(reminder.amount)}
                    </p>
                  )}

                  <div className="shrink-0 text-right">
                    <p className="text-xs text-white/40 font-mono">{reminder.due_date}</p>
                    {!isCompleted && (
                      <Badge
                        variant={days < 0 ? "destructive" : days <= 7 ? "warning" : "success"}
                        className="mt-1"
                      >
                        {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `${days}d`}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Add Reminder Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Reminder</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  options={[
                    { value: "advance_tax", label: "Advance Tax" },
                    { value: "gst_filing", label: "GST Filing" },
                    { value: "insurance_premium", label: "Insurance Premium" },
                    { value: "loan_emi", label: "Loan EMI" },
                    { value: "investment_review", label: "Investment Review" },
                    { value: "custom", label: "Custom" },
                  ]}
                  placeholder="Select type"
                />
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input placeholder="Reminder title" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" />
                </div>
                <div className="space-y-2">
                  <Label>Amount (optional)</Label>
                  <Input type="number" placeholder="0" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch />
                <Label>Recurring</Label>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input placeholder="Additional notes" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => setDialogOpen(false)}>Add Reminder</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
