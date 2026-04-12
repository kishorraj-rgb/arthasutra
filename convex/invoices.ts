import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Sellers ───────────────────────────────────────────────────────────

export const getSellers = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invoice_sellers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const addSeller = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    address: v.optional(v.string()),
    gstin: v.optional(v.string()),
    pan: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    logoDataUrl: v.optional(v.string()),
    logoPosition: v.optional(v.string()),
    invoicePrefix: v.optional(v.string()),
    upiId: v.optional(v.string()),
    signatureDataUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("invoice_sellers", args);
  },
});

export const updateSeller = mutation({
  args: {
    id: v.id("invoice_sellers"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    gstin: v.optional(v.string()),
    pan: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    logoDataUrl: v.optional(v.string()),
    logoPosition: v.optional(v.string()),
    invoicePrefix: v.optional(v.string()),
    upiId: v.optional(v.string()),
    signatureDataUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
    if (Object.keys(filtered).length > 0) await ctx.db.patch(id, filtered);
  },
});

export const deleteSeller = mutation({
  args: { id: v.id("invoice_sellers") },
  handler: async (ctx, args) => { await ctx.db.delete(args.id); },
});

// ─── Buyers ────────────────────────────────────────────────────────────

export const getBuyers = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invoice_buyers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const addBuyer = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    address: v.optional(v.string()),
    gstin: v.optional(v.string()),
    pan: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
  },
  handler: async (ctx, args) => { return await ctx.db.insert("invoice_buyers", args); },
});

export const updateBuyer = mutation({
  args: {
    id: v.id("invoice_buyers"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    gstin: v.optional(v.string()),
    pan: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
    if (Object.keys(filtered).length > 0) await ctx.db.patch(id, filtered);
  },
});

export const deleteBuyer = mutation({
  args: { id: v.id("invoice_buyers") },
  handler: async (ctx, args) => { await ctx.db.delete(args.id); },
});

// ─── Banks ─────────────────────────────────────────────────────────────

export const getBanks = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invoice_banks")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const addBank = mutation({
  args: {
    userId: v.id("users"),
    sellerId: v.optional(v.id("invoice_sellers")),
    accountName: v.string(),
    accountNumber: v.string(),
    bankName: v.string(),
    branch: v.optional(v.string()),
    ifscCode: v.string(),
  },
  handler: async (ctx, args) => { return await ctx.db.insert("invoice_banks", args); },
});

export const deleteBank = mutation({
  args: { id: v.id("invoice_banks") },
  handler: async (ctx, args) => { await ctx.db.delete(args.id); },
});

// ─── Products ──────────────────────────────────────────────────────────

export const getProducts = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invoice_products")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const addProduct = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    hsnSac: v.optional(v.string()),
    rate: v.number(),
    gstRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => { return await ctx.db.insert("invoice_products", args); },
});

export const updateProduct = mutation({
  args: {
    id: v.id("invoice_products"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    hsnSac: v.optional(v.string()),
    rate: v.optional(v.number()),
    gstRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
    if (Object.keys(filtered).length > 0) await ctx.db.patch(id, filtered);
  },
});

export const deleteProduct = mutation({
  args: { id: v.id("invoice_products") },
  handler: async (ctx, args) => { await ctx.db.delete(args.id); },
});

// ─── Invoice Counter ───────────────────────────────────────────────────

export const getNextInvoiceNumber = query({
  args: { userId: v.id("users"), sellerId: v.id("invoice_sellers") },
  handler: async (ctx, args) => {
    const counters = await ctx.db
      .query("invoice_counters")
      .withIndex("by_user_seller", (q) => q.eq("userId", args.userId).eq("sellerId", args.sellerId))
      .collect();
    const counter = counters[0];
    return counter ? counter.nextNum : 1;
  },
});

export const commitInvoiceNumber = mutation({
  args: { userId: v.id("users"), sellerId: v.id("invoice_sellers") },
  handler: async (ctx, args) => {
    const counters = await ctx.db
      .query("invoice_counters")
      .withIndex("by_user_seller", (q) => q.eq("userId", args.userId).eq("sellerId", args.sellerId))
      .collect();
    if (counters.length > 0) {
      await ctx.db.patch(counters[0]._id, { nextNum: counters[0].nextNum + 1 });
    } else {
      await ctx.db.insert("invoice_counters", { userId: args.userId, sellerId: args.sellerId, nextNum: 2 });
    }
  },
});

// ─── Invoices CRUD ─────────────────────────────────────────────────────

export const getInvoices = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return invoices.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  },
});

export const getInvoice = query({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const saveInvoice = mutation({
  args: {
    id: v.optional(v.id("invoices")),
    userId: v.id("users"),
    sellerId: v.optional(v.id("invoice_sellers")),
    buyerId: v.optional(v.id("invoice_buyers")),
    bankId: v.optional(v.id("invoice_banks")),
    documentType: v.string(),
    invoiceNumber: v.string(),
    invoiceDate: v.string(),
    dueDate: v.optional(v.string()),
    terms: v.optional(v.string()),
    subject: v.optional(v.string()),
    placeOfSupplyCode: v.optional(v.string()),
    items: v.array(v.object({
      description: v.string(),
      hsnSac: v.optional(v.string()),
      qty: v.number(),
      rate: v.number(),
      gstRate: v.optional(v.number()),
    })),
    subtotal: v.number(),
    gstTotal: v.number(),
    tdsAmount: v.optional(v.number()),
    roundOff: v.optional(v.number()),
    netTotal: v.number(),
    status: v.string(),
    template: v.optional(v.string()),
    watermark: v.optional(v.string()),
    notes: v.optional(v.string()),
    tdsEnabled: v.optional(v.boolean()),
    tdsRate: v.optional(v.number()),
    tdsSection: v.optional(v.string()),
    gstInclusive: v.optional(v.boolean()),
    logoDataUrl: v.optional(v.string()),
    signatureDataUrl: v.optional(v.string()),
    showUpiQr: v.optional(v.boolean()),
    sellerData: v.optional(v.any()),
    buyerData: v.optional(v.any()),
    bankData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { id, ...data } = args;
    if (id) {
      await ctx.db.patch(id, data);
      return id;
    } else {
      return await ctx.db.insert("invoices", data);
    }
  },
});

export const updateInvoiceStatus = mutation({
  args: {
    id: v.id("invoices"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const deleteInvoice = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    // Delete associated payments
    const payments = await ctx.db
      .query("invoice_payments")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.id))
      .collect();
    for (const p of payments) await ctx.db.delete(p._id);
    await ctx.db.delete(args.id);
  },
});

// ─── Payments ──────────────────────────────────────────────────────────

export const getInvoicePayments = query({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invoice_payments")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
      .collect();
  },
});

export const addPayment = mutation({
  args: {
    userId: v.id("users"),
    invoiceId: v.id("invoices"),
    amount: v.number(),
    method: v.optional(v.string()),
    date: v.string(),
    note: v.optional(v.string()),
    createIncomeEntry: v.optional(v.boolean()),
    sourceBank: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const paymentId = await ctx.db.insert("invoice_payments", {
      userId: args.userId,
      invoiceId: args.invoiceId,
      amount: args.amount,
      method: args.method,
      date: args.date,
      note: args.note,
    });

    // Update invoice status based on total payments
    const invoice = await ctx.db.get(args.invoiceId);
    if (invoice) {
      const allPayments = await ctx.db
        .query("invoice_payments")
        .withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
        .collect();
      const totalPaid = allPayments.reduce((s, p) => s + p.amount, 0);

      if (totalPaid >= invoice.netTotal) {
        await ctx.db.patch(args.invoiceId, { status: "paid" });
      } else if (totalPaid > 0) {
        await ctx.db.patch(args.invoiceId, { status: "partially_paid" });
      }

      // Create linked income entry if requested
      if (args.createIncomeEntry) {
        const sellerName = (invoice.sellerData as Record<string, string>)?.name || "Invoice";
        const buyerName = (invoice.buyerData as Record<string, string>)?.name || "";
        const gstPortion = invoice.netTotal > 0
          ? Math.round((invoice.gstTotal / invoice.netTotal) * args.amount)
          : 0;
        const tdsPortion = invoice.tdsAmount && invoice.netTotal > 0
          ? Math.round((invoice.tdsAmount / invoice.netTotal) * args.amount)
          : 0;

        const incomeId = await ctx.db.insert("income_entries", {
          userId: args.userId,
          date: args.date,
          amount: args.amount,
          type: "freelance" as const,
          description: `Invoice ${invoice.invoiceNumber} — ${buyerName}`,
          tds_deducted: tdsPortion,
          gst_collected: gstPortion,
          source_bank: args.sourceBank,
        });

        // Link income entry to invoice
        await ctx.db.patch(args.invoiceId, { linkedIncomeId: incomeId });
      }
    }

    return paymentId;
  },
});

// ─── Dashboard Stats ───────────────────────────────────────────────────

export const getInvoiceSummary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const activeInvoices = invoices.filter((i) => i.status !== "cancelled");
    const totalInvoiced = activeInvoices.reduce((s, i) => s + i.netTotal, 0);
    const totalPaid = activeInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.netTotal, 0);
    const totalOverdue = activeInvoices
      .filter((i) => i.status !== "paid" && i.dueDate && i.dueDate < new Date().toISOString().split("T")[0])
      .reduce((s, i) => s + i.netTotal, 0);
    const totalOutstanding = totalInvoiced - totalPaid;
    const totalGst = activeInvoices.reduce((s, i) => s + i.gstTotal, 0);

    return {
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      totalOverdue,
      totalGst,
      invoiceCount: activeInvoices.length,
      paidCount: activeInvoices.filter((i) => i.status === "paid").length,
      overdueCount: activeInvoices.filter((i) => i.status !== "paid" && i.dueDate && i.dueDate < new Date().toISOString().split("T")[0]).length,
    };
  },
});
