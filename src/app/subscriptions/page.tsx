"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  Plus,
  RefreshCw,
  CreditCard,
  Calendar,
  IndianRupee,
  Search,
  Trash2,
  Edit3,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";

const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half Yearly" },
  { value: "yearly", label: "Yearly" },
];

const CATEGORY_OPTIONS = [
  { value: "entertainment", label: "Entertainment" },
  { value: "productivity", label: "Productivity" },
  { value: "cloud_storage", label: "Cloud Storage" },
  { value: "insurance", label: "Insurance" },
  { value: "utility", label: "Utility" },
  { value: "fitness", label: "Fitness" },
  { value: "education", label: "Education" },
  { value: "other", label: "Other" },
];

const PAYMENT_OPTIONS = [
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank Transfer" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
];

function statusBadgeVariant(status: string): "success" | "warning" | "secondary" {
  if (status === "active") return "success";
  if (status === "paused") return "warning";
  return "secondary";
}

function frequencyLabel(freq: string) {
  return FREQUENCY_OPTIONS.find((f) => f.value === freq)?.label ?? freq;
}

function categoryLabel(cat: string) {
  return CATEGORY_OPTIONS.find((c) => c.value === cat)?.label ?? cat;
}

function paymentLabel(pm: string) {
  return PAYMENT_OPTIONS.find((p) => p.value === pm)?.label ?? pm;
}

const emptyForm = {
  name: "",
  amount: "",
  frequency: "monthly",
  category: "other",
  next_renewal_date: "",
  auto_renew: true,
  payment_method: "upi",
  card_last4: "",
  status: "active",
  notes: "",
};

export default function SubscriptionsPage() {
  const { user } = useAuth();

  const subscriptions = useQuery(
    api.subscriptions.getSubscriptions,
    user ? { userId: user.userId } : "skip"
  );
  const summary = useQuery(
    api.subscriptions.getSubscriptionSummary,
    user ? { userId: user.userId } : "skip"
  );
  const detected = useQuery(
    api.subscriptions.detectSubscriptions,
    user ? { userId: user.userId } : "skip"
  );

  const addSubscription = useMutation(api.subscriptions.addSubscription);
  const updateSubscription = useMutation(api.subscriptions.updateSubscription);
  const deleteSubscription = useMutation(api.subscriptions.deleteSubscription);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detectDialogOpen, setDetectDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  function handleFormChange(field: string, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function openAdd() {
    setEditingId(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(sub: NonNullable<typeof subscriptions>[number]) {
    setEditingId(sub._id);
    setFormData({
      name: sub.name,
      amount: sub.amount.toString(),
      frequency: sub.frequency,
      category: sub.category,
      next_renewal_date: sub.next_renewal_date,
      auto_renew: sub.auto_renew,
      payment_method: sub.payment_method,
      card_last4: sub.card_last4 ?? "",
      status: sub.status,
      notes: sub.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!user || !formData.name || !formData.amount) return;
    setSubmitting(true);
    try {
      const common = {
        name: formData.name,
        amount: parseFloat(formData.amount),
        frequency: formData.frequency as "monthly" | "quarterly" | "half_yearly" | "yearly",
        category: formData.category as "entertainment" | "productivity" | "cloud_storage" | "insurance" | "utility" | "fitness" | "education" | "other",
        next_renewal_date: formData.next_renewal_date,
        auto_renew: formData.auto_renew,
        payment_method: formData.payment_method as "credit_card" | "debit_card" | "upi" | "bank_transfer",
        card_last4: formData.card_last4 || undefined,
        status: formData.status as "active" | "paused" | "cancelled",
        notes: formData.notes || undefined,
      };

      if (editingId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await updateSubscription({ id: editingId as any, ...common });
      } else {
        await addSubscription({ userId: user.userId, ...common });
      }
      setDialogOpen(false);
      setFormData(emptyForm);
      setEditingId(null);
    } catch (error) {
      console.error("Failed to save subscription:", error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await deleteSubscription({ id: id as any });
    } catch (error) {
      console.error("Failed to delete subscription:", error);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleAddDetected(suggestion: any) {
    if (!user) return;
    try {
      // Use the subcategory as name if available (user's manual categorization is more accurate)
      const displayName = suggestion.subcategory || suggestion.name;
      await addSubscription({
        userId: user.userId,
        name: displayName,
        amount: suggestion.amount,
        frequency: suggestion.frequency as "monthly" | "quarterly" | "half_yearly" | "yearly",
        category: suggestion.category || "subscription",
        next_renewal_date: suggestion.lastDate || new Date().toISOString().split("T")[0],
        auto_renew: true,
        payment_method: suggestion.source === "cc" ? "credit_card" : "upi",
        status: "active",
        detected_from: suggestion.source === "cc" ? "cc_transactions" : "expense_entries",
      });
    } catch (error) {
      console.error("Failed to add detected subscription:", error);
    }
  }

  if (!user) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-text-secondary">Loading...</p>
        </div>
      </AppLayout>
    );
  }

  const isLoading = subscriptions === undefined;

  return (
    <AppLayout>
      <div className="space-y-6 animate-enter">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">Subscriptions</h1>
            <p className="text-text-secondary text-sm mt-1">Manage your recurring payments</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setDetectDialogOpen(true)}>
              <Search className="h-4 w-4 mr-2" />
              Detect from Transactions
            </Button>
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Subscription
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            {summary && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <IndianRupee className="h-4 w-4 text-accent-light" />
                      <p className="text-text-secondary text-xs uppercase">Monthly Cost</p>
                    </div>
                    <p className="stat-number text-2xl font-bold text-text-primary">{formatCurrency(summary.monthlyCost)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="h-4 w-4 text-blue-400" />
                      <p className="text-text-secondary text-xs uppercase">Annual Cost</p>
                    </div>
                    <p className="stat-number text-2xl font-bold text-blue-500">{formatCurrency(summary.annualCost)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-4 w-4 text-emerald-400" />
                      <p className="text-text-secondary text-xs uppercase">Active</p>
                    </div>
                    <p className="stat-number text-2xl font-bold text-emerald-500">{summary.activeCount}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-amber-400" />
                      <p className="text-text-secondary text-xs uppercase">Upcoming Renewals</p>
                    </div>
                    <p className="stat-number text-2xl font-bold text-amber-500">{summary.upcomingRenewals}</p>
                    <p className="text-text-tertiary text-xs mt-1">Next 30 days</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Subscription Cards */}
            {subscriptions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 mb-4">
                    <RefreshCw className="h-8 w-8 text-accent-light" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">No subscriptions tracked</h3>
                  <p className="text-text-secondary text-sm max-w-md mb-6">
                    Add your recurring subscriptions to track and manage costs, or detect them from your transaction history.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setDetectDialogOpen(true)}>
                      <Search className="h-4 w-4 mr-2" />
                      Detect
                    </Button>
                    <Button onClick={openAdd}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Subscription
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {subscriptions.map((sub) => (
                  <Card key={sub._id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-snug">{sub.name}</CardTitle>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant={statusBadgeVariant(sub.status)} className="text-[10px]">
                            {sub.status}
                          </Badge>
                          <button
                            onClick={() => openEdit(sub)}
                            className="rounded p-1 text-text-tertiary hover:text-accent hover:bg-accent/10 transition-colors"
                            title="Edit subscription"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(sub._id)}
                            className="rounded p-1 text-text-tertiary hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                            title="Delete subscription"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <p className="text-text-tertiary text-xs">Amount</p>
                          <p className="font-mono font-semibold text-text-primary">{formatCurrency(sub.amount)}</p>
                        </div>
                        <div>
                          <p className="text-text-tertiary text-xs">Frequency</p>
                          <p className="text-text-primary">{frequencyLabel(sub.frequency)}</p>
                        </div>
                        <div>
                          <p className="text-text-tertiary text-xs">Category</p>
                          <p className="text-text-primary">{categoryLabel(sub.category)}</p>
                        </div>
                        <div>
                          <p className="text-text-tertiary text-xs">Payment</p>
                          <p className="text-text-primary">{paymentLabel(sub.payment_method)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-border-light pt-3">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-text-tertiary" />
                          <span className="text-xs text-text-secondary">
                            Renews: {sub.next_renewal_date}
                          </span>
                        </div>
                        {sub.auto_renew && (
                          <Badge variant="secondary" className="text-[10px]">Auto-renew</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Subscription" : "Add Subscription"}</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="sub-name">Name</Label>
                <Input
                  id="sub-name"
                  placeholder="e.g. Netflix, Spotify"
                  value={formData.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub-amount">Amount</Label>
                <Input
                  id="sub-amount"
                  type="number"
                  placeholder="0"
                  value={formData.amount}
                  onChange={(e) => handleFormChange("amount", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub-frequency">Frequency</Label>
                <Select
                  id="sub-frequency"
                  options={FREQUENCY_OPTIONS}
                  value={formData.frequency}
                  onChange={(e) => handleFormChange("frequency", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub-category">Category</Label>
                <Select
                  id="sub-category"
                  options={CATEGORY_OPTIONS}
                  value={formData.category}
                  onChange={(e) => handleFormChange("category", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub-renewal">Next Renewal Date</Label>
                <Input
                  id="sub-renewal"
                  type="date"
                  value={formData.next_renewal_date}
                  onChange={(e) => handleFormChange("next_renewal_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub-payment">Payment Method</Label>
                <Select
                  id="sub-payment"
                  options={PAYMENT_OPTIONS}
                  value={formData.payment_method}
                  onChange={(e) => handleFormChange("payment_method", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub-status">Status</Label>
                <Select
                  id="sub-status"
                  options={STATUS_OPTIONS}
                  value={formData.status}
                  onChange={(e) => handleFormChange("status", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub-notes">Notes</Label>
                <Input
                  id="sub-notes"
                  placeholder="Optional notes"
                  value={formData.notes}
                  onChange={(e) => handleFormChange("notes", e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between sm:col-span-2 rounded-lg border border-border-light bg-surface-tertiary/50 p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="sub-auto">Auto Renew</Label>
                  <p className="text-xs text-text-tertiary">Automatically renews on the due date</p>
                </div>
                <Switch
                  id="sub-auto"
                  checked={formData.auto_renew}
                  onCheckedChange={(checked) => handleFormChange("auto_renew", checked)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingId ? "Update" : "Add"} Subscription
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detection Dialog */}
        <Dialog open={detectDialogOpen} onOpenChange={setDetectDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent-light" />
                Detected Subscriptions
              </DialogTitle>
            </DialogHeader>

            <div className="py-4 space-y-3">
              {detected === undefined ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-accent-light" />
                  <span className="ml-2 text-text-secondary text-sm">Analyzing transactions...</span>
                </div>
              ) : detected.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-text-secondary text-sm">
                    No recurring payment patterns found in your transactions.
                  </p>
                </div>
              ) : (
                detected.map((suggestion: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-border-light p-4 hover:bg-surface-tertiary/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-text-primary">
                          {suggestion.subcategory || suggestion.name}
                        </p>
                        {suggestion.source === "cc" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-500 font-medium">CC</span>
                        )}
                        {suggestion.source === "bank" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 font-medium">Bank</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-text-tertiary">
                        <span className="font-mono">{formatCurrency(suggestion.amount)}</span>
                        <span>{frequencyLabel(suggestion.frequency)}</span>
                        <span>{suggestion.occurrences}x</span>
                        {suggestion.category && suggestion.category !== "other" && (
                          <span className="text-accent">{suggestion.category}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddDetected(suggestion)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </Button>
                  </div>
                ))
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setDetectDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
