import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getCategoryPreferences = query({
  args: {
    userId: v.id("users"),
    scope: v.union(v.literal("expense"), v.literal("income")),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("category_preferences")
      .withIndex("by_user_scope", (q) =>
        q.eq("userId", args.userId).eq("scope", args.scope)
      )
      .collect();
  },
});

export const upsertCategoryPreference = mutation({
  args: {
    userId: v.id("users"),
    scope: v.union(v.literal("expense"), v.literal("income")),
    slug: v.string(),
    label: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    sort_order: v.number(),
    hidden: v.boolean(),
    subcategories: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("category_preferences")
      .withIndex("by_user_scope", (q) =>
        q.eq("userId", args.userId).eq("scope", args.scope)
      )
      .collect();

    const match = existing.find((p) => p.slug === args.slug);

    if (match) {
      await ctx.db.patch(match._id, {
        label: args.label,
        icon: args.icon,
        color: args.color,
        sort_order: args.sort_order,
        hidden: args.hidden,
        subcategories: args.subcategories,
      });
      return match._id;
    } else {
      return await ctx.db.insert("category_preferences", {
        userId: args.userId,
        scope: args.scope,
        slug: args.slug,
        label: args.label,
        icon: args.icon,
        color: args.color,
        sort_order: args.sort_order,
        hidden: args.hidden,
        subcategories: args.subcategories,
      });
    }
  },
});

export const batchSaveCategoryPreferences = mutation({
  args: {
    userId: v.id("users"),
    scope: v.union(v.literal("expense"), v.literal("income")),
    categories: v.array(
      v.object({
        slug: v.string(),
        label: v.string(),
        icon: v.optional(v.string()),
        color: v.optional(v.string()),
        sort_order: v.number(),
        hidden: v.boolean(),
        subcategories: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Delete all existing preferences for this scope
    const existing = await ctx.db
      .query("category_preferences")
      .withIndex("by_user_scope", (q) =>
        q.eq("userId", args.userId).eq("scope", args.scope)
      )
      .collect();

    for (const pref of existing) {
      await ctx.db.delete(pref._id);
    }

    // Insert all new preferences
    for (const cat of args.categories) {
      await ctx.db.insert("category_preferences", {
        userId: args.userId,
        scope: args.scope,
        slug: cat.slug,
        label: cat.label,
        icon: cat.icon,
        color: cat.color,
        sort_order: cat.sort_order,
        hidden: cat.hidden,
        subcategories: cat.subcategories,
      });
    }

    return { saved: args.categories.length };
  },
});

export const resetCategoryPreferences = mutation({
  args: {
    userId: v.id("users"),
    scope: v.union(v.literal("expense"), v.literal("income")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("category_preferences")
      .withIndex("by_user_scope", (q) =>
        q.eq("userId", args.userId).eq("scope", args.scope)
      )
      .collect();

    for (const pref of existing) {
      await ctx.db.delete(pref._id);
    }

    return { deleted: existing.length };
  },
});
