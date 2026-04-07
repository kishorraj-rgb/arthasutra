import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getSubscriptions = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Sort: active first, then by next_renewal_date
    return subs.sort((a, b) => {
      const statusOrder: Record<string, number> = { active: 0, paused: 1, cancelled: 2 };
      const statusDiff = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
      if (statusDiff !== 0) return statusDiff;
      return a.next_renewal_date.localeCompare(b.next_renewal_date);
    });
  },
});

export const addSubscription = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    amount: v.number(),
    frequency: v.union(
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("half_yearly"),
      v.literal("yearly")
    ),
    category: v.union(
      v.literal("entertainment"),
      v.literal("productivity"),
      v.literal("cloud_storage"),
      v.literal("insurance"),
      v.literal("utility"),
      v.literal("fitness"),
      v.literal("education"),
      v.literal("other")
    ),
    next_renewal_date: v.string(),
    auto_renew: v.boolean(),
    payment_method: v.union(
      v.literal("credit_card"),
      v.literal("debit_card"),
      v.literal("upi"),
      v.literal("bank_transfer")
    ),
    card_last4: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("cancelled")
    ),
    notes: v.optional(v.string()),
    detected_from: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("subscriptions", args);
  },
});

export const updateSubscription = mutation({
  args: {
    id: v.id("subscriptions"),
    name: v.optional(v.string()),
    amount: v.optional(v.number()),
    frequency: v.optional(
      v.union(
        v.literal("monthly"),
        v.literal("quarterly"),
        v.literal("half_yearly"),
        v.literal("yearly")
      )
    ),
    category: v.optional(
      v.union(
        v.literal("entertainment"),
        v.literal("productivity"),
        v.literal("cloud_storage"),
        v.literal("insurance"),
        v.literal("utility"),
        v.literal("fitness"),
        v.literal("education"),
        v.literal("other")
      )
    ),
    next_renewal_date: v.optional(v.string()),
    auto_renew: v.optional(v.boolean()),
    payment_method: v.optional(
      v.union(
        v.literal("credit_card"),
        v.literal("debit_card"),
        v.literal("upi"),
        v.literal("bank_transfer")
      )
    ),
    card_last4: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("paused"),
        v.literal("cancelled")
      )
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const deleteSubscription = mutation({
  args: { id: v.id("subscriptions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const getSubscriptionSummary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const activeSubs = subs.filter((s) => s.status === "active");
    const pausedSubs = subs.filter((s) => s.status === "paused");
    const cancelledSubs = subs.filter((s) => s.status === "cancelled");

    // Calculate monthly cost (normalize all frequencies to monthly)
    const frequencyMultiplier: Record<string, number> = {
      monthly: 1,
      quarterly: 1 / 3,
      half_yearly: 1 / 6,
      yearly: 1 / 12,
    };

    const monthlyCost = activeSubs.reduce((sum, s) => {
      return sum + s.amount * (frequencyMultiplier[s.frequency] ?? 1);
    }, 0);

    const annualCost = monthlyCost * 12;

    // Upcoming renewals (next 30 days)
    const today = new Date().toISOString().split("T")[0];
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const upcomingRenewals = activeSubs.filter(
      (s) => s.next_renewal_date >= today && s.next_renewal_date <= thirtyDays
    ).length;

    return {
      monthlyCost: Math.round(monthlyCost),
      annualCost: Math.round(annualCost),
      activeCount: activeSubs.length,
      pausedCount: pausedSubs.length,
      cancelledCount: cancelledSubs.length,
      upcomingRenewals,
      totalCount: subs.length,
    };
  },
});

export const detectSubscriptions = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const expenses = await ctx.db
      .query("expense_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Group by description (normalized)
    const grouped: Record<string, { amount: number; dates: string[]; description: string }> = {};

    for (const e of expenses) {
      const key = e.description.toLowerCase().trim();
      if (!grouped[key]) {
        grouped[key] = { amount: e.amount, dates: [], description: e.description };
      }
      grouped[key].dates.push(e.date);
      // Use most recent amount
      if (e.date > grouped[key].dates[0]) {
        grouped[key].amount = e.amount;
      }
    }

    // Find recurring patterns: 2+ entries at same amount to same payee
    const suggestions: Array<{
      name: string;
      amount: number;
      frequency: string;
      occurrences: number;
    }> = [];

    for (const [, data] of Object.entries(grouped)) {
      if (data.dates.length >= 2) {
        // Estimate frequency based on average gap between dates
        const sortedDates = data.dates.sort();
        let totalGapDays = 0;
        for (let i = 1; i < sortedDates.length; i++) {
          const d1 = new Date(sortedDates[i - 1]);
          const d2 = new Date(sortedDates[i]);
          totalGapDays += (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
        }
        const avgGap = totalGapDays / (sortedDates.length - 1);

        let frequency = "monthly";
        if (avgGap > 300) frequency = "yearly";
        else if (avgGap > 150) frequency = "half_yearly";
        else if (avgGap > 75) frequency = "quarterly";

        suggestions.push({
          name: data.description,
          amount: data.amount,
          frequency,
          occurrences: data.dates.length,
        });
      }
    }

    return suggestions.sort((a, b) => b.occurrences - a.occurrences);
  },
});
