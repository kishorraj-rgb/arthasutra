import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const LOAN_TYPE = v.union(
  v.literal("home"),
  v.literal("car"),
  v.literal("personal"),
  v.literal("education")
);

const TRANSACTION_TYPE = v.union(
  v.literal("interest"),
  v.literal("principal_repayment"),
  v.literal("compound_repayment"),
  v.literal("interest_repayment"),
  v.literal("charges"),
  v.literal("deposit"),
  v.literal("other")
);

// ---------------------------------------------------------------------------
// Loan CRUD
// ---------------------------------------------------------------------------

export const addLoan = mutation({
  args: {
    userId: v.id("users"),
    type: LOAN_TYPE,
    lender: v.string(),
    principal: v.number(),
    outstanding: v.number(),
    emi_amount: v.number(),
    interest_rate: v.number(),
    emi_date: v.number(),
    tenure_remaining: v.number(),
    // Extended fields
    account_number: v.optional(v.string()),
    sanctioned_amount: v.optional(v.number()),
    product_type: v.optional(v.string()),
    start_date: v.optional(v.string()),
    loan_term: v.optional(v.number()),
    ifsc_code: v.optional(v.string()),
    branch_name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("loans", args);
  },
});

export const updateLoan = mutation({
  args: {
    id: v.id("loans"),
    outstanding: v.optional(v.number()),
    emi_amount: v.optional(v.number()),
    tenure_remaining: v.optional(v.number()),
    interest_rate: v.optional(v.number()),
    principal: v.optional(v.number()),
    lender: v.optional(v.string()),
    type: v.optional(LOAN_TYPE),
    emi_date: v.optional(v.number()),
    account_number: v.optional(v.string()),
    sanctioned_amount: v.optional(v.number()),
    product_type: v.optional(v.string()),
    start_date: v.optional(v.string()),
    loan_term: v.optional(v.number()),
    ifsc_code: v.optional(v.string()),
    branch_name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(id, filtered);
    }
  },
});

export const deleteLoan = mutation({
  args: { id: v.id("loans") },
  handler: async (ctx, args) => {
    // Cascade delete: remove all transactions for this loan
    const txns = await ctx.db
      .query("loan_transactions")
      .withIndex("by_loan", (q) => q.eq("loanId", args.id))
      .collect();
    for (const t of txns) {
      await ctx.db.delete(t._id);
    }
    await ctx.db.delete(args.id);
  },
});

// ---------------------------------------------------------------------------
// Loan Queries
// ---------------------------------------------------------------------------

export const getLoans = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("loans")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const getLoanByAccountNumber = query({
  args: { userId: v.id("users"), accountNumber: v.string() },
  handler: async (ctx, args) => {
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return loans.find((l) => l.account_number === args.accountNumber) ?? null;
  },
});

// ---------------------------------------------------------------------------
// Loan Transactions
// ---------------------------------------------------------------------------

export const getLoanTransactions = query({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    const txns = await ctx.db
      .query("loan_transactions")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .collect();
    // Sort by date descending
    return txns.sort((a, b) => b.date.localeCompare(a.date));
  },
});

export const importLoanTransactions = mutation({
  args: {
    loanId: v.id("loans"),
    userId: v.id("users"),
    transactions: v.array(
      v.object({
        date: v.string(),
        value_date: v.optional(v.string()),
        description: v.string(),
        debit: v.number(),
        credit: v.number(),
        balance: v.number(),
        type: TRANSACTION_TYPE,
        reference: v.optional(v.string()),
      })
    ),
    // Optional: update loan metadata on re-import
    loanUpdates: v.optional(
      v.object({
        outstanding: v.optional(v.number()),
        emi_amount: v.optional(v.number()),
        tenure_remaining: v.optional(v.number()),
        interest_rate: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Fetch existing transactions for dedup
    const existing = await ctx.db
      .query("loan_transactions")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .collect();

    // Build dedup key set: date + description_prefix + debit + credit
    const existingKeys = new Set(
      existing.map((t) =>
        `${t.date}|${t.description.substring(0, 40)}|${t.debit}|${t.credit}`
      )
    );

    let inserted = 0;
    let skipped = 0;

    for (const tx of args.transactions) {
      const key = `${tx.date}|${tx.description.substring(0, 40)}|${tx.debit}|${tx.credit}`;
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }

      await ctx.db.insert("loan_transactions", {
        userId: args.userId,
        loanId: args.loanId,
        ...tx,
      });
      existingKeys.add(key); // Prevent intra-batch dupes
      inserted++;
    }

    // Update loan metadata if provided
    if (args.loanUpdates) {
      const updates = Object.fromEntries(
        Object.entries(args.loanUpdates).filter(([, v]) => v !== undefined)
      );
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(args.loanId, updates);
      }
    }

    return { inserted, skipped };
  },
});
