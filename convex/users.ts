import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const updateUserProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    pan_number: v.optional(v.string()),
    aadhaar_last4: v.optional(v.string()),
    user_type: v.optional(
      v.union(v.literal("employee"), v.literal("consultant"), v.literal("both"))
    ),
    annual_ctc: v.optional(v.number()),
    monthly_salary: v.optional(v.number()),
    gst_registered: v.optional(v.boolean()),
    gstin: v.optional(v.string()),
    financial_year_start: v.optional(v.string()),
    regime_preference: v.optional(v.union(v.literal("old"), v.literal("new"))),
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(userId, filtered);
  },
});
