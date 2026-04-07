import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getBankAccounts = query({
  args: {
    userId: v.id("users"),
    accountType: v.optional(v.union(v.literal("internal"), v.literal("external"))),
  },
  handler: async (ctx, args) => {
    if (args.accountType) {
      return await ctx.db
        .query("bank_accounts")
        .withIndex("by_user_type", (q) =>
          q.eq("userId", args.userId).eq("account_type", args.accountType!)
        )
        .collect();
    }
    return await ctx.db
      .query("bank_accounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const addBankAccount = mutation({
  args: {
    userId: v.id("users"),
    bank_name: v.string(),
    display_name: v.string(),
    account_last4: v.optional(v.string()),
    ifsc_code: v.optional(v.string()),
    logo_id: v.string(),
    logo_color: v.optional(v.string()),
    account_type: v.union(v.literal("internal"), v.literal("external")),
    sort_order: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("bank_accounts", {
      ...args,
      is_active: true,
    });
  },
});

export const updateBankAccount = mutation({
  args: {
    id: v.id("bank_accounts"),
    bank_name: v.optional(v.string()),
    display_name: v.optional(v.string()),
    account_last4: v.optional(v.string()),
    ifsc_code: v.optional(v.string()),
    logo_id: v.optional(v.string()),
    logo_color: v.optional(v.string()),
    account_type: v.optional(v.union(v.literal("internal"), v.literal("external"))),
    sort_order: v.optional(v.number()),
    is_active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const deleteBankAccount = mutation({
  args: { id: v.id("bank_accounts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
