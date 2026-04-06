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
