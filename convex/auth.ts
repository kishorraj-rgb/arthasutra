import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Auto-login: finds or creates the single owner user, returns a session
export const autoLogin = mutation({
  args: {},
  handler: async (ctx) => {
    // Find the owner (first user in the system)
    let user = await ctx.db.query("users").first();

    if (!user) {
      // Create the owner account on first use
      const userId = await ctx.db.insert("users", {
        name: "Kishor Raj",
        email: "kishor.raj@live.com",
        passwordHash: "",
        user_type: "both",
        gst_registered: false,
        created_at: Date.now(),
      });
      user = await ctx.db.get(userId);
    }

    if (!user) throw new Error("Failed to create user");

    // Create a long-lived session
    const token = generateToken();
    await ctx.db.insert("sessions", {
      userId: user._id,
      token,
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    });

    return { userId: user._id, token, name: user.name };
  },
});

export const getSession = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session || session.expiresAt < Date.now()) {
      return null;
    }

    const user = await ctx.db.get(session.userId);
    if (!user) return null;

    return {
      userId: user._id,
      name: user.name,
      email: user.email,
      user_type: user.user_type,
      gst_registered: user.gst_registered,
      annual_ctc: user.annual_ctc,
      monthly_salary: user.monthly_salary,
    };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (session) {
      await ctx.db.delete(session._id);
    }
  },
});

// Keep these for backward compatibility but they're not needed
export const register = mutation({
  args: { name: v.string(), email: v.string(), password: v.string(), user_type: v.union(v.literal("employee"), v.literal("consultant"), v.literal("both")) },
  handler: async () => { throw new Error("Use autoLogin instead"); },
});

export const login = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async () => { throw new Error("Use autoLogin instead"); },
});

export const loginOrRegister = mutation({
  args: { email: v.string(), password: v.string(), name: v.optional(v.string()) },
  handler: async () => { throw new Error("Use autoLogin instead"); },
});
