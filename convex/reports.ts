import { query } from "./_generated/server";
import { v } from "convex/values";

export const getProfitAndLoss = query({
  args: {
    userId: v.id("users"),
    financialYear: v.string(),
  },
  handler: async (ctx, args) => {
    const [startYearStr] = args.financialYear.split("-");
    const startYear = parseInt(startYearStr);
    const fyStart = `${startYear}-04-01`;
    const fyEnd = `${startYear + 1}-03-31`;

    const incomeEntries = await ctx.db
      .query("income_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const expenseEntries = await ctx.db
      .query("expense_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const fyIncome = incomeEntries.filter(
      (e) => e.date >= fyStart && e.date <= fyEnd
    );
    const fyExpenses = expenseEntries.filter(
      (e) => e.date >= fyStart && e.date <= fyEnd
    );

    const revenue: Record<string, number> = {};
    for (const entry of fyIncome) {
      revenue[entry.type] = (revenue[entry.type] || 0) + entry.amount;
    }

    const expenses: Record<string, number> = {};
    for (const entry of fyExpenses) {
      expenses[entry.category] = (expenses[entry.category] || 0) + entry.amount;
    }

    const grossIncome = fyIncome.reduce((sum, e) => sum + e.amount, 0);
    const totalExpenses = fyExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = grossIncome - totalExpenses;

    return {
      revenue,
      expenses,
      grossIncome,
      totalExpenses,
      netProfit,
    };
  },
});

export const getBalanceSheet = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const incomeEntries = await ctx.db
      .query("income_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const expenseEntries = await ctx.db
      .query("expense_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const investments = await ctx.db
      .query("investments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const loans = await ctx.db
      .query("loans")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const totalIncome = incomeEntries.reduce((sum, e) => sum + e.amount, 0);
    const totalExpenses = expenseEntries.reduce((sum, e) => sum + e.amount, 0);
    const cash = totalIncome - totalExpenses;

    const investmentsValue = investments.reduce(
      (sum, i) => sum + i.current_value,
      0
    );

    const loansOutstanding = loans.reduce((sum, l) => sum + l.outstanding, 0);

    const totalGSTCollected = incomeEntries.reduce(
      (sum, e) => sum + e.gst_collected,
      0
    );
    const totalGSTPaid = expenseEntries.reduce(
      (sum, e) => sum + e.gst_paid,
      0
    );
    const gstLiability = totalGSTCollected - totalGSTPaid;

    const netWorth = cash + investmentsValue - loansOutstanding - Math.max(0, gstLiability);

    return {
      assets: {
        cash,
        investments: investmentsValue,
      },
      liabilities: {
        loans: loansOutstanding,
        gstLiability: Math.max(0, gstLiability),
      },
      netWorth,
    };
  },
});

export const getCashFlow = query({
  args: {
    userId: v.id("users"),
    financialYear: v.string(),
  },
  handler: async (ctx, args) => {
    const [startYearStr] = args.financialYear.split("-");
    const startYear = parseInt(startYearStr);
    const fyStart = `${startYear}-04-01`;
    const fyEnd = `${startYear + 1}-03-31`;

    const incomeEntries = await ctx.db
      .query("income_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const expenseEntries = await ctx.db
      .query("expense_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const fyIncome = incomeEntries.filter(
      (e) => e.date >= fyStart && e.date <= fyEnd
    );
    const fyExpenses = expenseEntries.filter(
      (e) => e.date >= fyStart && e.date <= fyEnd
    );

    // Operating: income (excl transfers) - expenses (excl investments/transfers)
    const operatingIncome = fyIncome
      .filter((e) => e.type !== "transfer")
      .reduce((sum, e) => sum + e.amount, 0);
    const operatingExpenses = fyExpenses
      .filter((e) => e.category !== "investment" && e.category !== "transfer")
      .reduce((sum, e) => sum + e.amount, 0);
    const operating = operatingIncome - operatingExpenses;

    // Investing: investment purchases, dividend/interest income
    const investmentExpenses = fyExpenses
      .filter((e) => e.category === "investment")
      .reduce((sum, e) => sum + e.amount, 0);
    const investmentIncome = fyIncome
      .filter((e) => e.type === "dividend" || e.type === "interest")
      .reduce((sum, e) => sum + e.amount, 0);
    const investing = investmentIncome - investmentExpenses;

    // Financing: EMI payments, loan changes
    const emiPayments = fyExpenses
      .filter((e) => e.category === "emi")
      .reduce((sum, e) => sum + e.amount, 0);
    const financing = -emiPayments;

    const netCashFlow = operating + investing + financing;

    return {
      operating,
      investing,
      financing,
      netCashFlow,
    };
  },
});

export const getLedger = query({
  args: {
    userId: v.id("users"),
    financialYear: v.string(),
    accountHead: v.string(),
  },
  handler: async (ctx, args) => {
    const [startYearStr] = args.financialYear.split("-");
    const startYear = parseInt(startYearStr);
    const fyStart = `${startYear}-04-01`;
    const fyEnd = `${startYear + 1}-03-31`;

    const incomeEntries = await ctx.db
      .query("income_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const expenseEntries = await ctx.db
      .query("expense_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const fyIncome = incomeEntries.filter(
      (e) => e.date >= fyStart && e.date <= fyEnd
    );
    const fyExpenses = expenseEntries.filter(
      (e) => e.date >= fyStart && e.date <= fyEnd
    );

    type LedgerEntry = {
      date: string;
      description: string;
      debit: number;
      credit: number;
      balance: number;
    };

    const entries: LedgerEntry[] = [];

    // Match income entries by type or expense entries by category
    for (const e of fyIncome) {
      if (e.type === args.accountHead || args.accountHead === "all") {
        entries.push({
          date: e.date,
          description: e.description,
          debit: 0,
          credit: e.amount,
          balance: 0,
        });
      }
    }

    for (const e of fyExpenses) {
      if (e.category === args.accountHead || args.accountHead === "all") {
        entries.push({
          date: e.date,
          description: e.description,
          debit: e.amount,
          credit: 0,
          balance: 0,
        });
      }
    }

    // Sort by date
    entries.sort((a, b) => a.date.localeCompare(b.date));

    // Compute running balance
    let runningBalance = 0;
    for (const entry of entries) {
      runningBalance += entry.credit - entry.debit;
      entry.balance = runningBalance;
    }

    return entries;
  },
});
