import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveDocument = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    category: v.union(
      v.literal("identity"),
      v.literal("tax"),
      v.literal("investment"),
      v.literal("insurance"),
      v.literal("bank_statement"),
      v.literal("receipt"),
      v.literal("other")
    ),
    storageId: v.id("_storage"),
    file_size: v.number(),
    file_type: v.string(),
    tags: v.optional(v.array(v.string())),
    financial_year: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documents", {
      ...args,
      uploaded_at: Date.now(),
    });
  },
});

export const getDocuments = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Resolve storage URLs
    const docsWithUrls = await Promise.all(
      docs.map(async (doc) => {
        const url = await ctx.storage.getUrl(doc.storageId);
        return { ...doc, url };
      })
    );

    // Sort by uploaded_at descending
    return docsWithUrls.sort((a, b) => b.uploaded_at - a.uploaded_at);
  },
});

export const deleteDocument = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (doc) {
      await ctx.storage.delete(doc.storageId);
      await ctx.db.delete(args.id);
    }
  },
});

export const updateDocument = mutation({
  args: {
    id: v.id("documents"),
    name: v.optional(v.string()),
    category: v.optional(
      v.union(
        v.literal("identity"),
        v.literal("tax"),
        v.literal("investment"),
        v.literal("insurance"),
        v.literal("bank_statement"),
        v.literal("receipt"),
        v.literal("other")
      )
    ),
    tags: v.optional(v.array(v.string())),
    financial_year: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});
