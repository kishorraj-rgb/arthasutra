import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// FY 2024-25 New Regime Tax Slabs
function calculateNewRegimeTax(taxableIncome: number): number {
  const standardDeduction = 75000;
  let income = taxableIncome - standardDeduction;
  if (income <= 0) return 0;

  let tax = 0;

  // New regime slabs FY 2024-25
  if (income <= 300000) {
    tax = 0;
  } else if (income <= 700000) {
    tax = (income - 300000) * 0.05;
  } else if (income <= 1000000) {
    tax = 400000 * 0.05 + (income - 700000) * 0.10;
  } else if (income <= 1200000) {
    tax = 400000 * 0.05 + 300000 * 0.10 + (income - 1000000) * 0.15;
  } else if (income <= 1500000) {
    tax = 400000 * 0.05 + 300000 * 0.10 + 200000 * 0.15 + (income - 1200000) * 0.20;
  } else {
    tax = 400000 * 0.05 + 300000 * 0.10 + 200000 * 0.15 + 300000 * 0.20 + (income - 1500000) * 0.30;
  }

  // Rebate u/s 87A: If total income (after SD) <= 7L, rebate up to ₹25,000
  if (income <= 700000) {
    tax = Math.max(0, tax - 25000);
  }

  // Surcharge
  let surcharge = 0;
  if (income > 50000000) {
    surcharge = tax * 0.25; // Capped at 25% for new regime
  } else if (income > 20000000) {
    surcharge = tax * 0.25;
  } else if (income > 10000000) {
    surcharge = tax * 0.15;
  } else if (income > 5000000) {
    surcharge = tax * 0.10;
  }

  // Cess: 4% on (tax + surcharge)
  const cess = (tax + surcharge) * 0.04;

  return Math.round(tax + surcharge + cess);
}

// FY 2024-25 Old Regime Tax Slabs
function calculateOldRegimeTax(
  grossIncome: number,
  deductions: {
    standardDeduction?: number;
    section80C?: number;
    section80D?: number;
    section80CCD1B?: number;
    section24b?: number;
    hra?: number;
    otherDeductions?: number;
  }
): number {
  const sd = Math.min(deductions.standardDeduction ?? 50000, 50000);
  const s80c = Math.min(deductions.section80C ?? 0, 150000);
  const s80d = Math.min(deductions.section80D ?? 0, 100000);
  const s80ccd = Math.min(deductions.section80CCD1B ?? 0, 50000);
  const s24b = Math.min(deductions.section24b ?? 0, 200000);
  const hra = deductions.hra ?? 0;
  const other = deductions.otherDeductions ?? 0;

  const totalDeductions = sd + s80c + s80d + s80ccd + s24b + hra + other;
  let taxableIncome = grossIncome - totalDeductions;
  if (taxableIncome <= 0) return 0;

  let tax = 0;

  if (taxableIncome <= 250000) {
    tax = 0;
  } else if (taxableIncome <= 500000) {
    tax = (taxableIncome - 250000) * 0.05;
  } else if (taxableIncome <= 1000000) {
    tax = 250000 * 0.05 + (taxableIncome - 500000) * 0.20;
  } else {
    tax = 250000 * 0.05 + 500000 * 0.20 + (taxableIncome - 1000000) * 0.30;
  }

  // Rebate u/s 87A for old regime: up to ₹12,500 if income ≤ 5L
  if (taxableIncome <= 500000) {
    tax = Math.max(0, tax - 12500);
  }

  // Surcharge (old regime)
  let surcharge = 0;
  if (taxableIncome > 50000000) {
    surcharge = tax * 0.37;
  } else if (taxableIncome > 20000000) {
    surcharge = tax * 0.25;
  } else if (taxableIncome > 10000000) {
    surcharge = tax * 0.15;
  } else if (taxableIncome > 5000000) {
    surcharge = tax * 0.10;
  }

  const cess = (tax + surcharge) * 0.04;

  return Math.round(tax + surcharge + cess);
}

export const calculateIncomeTax = query({
  args: {
    grossIncome: v.number(),
    standardDeduction: v.optional(v.number()),
    section80C: v.optional(v.number()),
    section80D: v.optional(v.number()),
    section80CCD1B: v.optional(v.number()),
    section24b: v.optional(v.number()),
    hra: v.optional(v.number()),
    otherDeductions: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const oldRegimeTax = calculateOldRegimeTax(args.grossIncome, {
      standardDeduction: args.standardDeduction,
      section80C: args.section80C,
      section80D: args.section80D,
      section80CCD1B: args.section80CCD1B,
      section24b: args.section24b,
      hra: args.hra,
      otherDeductions: args.otherDeductions,
    });

    const newRegimeTax = calculateNewRegimeTax(args.grossIncome);

    const sd = Math.min(args.standardDeduction ?? 50000, 50000);
    const s80c = Math.min(args.section80C ?? 0, 150000);
    const s80d = Math.min(args.section80D ?? 0, 100000);
    const s80ccd = Math.min(args.section80CCD1B ?? 0, 50000);
    const s24b = Math.min(args.section24b ?? 0, 200000);
    const hra = args.hra ?? 0;
    const other = args.otherDeductions ?? 0;
    const totalDeductionsOld = sd + s80c + s80d + s80ccd + s24b + hra + other;
    const taxableIncomeOld = Math.max(0, args.grossIncome - totalDeductionsOld);
    const taxableIncomeNew = Math.max(0, args.grossIncome - 75000);

    return {
      grossIncome: args.grossIncome,
      oldRegime: {
        totalDeductions: totalDeductionsOld,
        taxableIncome: taxableIncomeOld,
        tax: oldRegimeTax,
        effectiveRate: args.grossIncome > 0 ? ((oldRegimeTax / args.grossIncome) * 100).toFixed(2) : "0",
      },
      newRegime: {
        totalDeductions: 75000,
        taxableIncome: taxableIncomeNew,
        tax: newRegimeTax,
        effectiveRate: args.grossIncome > 0 ? ((newRegimeTax / args.grossIncome) * 100).toFixed(2) : "0",
      },
      recommendation: oldRegimeTax <= newRegimeTax ? "old" : "new",
      savings: Math.abs(oldRegimeTax - newRegimeTax),
    };
  },
});

export const calculateHRA = query({
  args: {
    basicSalary: v.number(),
    hraReceived: v.number(),
    rentPaid: v.number(),
    isMetro: v.boolean(),
  },
  handler: async (_ctx, args) => {
    const actualHRA = args.hraReceived;
    const rentMinus10 = args.rentPaid - 0.10 * args.basicSalary;
    const percentOfBasic = args.isMetro ? 0.50 * args.basicSalary : 0.40 * args.basicSalary;

    const exemptHRA = Math.max(0, Math.min(actualHRA, rentMinus10, percentOfBasic));
    const taxableHRA = actualHRA - exemptHRA;

    return {
      actualHRA,
      rentMinus10Basic: Math.max(0, rentMinus10),
      percentOfBasic,
      exemptHRA,
      taxableHRA,
      annualExemptHRA: exemptHRA * 12,
      annualTaxableHRA: taxableHRA * 12,
    };
  },
});

export const saveTaxRecord = mutation({
  args: {
    userId: v.id("users"),
    financial_year: v.string(),
    gross_income: v.number(),
    total_deductions: v.number(),
    taxable_income: v.number(),
    tax_old_regime: v.number(),
    tax_new_regime: v.number(),
    tds_deducted: v.number(),
    advance_tax_paid: v.number(),
    gst_collected: v.number(),
    gst_paid: v.number(),
    gst_liability: v.number(),
    regime_chosen: v.union(v.literal("old"), v.literal("new")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tax_records", args);
  },
});

export const getTaxRecords = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tax_records")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Advance Tax
export const getAdvanceTaxPayments = query({
  args: {
    userId: v.id("users"),
    financial_year: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("advance_tax_payments")
      .withIndex("by_user_fy", (q) =>
        q.eq("userId", args.userId).eq("financial_year", args.financial_year)
      )
      .collect();
  },
});

export const addAdvanceTaxPayment = mutation({
  args: {
    userId: v.id("users"),
    financial_year: v.string(),
    quarter: v.union(v.literal("Q1"), v.literal("Q2"), v.literal("Q3"), v.literal("Q4")),
    due_date: v.string(),
    amount_due: v.number(),
    amount_paid: v.number(),
    paid_date: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("paid"), v.literal("overdue")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("advance_tax_payments", args);
  },
});

export const markAdvanceTaxPaid = mutation({
  args: {
    id: v.id("advance_tax_payments"),
    amount_paid: v.number(),
    paid_date: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      amount_paid: args.amount_paid,
      paid_date: args.paid_date,
      status: "paid",
    });
  },
});

// GST
export const getGSTFilings = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gst_filings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const addGSTFiling = mutation({
  args: {
    userId: v.id("users"),
    period: v.string(),
    gstr1_due: v.string(),
    gstr3b_due: v.string(),
    output_gst: v.number(),
    input_gst: v.number(),
    net_gst_liability: v.number(),
    status: v.union(v.literal("pending"), v.literal("filed")),
    filing_date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("gst_filings", args);
  },
});

export const markGSTFiled = mutation({
  args: {
    id: v.id("gst_filings"),
    filing_date: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "filed",
      filing_date: args.filing_date,
    });
  },
});

// ─── GSTR-1 Report (Outward Supplies) ──────────────────────────────────

export const generateGSTR1 = query({
  args: { userId: v.id("users"), period: v.string() }, // period: "2025-06" (YYYY-MM)
  handler: async (ctx, args) => {
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Filter by period (invoice date month)
    const periodInvoices = invoices.filter((inv) =>
      inv.invoiceDate.startsWith(args.period) && inv.status !== "cancelled"
    );

    // B2B (Business to Business) — buyer has GSTIN
    const b2b = periodInvoices.filter((inv) => {
      const buyerGstin = (inv.buyerData as Record<string, string>)?.gstin;
      return buyerGstin && buyerGstin.length >= 15;
    });

    // B2C (Business to Consumer) — buyer has no GSTIN
    const b2c = periodInvoices.filter((inv) => {
      const buyerGstin = (inv.buyerData as Record<string, string>)?.gstin;
      return !buyerGstin || buyerGstin.length < 15;
    });

    // Export invoices (foreign buyers)
    const exports = periodInvoices.filter((inv) => {
      const addr = (inv.buyerData as Record<string, string>)?.address || "";
      return ["dubai","uae","singapore","usa","uk","london"].some((f) => addr.toLowerCase().includes(f));
    });

    const totalTaxable = periodInvoices.reduce((s, i) => s + i.subtotal, 0);
    const totalIgst = b2b.filter((i) => {
      const s = (i.sellerData as Record<string, string>)?.gstin?.substring(0, 2) || "";
      const b = (i.buyerData as Record<string, string>)?.gstin?.substring(0, 2) || "";
      return s !== b;
    }).reduce((s, i) => s + i.gstTotal, 0);
    const intraGst = periodInvoices.reduce((s, i) => s + i.gstTotal, 0) - totalIgst;

    return {
      period: args.period,
      b2bCount: b2b.length,
      b2cCount: b2c.length,
      exportCount: exports.length,
      totalInvoices: periodInvoices.length,
      totalTaxable,
      totalIgst,
      totalCgst: Math.round(intraGst / 2),
      totalSgst: Math.round(intraGst / 2),
      totalGst: periodInvoices.reduce((s, i) => s + i.gstTotal, 0),
      invoices: periodInvoices.map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        buyerName: (inv.buyerData as Record<string, string>)?.name || "",
        buyerGstin: (inv.buyerData as Record<string, string>)?.gstin || "",
        taxableAmount: inv.subtotal,
        gstAmount: inv.gstTotal,
        totalAmount: inv.netTotal,
      })),
    };
  },
});

// ─── Advance Tax Auto-Calculation ──────────────────────────────────────

export const calculateAdvanceTax = query({
  args: { userId: v.id("users"), financialYear: v.string() },
  handler: async (ctx, args) => {
    const [startYear] = args.financialYear.split("-").map(Number);
    const fyStart = `${startYear}-04-01`;
    const fyEnd = `${startYear + 1}-03-31`;

    // Get all income for the FY
    const incomeEntries = await ctx.db
      .query("income_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const fyIncome = incomeEntries.filter((e) => e.date >= fyStart && e.date <= fyEnd);
    const totalIncome = fyIncome.reduce((s, e) => s + e.amount, 0);
    const totalTdsDeducted = fyIncome.reduce((s, e) => s + e.tds_deducted, 0);

    // Get investments for 80C/80CCD deductions
    const investments = await ctx.db
      .query("investments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const sec80C = Math.min(150000, investments.filter((i) => i.section === "80C").reduce((s, i) => s + i.invested_amount, 0));
    const sec80CCD = Math.min(50000, investments.filter((i) => i.section === "80CCD").reduce((s, i) => s + i.invested_amount, 0));

    // Get insurance for 80D
    const insurance = await ctx.db
      .query("insurance_policies")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const sec80D = Math.min(50000, insurance.filter((p) => p.type === "health").reduce((s, p) => s + p.annual_premium, 0));

    // Get home loan interest for 24(b)
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const homeLoanInterest = Math.min(200000, loans
      .filter((l) => l.type === "home")
      .reduce((s, l) => s + Math.round(l.outstanding * l.interest_rate / 100), 0));

    const totalDeductions = sec80C + sec80CCD + sec80D + homeLoanInterest;
    const taxableIncome = Math.max(0, totalIncome - totalDeductions);

    // Calculate tax (new regime)
    const newRegimeTax = calculateNewRegimeTax(totalIncome); // New regime ignores most deductions
    const oldRegimeTax = calculateOldRegimeTax(totalIncome, {
      section80C: sec80C,
      section80D: sec80D,
      section80CCD1B: sec80CCD,
      section24b: homeLoanInterest,
    });
    const recommendedTax = Math.min(newRegimeTax, oldRegimeTax);
    const netTaxPayable = Math.max(0, recommendedTax - totalTdsDeducted);

    // Quarterly breakdown
    const quarters = [
      { quarter: "Q1", dueDate: `${startYear}-06-15`, cumulativePct: 15 },
      { quarter: "Q2", dueDate: `${startYear}-09-15`, cumulativePct: 45 },
      { quarter: "Q3", dueDate: `${startYear}-12-15`, cumulativePct: 75 },
      { quarter: "Q4", dueDate: `${startYear + 1}-03-15`, cumulativePct: 100 },
    ].map((q) => ({
      ...q,
      amountDue: Math.round(netTaxPayable * q.cumulativePct / 100),
    }));

    // Get actual payments
    const payments = await ctx.db
      .query("advance_tax_payments")
      .withIndex("by_user_fy", (q) => q.eq("userId", args.userId).eq("financial_year", args.financialYear))
      .collect();

    const totalPaid = payments.reduce((s, p) => s + p.amount_paid, 0);

    return {
      totalIncome,
      totalDeductions,
      taxableIncome,
      newRegimeTax,
      oldRegimeTax,
      recommendedRegime: newRegimeTax <= oldRegimeTax ? "new" : "old",
      recommendedTax,
      totalTdsDeducted,
      netTaxPayable,
      quarters,
      totalAdvanceTaxPaid: totalPaid,
      balanceDue: Math.max(0, netTaxPayable - totalPaid),
      deductionBreakdown: { sec80C, sec80CCD, sec80D, homeLoanInterest },
    };
  },
});

// ─── TDS Reconciliation from Income Data ───────────────────────────────

export const getTDSReconciliation = query({
  args: { userId: v.id("users"), financialYear: v.string() },
  handler: async (ctx, args) => {
    const [startYear] = args.financialYear.split("-").map(Number);
    const fyStart = `${startYear}-04-01`;
    const fyEnd = `${startYear + 1}-03-31`;

    const incomeEntries = await ctx.db
      .query("income_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const fyIncome = incomeEntries.filter(
      (e) => e.date >= fyStart && e.date <= fyEnd && e.tds_deducted > 0
    );

    // Group by source (description prefix)
    const sourceMap = new Map<string, { amount: number; tds: number; count: number; dates: string[] }>();
    for (const e of fyIncome) {
      // Extract source name from description
      const desc = e.description;
      const source = desc.substring(0, 40).replace(/[-\/\d]/g, " ").trim() || "Unknown";
      const cur = sourceMap.get(source) || { amount: 0, tds: 0, count: 0, dates: [] };
      cur.amount += e.amount;
      cur.tds += e.tds_deducted;
      cur.count++;
      cur.dates.push(e.date);
      sourceMap.set(source, cur);
    }

    const entries = Array.from(sourceMap.entries()).map(([source, data]) => ({
      source,
      totalIncome: data.amount,
      totalTds: data.tds,
      transactionCount: data.count,
      tdsRate: data.amount > 0 ? Math.round((data.tds / data.amount) * 100 * 10) / 10 : 0,
      lastDate: data.dates.sort().pop() || "",
    }));

    const totalIncome = entries.reduce((s, e) => s + e.totalIncome, 0);
    const totalTds = entries.reduce((s, e) => s + e.totalTds, 0);

    return {
      entries: entries.sort((a, b) => b.totalTds - a.totalTds),
      totalIncome,
      totalTds,
      sourceCount: entries.length,
    };
  },
});
