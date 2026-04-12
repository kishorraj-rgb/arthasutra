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

    const today = new Date().toISOString().split("T")[0];

    // Only count active subs with future renewal dates (truly upcoming costs)
    const upcomingActiveSubs = activeSubs.filter(
      (s) => s.next_renewal_date >= today
    );

    // Calculate monthly cost only from upcoming active subscriptions
    const frequencyMultiplier: Record<string, number> = {
      monthly: 1,
      quarterly: 1 / 3,
      half_yearly: 1 / 6,
      yearly: 1 / 12,
    };

    const monthlyCost = upcomingActiveSubs.reduce((sum, s) => {
      return sum + s.amount * (frequencyMultiplier[s.frequency] ?? 1);
    }, 0);

    const annualCost = upcomingActiveSubs.reduce((sum, s) => {
      const yearMultiplier: Record<string, number> = {
        monthly: 12,
        quarterly: 4,
        half_yearly: 2,
        yearly: 1,
      };
      return sum + s.amount * (yearMultiplier[s.frequency] ?? 12);
    }, 0);

    // Upcoming renewals (next 30 days)
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const upcomingRenewals = activeSubs.filter(
      (s) => s.next_renewal_date >= today && s.next_renewal_date <= thirtyDays
    ).length;

    // Next upcoming renewal amount
    const nextRenewal = activeSubs
      .filter((s) => s.next_renewal_date >= today)
      .sort((a, b) => a.next_renewal_date.localeCompare(b.next_renewal_date))[0];

    // Cost by category
    const categoryBreakdown: Record<string, { count: number; total: number }> = {};
    for (const s of activeSubs) {
      if (!categoryBreakdown[s.category]) categoryBreakdown[s.category] = { count: 0, total: 0 };
      categoryBreakdown[s.category].count++;
      categoryBreakdown[s.category].total += s.amount * (frequencyMultiplier[s.frequency] ?? 1);
    }

    // Expired active subs (renewal date passed — likely one-time or expired)
    const expiredActive = activeSubs.filter((s) => s.next_renewal_date < today).length;

    return {
      monthlyCost: Math.round(monthlyCost),
      annualCost: Math.round(annualCost),
      activeCount: activeSubs.length,
      pausedCount: pausedSubs.length,
      cancelledCount: cancelledSubs.length,
      upcomingRenewals,
      totalCount: subs.length,
      expiredActive,
      categoryBreakdown,
      nextRenewal: nextRenewal
        ? { name: nextRenewal.name, date: nextRenewal.next_renewal_date, amount: nextRenewal.amount }
        : null,
    };
  },
});

export const detectSubscriptions = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Simple approach: pick ALL transactions categorized as "subscription"
    // from both Expenses AND Credit Cards. User has manually categorized these.

    const expenses = await ctx.db
      .query("expense_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const ccTransactions = await ctx.db
      .query("cc_transactions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Filter: only category === "subscription"
    const subExpenses = expenses.filter((e) => e.category === "subscription");
    const subCC = ccTransactions.filter((t) => t.type === "debit" && t.category === "subscription");

    // Group by subcategory (user's manual name) — this is the subscription name
    const grouped: Record<string, {
      name: string; amounts: number[]; dates: string[]; source: string;
      category: string; subcategory: string;
    }> = {};

    for (const e of subExpenses) {
      const sub = (e as Record<string, unknown>).subcategory as string || "";
      const name = sub || e.description.substring(0, 30).trim();
      const key = name.toLowerCase();
      if (!grouped[key]) {
        grouped[key] = { name, amounts: [], dates: [], source: "bank", category: "subscription", subcategory: sub };
      }
      grouped[key].amounts.push(e.amount);
      grouped[key].dates.push(e.date);
    }

    for (const t of subCC) {
      const sub = (t as Record<string, unknown>).subcategory as string || "";
      const name = sub || t.merchant_name || t.description.substring(0, 30).trim();
      const key = name.toLowerCase();
      if (!grouped[key]) {
        grouped[key] = { name, amounts: [], dates: [], source: "cc", category: "subscription", subcategory: sub };
      }
      grouped[key].amounts.push(t.amount);
      grouped[key].dates.push(t.date);
    }

    // Build suggestions from grouped data
    const suggestions: Array<{
      name: string;
      amount: number;
      frequency: string;
      occurrences: number;
      source: string;
      lastDate: string;
      category: string;
      subcategory: string;
    }> = [];

    for (const [, data] of Object.entries(grouped)) {
      const avgAmt = data.amounts.reduce((s, a) => s + a, 0) / data.amounts.length;
      const sortedDates = data.dates.sort();

      // Estimate frequency from date gaps (if 2+ entries)
      let frequency = "monthly";
      if (sortedDates.length >= 2) {
        let totalGapDays = 0;
        for (let i = 1; i < sortedDates.length; i++) {
          const d1 = new Date(sortedDates[i - 1]);
          const d2 = new Date(sortedDates[i]);
          totalGapDays += (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
        }
        const avgGap = totalGapDays / (sortedDates.length - 1);
        if (avgGap > 300) frequency = "yearly";
        else if (avgGap > 150) frequency = "half_yearly";
        else if (avgGap > 75) frequency = "quarterly";
      }

      suggestions.push({
        name: data.name,
        amount: Math.round(avgAmt),
        frequency,
        occurrences: data.dates.length,
        source: data.source,
        lastDate: sortedDates[sortedDates.length - 1],
        category: data.category,
        subcategory: data.subcategory,
      });
    }

    return suggestions.sort((a, b) => b.occurrences - a.occurrences);
  },
});
