/**
 * Parser for GST Electronic Cash Ledger CSV from services.gst.gov.in
 *
 * CSV structure:
 * - Row 1: "Electronic Cash Ledger"
 * - Row 2: blank
 * - Row 3: GSTIN header
 * - Row 4: Name header
 * - Row 5: From date
 * - Row 6: To date
 * - Row 7: Column headers (Sr.No, Date, Time, ...)
 * - Row 8: Sub-headers (Tax, Interest, Penalty, Fee, Others, Total) x8
 * - Row 9+: Data rows
 *
 * Each data row has ~56 columns:
 * [0] Sr.No, [1] Date, [2] Time, [3] Reporting date, [4] Reference No.,
 * [5] Tax Period, [6] Description, [7] Transaction Type
 * [8-13]  IGST debited/credited (Tax, Interest, Penalty, Fee, Others, Total)
 * [14-19] CGST debited/credited
 * [20-25] SGST debited/credited
 * [26-31] CESS debited/credited
 * [32-37] IGST balance
 * [38-43] CGST balance
 * [44-49] SGST balance
 * [50-55] CESS balance
 */

export interface CashLedgerEntry {
  srNo: number;
  date: string; // YYYY-MM-DD
  referenceNo: string;
  taxPeriod: string; // Original: "May-25", normalized stored separately
  taxPeriodISO: string; // "2025-05" or ""
  description: string;
  txnType: string; // "Credit" | "Debit" | "-"
  // Tax amounts
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  total: number;
  // Interest
  interestIgst: number;
  interestCgst: number;
  interestSgst: number;
  // Balance
  balanceIgst: number;
  balanceCgst: number;
  balanceSgst: number;
  balanceCess: number;
  balanceTotal: number;
}

/** Parse Indian formatted number: "1,17,475.00" → 117475 */
function parseIndianNumber(s: string): number {
  if (!s || s === "-" || s === '"-"') return 0;
  // Remove quotes and commas
  const cleaned = s.replace(/"/g, "").replace(/,/g, "").trim();
  if (!cleaned || cleaned === "-") return 0;
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

/** Parse date from "16/07/2025" or "dd/MM/yyyy" → "YYYY-MM-DD" */
function parseGSTDate(s: string): string {
  if (!s || s === "-" || s === '"-"') return "";
  const cleaned = s.replace(/"/g, "").trim();
  if (!cleaned || cleaned === "-") return "";

  // Try dd/MM/yyyy
  const parts = cleaned.split("/");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    if (yyyy.length === 4) {
      return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }
  }
  return "";
}

/** Normalize tax period: "May-25" → "2025-05", "Jun-25" → "2025-06" */
function normalizeTaxPeriod(s: string): string {
  if (!s || s === "-") return "";
  const cleaned = s.replace(/"/g, "").trim();
  if (!cleaned || cleaned === "-") return "";

  const monthMap: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04",
    may: "05", jun: "06", jul: "07", aug: "08",
    sep: "09", oct: "10", nov: "11", dec: "12",
  };

  // Match "May-25", "Jun-25", "Nov-25" etc.
  const match = cleaned.match(/^([A-Za-z]{3})-(\d{2})$/);
  if (match) {
    const month = monthMap[match[1].toLowerCase()];
    const year = `20${match[2]}`;
    if (month) return `${year}-${month}`;
  }
  return "";
}

/** Clean a CSV field — remove surrounding quotes and leading/trailing junk */
function cleanField(s: string): string {
  if (!s) return "";
  // The GST CSV has weird double-quote patterns like ""16/07/2025
  return s.replace(/^"+/, "").replace(/"+$/, "").trim();
}

/**
 * Parse a GST Electronic Cash Ledger CSV string.
 * Returns parsed entries (excluding Opening/Closing Balance rows).
 */
export function parseGSTCashLedger(csvText: string): {
  gstin: string;
  name: string;
  fromDate: string;
  toDate: string;
  entries: CashLedgerEntry[];
  closingBalance: {
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    total: number;
  };
} {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Extract metadata from header rows
  let gstin = "";
  let name = "";
  let fromDate = "";
  let toDate = "";

  for (const line of lines.slice(0, 6)) {
    if (line.includes("GSTIN")) {
      const parts = line.split(",");
      gstin = cleanField(parts[parts.indexOf("GSTIN") + 1] || parts[7] || "");
    }
    if (line.includes("Name(Legal)") || line.includes("Name")) {
      const parts = line.split(",");
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].includes("Name")) {
          name = cleanField(parts[i + 1] || "");
          break;
        }
      }
    }
    if (line.includes(",From,")) {
      const parts = line.split(",");
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].trim() === "From") { fromDate = cleanField(parts[i + 1] || ""); break; }
      }
    }
    if (line.includes(",To,") || line.includes(",To")) {
      const parts = line.split(",");
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].trim() === "To") { toDate = cleanField(parts[i + 1] || ""); break; }
      }
    }
  }

  // Find data rows — look for rows starting with a number in quotes
  const entries: CashLedgerEntry[] = [];
  let closingBalance = { igst: 0, cgst: 0, sgst: 0, cess: 0, total: 0 };

  for (const line of lines) {
    // Parse CSV respecting quoted fields
    const cols = parseCSVLine(line);
    if (cols.length < 32) continue;

    const srNoRaw = cleanField(cols[0]);
    const srNo = parseInt(srNoRaw);
    if (isNaN(srNo)) continue; // Skip header rows

    const dateStr = cleanField(cols[1]);
    const date = parseGSTDate(dateStr);
    const refNo = cleanField(cols[4]);
    const taxPeriod = cleanField(cols[5]);
    const description = cleanField(cols[6]);
    const txnType = cleanField(cols[7]);

    // Skip if it's opening/closing balance
    if (description === "Opening Balance" || description === "Closing Balance") {
      if (description === "Closing Balance") {
        // Extract closing balance from balance columns
        closingBalance = {
          igst: parseIndianNumber(cols[32]) + parseIndianNumber(cols[33]), // tax + interest
          cgst: parseIndianNumber(cols[38]) + parseIndianNumber(cols[39]),
          sgst: parseIndianNumber(cols[44]) + parseIndianNumber(cols[45]),
          cess: parseIndianNumber(cols[50]) + parseIndianNumber(cols[51]),
          total:
            parseIndianNumber(cols[37]) + // IGST total balance
            parseIndianNumber(cols[43]) + // CGST total balance
            parseIndianNumber(cols[49]) + // SGST total balance
            parseIndianNumber(cols[55]),  // CESS total balance
        };
      }
      continue;
    }

    // IGST debited/credited: cols[8]=Tax, [9]=Interest, [13]=Total
    // CGST: cols[14]=Tax, [15]=Interest, [19]=Total
    // SGST: cols[20]=Tax, [21]=Interest, [25]=Total
    // CESS: cols[26]=Tax, [31]=Total
    // IGST balance: cols[32-37], Total=[37]
    // CGST balance: cols[38-43], Total=[43]
    // SGST balance: cols[44-49], Total=[49]
    // CESS balance: cols[50-55], Total=[55]

    const entry: CashLedgerEntry = {
      srNo,
      date: date || "",
      referenceNo: refNo || "",
      taxPeriod: taxPeriod || "-",
      taxPeriodISO: normalizeTaxPeriod(taxPeriod),
      description,
      txnType,
      // Tax amounts (total of each head)
      igst: parseIndianNumber(cols[13]),
      cgst: parseIndianNumber(cols[19]),
      sgst: parseIndianNumber(cols[25]),
      cess: parseIndianNumber(cols[31]),
      total:
        parseIndianNumber(cols[13]) +
        parseIndianNumber(cols[19]) +
        parseIndianNumber(cols[25]) +
        parseIndianNumber(cols[31]),
      // Interest components
      interestIgst: parseIndianNumber(cols[9]),
      interestCgst: parseIndianNumber(cols[15]),
      interestSgst: parseIndianNumber(cols[21]),
      // Balance
      balanceIgst: parseIndianNumber(cols[37]),
      balanceCgst: parseIndianNumber(cols[43]),
      balanceSgst: parseIndianNumber(cols[49]),
      balanceCess: parseIndianNumber(cols[55]),
      balanceTotal:
        parseIndianNumber(cols[37]) +
        parseIndianNumber(cols[43]) +
        parseIndianNumber(cols[49]) +
        parseIndianNumber(cols[55]),
    };

    entries.push(entry);
  }

  return { gstin, name, fromDate, toDate, entries, closingBalance };
}

/** Parse a CSV line handling quoted fields with commas inside */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
