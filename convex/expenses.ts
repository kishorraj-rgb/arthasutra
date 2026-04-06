import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const addExpenseEntry = mutation({
  args: {
    userId: v.id("users"),
    date: v.string(),
    amount: v.number(),
    category: v.union(
      v.literal("housing"),
      v.literal("food"),
      v.literal("transport"),
      v.literal("medical"),
      v.literal("education"),
      v.literal("insurance"),
      v.literal("investment"),
      v.literal("driver_salary"),
      v.literal("school_fees"),
      v.literal("utilities"),
      v.literal("entertainment"),
      v.literal("clothing"),
      v.literal("grocery"),
      v.literal("shopping"),
      v.literal("personal_care"),
      v.literal("subscription"),
      v.literal("donation"),
      v.literal("emi"),
      v.literal("rent"),
      v.literal("travel"),
      v.literal("cash_withdrawal"),
      v.literal("transfer"),
      v.literal("other")
    ),
    description: v.string(),
    gst_paid: v.number(),
    is_business_expense: v.boolean(),
    receipt_url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("expense_entries", args);
  },
});

export const updateExpenseEntry = mutation({
  args: {
    id: v.id("expense_entries"),
    date: v.optional(v.string()),
    amount: v.optional(v.number()),
    category: v.optional(
      v.union(
        v.literal("housing"),
        v.literal("food"),
        v.literal("transport"),
        v.literal("medical"),
        v.literal("education"),
        v.literal("insurance"),
        v.literal("investment"),
        v.literal("driver_salary"),
        v.literal("school_fees"),
        v.literal("utilities"),
        v.literal("entertainment"),
      v.literal("transfer"),
        v.literal("other")
      )
    ),
    description: v.optional(v.string()),
    gst_paid: v.optional(v.number()),
    is_business_expense: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const deleteExpenseEntry = mutation({
  args: { id: v.id("expense_entries") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const getExpenseEntries = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("expense_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const getMonthlyExpenses = query({
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
      .query("expense_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return entries.filter((e) => e.date >= startDate && e.date < endDate);
  },
});

export const getExpensesByCategory = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("expense_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const byCategory: Record<string, number> = {};
    for (const entry of entries) {
      byCategory[entry.category] = (byCategory[entry.category] || 0) + entry.amount;
    }
    return byCategory;
  },
});
