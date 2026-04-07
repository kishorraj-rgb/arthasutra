import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TransactionInput {
  id: string;
  description: string;
  amount: number;
  currentCategory: string;
}

interface CategorizedResult {
  id: string;
  category: string;
  subcategory: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 30;

const EXPENSE_CATEGORIES = [
  "food", "transport", "housing", "medical", "education", "insurance",
  "investment", "utilities", "entertainment", "clothing", "grocery",
  "shopping", "personal_care", "subscription", "donation", "emi", "rent",
  "travel", "tax_payment", "credit_card_bill", "recharge", "household",
  "cash_withdrawal", "transfer", "driver_salary", "school_fees", "other",
];

const INCOME_CATEGORIES = [
  "salary", "freelance", "rental", "interest", "dividend", "refund",
  "reimbursement", "transfer", "other",
];

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(
  transactions: TransactionInput[],
  mode: "expense" | "income"
): string {
  const categories =
    mode === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const lines = transactions
    .map(
      (t, i) =>
        `${i + 1}. [${t.id}] ${t.description} - ₹${t.amount} (current: ${t.currentCategory})`
    )
    .join("\n");

  return `You are a financial transaction categorizer for Indian personal finance.
Categorize each transaction into a category and subcategory.

Available categories: ${categories.join(", ")}

For each transaction, respond with:
- category: the best matching category slug from the list above
- subcategory: a short, specific label (2-4 words) describing what this transaction is for

Examples of good subcategories: "Swiggy Delivery", "Uber Ride", "Netflix Subscription", "ICICI CC Bill", "SBI Mutual Fund SIP", "Jio Recharge", "Amazon Purchase", "Salary Credit"

Transactions:
${lines}

Respond ONLY as a JSON array: [{"id": "...", "category": "...", "subcategory": "..."}]
Do not include any markdown formatting, code blocks, or explanation.`;
}

// ---------------------------------------------------------------------------
// Gemini API call
// ---------------------------------------------------------------------------

async function callGemini(
  prompt: string,
  apiKey: string
): Promise<CategorizedResult[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data: GeminiResponse = await response.json();

  const rawText =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Parse JSON — handle possible markdown code blocks
  const cleaned = rawText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const parsed: CategorizedResult[] = JSON.parse(cleaned);
  return parsed;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      transactions,
      mode = "expense",
    }: { transactions: TransactionInput[]; mode?: "expense" | "income" } = body;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: "No transactions provided" },
        { status: 400 }
      );
    }

    const apiKey =
      process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_VISION_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Gemini API key not configured. Set GOOGLE_GEMINI_API_KEY in your environment." },
        { status: 500 }
      );
    }

    // Process in batches
    const allResults: CategorizedResult[] = [];
    const errors: string[] = [];

    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE);
      const prompt = buildPrompt(batch, mode);

      try {
        const results = await callGemini(prompt, apiKey);
        allResults.push(...results);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${msg}`);
        // Continue with next batch
      }
    }

    return NextResponse.json({
      results: allResults,
      totalProcessed: allResults.length,
      totalRequested: transactions.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
