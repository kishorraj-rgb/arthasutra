import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const addInsurancePolicy = mutation({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("term"),
      v.literal("health"),
      v.literal("vehicle"),
      v.literal("home"),
      v.literal("travel")
    ),
    provider: v.string(),
    policy_number: v.string(),
    sum_assured: v.number(),
    annual_premium: v.number(),
    next_due_date: v.string(),
    maturity_date: v.optional(v.string()),
    nominee: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("insurance_policies", args);
  },
});

export const updateInsurancePolicy = mutation({
  args: {
    id: v.id("insurance_policies"),
    next_due_date: v.optional(v.string()),
    annual_premium: v.optional(v.number()),
    nominee: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const deleteInsurancePolicy = mutation({
  args: { id: v.id("insurance_policies") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const getInsurancePolicies = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("insurance_policies")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});
