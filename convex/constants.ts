// Convex Cron Jobs for ArthaSutra
// These would be configured when Convex is deployed
//
// import { cronJobs } from "convex/server";
// import { internal } from "./_generated/api";
//
// const crons = cronJobs();
//
// // Check advance tax dates on 1st of every month
// crons.monthly(
//   "check advance tax dates",
//   { day: 1, hourUTC: 3, minuteUTC: 30 }, // 9:00 AM IST
//   internal.scheduled.checkAdvanceTaxDates
// );
//
// // GST filing reminder on 15th of every month
// crons.monthly(
//   "gst filing reminder",
//   { day: 15, hourUTC: 3, minuteUTC: 30 },
//   internal.scheduled.checkGSTFilingDates
// );
//
// // Weekly investment review nudge (Monday)
// crons.weekly(
//   "weekly investment review",
//   { dayOfWeek: "monday", hourUTC: 3, minuteUTC: 30 },
//   internal.scheduled.weeklyInvestmentReview
// );
//
// // Daily overdue reminder check
// crons.daily(
//   "check overdue reminders",
//   { hourUTC: 2, minuteUTC: 0 }, // 7:30 AM IST
//   internal.scheduled.checkOverdueReminders
// );
//
// export default crons;

// Scheduled function implementations
// These would be internal mutations/actions

export const ADVANCE_TAX_DATES = {
  Q1: { date: "06-15", percentage: 15, label: "15% of tax liability" },
  Q2: { date: "09-15", percentage: 45, label: "45% of tax liability" },
  Q3: { date: "12-15", percentage: 75, label: "75% of tax liability" },
  Q4: { date: "03-15", percentage: 100, label: "100% of tax liability" },
} as const;

export const GST_FILING_DATES = {
  GSTR1: { day: 11, label: "GSTR-1 (Outward Supplies)" },
  GSTR3B: { day: 20, label: "GSTR-3B (Monthly Summary)" },
} as const;
