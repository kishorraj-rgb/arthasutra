import * as XLSX from "xlsx";
import { ParsedTransaction } from "./types";
import { autoDetectBank, getBankFormatById } from "./bank-formats";
import { parseRows } from "./parser-csv";

export function parseXLSX(
  file: File,
  bankId?: string
): Promise<{ transactions: ParsedTransaction[]; bankName: string; error?: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          resolve({ transactions: [], bankName: "", error: "Failed to read file" });
          return;
        }

        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          resolve({ transactions: [], bankName: "", error: "No sheets found in Excel file" });
          return;
        }

        const sheet = workbook.Sheets[sheetName];

        // Convert sheet to array-of-arrays (no header assumption)
        const allRows = XLSX.utils.sheet_to_json<string[]>(sheet, {
          header: 1,
          raw: false,
          defval: "",
        });

        if (!allRows || allRows.length === 0) {
          resolve({ transactions: [], bankName: "", error: "No data found in Excel file" });
          return;
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
          resolve({
            transactions: [],
            bankName: "",
            error: "Could not detect bank format. Please select your bank manually.",
          });
          return;
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
        resolve({ transactions, bankName: detectedFormat.name });
      } catch (err) {
        resolve({
          transactions: [],
          bankName: "",
          error: `Excel parse error: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
      }
    };
    reader.onerror = () => {
      resolve({ transactions: [], bankName: "", error: "Failed to read file" });
    };
    reader.readAsArrayBuffer(file);
  });
}
