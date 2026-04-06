import { query } from "./_generated/server";
import { v } from "convex/values";

export const getDashboardMetrics = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get all data
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

    const reminders = await ctx.db
      .query("reminders")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Current financial year (Apr-Mar)
    const now = new Date();
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStart = `${fyStartYear}-04-01`;
    const fyEnd = `${fyStartYear + 1}-03-31`;

    // FY-filtered entries
    const fyIncome = incomeEntries.filter((e) => e.date >= fyStart && e.date <= fyEnd);
    const fyExpenses = expenseEntries.filter((e) => e.date >= fyStart && e.date <= fyEnd);

    // FY totals
    const totalIncome = fyIncome.reduce((sum, e) => sum + e.amount, 0);
    const totalExpenses = fyExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalTDS = fyIncome.reduce((sum, e) => sum + e.tds_deducted, 0);
    const totalGSTCollected = fyIncome.reduce((sum, e) => sum + e.gst_collected, 0);
    const totalGSTPaid = fyExpenses.reduce((sum, e) => sum + e.gst_paid, 0);

    // Investments
    const totalInvested = investments.reduce((sum, i) => sum + i.invested_amount, 0);
    const totalCurrentValue = investments.reduce((sum, i) => sum + i.current_value, 0);
    const totalLoanOutstanding = loans.reduce((sum, l) => sum + l.outstanding, 0);

    const netWorth = totalCurrentValue - totalLoanOutstanding + (totalIncome - totalExpenses);
    const portfolioGainLoss = totalCurrentValue - totalInvested;

    // Find the latest month with data for "current month" display
    const allDates = [...fyIncome.map((e) => e.date), ...fyExpenses.map((e) => e.date)];
    let displayMonth: string;
    if (allDates.length > 0) {
      const latestDate = allDates.sort().reverse()[0];
      displayMonth = latestDate.slice(0, 7); // "YYYY-MM"
    } else {
      displayMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }

    const currentMonthIncome = fyIncome
      .filter((e) => e.date.startsWith(displayMonth))
      .reduce((sum, e) => sum + e.amount, 0);
    const currentMonthExpenses = fyExpenses
      .filter((e) => e.date.startsWith(displayMonth))
      .reduce((sum, e) => sum + e.amount, 0);

    // Monthly cash flow for FY (Apr-Mar)
    const cashFlow = [];
    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(fyStartYear, 3 + i, 1); // Start from April
      const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
      const monthIncome = fyIncome
        .filter((e) => e.date.startsWith(monthStr))
        .reduce((sum, e) => sum + e.amount, 0);
      const monthExpense = fyExpenses
        .filter((e) => e.date.startsWith(monthStr))
        .reduce((sum, e) => sum + e.amount, 0);
      cashFlow.push({
        month: monthStr,
        income: monthIncome,
        expense: monthExpense,
        net: monthIncome - monthExpense,
      });
    }

    // Income by type for entire FY
    const incomeByType: Record<string, number> = {};
    for (const entry of fyIncome) {
      incomeByType[entry.type] = (incomeByType[entry.type] || 0) + entry.amount;
    }

    // Expenses by category for entire FY
    const expenseByCategory: Record<string, number> = {};
    for (const entry of fyExpenses) {
      expenseByCategory[entry.category] =
        (expenseByCategory[entry.category] || 0) + entry.amount;
    }

    // Upcoming reminders (7 days)
    const todayStr = now.toISOString().split("T")[0];
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const upcomingReminders = reminders
      .filter((r) => !r.is_completed && r.due_date >= todayStr && r.due_date <= nextWeek)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));

    // Tax saving investments (80C)
    const taxSaving80C = investments
      .filter((i) => i.tax_saving && i.section === "80C")
      .reduce((sum, i) => sum + i.invested_amount, 0);

    return {
      netWorth,
      totalIncome,
      totalExpenses,
      currentMonthIncome,
      currentMonthExpenses,
      displayMonth,
      totalInvested,
      totalCurrentValue,
      portfolioGainLoss,
      totalLoanOutstanding,
      totalTDS,
      totalGSTCollected,
      totalGSTPaid,
      gstLiability: totalGSTCollected - totalGSTPaid,
      cashFlow,
      incomeByType,
      expenseByCategory,
      upcomingReminders,
      taxSaving80C,
      taxSavingLimit: 150000,
      fyLabel: `${fyStartYear}-${(fyStartYear + 1).toString().slice(-2)}`,
    };
  },
});

export const saveUserProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const updateUserProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});
