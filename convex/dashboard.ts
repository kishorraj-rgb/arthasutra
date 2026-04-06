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

    // Calculate totals
    const totalIncome = incomeEntries.reduce((sum, e) => sum + e.amount, 0);
    const totalExpenses = expenseEntries.reduce((sum, e) => sum + e.amount, 0);
    const totalInvested = investments.reduce((sum, i) => sum + i.invested_amount, 0);
    const totalCurrentValue = investments.reduce((sum, i) => sum + i.current_value, 0);
    const totalLoanOutstanding = loans.reduce((sum, l) => sum + l.outstanding, 0);
    const totalTDS = incomeEntries.reduce((sum, e) => sum + e.tds_deducted, 0);
    const totalGSTCollected = incomeEntries.reduce((sum, e) => sum + e.gst_collected, 0);
    const totalGSTPaid = expenseEntries.reduce((sum, e) => sum + e.gst_paid, 0);

    const netWorth = totalCurrentValue - totalLoanOutstanding;
    const portfolioGainLoss = totalCurrentValue - totalInvested;

    // Monthly cash flow (last 12 months)
    const now = new Date();
    const cashFlow = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthIncome = incomeEntries
        .filter((e) => e.date.startsWith(monthStr))
        .reduce((sum, e) => sum + e.amount, 0);
      const monthExpense = expenseEntries
        .filter((e) => e.date.startsWith(monthStr))
        .reduce((sum, e) => sum + e.amount, 0);
      cashFlow.push({
        month: monthStr,
        income: monthIncome,
        expense: monthExpense,
        net: monthIncome - monthExpense,
      });
    }

    // Current month breakdown
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currentMonthIncome = incomeEntries
      .filter((e) => e.date.startsWith(currentMonth))
      .reduce((sum, e) => sum + e.amount, 0);
    const currentMonthExpenses = expenseEntries
      .filter((e) => e.date.startsWith(currentMonth))
      .reduce((sum, e) => sum + e.amount, 0);

    // Income by type for donut chart
    const incomeByType: Record<string, number> = {};
    const currentMonthIncomeEntries = incomeEntries.filter((e) =>
      e.date.startsWith(currentMonth)
    );
    for (const entry of currentMonthIncomeEntries) {
      incomeByType[entry.type] = (incomeByType[entry.type] || 0) + entry.amount;
    }

    // Expenses by category for donut chart
    const expenseByCategory: Record<string, number> = {};
    const currentMonthExpenseEntries = expenseEntries.filter((e) =>
      e.date.startsWith(currentMonth)
    );
    for (const entry of currentMonthExpenseEntries) {
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
