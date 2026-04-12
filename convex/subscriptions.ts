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
    // Gather transactions from BOTH expenses AND credit cards
    const expenses = await ctx.db
      .query("expense_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const ccTransactions = await ctx.db
      .query("cc_transactions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Known subscription patterns for better naming
    const KNOWN_SUBS: Array<{ pattern: RegExp; name: string }> = [
      { pattern: /NETFLIX/i, name: "Netflix" },
      { pattern: /SPOTIFY/i, name: "Spotify" },
      { pattern: /AMAZON\s*PRIME/i, name: "Amazon Prime" },
      { pattern: /HOTSTAR|DISNEY/i, name: "Hotstar/Disney+" },
      { pattern: /YOUTUBE\s*(PREMIUM)?GOOGLE/i, name: "YouTube Premium" },
      { pattern: /APPLE\s*(MUSIC|TV|ONE|ICLOUD)/i, name: "Apple" },
      { pattern: /GOOGLE\s*(PLAY|ONE|CLOUD|WORKSPACE)/i, name: "Google" },
      { pattern: /ADOBE/i, name: "Adobe" },
      { pattern: /OPENAI|CHATGPT/i, name: "OpenAI/ChatGPT" },
      { pattern: /CURSOR/i, name: "Cursor" },
      { pattern: /GITHUB/i, name: "GitHub" },
      { pattern: /LINKEDIN/i, name: "LinkedIn" },
      { pattern: /ZOOM/i, name: "Zoom" },
      { pattern: /NOTION/i, name: "Notion" },
      { pattern: /FIGMA/i, name: "Figma" },
      { pattern: /CANVA/i, name: "Canva" },
      { pattern: /ZEE5/i, name: "Zee5" },
      { pattern: /SONY\s*LIV/i, name: "SonyLIV" },
      { pattern: /AIRTEL/i, name: "Airtel" },
      { pattern: /JIO/i, name: "Jio" },
      { pattern: /SETAPP|PADDLE/i, name: "Setapp/PaddleNet" },
      { pattern: /VERCEL/i, name: "Vercel" },
      { pattern: /HOSTINGER/i, name: "Hostinger" },
      { pattern: /MICROSOFT/i, name: "Microsoft" },
    ];

    function getSubName(desc: string): string {
      for (const s of KNOWN_SUBS) {
        if (s.pattern.test(desc)) return s.name;
      }
      return desc.substring(0, 30).trim();
    }

    // Merge all transactions into one list — include category + subcategory
    const allTxns: Array<{ amount: number; date: string; description: string; source: string; category: string; subcategory: string }> = [];

    for (const e of expenses) {
      allTxns.push({
        amount: e.amount, date: e.date, description: e.description, source: "bank",
        category: e.category || "other",
        subcategory: (e as Record<string, unknown>).subcategory as string || "",
      });
    }
    for (const cc of ccTransactions) {
      if (cc.type === "debit") {
        allTxns.push({
          amount: cc.amount, date: cc.date, description: cc.merchant_name || cc.description, source: "cc",
          category: cc.category || "other",
          subcategory: (cc as Record<string, unknown>).subcategory as string || "",
        });
      }
    }

    // Group by normalized name + similar amount (±15%)
    const grouped: Record<string, {
      name: string; amounts: number[]; dates: string[]; source: string;
      category: string; subcategory: string;
    }> = {};

    for (const tx of allTxns) {
      const name = getSubName(tx.description);
      const key = name.toLowerCase();
      if (!grouped[key]) {
        grouped[key] = {
          name, amounts: [], dates: [], source: tx.source,
          category: tx.category, subcategory: tx.subcategory,
        };
      }
      grouped[key].amounts.push(tx.amount);
      grouped[key].dates.push(tx.date);
      // Use the most recently assigned category (user's manual categorization)
      if (tx.category && tx.category !== "other") {
        grouped[key].category = tx.category;
      }
      if (tx.subcategory) {
        grouped[key].subcategory = tx.subcategory;
      }
    }

    // Find recurring patterns
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
      if (data.dates.length < 2) continue;

      // Check amount consistency (±15%)
      const avgAmt = data.amounts.reduce((s, a) => s + a, 0) / data.amounts.length;
      const consistent = data.amounts.every((a) => Math.abs(a - avgAmt) / Math.max(avgAmt, 1) < 0.15);
      if (!consistent) continue;

      // Estimate frequency from date gaps
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

    return suggestions
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 50); // Top 50 suggestions
  },
});
