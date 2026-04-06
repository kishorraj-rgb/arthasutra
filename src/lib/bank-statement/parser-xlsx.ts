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
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
          raw: false,
          defval: "",
        });

        if (!jsonData || jsonData.length === 0) {
          resolve({ transactions: [], bankName: "", error: "No data found in Excel file" });
          return;
        }

        const headers = Object.keys(jsonData[0]);
        const format = bankId ? getBankFormatById(bankId) : autoDetectBank(headers);

        if (!format) {
          resolve({
            transactions: [],
            bankName: "",
            error: "Could not detect bank format. Please select your bank manually.",
          });
          return;
        }

        const transactions = parseRows(jsonData, headers, format);
        resolve({ transactions, bankName: format.name });
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
