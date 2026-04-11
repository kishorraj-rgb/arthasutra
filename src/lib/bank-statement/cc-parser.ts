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

export interface CCStatementMeta {
  paymentDueDate?: string;
  statementDate?: string;
  totalAmountDue?: number;
  minimumDue?: number;
  creditLimit?: number;
  availableLimit?: number;
  openingBalance?: number;
  totalPayments?: number;
  totalPurchases?: number;
  financeCharges?: number;
  rewardPoints?: number;
  cardLast4?: string;
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
      const h = headers.map((x) => x.toLowerCase().trim());
      return (
        h.some((x) => x.includes("date")) &&
        (h.some((x) => x.includes("narration") || x.includes("transaction details") || x.includes("description")) ||
          h.some((x) => x.includes("particulars"))) &&
        (h.some((x) => x.includes("amount") || x.includes("inr") || x === "amt") ||
          h.some((x) => x.includes("debit /credit") || x.includes("debit/credit")))
      );
    },
    dateColumns: ["Date", "DATE", "Transaction Date"],
    descriptionColumns: ["Narration", "Transaction Details", "Particulars", "Description"],
    amountColumns: ["Amount (INR)", "Amount(INR)", "AMT", "Amount", "Debit/Credit"],
    typeColumns: ["Type", "Cr/Dr", "DR/CR", "Debit /Credit", "Debit/Credit"],
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

// HDFC CC statement format: ~|~ delimited (or ~,~ after PapaParse comma-split)
// Headers: Transaction type~|~Primary / Addon Customer Name~|~DATE~|~Description~|~AMT~|~Debit /Credit~|~
function parseHDFCPipeCC(rawRows: string[][]): { transactions: CCTransaction[]; meta: CCStatementMeta } {
  // Re-join rows — PapaParse may have split on commas inside ~|~
  const lines = rawRows.map((r) => r.join(","));

  // Detect the actual delimiter used: ~|~ (original) or ~,~ (after PapaParse comma-split) or ~ (older HDFC format)
  const delim = lines.some((l) => l.includes("~|~"))
    ? "~|~"
    : lines.some((l) => l.includes("~,~"))
      ? "~,~"
      : "~";

  // Extract metadata from header rows
  const meta: CCStatementMeta = {};
  const parseMetaAmt = (s: string) => { const n = parseFloat(s.replace(/[,\s]/g, "")); return isNaN(n) ? undefined : n; };

  for (const line of lines.slice(0, 25)) {
    const parts = line.split(delim).map((s) => s.trim());
    if (parts.length < 2) continue;
    const key = parts[0].toLowerCase();
    const val = parts[1];
    if (key.includes("payment due date")) meta.paymentDueDate = val;
    else if (key.includes("statement date")) meta.statementDate = val;
    else if (key.includes("total amount due")) meta.totalAmountDue = parseMetaAmt(val);
    else if (key.includes("minimum amount due")) meta.minimumDue = parseMetaAmt(val);
    else if (key.includes("credit limit")) meta.creditLimit = parseMetaAmt(val);
    else if (key.includes("available limit")) meta.availableLimit = parseMetaAmt(val);
    else if (key.startsWith("card no")) meta.cardLast4 = val.replace(/[X\s]/g, "").slice(-4);
  }

  // Extract account summary: Opening Bal - Payment/Credit + Purchases/Debits + Finance Charges = Total
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    if (lines[i].includes("Opening Bal") && lines[i + 1]) {
      const sumParts = lines[i + 1].split(delim).map((s) => s.trim()).filter((s) => s && s !== "-" && s !== "+" && s !== "=");
      if (sumParts.length >= 4) {
        meta.openingBalance = parseMetaAmt(sumParts[0]);
        meta.totalPayments = parseMetaAmt(sumParts[1]);
        meta.totalPurchases = parseMetaAmt(sumParts[2]);
        meta.financeCharges = parseMetaAmt(sumParts[3]);
      }
      break;
    }
  }

  // Extract reward points closing balance
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("Opening Balance") && lines[i].includes("Closing Balance") && lines[i + 1]) {
      const rpParts = lines[i + 1].split(delim).map((s) => s.trim());
      if (rpParts.length >= 5) {
        meta.rewardPoints = parseInt(rpParts[4]?.replace(/[,\s]/g, "")) || undefined;
      }
      break;
    }
  }

  // Find the transaction header row
  let headerIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const line = lines[i];
    if ((line.includes("DATE") || line.includes("Date")) &&
        (line.includes("Description") || line.includes("Particulars")) &&
        (line.includes("AMT") || line.includes("Amount"))) {
      headerIdx = i;
      break;
    }
    if (line.includes("Transaction type") && line.includes("~")) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) return { transactions: [], meta };

  const transactions: CCTransaction[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Stop at non-transaction sections
    const lineNoDelim = line.replace(/~(\|~|,~)?/g, " ").trim().toLowerCase();
    if (lineNoDelim.startsWith("cashback") || lineNoDelim.startsWith("gst summary") ||
        lineNoDelim.startsWith("state account") || lineNoDelim.startsWith("hsn") ||
        lineNoDelim.startsWith("registered") || lineNoDelim.startsWith("*gst") ||
        lineNoDelim.startsWith("opening bal") || lineNoDelim.startsWith("reward")) break;

    const parts = line.split(delim).map((s) => s.trim());
    if (parts.length < 5) continue;

    // Parts: [Transaction type, Customer Name, DATE, Description, AMT, Debit/Credit]
    const rawDate = parts[2];
    const description = parts[3];
    const rawAmount = parts[4];
    const typeIndicator = parts[5] || "";

    if (!rawDate || !description) continue;

    // Parse date: "DD/MM/YYYY HH:MM:SS" or "DD/MM/YYYY"
    const datePart = rawDate.split(" ")[0];
    const date = parseDate(datePart);
    if (!date) continue;

    const amount = parseAmount(rawAmount);
    if (amount === 0) continue;

    const type: "debit" | "credit" = typeIndicator.toLowerCase().startsWith("cr") ? "credit" : "debit";

    // Detect payments by description
    const descLower = description.toLowerCase();
    const isPayment = descLower.includes("credit card payment") || descLower.includes("payment received");
    const finalType = isPayment ? "credit" : type;

    const merchant_name = cleanMerchantName(description);

    // Auto-categorize
    const fakeParsedTx: ParsedTransaction = {
      id: generateId(), date, description, amount, type: finalType,
      incomeType: "other", expenseCategory: "other", isDuplicate: false, selected: true,
    };
    const categorized = categorizeTransaction(fakeParsedTx);

    let category = finalType === "debit" ? categorized.expenseCategory : "credit_card_bill";
    if (descLower.includes("igst") || descLower.includes("cgst") || descLower.includes("sgst")) category = "tax_payment";
    if (descLower.includes("membership fee") || descLower.includes("annual fee")) category = "other";
    if (descLower.includes("cashback")) category = "other";

    transactions.push({
      id: generateId(),
      date,
      amount,
      type: finalType,
      description,
      merchant_name,
      category,
      selected: true,
    });
  }

  return { transactions, meta };
}

// Axis Bank CC XLSX parser
function parseAxisCCXLSX(rows: string[][]): { transactions: CCTransaction[]; meta: CCStatementMeta } {
  const meta: CCStatementMeta = {};

  // Extract metadata from rows 1-5
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const row = rows[i].map((c) => (c || "").toString().trim()).join(" ");
    // Card number
    const cardMatch = row.match(/Credit Card Number[:\s]*(\d{4}X+\d{4})/i);
    if (cardMatch) meta.cardLast4 = cardMatch[1].slice(-4);
    // Payment due
    const dueMatch = row.match(/Total Payment Due\s*₹?\s*([\d,.]+)/);
    if (dueMatch) meta.totalAmountDue = parseFloat(dueMatch[1].replace(/,/g, "")) || undefined;
    const minMatch = row.match(/Minimum Payment Due\s*₹?\s*([\d,.]+)/);
    if (minMatch) meta.minimumDue = parseFloat(minMatch[1].replace(/,/g, "")) || undefined;
    const dueDateMatch = row.match(/Payment Due Date\s*(\d{2}\s+\w+\s+'\d{2})/);
    if (dueDateMatch) meta.paymentDueDate = dueDateMatch[1];
    const limitMatch = row.match(/Credit Limit\s*₹?\s*([\d,.]+)/);
    if (limitMatch) meta.creditLimit = parseFloat(limitMatch[1].replace(/,/g, "")) || undefined;
    const openMatch = row.match(/Opening Balance\s*₹?\s*([\d,.]+)/);
    if (openMatch) meta.openingBalance = parseFloat(openMatch[1].replace(/,/g, "")) || undefined;
  }

  // Find header row: "Date | Transaction Details | Amount (INR) | Debit/Credit"
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i].map((c) => (c || "").toString().toLowerCase().trim());
    if (row.some((c) => c.includes("date")) && row.some((c) => c.includes("transaction")) && row.some((c) => c.includes("amount"))) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) return { transactions: [], meta };

  const transactions: CCTransaction[] = [];
  const monthMap: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cells = rows[i].map((c) => (c || "").toString().trim());
    if (cells.length < 4) continue;
    // Stop at end marker
    if (cells.some((c) => c.includes("End of Statement"))) break;

    const rawDate = cells[0];
    const description = cells[1];
    const rawAmount = cells[2];
    const typeStr = cells[3];

    if (!rawDate || !description) continue;

    // Parse date: "11 Mar '26" or "23 Feb '26"
    const dateMatch = rawDate.match(/(\d{1,2})\s+(\w{3})\s+'(\d{2})/);
    if (!dateMatch) continue;
    const [, day, monStr, yr] = dateMatch;
    const month = monthMap[monStr.toLowerCase()];
    if (!month) continue;
    const year = parseInt(yr) > 50 ? `19${yr}` : `20${yr}`;
    const date = `${year}-${month}-${day.padStart(2, "0")}`;

    // Parse amount: "₹ 2,801.00"
    const amount = parseAmount(rawAmount.replace(/₹/g, ""));
    if (amount === 0) continue;

    const type: "debit" | "credit" = typeStr.toLowerCase().includes("credit") ? "credit" : "debit";
    const descLower = description.toLowerCase();

    // Detect payments
    const isPayment = descLower.includes("ib payment") || descLower.includes("payment received") || descLower.includes("cashback credit");
    const finalType = isPayment && type === "debit" ? "credit" : type;

    const merchant_name = cleanMerchantName(description);

    // Categorize
    const isPrincipalEmi = descLower.includes("emi principal");
    const isInterestEmi = descLower.includes("emi interest");

    const fakeTx: ParsedTransaction = {
      id: generateId(), date, description, amount, type: finalType,
      incomeType: "other", expenseCategory: "other", isDuplicate: false, selected: true,
    };
    const categorized = categorizeTransaction(fakeTx);

    let category = finalType === "debit" ? categorized.expenseCategory : "credit_card_bill";
    if (isPrincipalEmi || isInterestEmi) category = "emi";
    if (descLower.includes("gst") && amount < 500) category = "tax_payment";
    if (descLower.includes("annual fee") || descLower.includes("membership fee")) category = "other";

    transactions.push({
      id: generateId(), date, amount, type: finalType, description, merchant_name, category,
      selected: !isPrincipalEmi,
    });
  }

  return { transactions, meta };
}

export function parseCCStatement(
  file: File,
  ccFormatId?: string
): Promise<{ transactions: CCTransaction[]; error?: string; meta?: CCStatementMeta }> {
  // Handle XLSX/XLS files (Axis Bank, etc.)
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "xlsx" || ext === "xls") {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const XLSX = await import("xlsx");
          const data = e.target?.result;
          if (!data) { resolve({ transactions: [], error: "Failed to read file" }); return; }
          const wb = XLSX.read(data, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
          if (!rows || rows.length === 0) { resolve({ transactions: [], error: "No data in Excel file" }); return; }

          // Try Axis Bank format (has "Transaction Details" + "Debit/Credit" headers)
          const result = parseAxisCCXLSX(rows);
          if (result.transactions.length > 0) {
            resolve({ transactions: result.transactions, meta: result.meta });
            return;
          }

          // Generic: try to detect format from headers and use parseCCRows
          resolve({ transactions: [], error: "Could not detect CC format in Excel file." });
        } catch (err) {
          resolve({ transactions: [], error: `Excel parse error: ${err instanceof Error ? err.message : "Unknown error"}` });
        }
      };
      reader.onerror = () => resolve({ transactions: [], error: "Failed to read file" });
      reader.readAsArrayBuffer(file);
    });
  }

  // Handle CSV files
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          resolve({ transactions: [], error: "No data found in CSV file" });
          return;
        }

        let allRows = results.data as string[][];

        // HDFC CC statements use ~ or ~|~ delimiter (appears as ~,~ after PapaParse comma-split)
        const firstFewLines = allRows.slice(0, 30).map((r) => r.join(","));
        const isHdfcPipeFormat = firstFewLines.some(
          (line) => line.includes("~") &&
            (line.includes("DATE") || line.includes("Description") || line.includes("AMT") ||
             line.includes("Payment Due Date") || line.includes("Statement Date"))
        );
        if (isHdfcPipeFormat) {
          const result = parseHDFCPipeCC(allRows);
          if (result.transactions.length > 0) {
            resolve({ transactions: result.transactions, meta: result.meta });
            return;
          }
        }

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
    const descLower = description.toLowerCase();

    // Detect EMI amortization transactions
    const isPrincipalAmortization = descLower.includes("principal amount amortization") || descLower.includes("principal amortization");
    const isInterestAmortization = descLower.includes("interest amount amortization") || descLower.includes("interest amortization");
    const isEmiAmortization = isPrincipalAmortization || isInterestAmortization;

    // Detect payment/credit transactions by description keywords
    const isPaymentByDesc = descLower.includes("payment received") || descLower.includes("payment recd") ||
      descLower.includes("autodebit payment") || descLower.includes("auto debit") ||
      descLower.includes("infinity payment") || descLower.includes("credit received");

    // Override type for payment transactions detected by description
    if (isPaymentByDesc && type === "debit") {
      type = "credit";
    }

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

    // Smart category assignment
    let category = type === "debit" ? categorized.expenseCategory : "credit_card_bill";
    if (isPrincipalAmortization) category = "emi";
    if (isInterestAmortization) category = "emi";
    if (descLower.includes("igst-ci@18%") || descLower.includes("cgst") || descLower.includes("sgst")) category = "tax_payment";
    if (descLower.includes("dcc fee")) category = "other"; // DCC fees

    transactions.push({
      id: generateId(),
      date,
      amount,
      type,
      description,
      merchant_name,
      category,
      selected: !isPrincipalAmortization, // Deselect principal EMI by default (already counted in original)
    });
  }

  return transactions;
}

export const CC_FORMAT_OPTIONS = CC_FORMATS.map((f) => ({
  value: f.id,
  label: f.name,
}));
