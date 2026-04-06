import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const addIncomeEntry = mutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
    amount: v.number(),
    type: v.union(
      v.literal("salary"),
      v.literal("freelance"),
      v.literal("rental"),
      v.literal("interest"),
      v.literal("dividend"),
      v.literal("refund"),
      v.literal("reimbursement"),
      v.literal("transfer"),
      v.literal("other")
    ),
    description: v.string(),
    tds_deducted: v.number(),
    gst_collected: v.number(),
    invoice_number: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("income_entries", args);
  },
});

export const updateIncomeEntry = mutation({
  args: {
    id: v.id("income_entries"),
    date: v.optional(v.string()),
    amount: v.optional(v.number()),
    type: v.optional(
      v.union(
        v.literal("salary"),
        v.literal("freelance"),
        v.literal("rental"),
        v.literal("interest"),
        v.literal("dividend"),
        v.literal("refund"),
        v.literal("reimbursement"),
        v.literal("transfer"),
        v.literal("other")
      )
    ),
    description: v.optional(v.string()),
    tds_deducted: v.optional(v.number()),
    gst_collected: v.optional(v.number()),
    invoice_number: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const deleteIncomeEntry = mutation({
  args: { id: v.id("income_entries") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const getIncomeEntries = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("income_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const getMonthlyIncome = query({
  args: {
    userId: v.id("users"),
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
    const startDate = `${args.year}-${String(args.month).padStart(2, "0")}-01`;
    const endDate =
      args.month === 12
        ? `${args.year + 1}-01-01`
        : `${args.year}-${String(args.month + 1).padStart(2, "0")}-01`;

    const entries = await ctx.db
      .query("income_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return entries.filter((e) => e.date >= startDate && e.date < endDate);
  },
});

export const getAnnualIncome = query({
  args: {
    userId: v.id("users"),
    financialYear: v.string(), // e.g., "2024-25"
  },
  handler: async (ctx, args) => {
    const [startYearStr] = args.financialYear.split("-");
    const startYear = parseInt(startYearStr);
    const startDate = `${startYear}-04-01`;
    const endDate = `${startYear + 1}-03-31`;

    const entries = await ctx.db
      .query("income_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return entries.filter((e) => e.date >= startDate && e.date <= endDate);
  },
});
