import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const batchImportTransactions = mutation({
  args: {
    userId: v.id("users"),
    transactions: v.array(
      v.object({
        date: v.string(),
        amount: v.number(),
        type: v.union(v.literal("credit"), v.literal("debit")),
        description: v.string(),
        incomeType: v.union(
          v.literal("salary"),
          v.literal("freelance"),
          v.literal("rental"),
          v.literal("interest"),
          v.literal("dividend"),
          v.literal("other")
        ),
        expenseCategory: v.union(
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
          v.literal("other")
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    let incomeCount = 0;
    let expenseCount = 0;

    for (const tx of args.transactions) {
      if (tx.type === "credit") {
        await ctx.db.insert("income_entries", {
          userId: args.userId,
          date: tx.date,
          amount: tx.amount,
          type: tx.incomeType,
          description: tx.description,
          tds_deducted: 0,
          gst_collected: 0,
        });
        incomeCount++;
      } else {
        await ctx.db.insert("expense_entries", {
          userId: args.userId,
          date: tx.date,
          amount: tx.amount,
          category: tx.expenseCategory,
          description: tx.description,
          gst_paid: 0,
          is_business_expense: false,
        });
        expenseCount++;
      }
    }

    return { incomeCount, expenseCount };
  },
});

export const getExistingTransactionsInRange = query({
  args: {
    userId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const incomeEntries = await ctx.db
      .query("income_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const expenseEntries = await ctx.db
      .query("expense_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const filterByRange = <T extends { date: string }>(entries: T[]) =>
      entries.filter((e) => e.date >= args.startDate && e.date <= args.endDate);

    return {
      income: filterByRange(incomeEntries).map((e) => ({
        date: e.date,
        amount: e.amount,
        description: e.description,
      })),
      expenses: filterByRange(expenseEntries).map((e) => ({
        date: e.date,
        amount: e.amount,
        description: e.description,
      })),
    };
  },
});
