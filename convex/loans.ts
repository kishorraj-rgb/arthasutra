import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const addLoan = mutation({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("home"),
      v.literal("car"),
      v.literal("personal"),
      v.literal("education")
    ),
    lender: v.string(),
    principal: v.number(),
    outstanding: v.number(),
    emi_amount: v.number(),
    interest_rate: v.number(),
    emi_date: v.number(),
    tenure_remaining: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("loans", args);
  },
});

export const updateLoan = mutation({
  args: {
    id: v.id("loans"),
    outstanding: v.optional(v.number()),
    emi_amount: v.optional(v.number()),
    tenure_remaining: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const deleteLoan = mutation({
  args: { id: v.id("loans") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const getLoans = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("loans")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});
