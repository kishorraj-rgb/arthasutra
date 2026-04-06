import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const addInvestment = mutation({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("mutual_fund"),
      v.literal("stocks"),
      v.literal("ppf"),
      v.literal("nps"),
      v.literal("fd"),
      v.literal("rd"),
      v.literal("gold"),
      v.literal("real_estate"),
      v.literal("elss"),
      v.literal("ulip")
    ),
    name: v.string(),
    invested_amount: v.number(),
    current_value: v.number(),
    date_invested: v.string(),
    maturity_date: v.optional(v.string()),
    expected_return_rate: v.number(),
    lock_in_period: v.optional(v.number()),
    tax_saving: v.boolean(),
    section: v.union(
      v.literal("80C"),
      v.literal("80D"),
      v.literal("80CCD"),
      v.literal("none")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("investments", args);
  },
});

export const updateInvestment = mutation({
  args: {
    id: v.id("investments"),
    current_value: v.optional(v.number()),
    invested_amount: v.optional(v.number()),
    expected_return_rate: v.optional(v.number()),
    maturity_date: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const deleteInvestment = mutation({
  args: { id: v.id("investments") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const getInvestments = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("investments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const getInvestmentPortfolio = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const investments = await ctx.db
      .query("investments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const totalInvested = investments.reduce((sum, i) => sum + i.invested_amount, 0);
    const totalCurrent = investments.reduce((sum, i) => sum + i.current_value, 0);
    const gainLoss = totalCurrent - totalInvested;
    const gainLossPercent = totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0;

    const byType: Record<string, { invested: number; current: number; count: number }> = {};
    for (const inv of investments) {
      if (!byType[inv.type]) {
        byType[inv.type] = { invested: 0, current: 0, count: 0 };
      }
      byType[inv.type].invested += inv.invested_amount;
      byType[inv.type].current += inv.current_value;
      byType[inv.type].count += 1;
    }

    const taxSavingUsed = investments
      .filter((i) => i.tax_saving && i.section === "80C")
      .reduce((sum, i) => sum + i.invested_amount, 0);

    return {
      investments,
      totalInvested,
      totalCurrent,
      gainLoss,
      gainLossPercent,
      byType,
      taxSavingUsed,
      taxSavingLimit: 150000,
    };
  },
});
