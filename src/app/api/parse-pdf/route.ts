import { NextRequest, NextResponse } from "next/server";
import { parseAmount, parseDate, generateId } from "@/lib/bank-statement/parse-utils";
import type { ParsedTransaction } from "@/lib/bank-statement/types";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const bankId = formData.get("bank") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Dynamic import for server-side only
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    const lines = text.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    const transactions = extractTransactionsFromText(lines);

    const detectedBank = bankId || "unknown";
    const bankNames: Record<string, string> = {
      hdfc: "HDFC Bank",
      icici: "ICICI Bank",
      sbi: "SBI",
      axis: "Axis Bank",
    };

    return NextResponse.json({
      transactions,
      bankName: bankNames[detectedBank] || "Unknown Bank",
    });
  } catch (err) {
    return NextResponse.json(
      { error: `PDF parsing failed: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

function extractTransactionsFromText(
  lines: string[]
): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];

  // Generic PDF parsing: look for lines that start with a date pattern
  const datePattern = /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}[\s\-][A-Za-z]{3}[\s\-]\d{2,4})/;
  const dateFormats = ["dd/MM/yyyy", "dd-MM-yyyy", "dd MMM yyyy", "dd-MMM-yyyy"];

  for (const line of lines) {
    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;

    const rawDate = dateMatch[1];
    const date = parseDate(rawDate, dateFormats);
    if (!date) continue;

    // Rest of line after date
    const rest = line.substring(dateMatch[0].length).trim();

    // Try to extract amounts from the line
    // Look for number patterns (with commas and decimals)
    const amounts = rest.match(/[\d,]+\.\d{2}/g);
    if (!amounts || amounts.length === 0) continue;

    // Description is everything before the first number
    const firstAmountIdx = rest.search(/[\d,]+\.\d{2}/);
    const description = rest.substring(0, firstAmountIdx).trim().replace(/\s+/g, " ");
    if (!description || description.length < 2) continue;

    // Parse amounts - typically: debit, credit, balance (2-3 numbers)
    const parsedAmounts = amounts.map(parseAmount);

    let amount = 0;
    let type: "credit" | "debit" = "debit";

    if (parsedAmounts.length >= 2) {
      // If first amount > 0 and second is 0, it's debit; vice versa
      if (parsedAmounts[0] > 0 && parsedAmounts[1] === 0) {
        amount = parsedAmounts[0];
        type = "debit";
      } else if (parsedAmounts[0] === 0 && parsedAmounts[1] > 0) {
        amount = parsedAmounts[1];
        type = "credit";
      } else if (parsedAmounts[0] > 0) {
        amount = parsedAmounts[0];
        type = "debit";
      }
    } else if (parsedAmounts.length === 1 && parsedAmounts[0] > 0) {
      amount = parsedAmounts[0];
      // Check description for credit indicators
      type = /CR|CREDIT|DEPOSIT|RECEIVED|SALARY|NEFT CR/i.test(description) ? "credit" : "debit";
    }

    if (amount <= 0) continue;

    transactions.push({
      id: generateId(),
      date,
      description,
      amount,
      type,
      incomeType: "other",
      expenseCategory: "other",
      isDuplicate: false,
      selected: true,
    });
  }

  return transactions;
}
