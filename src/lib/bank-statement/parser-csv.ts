import Papa from "papaparse";
import { ParsedTransaction, BankFormat } from "./types";
import { autoDetectBank, getBankFormatById } from "./bank-formats";
import { parseDate, findColumn, parseAmount, generateId } from "./parse-utils";

export function parseCSV(
  file: File,
  bankId?: string
): Promise<{ transactions: ParsedTransaction[]; bankName: string; error?: string }> {
  return new Promise((resolve) => {
    // First pass: parse without headers to find the actual data table
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          resolve({ transactions: [], bankName: "", error: "No data found in CSV file" });
          return;
        }

        const allRows = results.data as string[][];

        // Find the header row by looking for a row that matches bank format headers
        let headerRowIdx = -1;
        let detectedFormat: BankFormat | null = null;

        for (let i = 0; i < Math.min(allRows.length, 50); i++) {
          const row = allRows[i].map((c) => c?.trim()).filter(Boolean);
          if (row.length < 3) continue;

          const format = bankId ? getBankFormatById(bankId) : autoDetectBank(row);
          if (format) {
            // Verify this row has actual header-like content (not data)
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

        // Fallback: try row 0 as header
        if (headerRowIdx === -1) {
          const row0 = allRows[0].map((c) => c?.trim()).filter(Boolean);
          detectedFormat = bankId ? getBankFormatById(bankId) : autoDetectBank(row0);
          if (detectedFormat) headerRowIdx = 0;
        }

        if (headerRowIdx === -1 || !detectedFormat) {
          resolve({
            transactions: [],
            bankName: "",
            error: "Could not detect bank format. Please select your bank manually.",
          });
          return;
        }

        // Build header-keyed rows from data after header
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

        const transactions = parseRows(dataRows, headers, detectedFormat);
        resolve({ transactions, bankName: detectedFormat.name });
      },
      error: (err) => {
        resolve({ transactions: [], bankName: "", error: `CSV parse error: ${err.message}` });
      },
    });
  });
}

export function parseRows(
  rows: Record<string, string>[],
  headers: string[],
  format: BankFormat
): ParsedTransaction[] {
  const dateCol = findColumn(headers, format.dateColumns);
  const descCol = findColumn(headers, format.descriptionColumns);
  const debitCol = findColumn(headers, format.debitColumns);
  const creditCol = findColumn(headers, format.creditColumns);
  const balanceCol = findColumn(headers, format.balanceColumns);
  const refCol = findColumn(headers, format.referenceColumns);

  if (!dateCol || !descCol) {
    return [];
  }

  const transactions: ParsedTransaction[] = [];

  for (const row of rows) {
    const rawDate = row[dateCol]?.trim();
    const description = row[descCol]?.trim();
    if (!rawDate || !description) continue;
    // Skip B/F (brought forward) rows
    if (description === "B/F" || description === "b/f") continue;

    const date = parseDate(rawDate, format.dateFormats);
    if (!date) continue;

    const debitAmt = debitCol ? parseAmount(row[debitCol]) : 0;
    const creditAmt = creditCol ? parseAmount(row[creditCol]) : 0;

    let amount = 0;
    let type: "credit" | "debit" = "debit";

    if (creditAmt > 0) {
      amount = creditAmt;
      type = "credit";
    } else if (debitAmt > 0) {
      amount = debitAmt;
      type = "debit";
    } else {
      continue; // Skip rows with no amount
    }

    transactions.push({
      id: generateId(),
      date,
      description,
      amount,
      type,
      balance: balanceCol ? parseAmount(row[balanceCol]) : undefined,
      reference: refCol ? row[refCol]?.trim() : undefined,
      incomeType: "other",
      expenseCategory: "other",
      isDuplicate: false,
      selected: true,
    });
  }

  return transactions;
}
