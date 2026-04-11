import * as XLSX from "xlsx";
import { ParsedTransaction } from "./types";
import { autoDetectBank, getBankFormatById } from "./bank-formats";
import { parseRows } from "./parser-csv";

export interface XLSXParseResult {
  transactions: ParsedTransaction[];
  bankName: string;
  error?: string;
  needsPassword?: boolean;
}

/**
 * Parse an ArrayBuffer containing XLSX/XLS data.
 * Extracted so it can be reused after server-side decryption.
 */
export function parseXLSXBuffer(
  data: ArrayBuffer,
  bankId?: string
): XLSXParseResult {
  const workbook = XLSX.read(data, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { transactions: [], bankName: "", error: "No sheets found in Excel file" };
  }

  const sheet = workbook.Sheets[sheetName];

  // Convert sheet to array-of-arrays (no header assumption)
  const allRows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  if (!allRows || allRows.length === 0) {
    return { transactions: [], bankName: "", error: "No data found in Excel file" };
  }

  // Scan for the actual header row (bank XLS files have metadata rows at the top)
  let headerRowIdx = -1;
  let detectedFormat = bankId ? getBankFormatById(bankId) : null;

  for (let i = 0; i < Math.min(allRows.length, 50); i++) {
    const row = allRows[i]
      .map((c) => (c ?? "").toString().trim())
      .filter(Boolean);
    if (row.length < 3) continue;

    // Skip rows that are clearly separators (all asterisks, dashes, etc.)
    if (row.every((c) => /^[*\-=_]+$/.test(c))) continue;

    const format = bankId ? getBankFormatById(bankId) : autoDetectBank(row);
    if (format) {
      // Verify this row has actual header-like content
      const hasDateHeader = row.some((c) =>
        format.dateColumns.some(
          (dc) => c.toLowerCase().includes(dc.toLowerCase())
        )
      );
      if (hasDateHeader) {
        headerRowIdx = i;
        detectedFormat = format;
        break;
      }
    }
  }

  if (headerRowIdx === -1 || !detectedFormat) {
    return {
      transactions: [],
      bankName: "",
      error: "Could not detect bank format. Please select your bank manually.",
    };
  }

  // Build header-keyed rows from data after header
  const headers = allRows[headerRowIdx].map((c) =>
    (c ?? "").toString().trim()
  );
  const dataRows: Record<string, string>[] = [];

  for (let i = headerRowIdx + 1; i < allRows.length; i++) {
    const row = allRows[i];
    if (!row || row.length < 3) continue;
    // Skip separator rows (asterisks, dashes)
    const nonEmpty = row.filter((c) => (c ?? "").toString().trim());
    if (
      nonEmpty.length > 0 &&
      nonEmpty.every((c) => /^[*\-=_]+$/.test(c.toString().trim()))
    )
      continue;

    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = (row[idx] ?? "").toString();
    });
    dataRows.push(obj);
  }

  const transactions = parseRows(dataRows, headers, detectedFormat);
  return { transactions, bankName: detectedFormat.name };
}

/**
 * Main entry: reads a File, detects password-protection,
 * and parses the XLSX/XLS data.
 */
export function parseXLSX(
  file: File,
  bankId?: string
): Promise<XLSXParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result as ArrayBuffer;
        if (!data) {
          resolve({ transactions: [], bankName: "", error: "Failed to read file" });
          return;
        }

        resolve(parseXLSXBuffer(data, bankId));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";

        // Detect password-protected files
        if (message.includes("password-protected") || message.includes("Encrypted")) {
          resolve({
            transactions: [],
            bankName: "",
            error: "This file is password-protected. Please enter the password.",
            needsPassword: true,
          });
          return;
        }

        resolve({
          transactions: [],
          bankName: "",
          error: `Excel parse error: ${message}`,
        });
      }
    };
    reader.onerror = () => {
      resolve({ transactions: [], bankName: "", error: "Failed to read file" });
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Decrypt a password-protected XLSX via the server API,
 * then parse the decrypted result client-side.
 */
export async function parseXLSXWithPassword(
  file: File,
  password: string,
  bankId?: string
): Promise<XLSXParseResult> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("password", password);

    const resp = await fetch("/api/decrypt-xlsx", {
      method: "POST",
      body: formData,
    });

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({ error: "Decryption failed" }));
      return {
        transactions: [],
        bankName: "",
        error: data.error || "Decryption failed",
        needsPassword: resp.status === 401, // wrong password
      };
    }

    const decryptedBuffer = await resp.arrayBuffer();
    return parseXLSXBuffer(decryptedBuffer, bankId);
  } catch (err) {
    return {
      transactions: [],
      bankName: "",
      error: `Decryption error: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}
