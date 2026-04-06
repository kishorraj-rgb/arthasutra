"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { Bell, Plus, Calendar, CheckCircle, AlertTriangle, Clock, Calculator, Receipt, Shield, Landmark, PieChart, Check, Loader2 } from "lucide-react";

const typeIcons: Record<string, typeof Bell> = { advance_tax: Calculator, gst_filing: Receipt, insurance_premium: Shield, loan_emi: Landmark, investment_review: PieChart, custom: Bell };
const typeColors: Record<string, string> = { advance_tax: "text-gold", gst_filing: "text-purple-400", insurance_premium: "text-blue-400", loan_emi: "text-rose", investment_review: "text-emerald", custom: "text-text-secondary" };

function getDaysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(dateStr).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function RemindersPage() {
  const { user } = useAuth();
  const reminders = useQuery(api.reminders.getReminders, user ? { userId: user.userId } : "skip");
  const addReminder = useMutation(api.reminders.addReminder);
  const completeReminder = useMutation(api.reminders.completeReminder);
  const deleteReminder = useMutation(api.reminders.deleteReminder);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ type: "custom", title: "", due_date: "", amount: "", is_recurring: false, notes: "" });

  const handleSubmit = async () => {
    if (!user || !form.title || !form.due_date) return;
    setSaving(true);
    try {
      await addReminder({
        userId: user.userId,
        type: form.type as "advance_tax" | "gst_filing" | "insurance_premium" | "loan_emi" | "investment_review" | "custom",
        title: form.title,
        due_date: form.due_date,
        amount: form.amount ? Number(form.amount) : undefined,
        is_recurring: form.is_recurring,
        is_completed: false,
        notes: form.notes || undefined,
      });
      setDialogOpen(false);
      setForm({ type: "custom", title: "", due_date: "", amount: "", is_recurring: false, notes: "" });
    } finally { setSaving(false); }
  };

  const allReminders = reminders ?? [];
  const filtered = allReminders.filter((r) => {
    if (filter === "pending") return !r.is_completed;
    if (filter === "completed") return r.is_completed;
    if (filter !== "all") return r.type === filter;
    return true;
  }).sort((a, b) => {
    if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
    return a.due_date.localeCompare(b.due_date);
  });

  const overdueCount = allReminders.filter((r) => !r.is_completed && getDaysUntil(r.due_date) < 0).length;
  const dueSoonCount = allReminders.filter((r) => !r.is_completed && getDaysUntil(r.due_date) >= 0 && getDaysUntil(r.due_date) <= 7).length;
  const upcomingCount = allReminders.filter((r) => !r.is_completed && getDaysUntil(r.due_date) > 7).length;
  const completedCount = allReminders.filter((r) => r.is_completed).length;

  return (
    <AppLayout>
      <div className="space-y-6 animate-enter">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">Reminders</h1>
            <p className="text-text-secondary text-sm mt-1">Financial obligations & due dates</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Reminder</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-5 flex items-center gap-3"><div className="p-2 rounded-lg bg-rose/10"><AlertTriangle className="h-5 w-5 text-rose" /></div><div><p className="text-text-secondary text-xs">Overdue</p><p className="stat-number text-xl text-rose">{overdueCount}</p></div></CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-3"><div className="p-2 rounded-lg bg-amber-500/10"><Clock className="h-5 w-5 text-amber-400" /></div><div><p className="text-text-secondary text-xs">Due in 7 days</p><p className="stat-number text-xl text-amber-400">{dueSoonCount}</p></div></CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-3"><div className="p-2 rounded-lg bg-emerald/10"><Calendar className="h-5 w-5 text-emerald" /></div><div><p className="text-text-secondary text-xs">Upcoming</p><p className="stat-number text-xl text-emerald">{upcomingCount}</p></div></CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-3"><div className="p-2 rounded-lg bg-surface-tertiary"><CheckCircle className="h-5 w-5 text-text-tertiary" /></div><div><p className="text-text-secondary text-xs">Completed</p><p className="stat-number text-xl text-text-tertiary">{completedCount}</p></div></CardContent></Card>
        </div>

        <div className="flex gap-2 flex-wrap">
          {[{ value: "all", label: "All" }, { value: "pending", label: "Pending" }, { value: "completed", label: "Completed" }, { value: "advance_tax", label: "Tax" }, { value: "gst_filing", label: "GST" }, { value: "insurance_premium", label: "Insurance" }, { value: "loan_emi", label: "Loan EMI" }].map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f.value ? "bg-gold/20 text-gold border border-gold/30" : "text-text-tertiary hover:text-text-secondary border border-border-light hover:border-border"}`}>{f.label}</button>
          ))}
        </div>

        {reminders === undefined ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-12 text-center"><Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" /><p className="text-text-secondary">{filter === "all" ? "No reminders yet. Add your first reminder!" : "No reminders match this filter."}</p></CardContent></Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((reminder) => {
              const days = getDaysUntil(reminder.due_date);
              const Icon = typeIcons[reminder.type] || Bell;
              const color = typeColors[reminder.type] || "text-text-secondary";
              return (
                <Card key={reminder._id} className={`transition-all ${reminder.is_completed ? "opacity-50" : ""}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <button onClick={() => reminder.is_completed ? deleteReminder({ id: reminder._id }) : completeReminder({ id: reminder._id })} className={`shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${reminder.is_completed ? "bg-emerald border-emerald" : "border-white/20 hover:border-gold"}`}>
                      {reminder.is_completed && <Check className="h-3 w-3 text-white" />}
                    </button>
                    <div className={`p-1.5 rounded-lg bg-surface-tertiary ${color}`}><Icon className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${reminder.is_completed ? "line-through text-text-tertiary" : "text-text-primary"}`}>{reminder.title}</p>
                      {reminder.notes && <p className="text-xs text-text-tertiary truncate">{reminder.notes}</p>}
                    </div>
                    {reminder.amount && <p className="stat-number text-sm text-gold shrink-0">{formatCurrency(reminder.amount)}</p>}
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-text-tertiary font-mono">{reminder.due_date}</p>
                      {!reminder.is_completed && <Badge variant={days < 0 ? "destructive" : days <= 7 ? "warning" : "success"} className="mt-1">{days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `${days}d`}</Badge>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Reminder</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Type</Label><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={[{ value: "advance_tax", label: "Advance Tax" }, { value: "gst_filing", label: "GST Filing" }, { value: "insurance_premium", label: "Insurance Premium" }, { value: "loan_emi", label: "Loan EMI" }, { value: "investment_review", label: "Investment Review" }, { value: "custom", label: "Custom" }]} /></div>
              <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Reminder title" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                <div className="space-y-2"><Label>Amount (optional)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" /></div>
              </div>
              <div className="flex items-center gap-3"><Switch checked={form.is_recurring} onCheckedChange={(v) => setForm({ ...form, is_recurring: v })} /><Label>Recurring</Label></div>
              <div className="space-y-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes" /></div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Add Reminder"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
