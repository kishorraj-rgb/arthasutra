import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─── Queries ────────────────────────────────────────────────────────────

export const getCreditCards = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const cards = await ctx.db
      .query("credit_cards")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Sort: active first, then by card_name
    return cards.sort((a, b) => {
      const statusOrder: Record<string, number> = { active: 0, closed: 1 };
      const statusDiff = (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2);
      if (statusDiff !== 0) return statusDiff;
      return a.card_name.localeCompare(b.card_name);
    });
  },
});

export const getCCTransactions = query({
  args: {
    creditCardId: v.id("credit_cards"),
    statementMonth: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.statementMonth) {
      return await ctx.db
        .query("cc_transactions")
        .withIndex("by_card_month", (q) =>
          q.eq("credit_card_id", args.creditCardId).eq("statement_month", args.statementMonth!)
        )
        .collect();
    }
    const txns = await ctx.db
      .query("cc_transactions")
      .withIndex("by_card", (q) => q.eq("credit_card_id", args.creditCardId))
      .collect();
    return txns.sort((a, b) => b.date.localeCompare(a.date));
  },
});

export const getCCStatements = query({
  args: { creditCardId: v.id("credit_cards") },
  handler: async (ctx, args) => {
    const statements = await ctx.db
      .query("cc_statements")
      .withIndex("by_card_month", (q) => q.eq("credit_card_id", args.creditCardId))
      .collect();
    return statements.sort((a, b) => b.statement_month.localeCompare(a.statement_month));
  },
});

export const getCCSummary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const cards = await ctx.db
      .query("credit_cards")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const activeCards = cards.filter((c) => c.status === "active");

    let totalOutstanding = 0;
    let totalLimit = 0;

    for (const card of activeCards) {
      totalLimit += card.credit_limit ?? 0;

      // Get latest statement for outstanding
      const statements = await ctx.db
        .query("cc_statements")
        .withIndex("by_card_month", (q) => q.eq("credit_card_id", card._id))
        .collect();
      if (statements.length > 0) {
        const latest = statements.sort((a, b) =>
          b.statement_month.localeCompare(a.statement_month)
        )[0];
        if (latest.total_due && latest.payment_status !== "paid") {
          totalOutstanding += latest.total_due;
        }
      }
    }

    return {
      totalOutstanding,
      totalLimit,
      availableCredit: totalLimit - totalOutstanding,
      cardCount: activeCards.length,
      totalCards: cards.length,
    };
  },
});

// ─── Mutations ──────────────────────────────────────────────────────────

export const addCreditCard = mutation({
  args: {
    userId: v.id("users"),
    card_name: v.string(),
    card_last4: v.string(),
    card_network: v.union(v.literal("visa"), v.literal("mastercard"), v.literal("rupay"), v.literal("amex")),
    issuer: v.string(),
    credit_limit: v.optional(v.number()),
    billing_cycle_date: v.optional(v.number()),
    payment_due_date: v.optional(v.number()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("credit_cards", {
      ...args,
      status: "active",
    });
  },
});

export const updateCreditCard = mutation({
  args: {
    id: v.id("credit_cards"),
    card_name: v.optional(v.string()),
    card_last4: v.optional(v.string()),
    card_network: v.optional(v.union(v.literal("visa"), v.literal("mastercard"), v.literal("rupay"), v.literal("amex"))),
    issuer: v.optional(v.string()),
    credit_limit: v.optional(v.number()),
    billing_cycle_date: v.optional(v.number()),
    payment_due_date: v.optional(v.number()),
    status: v.optional(v.union(v.literal("active"), v.literal("closed"))),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const deleteCreditCard = mutation({
  args: { id: v.id("credit_cards") },
  handler: async (ctx, args) => {
    // Delete associated transactions
    const txns = await ctx.db
      .query("cc_transactions")
      .withIndex("by_card", (q) => q.eq("credit_card_id", args.id))
      .collect();
    for (const txn of txns) {
      await ctx.db.delete(txn._id);
    }
    // Delete associated statements
    const stmts = await ctx.db
      .query("cc_statements")
      .withIndex("by_card_month", (q) => q.eq("credit_card_id", args.id))
      .collect();
    for (const stmt of stmts) {
      await ctx.db.delete(stmt._id);
    }
    await ctx.db.delete(args.id);
  },
});

export const importCCTransactions = mutation({
  args: {
    userId: v.id("users"),
    creditCardId: v.id("credit_cards"),
    statementMonth: v.string(),
    transactions: v.array(
      v.object({
        date: v.string(),
        amount: v.number(),
        type: v.union(v.literal("debit"), v.literal("credit")),
        description: v.string(),
        merchant_name: v.optional(v.string()),
        category: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Fetch existing transactions for this card to dedup
    const existing = await ctx.db
      .query("cc_transactions")
      .withIndex("by_card", (q) => q.eq("credit_card_id", args.creditCardId))
      .collect();

    // Build dedup key set: date + description_prefix + amount + type
    const existingKeys = new Set(
      existing.map((t) =>
        `${t.date}|${t.description.substring(0, 40)}|${t.amount}|${t.type}`
      )
    );

    let inserted = 0;
    let skipped = 0;

    for (const tx of args.transactions) {
      const key = `${tx.date}|${tx.description.substring(0, 40)}|${tx.amount}|${tx.type}`;
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }

      await ctx.db.insert("cc_transactions", {
        userId: args.userId,
        credit_card_id: args.creditCardId,
        date: tx.date,
        amount: tx.amount,
        type: tx.type,
        description: tx.description,
        merchant_name: tx.merchant_name,
        category: tx.category,
        match_status: "unmatched",
        statement_month: args.statementMonth,
      });
      existingKeys.add(key); // Prevent intra-batch dupes
      inserted++;
    }

    // Create or update statement
    const existingStatements = await ctx.db
      .query("cc_statements")
      .withIndex("by_card_month", (q) =>
        q.eq("credit_card_id", args.creditCardId).eq("statement_month", args.statementMonth)
      )
      .collect();

    const totalDue = args.transactions
      .filter((t) => t.type === "debit")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalCredits = args.transactions
      .filter((t) => t.type === "credit")
      .reduce((sum, t) => sum + t.amount, 0);

    if (existingStatements.length > 0) {
      await ctx.db.patch(existingStatements[0]._id, {
        total_due: totalDue - totalCredits,
        transaction_count: args.transactions.length,
      });
    } else {
      await ctx.db.insert("cc_statements", {
        userId: args.userId,
        credit_card_id: args.creditCardId,
        statement_month: args.statementMonth,
        total_due: totalDue - totalCredits,
        transaction_count: args.transactions.length,
        payment_status: "unpaid",
      });
    }

    return { imported: inserted, skipped };
  },
});

// Dedup existing CC transactions — removes duplicates keeping the first occurrence
export const dedupCCTransactions = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("cc_transactions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const seen = new Set<string>();
    let removed = 0;

    // Sort by creation time so we keep the oldest
    const sorted = all.sort((a, b) => a._creationTime - b._creationTime);

    for (const t of sorted) {
      const key = `${t.credit_card_id}|${t.date}|${t.description.substring(0, 40)}|${t.amount}|${t.type}`;
      if (seen.has(key)) {
        await ctx.db.delete(t._id);
        removed++;
      } else {
        seen.add(key);
      }
    }

    return { removed, kept: all.length - removed };
  },
});

// Delete specific CC transactions by ID
export const deleteCCTransactions = mutation({
  args: {
    transactionIds: v.array(v.id("cc_transactions")),
  },
  handler: async (ctx, args) => {
    for (const id of args.transactionIds) {
      await ctx.db.delete(id);
    }
    return { deleted: args.transactionIds.length };
  },
});

// Cross-card dedup: find transactions that exist on multiple cards
export const findCrossCardDupes = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("cc_transactions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Group by dedup key (without card ID)
    const groups = new Map<string, typeof all>();
    for (const t of all) {
      const key = `${t.date}|${t.description.substring(0, 40)}|${t.amount}|${t.type}`;
      const group = groups.get(key) || [];
      group.push(t);
      groups.set(key, group);
    }

    // Filter to only groups that span multiple cards
    const dupes: Array<{
      key: string;
      date: string;
      description: string;
      amount: number;
      type: string;
      transactions: Array<{ _id: string; credit_card_id: string; _creationTime: number }>;
    }> = [];

    const entries = Array.from(groups.entries());
    for (const [key, group] of entries) {
      const cardIds = new Set(group.map((t: (typeof all)[0]) => t.credit_card_id));
      if (cardIds.size > 1) {
        dupes.push({
          key,
          date: group[0].date,
          description: group[0].description,
          amount: group[0].amount,
          type: group[0].type,
          transactions: group.map((t: (typeof all)[0]) => ({
            _id: t._id,
            credit_card_id: t.credit_card_id,
            _creationTime: t._creationTime,
          })),
        });
      }
    }

    return dupes.sort((a, b) => b.date.localeCompare(a.date));
  },
});

// Reassign transactions from one card to another
export const reassignCCTransactions = mutation({
  args: {
    userId: v.id("users"),
    fromCardId: v.id("credit_cards"),
    toCardId: v.id("credit_cards"),
  },
  handler: async (ctx, args) => {
    if (args.fromCardId === args.toCardId) return { moved: 0 };

    const txns = await ctx.db
      .query("cc_transactions")
      .withIndex("by_card", (q) => q.eq("credit_card_id", args.fromCardId))
      .collect();

    // Get existing transactions on the target card for dedup
    const targetTxns = await ctx.db
      .query("cc_transactions")
      .withIndex("by_card", (q) => q.eq("credit_card_id", args.toCardId))
      .collect();

    const targetKeys = new Set(
      targetTxns.map((t) => `${t.date}|${t.description.substring(0, 40)}|${t.amount}|${t.type}`)
    );

    let moved = 0;
    let dupes = 0;

    for (const t of txns) {
      const key = `${t.date}|${t.description.substring(0, 40)}|${t.amount}|${t.type}`;
      if (targetKeys.has(key)) {
        // Already exists on target card — delete the duplicate from source
        await ctx.db.delete(t._id);
        dupes++;
      } else {
        // Move to target card
        await ctx.db.patch(t._id, { credit_card_id: args.toCardId });
        targetKeys.add(key);
        moved++;
      }
    }

    return { moved, dupes, total: txns.length };
  },
});

// Purge all CC transactions for a card (for re-import after parsing fix)
export const purgeCCTransactions = mutation({
  args: {
    userId: v.id("users"),
    creditCardId: v.optional(v.id("credit_cards")),
  },
  handler: async (ctx, args) => {
    const txns = args.creditCardId
      ? await ctx.db
          .query("cc_transactions")
          .withIndex("by_card", (q) => q.eq("credit_card_id", args.creditCardId!))
          .collect()
      : await ctx.db
          .query("cc_transactions")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .collect();

    for (const t of txns) {
      await ctx.db.delete(t._id);
    }

    // Also delete associated statements
    const statements = args.creditCardId
      ? await ctx.db
          .query("cc_statements")
          .withIndex("by_card_month", (q) => q.eq("credit_card_id", args.creditCardId!))
          .collect()
      : await ctx.db
          .query("cc_statements")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .collect();

    for (const s of statements) {
      await ctx.db.delete(s._id);
    }

    return { deleted: txns.length };
  },
});

// ─── Auto-Match ─────────────────────────────────────────────────────────

function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  wordsA.forEach((w) => {
    if (wordsB.has(w)) overlap++;
  });
  return overlap / Math.max(wordsA.size, wordsB.size);
}

function daysDiff(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.abs(a - b) / (1000 * 60 * 60 * 24);
}

export const autoMatchTransactions = mutation({
  args: {
    userId: v.id("users"),
    creditCardId: v.id("credit_cards"),
    statementMonth: v.string(),
  },
  handler: async (ctx, args) => {
    const ccTxns = await ctx.db
      .query("cc_transactions")
      .withIndex("by_card_month", (q) =>
        q.eq("credit_card_id", args.creditCardId).eq("statement_month", args.statementMonth)
      )
      .collect();

    const unmatchedDebits = ccTxns.filter(
      (t) => t.type === "debit" && t.match_status === "unmatched"
    );

    if (unmatchedDebits.length === 0) {
      return { autoMatched: 0, needReview: 0, unmatched: 0 };
    }

    // Get expense entries for the user (within a reasonable date range)
    const expenses = await ctx.db
      .query("expense_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    let autoMatched = 0;
    let needReview = 0;
    let unmatched = 0;

    for (const ccTx of unmatchedDebits) {
      let bestScore = 0;
      let bestExpenseId: string | null = null;

      for (const expense of expenses) {
        const days = daysDiff(ccTx.date, expense.date);
        if (days > 5) continue;

        let score = 0;

        // Amount scoring
        const amtDiff = Math.abs(ccTx.amount - expense.amount);
        if (amtDiff === 0) score += 50;
        else if (amtDiff <= 5) score += 30;
        else if (amtDiff <= 50) score += 10;

        // Date scoring
        if (days === 0) score += 40;
        else if (days <= 1) score += 25;
        else if (days <= 3) score += 10;

        // Description overlap scoring
        const overlap = wordOverlap(ccTx.description, expense.description);
        if (overlap > 0.4) score += 30;
        else if (overlap > 0.2) score += 15;

        if (score > bestScore) {
          bestScore = score;
          bestExpenseId = expense._id;
        }
      }

      if (bestScore >= 80 && bestExpenseId) {
        await ctx.db.patch(ccTx._id, {
          match_status: "matched",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          matched_expense_id: bestExpenseId as any,
          match_confidence: "high",
        });
        autoMatched++;
      } else if (bestScore >= 50) {
        await ctx.db.patch(ccTx._id, {
          match_confidence: "medium",
        });
        needReview++;
      } else {
        unmatched++;
      }
    }

    return { autoMatched, needReview, unmatched };
  },
});

export const updateCCTransaction = mutation({
  args: {
    id: v.id("cc_transactions"),
    category: v.optional(v.string()),
    subcategory: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const matchCCTransaction = mutation({
  args: {
    ccTransactionId: v.id("cc_transactions"),
    expenseEntryId: v.id("expense_entries"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ccTransactionId, {
      matched_expense_id: args.expenseEntryId,
      match_status: "manual_match",
      match_confidence: "high",
    });
  },
});

export const unmatchCCTransaction = mutation({
  args: { ccTransactionId: v.id("cc_transactions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ccTransactionId, {
      matched_expense_id: undefined,
      match_status: "unmatched",
      match_confidence: undefined,
    });
  },
});

export const ignoreCCTransaction = mutation({
  args: { ccTransactionId: v.id("cc_transactions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ccTransactionId, {
      match_status: "ignored",
    });
  },
});

// Find CC bill payment transactions from bank accounts (reconciliation)
export const findCCPayments = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const expenses = await ctx.db
      .query("expense_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Look for CC bill payment patterns in bank expense descriptions
    const ccPaymentPatterns = [
      /cc\s*payment/i, /credit\s*card\s*payment/i, /billpay/i,
      /bill\s*pay/i, /card\s*payment/i, /ib\s*billpay/i,
      /creditcard\s*payment/i, /autopay/i, /auto\s*debit.*card/i,
    ];

    return expenses
      .filter((e) => {
        const desc = e.description.toLowerCase();
        return ccPaymentPatterns.some((p) => p.test(desc)) ||
          desc.includes("credit card") ||
          (e.category === "credit_card_bill");
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 50);
  },
});

// Get all CC transactions across all cards for unified table view
export const getAllCCTransactions = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cc_transactions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Get potential expense matches for a CC transaction (for manual matching UI)
export const getExpenseCandidates = query({
  args: {
    userId: v.id("users"),
    ccTransactionId: v.id("cc_transactions"),
  },
  handler: async (ctx, args) => {
    const ccTx = await ctx.db.get(args.ccTransactionId);
    if (!ccTx) return [];

    const expenses = await ctx.db
      .query("expense_entries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Score and rank candidates
    const candidates = expenses
      .map((expense) => {
        const days = daysDiff(ccTx.date, expense.date);
        if (days > 10) return null;

        let score = 0;
        const amtDiff = Math.abs(ccTx.amount - expense.amount);
        if (amtDiff === 0) score += 50;
        else if (amtDiff <= 5) score += 30;
        else if (amtDiff <= 50) score += 10;

        if (days === 0) score += 40;
        else if (days <= 1) score += 25;
        else if (days <= 3) score += 10;

        const overlap = wordOverlap(ccTx.description, expense.description);
        if (overlap > 0.4) score += 30;
        else if (overlap > 0.2) score += 15;

        if (score < 20) return null;

        return { ...expense, matchScore: score };
      })
      .filter(Boolean)
      .sort((a, b) => b!.matchScore - a!.matchScore)
      .slice(0, 10);

    return candidates;
  },
});
