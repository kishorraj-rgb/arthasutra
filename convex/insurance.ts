import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const INSURANCE_TYPE = v.union(
  v.literal("term"),
  v.literal("health"),
  v.literal("vehicle"),
  v.literal("home"),
  v.literal("travel")
);

const VEHICLE_DETAILS = v.optional(
  v.object({
    registration_no: v.optional(v.string()),
    make: v.optional(v.string()),
    model: v.optional(v.string()),
    variant: v.optional(v.string()),
    fuel_type: v.optional(v.string()),
    year: v.optional(v.string()),
    engine_no: v.optional(v.string()),
    chassis_no: v.optional(v.string()),
    rto_location: v.optional(v.string()),
    idv: v.optional(v.number()),
    body_type: v.optional(v.string()),
  })
);

const INSURED_MEMBER = v.object({
  name: v.string(),
  relationship: v.optional(v.string()),
  dob: v.optional(v.string()),
  member_id: v.optional(v.string()),
  gender: v.optional(v.string()),
  age: v.optional(v.number()),
});

const ADD_ON = v.object({
  name: v.string(),
  details: v.optional(v.string()),
  uin: v.optional(v.string()),
});

const PREMIUM_BREAKDOWN = v.optional(
  v.object({
    net_premium: v.number(),
    gst: v.number(),
    total_premium: v.number(),
  })
);

// ---------------------------------------------------------------------------
// Policy CRUD
// ---------------------------------------------------------------------------

export const addInsurancePolicy = mutation({
  args: {
    userId: v.id("users"),
    type: INSURANCE_TYPE,
    provider: v.string(),
    policy_number: v.string(),
    sum_assured: v.number(),
    annual_premium: v.number(),
    next_due_date: v.string(),
    maturity_date: v.optional(v.string()),
    nominee: v.optional(v.string()),
    policy_start_date: v.optional(v.string()),
    policy_end_date: v.optional(v.string()),
    premium_breakdown: PREMIUM_BREAKDOWN,
    vehicle_details: VEHICLE_DETAILS,
    insured_members: v.optional(v.array(INSURED_MEMBER)),
    add_ons: v.optional(v.array(ADD_ON)),
    ncb_percent: v.optional(v.number()),
    policy_category: v.optional(v.string()),
    coverage_type: v.optional(v.string()),
    deductible: v.optional(v.number()),
    financier: v.optional(v.string()),
    previous_policy_number: v.optional(v.string()),
    previous_insurer: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("insurance_policies", args);
  },
});

export const updateInsurancePolicy = mutation({
  args: {
    id: v.id("insurance_policies"),
    type: v.optional(INSURANCE_TYPE),
    provider: v.optional(v.string()),
    policy_number: v.optional(v.string()),
    sum_assured: v.optional(v.number()),
    annual_premium: v.optional(v.number()),
    next_due_date: v.optional(v.string()),
    maturity_date: v.optional(v.string()),
    nominee: v.optional(v.string()),
    policy_start_date: v.optional(v.string()),
    policy_end_date: v.optional(v.string()),
    premium_breakdown: PREMIUM_BREAKDOWN,
    vehicle_details: VEHICLE_DETAILS,
    insured_members: v.optional(v.array(INSURED_MEMBER)),
    add_ons: v.optional(v.array(ADD_ON)),
    ncb_percent: v.optional(v.number()),
    policy_category: v.optional(v.string()),
    coverage_type: v.optional(v.string()),
    deductible: v.optional(v.number()),
    financier: v.optional(v.string()),
    previous_policy_number: v.optional(v.string()),
    previous_insurer: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(id, filtered);
    }
  },
});

export const deleteInsurancePolicy = mutation({
  args: { id: v.id("insurance_policies") },
  handler: async (ctx, args) => {
    // Cascade: delete attached documents
    const docs = await ctx.db
      .query("insurance_documents")
      .withIndex("by_policy", (q) => q.eq("policyId", args.id))
      .collect();
    for (const doc of docs) {
      await ctx.storage.delete(doc.storageId);
      await ctx.db.delete(doc._id);
    }
    await ctx.db.delete(args.id);
  },
});

// ---------------------------------------------------------------------------
// Policy Queries
// ---------------------------------------------------------------------------

export const getInsurancePolicies = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("insurance_policies")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// ---------------------------------------------------------------------------
// Document Management
// ---------------------------------------------------------------------------

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveInsuranceDocument = mutation({
  args: {
    userId: v.id("users"),
    policyId: v.id("insurance_policies"),
    storageId: v.id("_storage"),
    name: v.string(),
    file_size: v.number(),
    file_type: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("insurance_documents", {
      ...args,
      uploaded_at: Date.now(),
    });
  },
});

export const getInsuranceDocuments = query({
  args: { policyId: v.id("insurance_policies") },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("insurance_documents")
      .withIndex("by_policy", (q) => q.eq("policyId", args.policyId))
      .collect();
    const withUrls = await Promise.all(
      docs.map(async (doc) => ({
        ...doc,
        url: await ctx.storage.getUrl(doc.storageId),
      }))
    );
    return withUrls.sort((a, b) => b.uploaded_at - a.uploaded_at);
  },
});

export const deleteInsuranceDocument = mutation({
  args: { id: v.id("insurance_documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (doc) {
      await ctx.storage.delete(doc.storageId);
      await ctx.db.delete(args.id);
    }
  },
});
