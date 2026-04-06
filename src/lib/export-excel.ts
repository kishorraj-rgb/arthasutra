import * as XLSX from "xlsx";
import { parseDescription } from "@/lib/bank-statement/description-parser";

// ---------------------------------------------------------------------------
// Types for the entry objects coming from Convex
// ---------------------------------------------------------------------------

interface IncomeEntry {
  date: string;
  amount: number;
  type: string;
  description: string;
  tds_deducted: number;
  gst_collected: number;
  invoice_number?: string;
}

interface ExpenseEntry {
  date: string;
  amount: number;
  category: string;
  description: string;
  gst_paid: number;
  is_business_expense: boolean;
  receipt_url?: string;
}

interface IncomeRow {
  Date: string;
  "Voucher Type": string;
  Particulars: string;
  "Income Type": string;
  Debit: number | string;
  Credit: number | string;
  "Bank Name": string;
  "Payment Method": string;
  "Reference Number": string;
  "TDS Deducted": number | string;
  "GST Collected": number | string;
  Narration: string;
}

interface ExpenseRow {
  Date: string;
  "Voucher Type": string;
  Particulars: string;
  "Expense Category": string;
  Debit: number | string;
  Credit: number | string;
  "Bank Name": string;
  "Payment Method": string;
  "Reference Number": string;
  "GST Paid": number | string;
  "Business Expense": string;
  Narration: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format an ISO date string as dd/MM/yyyy */
function formatDateForTally(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Format a number to 2 decimal places */
function fmt(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Title-case an income type value */
function incomeTypeLabel(type: string): string {
  const map: Record<string, string> = {
    salary: "Salary",
    freelance: "Freelance/Consulting",
    rental: "Rental Income",
    interest: "Interest",
    dividend: "Dividend",
    transfer: "Transfer",
    other: "Other",
  };
  return map[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

/** Title-case an expense category value */
function expenseCategoryLabel(cat: string): string {
  const map: Record<string, string> = {
    housing: "Housing/Rent",
    food: "Food & Dining",
    transport: "Transport",
    medical: "Medical",
    education: "Education",
    insurance: "Insurance",
    investment: "Investment",
    driver_salary: "Driver Salary",
    school_fees: "School Fees",
    utilities: "Utilities",
    entertainment: "Entertainment",
    other: "Other",
  };
  return map[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
}

/** Auto-size columns based on header + data widths */
function autoSizeColumns(ws: XLSX.WorkSheet, data: IncomeRow[] | ExpenseRow[]): void {
  if (data.length === 0) return;
  const first = data[0] as Record<string, unknown>;
  const keys = Object.keys(first);
  const colWidths: XLSX.ColInfo[] = keys.map((key) => {
    let maxLen = key.length;
    for (const row of data) {
      const val = (row as Record<string, unknown>)[key];
      const len = val != null ? String(val).length : 0;
      if (len > maxLen) maxLen = len;
    }
    return { wch: Math.min(maxLen + 2, 40) };
  });
  ws["!cols"] = colWidths;
}

/** Trigger a browser download for a workbook */
function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Export Income to Excel
// ---------------------------------------------------------------------------

export function exportIncomeToExcel(entries: IncomeEntry[], fyLabel: string): void {
  const rows: IncomeRow[] = entries.map((e) => {
    const parsed = parseDescription(e.description);
    return {
      Date: formatDateForTally(e.date),
      "Voucher Type": "Receipt",
      Particulars: parsed.payee,
      "Income Type": incomeTypeLabel(e.type),
      Debit: fmt(e.amount),
      Credit: fmt(e.amount),
      "Bank Name": parsed.bank || "",
      "Payment Method": parsed.method,
      "Reference Number": parsed.reference || "",
      "TDS Deducted": fmt(e.tds_deducted),
      "GST Collected": fmt(e.gst_collected),
      Narration: parsed.rawDescription,
    };
  });

  // Summary row
  const totalAmount = entries.reduce((s, e) => s + e.amount, 0);
  const totalTds = entries.reduce((s, e) => s + e.tds_deducted, 0);
  const totalGst = entries.reduce((s, e) => s + e.gst_collected, 0);

  rows.push({
    Date: "",
    "Voucher Type": "",
    Particulars: "TOTAL",
    "Income Type": "",
    Debit: fmt(totalAmount),
    Credit: fmt(totalAmount),
    "Bank Name": "",
    "Payment Method": "",
    "Reference Number": "",
    "TDS Deducted": fmt(totalTds),
    "GST Collected": fmt(totalGst),
    Narration: "",
  });

  const sheetName = `Income FY ${fyLabel}`;
  const ws = XLSX.utils.json_to_sheet(rows);
  autoSizeColumns(ws, rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31)); // Excel 31-char limit

  downloadWorkbook(wb, `Income_FY_${fyLabel.replace(/\//g, "-")}.xlsx`);
}

// ---------------------------------------------------------------------------
// Export Expenses to Excel
// ---------------------------------------------------------------------------

export function exportExpensesToExcel(entries: ExpenseEntry[], fyLabel: string): void {
  const rows: ExpenseRow[] = entries.map((e) => {
    const parsed = parseDescription(e.description);
    return {
      Date: formatDateForTally(e.date),
      "Voucher Type": "Payment",
      Particulars: parsed.payee,
      "Expense Category": expenseCategoryLabel(e.category),
      Debit: fmt(e.amount),
      Credit: fmt(e.amount),
      "Bank Name": parsed.bank || "",
      "Payment Method": parsed.method,
      "Reference Number": parsed.reference || "",
      "GST Paid": fmt(e.gst_paid),
      "Business Expense": e.is_business_expense ? "Yes" : "No",
      Narration: parsed.rawDescription,
    };
  });

  // Summary row
  const totalAmount = entries.reduce((s, e) => s + e.amount, 0);
  const totalGst = entries.reduce((s, e) => s + e.gst_paid, 0);

  rows.push({
    Date: "",
    "Voucher Type": "",
    Particulars: "TOTAL",
    "Expense Category": "",
    Debit: fmt(totalAmount),
    Credit: fmt(totalAmount),
    "Bank Name": "",
    "Payment Method": "",
    "Reference Number": "",
    "GST Paid": fmt(totalGst),
    "Business Expense": "",
    Narration: "",
  });

  const sheetName = `Expenses FY ${fyLabel}`;
  const ws = XLSX.utils.json_to_sheet(rows);
  autoSizeColumns(ws, rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

  downloadWorkbook(wb, `Expenses_FY_${fyLabel.replace(/\//g, "-")}.xlsx`);
}
