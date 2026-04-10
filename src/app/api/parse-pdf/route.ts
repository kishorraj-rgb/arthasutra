import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/bank-statement/parse-utils";
import type { ParsedTransaction } from "@/lib/bank-statement/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AITransaction {
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
}

interface AIResult {
  bankName: string;
  transactions: AITransaction[];
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildPrompt(bankHint?: string): string {
  const bankLine = bankHint
    ? `The statement is from ${bankHint}.`
    : "Detect the bank name from the statement header/logo if possible.";

  return `You are a bank statement parser for Indian banks. Extract ALL transactions from this bank statement PDF.

${bankLine}

For each transaction, extract:
- date: in YYYY-MM-DD format
- description: the narration/description text (payee, reference, etc.)
- amount: numeric value (always positive)
- type: "debit" for money going out (withdrawals, payments, purchases), "credit" for money coming in (deposits, salary, refunds)

Also detect:
- bankName: the bank this statement belongs to (e.g. "HDFC Bank", "ICICI Bank", "SBI", "Axis Bank")

Rules:
- Extract EVERY transaction row, do not skip any
- Dates should be converted to YYYY-MM-DD format
- Amounts should be positive numbers without commas or currency symbols
- If debit/credit columns exist, use them to determine type
- If a single amount column exists, use context clues (DR/CR suffix, withdrawal/deposit column headers)
- Ignore opening/closing balance rows, interest summary rows, and non-transaction lines
- Keep the original description text as-is (do not summarize)

Respond ONLY as JSON (no markdown, no code blocks):
{"bankName": "...", "transactions": [{"date": "YYYY-MM-DD", "description": "...", "amount": 123.45, "type": "debit"}]}`;
}

// ---------------------------------------------------------------------------
// OpenAI API call (GPT-4o with file/image input)
// ---------------------------------------------------------------------------

async function callOpenAI(
  base64PDF: string,
  bankHint?: string,
  apiKey?: string
): Promise<AIResult> {
  if (!apiKey) {
    throw new Error(
      "OpenAI API key not configured. Set OPENAI_API_KEY in your environment."
    );
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "file",
              file: {
                filename: "statement.pdf",
                file_data: `data:application/pdf;base64,${base64PDF}`,
              },
            },
            { type: "text", text: buildPrompt(bankHint) },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  const rawText = data?.choices?.[0]?.message?.content ?? "";

  // Parse JSON — handle possible markdown code blocks
  const cleaned = rawText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  return JSON.parse(cleaned);
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const bankId = formData.get("bank") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OpenAI API key not configured. Set OPENAI_API_KEY in your environment.",
        },
        { status: 500 }
      );
    }

    // Convert file to base64
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64PDF = buffer.toString("base64");

    // Bank name hint
    const bankNames: Record<string, string> = {
      hdfc: "HDFC Bank",
      icici: "ICICI Bank",
      sbi: "State Bank of India",
      axis: "Axis Bank",
    };
    const bankHint = bankId ? bankNames[bankId] : undefined;

    // Call OpenAI to extract transactions
    const aiResult = await callOpenAI(base64PDF, bankHint, apiKey);

    // Convert AI results to ParsedTransaction format
    const transactions: ParsedTransaction[] = (
      aiResult.transactions || []
    ).map((t) => ({
      id: generateId(),
      date: t.date,
      description: t.description,
      amount: Math.abs(t.amount),
      type: t.type,
      incomeType: "other" as const,
      expenseCategory: "other" as const,
      isDuplicate: false,
      selected: true,
    }));

    return NextResponse.json({
      transactions,
      bankName: aiResult.bankName || bankNames[bankId ?? ""] || "Unknown Bank",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `PDF parsing failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
