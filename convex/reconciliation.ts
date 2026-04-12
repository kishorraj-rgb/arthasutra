import { query } from "./_generated/server";
import { v } from "convex/values";

// ─── Cross-Module Reconciliation ───────────────────────────────────────
// Finds connections between different ArthaSutra modules

/**
 * Find CC bill payments in expense entries and link them to credit cards
 */
export const findCCBillPayments = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const expenses = await ctx.db
      .query("expense_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const ccPaymentPatterns = [
      /cc\s*payment/i, /credit\s*card\s*payment/i, /billpay/i,
      /bill\s*pay/i, /card\s*payment/i, /ib\s*billpay/i,
      /autopay/i, /auto\s*debit.*card/i,
    ];

    return expenses
      .filter((e) => {
        const desc = e.description.toLowerCase();
        return ccPaymentPatterns.some((p) => p.test(desc)) ||
          desc.includes("credit card") || e.category === "credit_card_bill";
      })
      .map((e) => ({
        _id: e._id,
        date: e.date,
        amount: e.amount,
        description: e.description,
        source_bank: (e as Record<string, unknown>).source_bank as string || "",
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  },
});

/**
 * Find loan EMI payments in expense entries
 */
export const findLoanEMIPayments = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const expenses = await ctx.db
      .query("expense_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const emiPatterns = [
      /emi/i, /loan\s*repayment/i, /loan\s*emi/i,
      /home\s*loan/i, /car\s*loan/i, /personal\s*loan/i,
      /ach.*loan/i, /nach.*emi/i,
    ];

    return expenses
      .filter((e) => emiPatterns.some((p) => p.test(e.description)) || e.category === "emi")
      .map((e) => ({
        _id: e._id,
        date: e.date,
        amount: e.amount,
        description: e.description,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  },
});

/**
 * Find insurance premium payments in expense entries
 */
export const findInsurancePremiums = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const expenses = await ctx.db
      .query("expense_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return expenses
      .filter((e) => e.category === "insurance" ||
        /insurance|premium|lic|sbi\s*life|icici\s*pru|hdfc\s*life/i.test(e.description))
      .map((e) => ({
        _id: e._id,
        date: e.date,
        amount: e.amount,
        description: e.description,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  },
});

/**
 * Find SIP/Investment debits in expense entries
 */
export const findInvestmentDebits = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const expenses = await ctx.db
      .query("expense_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return expenses
      .filter((e) => e.category === "investment" ||
        /sip|mutual\s*fund|ppf|nps|elss|zerodha|groww|kfintech|cams/i.test(e.description))
      .map((e) => ({
        _id: e._id,
        date: e.date,
        amount: e.amount,
        description: e.description,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  },
});

/**
 * Overall reconciliation summary
 */
export const getReconciliationSummary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const expenses = await ctx.db
      .query("expense_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const income = await ctx.db
      .query("income_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const ccTxns = await ctx.db
      .query("cc_transactions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const insurance = await ctx.db
      .query("insurance_policies")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Category breakdown
    const categoryBreakdown: Record<string, { count: number; total: number }> = {};
    for (const e of expenses) {
      const cat = e.category || "other";
      if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { count: 0, total: 0 };
      categoryBreakdown[cat].count++;
      categoryBreakdown[cat].total += e.amount;
    }

    // Uncategorized count
    const uncategorizedExpenses = expenses.filter((e) => !e.category || e.category === "other").length;
    const uncategorizedCC = ccTxns.filter((t) => !t.category || t.category === "other").length;

    // Unlinked invoices (paid but no linkedIncomeId)
    const unlinkedInvoices = invoices.filter((i) =>
      i.status === "paid" && !i.linkedIncomeId
    ).length;

    // CC transactions without expense match
    const unmatchedCC = ccTxns.filter((t) =>
      t.match_status === "unmatched" && t.type === "debit"
    ).length;

    return {
      totalExpenses: expenses.length,
      totalIncome: income.length,
      totalCCTransactions: ccTxns.length,
      totalInvoices: invoices.length,
      totalLoans: loans.length,
      totalInsurance: insurance.length,
      uncategorizedExpenses,
      uncategorizedCC,
      unlinkedInvoices,
      unmatchedCC,
      categoryBreakdown,
      // Health scores
      categorizationHealth: expenses.length > 0
        ? Math.round(((expenses.length - uncategorizedExpenses) / expenses.length) * 100)
        : 100,
      ccMatchHealth: ccTxns.length > 0
        ? Math.round(((ccTxns.length - unmatchedCC) / ccTxns.length) * 100)
        : 100,
      invoiceLinkHealth: invoices.filter((i) => i.status === "paid").length > 0
        ? Math.round(((invoices.filter((i) => i.status === "paid").length - unlinkedInvoices) / invoices.filter((i) => i.status === "paid").length) * 100)
        : 100,
    };
  },
});
