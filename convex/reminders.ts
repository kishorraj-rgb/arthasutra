import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const addReminder = mutation({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("advance_tax"),
      v.literal("gst_filing"),
      v.literal("investment_review"),
      v.literal("insurance_premium"),
      v.literal("loan_emi"),
      v.literal("custom")
    ),
    title: v.string(),
    due_date: v.string(),
    amount: v.optional(v.number()),
    is_recurring: v.boolean(),
    frequency: v.optional(v.string()),
    is_completed: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("reminders", args);
  },
});

export const completeReminder = mutation({
  args: { id: v.id("reminders") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { is_completed: true });
  },
});

export const deleteReminder = mutation({
  args: { id: v.id("reminders") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const getReminders = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reminders")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const getUpcomingReminders = query({
  args: {
    userId: v.id("users"),
    days: v.number(),
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + args.days * 24 * 60 * 60 * 1000);
    const todayStr = now.toISOString().split("T")[0];
    const futureStr = futureDate.toISOString().split("T")[0];

    const reminders = await ctx.db
      .query("reminders")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return reminders
      .filter((r) => !r.is_completed && r.due_date >= todayStr && r.due_date <= futureStr)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  },
});
