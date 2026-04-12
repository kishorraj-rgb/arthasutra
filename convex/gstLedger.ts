import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── GST Electronic Cash Ledger ──────────────────────────────────────

export const importCashLedger = mutation({
  args: {
    userId: v.id("users"),
    entries: v.array(
      v.object({
        srNo: v.number(),
        date: v.string(),
        referenceNo: v.string(),
        taxPeriod: v.string(),
        description: v.string(),
        txnType: v.string(),
        igst: v.number(),
        cgst: v.number(),
        sgst: v.number(),
        cess: v.number(),
        total: v.number(),
        interestIgst: v.number(),
        interestCgst: v.number(),
        interestSgst: v.number(),
        balanceIgst: v.number(),
        balanceCgst: v.number(),
        balanceSgst: v.number(),
        balanceCess: v.number(),
        balanceTotal: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Get existing entries to dedup by referenceNo
    const existing = await ctx.db
      .query("gst_cash_ledger")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const existingRefs = new Set(existing.map((e) => e.referenceNo));

    let imported = 0;
    let skipped = 0;
    for (const entry of args.entries) {
      if (entry.referenceNo && existingRefs.has(entry.referenceNo)) {
        skipped++;
        continue;
      }
      await ctx.db.insert("gst_cash_ledger", {
        userId: args.userId,
        ...entry,
      });
      imported++;
    }
    return { imported, skipped, total: args.entries.length };
  },
});

export const getCashLedger = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("gst_cash_ledger")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return entries.sort((a, b) => a.srNo - b.srNo);
  },
});

export const getCashLedgerSummary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("gst_cash_ledger")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    if (entries.length === 0) return null;

    const credits = entries.filter((e) => e.txnType === "Credit");
    const debits = entries.filter((e) => e.txnType === "Debit");

    const totalDeposited = credits.reduce((s, e) => s + e.total, 0);
    const totalDebited = debits.reduce((s, e) => s + e.total, 0);

    // Interest paid (sum of all interest columns across all debits)
    const totalInterest =
      entries.reduce((s, e) => s + e.interestIgst + e.interestCgst + e.interestSgst, 0);

    // Last entry has the final balance
    const sorted = [...entries].sort((a, b) => a.srNo - b.srNo);
    const lastEntry = sorted[sorted.length - 1];
    const currentBalance = {
      igst: lastEntry.balanceIgst,
      cgst: lastEntry.balanceCgst,
      sgst: lastEntry.balanceSgst,
      cess: lastEntry.balanceCess,
      total: lastEntry.balanceTotal,
    };

    // Filed periods — unique tax periods from debit entries
    const filedPeriodsSet: Record<string, boolean> = {};
    for (const e of debits) {
      if (e.taxPeriod && e.taxPeriod !== "-") filedPeriodsSet[e.taxPeriod] = true;
    }
    const filedPeriods = Object.keys(filedPeriodsSet);

    // Per-period breakdown: what was actually paid for each tax period
    const periodBreakdown: Record<
      string,
      { igst: number; cgst: number; sgst: number; cess: number; total: number; interest: number; date: string }
    > = {};
    for (const d of debits) {
      if (!d.taxPeriod || d.taxPeriod === "-") continue;
      if (!periodBreakdown[d.taxPeriod]) {
        periodBreakdown[d.taxPeriod] = { igst: 0, cgst: 0, sgst: 0, cess: 0, total: 0, interest: 0, date: d.date };
      }
      periodBreakdown[d.taxPeriod].igst += d.igst;
      periodBreakdown[d.taxPeriod].cgst += d.cgst;
      periodBreakdown[d.taxPeriod].sgst += d.sgst;
      periodBreakdown[d.taxPeriod].cess += d.cess;
      periodBreakdown[d.taxPeriod].total += d.total;
      periodBreakdown[d.taxPeriod].interest += d.interestIgst + d.interestCgst + d.interestSgst;
    }

    return {
      entryCount: entries.length,
      totalDeposited,
      totalDebited,
      totalInterest,
      currentBalance,
      filedPeriods,
      periodBreakdown,
    };
  },
});

export const clearCashLedger = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("gst_cash_ledger")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const e of entries) {
      await ctx.db.delete(e._id);
    }
    return { deleted: entries.length };
  },
});
