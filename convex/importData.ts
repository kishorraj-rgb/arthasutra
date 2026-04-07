import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const batchImportTransactions = mutation({
  args: {
    userId: v.id("users"),
    sourceBank: v.optional(v.string()),
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
          v.literal("refund"),
          v.literal("reimbursement"),
          v.literal("transfer"),
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
          v.literal("clothing"),
          v.literal("grocery"),
          v.literal("shopping"),
          v.literal("personal_care"),
          v.literal("subscription"),
          v.literal("donation"),
          v.literal("emi"),
          v.literal("rent"),
          v.literal("travel"),
          v.literal("tax_payment"),
          v.literal("credit_card_bill"),
          v.literal("recharge"),
          v.literal("household"),
          v.literal("cash_withdrawal"),
          v.literal("transfer"),
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
          source_bank: args.sourceBank,
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
          source_bank: args.sourceBank,
          gst_paid: 0,
          is_business_expense: false,
        });
        expenseCount++;
      }
    }

    return { incomeCount, expenseCount };
  },
});

// One-time migration: backfill source_bank on all existing entries
// Can be called without userId — will use first user in system
export const backfillSourceBank = mutation({
  args: {
    userId: v.optional(v.id("users")),
    sourceBank: v.string(),
  },
  handler: async (ctx, args) => {
    let userId = args.userId;
    if (!userId) {
      const firstUser = await ctx.db.query("users").first();
      if (!firstUser) return { expenseCount: 0, incomeCount: 0, error: "No users found" };
      userId = firstUser._id;
    }

    let expenseCount = 0;
    let incomeCount = 0;

    const expenses = await ctx.db
      .query("expense_entries")
      .withIndex("by_user", (q) => q.eq("userId", userId!))
      .collect();

    for (const e of expenses) {
      if (!e.source_bank) {
        await ctx.db.patch(e._id, { source_bank: args.sourceBank });
        expenseCount++;
      }
    }

    const income = await ctx.db
      .query("income_entries")
      .withIndex("by_user", (q) => q.eq("userId", userId!))
      .collect();

    for (const i of income) {
      if (!i.source_bank) {
        await ctx.db.patch(i._id, { source_bank: args.sourceBank });
        incomeCount++;
      }
    }

    return { expenseCount, incomeCount };
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
