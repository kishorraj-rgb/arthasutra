import Papa from "papaparse";
import { parseDate, parseAmount, generateId, findColumn } from "./parse-utils";
import { cleanMerchantName } from "./merchant-cleaner";
import { categorizeTransaction } from "./categorizer";
import type { ParsedTransaction } from "./types";

export interface CCTransaction {
  id: string;
  date: string;
  amount: number;
  type: "debit" | "credit";
  description: string;
  merchant_name: string;
  category: string;
  selected: boolean;
}

interface CCFormat {
  id: string;
  name: string;
  detect: (headers: string[]) => boolean;
  dateColumns: string[];
  descriptionColumns: string[];
  amountColumns?: string[];
  typeColumns?: string[];
  debitColumns?: string[];
  creditColumns?: string[];
  dateFormats?: string[];
  amountMode: "single" | "split" | "signed";
}

const CC_FORMATS: CCFormat[] = [
  {
    id: "hdfc_cc",
    name: "HDFC Credit Card",
    detect: (headers) => {
      const h = headers.map((x) => x.toLowerCase());
      return (
        h.some((x) => x.includes("date")) &&
        (h.some((x) => x.includes("narration") || x.includes("transaction details")) ||
          h.some((x) => x.includes("particulars"))) &&
        h.some((x) => x.includes("amount") || x.includes("inr"))
      );
    },
    dateColumns: ["Date", "Transaction Date"],
    descriptionColumns: ["Narration", "Transaction Details", "Particulars", "Description"],
    amountColumns: ["Amount (INR)", "Amount(INR)", "Amount", "Debit/Credit"],
    typeColumns: ["Type", "Cr/Dr", "DR/CR"],
    amountMode: "single",
  },
  {
    id: "icici_cc",
    name: "ICICI Credit Card",
    detect: (headers) => {
      const h = headers.map((x) => x.toLowerCase().trim());
      return (
        h.some((x) => x === "date" || x.includes("transaction date")) &&
        h.some((x) => x.includes("transaction details") || x.includes("details")) &&
        (h.some((x) => x.includes("amount(in rs)") || x.includes("amount (in rs)") ||
                       x.includes("billingamount") || x.includes("billing amount")) ||
         h.some((x) => x.includes("billingamountsign")))
      );
    },
    dateColumns: ["Date", "Transaction Date"],
    descriptionColumns: ["Transaction Details", "Details", "Description"],
    amountColumns: ["Amount(in Rs)", "Amount (in Rs)", "Amount(in Rs.)", "Amount (in Rs.)", "BillingAmount", "Billing Amount", "Amount"],
    typeColumns: ["BillingAmountSign", "Cr/Dr", "DR/CR", "Type"],
    amountMode: "single",
  },
  {
    id: "amex_cc",
    name: "American Express",
    detect: (headers) => {
      const h = headers.map((x) => x.toLowerCase());
      return (
        h.some((x) => x === "date") &&
        h.some((x) => x === "description" || x === "particulars") &&
        h.some((x) => x === "amount") &&
        !h.some((x) => x.includes("billing"))
      );
    },
    dateColumns: ["Date"],
    descriptionColumns: ["Description", "Particulars"],
    amountColumns: ["Amount"],
    amountMode: "signed", // Negative = credit
  },
  {
    id: "sbi_cc",
    name: "SBI Credit Card",
    detect: (headers) => {
      const h = headers.map((x) => x.toLowerCase());
      return (
        h.some((x) => x.includes("date")) &&
        h.some((x) => x.includes("description") || x.includes("transaction")) &&
        h.some((x) => x.includes("debit")) &&
        h.some((x) => x.includes("credit"))
      );
    },
    dateColumns: ["Date", "Transaction Date"],
    descriptionColumns: ["Description", "Transaction Description", "Particulars"],
    debitColumns: ["Debit", "Debit Amount", "Dr"],
    creditColumns: ["Credit", "Credit Amount", "Cr"],
    amountMode: "split",
  },
];

// ICICI CC special format: merged cells with 4 empty cols between fields
// Pattern: Date,,,,Details,,,,Amount (INR),,,,Reference Number
function isICICIMergedFormat(allRows: string[][]): boolean {
  for (let i = 0; i < Math.min(allRows.length, 20); i++) {
    const row = allRows[i];
    if (!row) continue;
    const joined = row.join(",").toLowerCase();
    if (joined.includes("transaction date") && joined.includes("details") && joined.includes("amount")) {
      return true;
    }
  }
  return false;
}

function parseICICIMergedCC(allRows: string[][]): CCTransaction[] {
  // Find the header row containing "Transaction Date"
  let dataStartIdx = -1;
  for (let i = 0; i < Math.min(allRows.length, 25); i++) {
    const joined = allRows[i]?.join(",").toLowerCase() || "";
    if (joined.includes("transaction date") && joined.includes("details")) {
      dataStartIdx = i + 1; // Skip header, next row may be empty
      break;
    }
  }
  if (dataStartIdx === -1) return [];

  const transactions: CCTransaction[] = [];

  for (let i = dataStartIdx; i < allRows.length; i++) {
    const row = allRows[i];
    if (!row || row.length < 5) continue;

    // Fields are at positions 0, 4, 8, 12 (every 4th column)
    const nonEmpty = row.map((c) => c?.trim()).filter(Boolean);
    if (nonEmpty.length < 3) continue;

    // Find date in first non-empty column
    const rawDate = row[0]?.trim();
    if (!rawDate || !/^\d{2}-\d{2}-\d{4}$/.test(rawDate)) continue;

    const date = parseDate(rawDate);
    if (!date) continue;

    // Details: find the next significant non-empty field after date
    let details = "";
    for (let j = 1; j < Math.min(row.length, 8); j++) {
      if (row[j]?.trim()) { details = row[j].trim(); break; }
    }
    if (!details) continue;

    // Amount: find field containing "Dr." or "Cr."
    let rawAmount = "";
    for (let j = 5; j < Math.min(row.length, 12); j++) {
      const val = row[j]?.trim();
      if (val && (val.includes("Dr.") || val.includes("Cr.") || /[\d,]+\.\d+/.test(val))) {
        rawAmount = val;
        break;
      }
    }
    if (!rawAmount) continue;

    const isDr = rawAmount.includes("Dr.");
    const isCr = rawAmount.includes("Cr.");
    // Remove "Dr." and "Cr." as literal strings (not character class — that strips the decimal point!)
    const cleanedAmt = rawAmount.replace(/\s*Dr\.\s*/g, "").replace(/\s*Cr\.\s*/g, "").replace(/,/g, "").trim();
    const amount = parseFloat(cleanedAmt);
    if (isNaN(amount) || amount === 0) continue;

    const type: "debit" | "credit" = isCr ? "credit" : "debit";

    // Reference number
    let reference = "";
    for (let j = 9; j < row.length; j++) {
      if (row[j]?.trim() && /^\d{5,}$/.test(row[j].trim())) { reference = row[j].trim(); break; }
    }

    const merchant_name = cleanMerchantName(details);
    const fakeParsedTx: ParsedTransaction = {
      id: generateId(), date, description: details, amount, type,
      incomeType: "other", expenseCategory: "other", isDuplicate: false, selected: true,
    };
    const categorized = categorizeTransaction(fakeParsedTx);

    transactions.push({
      id: generateId(), date, amount, type, description: details,
      merchant_name,
      category: type === "debit" ? categorized.expenseCategory : "credit_card_bill",
      selected: true,
    });
  }

  return transactions;
}

function detectCCFormat(headers: string[]): CCFormat | null {
  for (const format of CC_FORMATS) {
    if (format.detect(headers)) return format;
  }
  return null;
}

function getCCFormatById(id: string): CCFormat | null {
  return CC_FORMATS.find((f) => f.id === id) ?? null;
}

export function parseCCStatement(
  file: File,
  ccFormatId?: string
): Promise<{ transactions: CCTransaction[]; error?: string }> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          resolve({ transactions: [], error: "No data found in CSV file" });
          return;
        }

        const allRows = results.data as string[][];

        // Check for ICICI merged format first (special case with 4 empty cols between fields)
        if (isICICIMergedFormat(allRows)) {
          const transactions = parseICICIMergedCC(allRows);
          if (transactions.length > 0) {
            resolve({ transactions });
            return;
          }
        }

        // Standard format detection
        let headerRowIdx = -1;
        let detectedFormat: CCFormat | null = null;

        for (let i = 0; i < Math.min(allRows.length, 50); i++) {
          const row = allRows[i].map((c) => c?.trim()).filter(Boolean);
          if (row.length < 3) continue;

          const format = ccFormatId ? getCCFormatById(ccFormatId) : detectCCFormat(row);
          if (format) {
            const hasDateHeader = row.some((c) =>
              format.dateColumns.some((dc) => c.toLowerCase().includes(dc.toLowerCase()))
            );
            if (hasDateHeader) {
              headerRowIdx = i;
              detectedFormat = format;
              break;
            }
          }
        }

        // Fallback: try row 0
        if (headerRowIdx === -1) {
          const row0 = allRows[0].map((c) => c?.trim()).filter(Boolean);
          detectedFormat = ccFormatId ? getCCFormatById(ccFormatId) : detectCCFormat(row0);
          if (detectedFormat) headerRowIdx = 0;
        }

        if (headerRowIdx === -1 || !detectedFormat) {
          resolve({
            transactions: [],
            error: "Could not detect credit card statement format. Please select format manually.",
          });
          return;
        }

        const headers = allRows[headerRowIdx].map((c) => c?.trim());
        const dataRows: Record<string, string>[] = [];

        for (let i = headerRowIdx + 1; i < allRows.length; i++) {
          const row = allRows[i];
          if (!row || row.length < 3) continue;
          const obj: Record<string, string> = {};
          headers.forEach((h, idx) => {
            if (h) obj[h] = row[idx] || "";
          });
          dataRows.push(obj);
        }

        const transactions = parseCCRows(dataRows, headers, detectedFormat);
        resolve({ transactions });
      },
      error: (err) => {
        resolve({ transactions: [], error: `CSV parse error: ${err.message}` });
      },
    });
  });
}

function parseCCRows(
  rows: Record<string, string>[],
  headers: string[],
  format: CCFormat
): CCTransaction[] {
  const dateCol = findColumn(headers, format.dateColumns);
  const descCol = findColumn(headers, format.descriptionColumns);

  if (!dateCol || !descCol) return [];

  const amountCol = format.amountColumns ? findColumn(headers, format.amountColumns) : null;
  const typeCol = format.typeColumns ? findColumn(headers, format.typeColumns) : null;
  const debitCol = format.debitColumns ? findColumn(headers, format.debitColumns) : null;
  const creditCol = format.creditColumns ? findColumn(headers, format.creditColumns) : null;

  const transactions: CCTransaction[] = [];

  for (const row of rows) {
    const rawDate = row[dateCol]?.trim();
    const description = row[descCol]?.trim();
    if (!rawDate || !description) continue;
    if (description === "B/F" || description === "b/f") continue;

    const date = parseDate(rawDate, format.dateFormats);
    if (!date) continue;

    let amount = 0;
    let type: "debit" | "credit" = "debit";

    if (format.amountMode === "split" && debitCol && creditCol) {
      const debitAmt = parseAmount(row[debitCol]);
      const creditAmt = parseAmount(row[creditCol]);
      if (creditAmt > 0) {
        amount = creditAmt;
        type = "credit";
      } else if (debitAmt > 0) {
        amount = debitAmt;
        type = "debit";
      } else {
        continue;
      }
    } else if (format.amountMode === "signed" && amountCol) {
      const rawAmt = row[amountCol]?.replace(/[,\s₹$INR]/g, "").trim();
      if (!rawAmt || rawAmt === "-") continue;
      const num = parseFloat(rawAmt);
      if (isNaN(num)) continue;
      amount = Math.abs(num);
      type = num < 0 ? "credit" : "debit";
    } else if (amountCol) {
      amount = parseAmount(row[amountCol]);
      if (amount === 0) continue;
      // Determine type from type column or amount sign
      if (typeCol && row[typeCol]) {
        const typeVal = row[typeCol].trim().toUpperCase();
        type = typeVal.startsWith("CR") ? "credit" : "debit";
      } else {
        // Check raw amount for sign
        const rawAmt = row[amountCol]?.replace(/[,\s₹$INR]/g, "").trim();
        if (rawAmt && parseFloat(rawAmt) < 0) {
          type = "credit";
        }
      }
    } else {
      continue;
    }

    const merchant_name = cleanMerchantName(description);

    // Use the categorizer to auto-categorize
    const fakeParsedTx: ParsedTransaction = {
      id: generateId(),
      date,
      description,
      amount,
      type,
      incomeType: "other",
      expenseCategory: "other",
      isDuplicate: false,
      selected: true,
    };
    const categorized = categorizeTransaction(fakeParsedTx);

    transactions.push({
      id: generateId(),
      date,
      amount,
      type,
      description,
      merchant_name,
      category: type === "debit" ? categorized.expenseCategory : "credit_card_bill",
      selected: true,
    });
  }

  return transactions;
}

export const CC_FORMAT_OPTIONS = CC_FORMATS.map((f) => ({
  value: f.id,
  label: f.name,
}));
