import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const addPurchaseBill = mutation({
  args: {
    userId: v.id("users"),
    vendorName: v.string(),
    vendorGstin: v.optional(v.string()),
    billNumber: v.string(),
    billDate: v.string(),
    description: v.string(),
    hsnSac: v.optional(v.string()),
    subtotal: v.number(),
    igst: v.number(),
    cgst: v.number(),
    sgst: v.number(),
    cessAmount: v.optional(v.number()),
    totalGst: v.number(),
    totalAmount: v.number(),
    category: v.optional(v.string()),
    itcClaimed: v.boolean(),
    itcPeriod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("purchase_bills", args);
  },
});

export const getPurchaseBills = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const bills = await ctx.db
      .query("purchase_bills")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return bills.sort((a, b) => b.billDate.localeCompare(a.billDate));
  },
});

export const updatePurchaseBill = mutation({
  args: {
    id: v.id("purchase_bills"),
    vendorName: v.optional(v.string()),
    vendorGstin: v.optional(v.string()),
    billNumber: v.optional(v.string()),
    billDate: v.optional(v.string()),
    description: v.optional(v.string()),
    hsnSac: v.optional(v.string()),
    subtotal: v.optional(v.number()),
    igst: v.optional(v.number()),
    cgst: v.optional(v.number()),
    sgst: v.optional(v.number()),
    cessAmount: v.optional(v.number()),
    totalGst: v.optional(v.number()),
    totalAmount: v.optional(v.number()),
    category: v.optional(v.string()),
    itcClaimed: v.optional(v.boolean()),
    itcPeriod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    // Remove undefined fields
    const updates: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) updates[k] = val;
    }
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(id, updates);
    }
  },
});

export const deletePurchaseBill = mutation({
  args: { id: v.id("purchase_bills") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const getITCSummary = query({
  args: { userId: v.id("users"), financialYear: v.string() },
  handler: async (ctx, args) => {
    const [startYear] = args.financialYear.split("-").map(Number);
    const fyStart = `${startYear}-04-01`;
    const fyEnd = `${startYear + 1}-03-31`;

    const bills = await ctx.db
      .query("purchase_bills")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const fyBills = bills.filter(
      (b) => b.billDate >= fyStart && b.billDate <= fyEnd
    );

    const totalIgst = fyBills.reduce((s, b) => s + b.igst, 0);
    const totalCgst = fyBills.reduce((s, b) => s + b.cgst, 0);
    const totalSgst = fyBills.reduce((s, b) => s + b.sgst, 0);
    const totalCess = fyBills.reduce((s, b) => s + (b.cessAmount ?? 0), 0);
    const totalGst = fyBills.reduce((s, b) => s + b.totalGst, 0);
    const totalSubtotal = fyBills.reduce((s, b) => s + b.subtotal, 0);

    const claimed = fyBills.filter((b) => b.itcClaimed);
    const unclaimed = fyBills.filter((b) => !b.itcClaimed);

    // Group by month
    const byMonth: Record<string, number> = {};
    for (const b of fyBills) {
      const month = b.billDate.substring(0, 7); // YYYY-MM
      byMonth[month] = (byMonth[month] || 0) + b.totalGst;
    }

    // Group by category
    const byCategory: Record<string, { count: number; gst: number; amount: number }> = {};
    for (const b of fyBills) {
      const cat = b.category || "other";
      if (!byCategory[cat]) byCategory[cat] = { count: 0, gst: 0, amount: 0 };
      byCategory[cat].count++;
      byCategory[cat].gst += b.totalGst;
      byCategory[cat].amount += b.totalAmount;
    }

    return {
      billCount: fyBills.length,
      totalSubtotal,
      totalIgst,
      totalCgst,
      totalSgst,
      totalCess,
      totalGst,
      claimedCount: claimed.length,
      claimedGst: claimed.reduce((s, b) => s + b.totalGst, 0),
      unclaimedCount: unclaimed.length,
      unclaimedGst: unclaimed.reduce((s, b) => s + b.totalGst, 0),
      byMonth,
      byCategory,
    };
  },
});
