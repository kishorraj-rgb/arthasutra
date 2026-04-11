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
  Subcategory: string;
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

/** Auto-size columns based on the worksheet range */
function autoSizeColumns(ws: XLSX.WorkSheet): void {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const colWidths: XLSX.ColInfo[] = [];

  for (let c = range.s.c; c <= range.e.c; c++) {
    let maxLen = 8; // minimum width
    for (let r = range.s.r; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v != null) {
        const len = String(cell.v).length;
        if (len > maxLen) maxLen = len;
      }
    }
    colWidths.push({ wch: Math.min(maxLen + 2, 40) });
  }
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
  autoSizeColumns(ws);

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
      Subcategory: (e as ExpenseEntry & { subcategory?: string }).subcategory || "",
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
    Subcategory: "",
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
  autoSizeColumns(ws);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

  downloadWorkbook(wb, `Expenses_FY_${fyLabel.replace(/\//g, "-")}.xlsx`);
}

// ---------------------------------------------------------------------------
// Credit Card Transactions Export (Styled with ExcelJS)
// ---------------------------------------------------------------------------

interface CCEntry {
  date: string;
  amount: number;
  type: "debit" | "credit";
  description: string;
  merchant_name?: string;
  category: string;
  credit_card_id: string;
  match_status: string;
  statement_month: string;
}

export async function exportCCToExcel(
  entries: (CCEntry & { subcategory?: string })[],
  cardMap: Map<string, { card_name: string; card_last4: string; issuer: string }>,
  label: string
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "ArthaSutra";
  wb.created = new Date();

  // Colors
  const ROSE = "F43F5E";
  const ROSE_LIGHT = "FFF1F2";
  const EMERALD = "10B981";
  const EMERALD_LIGHT = "ECFDF5";
  const AMBER = "F59E0B";
  const AMBER_LIGHT = "FFFBEB";
  const SLATE = "1E293B";
  const GRAY_BG = "F8FAFC";
  const WHITE = "FFFFFF";

  const headerFont = { name: "Helvetica", bold: true, size: 11, color: { argb: WHITE } };
  const bodyFont = { name: "Helvetica", size: 10 };
  const titleFont = { name: "Helvetica", bold: true, size: 14, color: { argb: SLATE } };
  const subtitleFont = { name: "Helvetica", size: 10, color: { argb: "64748B" } };
  const kpiValueFont = { name: "Helvetica", bold: true, size: 18 };
  const kpiLabelFont = { name: "Helvetica", size: 9, color: { argb: "94A3B8" } };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const thinBorder: any = { style: "thin", color: { argb: "E2E8F0" } };
  const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

  // Compute stats
  const totalSpends = entries.filter((e) => e.type === "debit").reduce((s, e) => s + e.amount, 0);
  const totalPayments = entries.filter((e) => e.type === "credit").reduce((s, e) => s + e.amount, 0);
  const outstanding = totalSpends - totalPayments;
  const matched = entries.filter((e) => e.match_status === "matched" || e.match_status === "manual_match").length;
  const matchPct = entries.length > 0 ? Math.round((matched / entries.length) * 100) : 0;

  // Category breakdown
  const catBreakdown = new Map<string, { spends: number; count: number }>();
  for (const e of entries) {
    if (e.type !== "debit") continue;
    const label = expenseCategoryLabel(e.category);
    const cur = catBreakdown.get(label) || { spends: 0, count: 0 };
    cur.spends += e.amount;
    cur.count++;
    catBreakdown.set(label, cur);
  }
  const catSorted = Array.from(catBreakdown.entries()).sort((a, b) => b[1].spends - a[1].spends);

  // Card breakdown
  const cardBreakdown = new Map<string, { spends: number; payments: number; count: number }>();
  for (const e of entries) {
    const card = cardMap.get(e.credit_card_id);
    const name = card ? `${card.issuer} ..${card.card_last4}` : "Unknown";
    const cur = cardBreakdown.get(name) || { spends: 0, payments: 0, count: 0 };
    if (e.type === "debit") cur.spends += e.amount;
    else cur.payments += e.amount;
    cur.count++;
    cardBreakdown.set(name, cur);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SHEET 1: Dashboard
  // ═══════════════════════════════════════════════════════════════════════
  const dash = wb.addWorksheet("Dashboard", { properties: { tabColor: { argb: ROSE } } });
  dash.properties.defaultColWidth = 16;

  // Title
  dash.mergeCells("A1:F1");
  const titleCell = dash.getCell("A1");
  titleCell.value = "Credit Card Report";
  titleCell.font = { ...titleFont, size: 20 };
  titleCell.alignment = { vertical: "middle" };
  dash.getRow(1).height = 40;

  dash.mergeCells("A2:F2");
  const subCell = dash.getCell("A2");
  subCell.value = `FY ${label} | Generated ${new Date().toLocaleDateString("en-IN")} | ArthaSutra`;
  subCell.font = subtitleFont;
  dash.getRow(2).height = 22;

  // KPI Row
  const kpis = [
    { label: "TOTAL SPENDS", value: fmt(totalSpends), color: ROSE, bg: ROSE_LIGHT },
    { label: "TOTAL PAYMENTS", value: fmt(totalPayments), color: EMERALD, bg: EMERALD_LIGHT },
    { label: "OUTSTANDING", value: fmt(outstanding), color: AMBER, bg: AMBER_LIGHT },
    { label: "TRANSACTIONS", value: entries.length, color: SLATE, bg: GRAY_BG },
    { label: "MATCHED", value: `${matchPct}%`, color: EMERALD, bg: EMERALD_LIGHT },
  ];

  dash.getRow(4).height = 18;
  dash.getRow(5).height = 32;

  kpis.forEach((kpi, i) => {
    const col = i + 1;
    const labelCell = dash.getCell(4, col);
    labelCell.value = kpi.label;
    labelCell.font = kpiLabelFont;
    labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: kpi.bg } };
    labelCell.border = allBorders;
    labelCell.alignment = { horizontal: "center" };

    const valCell = dash.getCell(5, col);
    valCell.value = typeof kpi.value === "number" ? kpi.value : kpi.value;
    valCell.font = { ...kpiValueFont, color: { argb: kpi.color } };
    valCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: kpi.bg } };
    valCell.border = allBorders;
    valCell.alignment = { horizontal: "center" };
    if (typeof kpi.value === "number") {
      valCell.numFmt = "#,##0";
    }
  });

  // Category Breakdown
  dash.getCell("A7").value = "SPEND BY CATEGORY";
  dash.getCell("A7").font = { ...headerFont, color: { argb: SLATE }, size: 12 };
  dash.getRow(7).height = 28;

  const catHeaders = ["Category", "Transactions", "Amount", "% of Total"];
  catHeaders.forEach((h, i) => {
    const cell = dash.getCell(8, i + 1);
    cell.value = h;
    cell.font = { ...headerFont, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROSE } };
    cell.border = allBorders;
    cell.alignment = { horizontal: i >= 2 ? "right" : "left" };
  });
  dash.getRow(8).height = 24;

  catSorted.forEach(([cat, data], i) => {
    const row = 9 + i;
    const r = dash.getRow(row);
    r.height = 20;
    const bg = i % 2 === 0 ? WHITE : GRAY_BG;

    dash.getCell(row, 1).value = cat;
    dash.getCell(row, 1).font = bodyFont;
    dash.getCell(row, 2).value = data.count;
    dash.getCell(row, 2).alignment = { horizontal: "right" };
    dash.getCell(row, 3).value = fmt(data.spends);
    dash.getCell(row, 3).numFmt = "#,##0.00";
    dash.getCell(row, 3).alignment = { horizontal: "right" };
    dash.getCell(row, 4).value = totalSpends > 0 ? `${Math.round((data.spends / totalSpends) * 100)}%` : "0%";
    dash.getCell(row, 4).alignment = { horizontal: "right" };

    for (let c = 1; c <= 4; c++) {
      dash.getCell(row, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      dash.getCell(row, c).border = allBorders;
      if (!dash.getCell(row, c).font) dash.getCell(row, c).font = bodyFont;
    }
  });

  // Card Breakdown
  const cardStartRow = 9 + catSorted.length + 2;
  dash.getCell(cardStartRow, 1).value = "SPEND BY CARD";
  dash.getCell(cardStartRow, 1).font = { ...headerFont, color: { argb: SLATE }, size: 12 };
  dash.getRow(cardStartRow).height = 28;

  const cardHeaders = ["Card", "Transactions", "Spends", "Payments", "Outstanding"];
  cardHeaders.forEach((h, i) => {
    const cell = dash.getCell(cardStartRow + 1, i + 1);
    cell.value = h;
    cell.font = { ...headerFont, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE } };
    cell.border = allBorders;
    cell.alignment = { horizontal: i >= 2 ? "right" : "left" };
  });

  Array.from(cardBreakdown.entries()).forEach(([card, data], i) => {
    const row = cardStartRow + 2 + i;
    const bg = i % 2 === 0 ? WHITE : GRAY_BG;
    dash.getCell(row, 1).value = card;
    dash.getCell(row, 2).value = data.count;
    dash.getCell(row, 2).alignment = { horizontal: "right" };
    dash.getCell(row, 3).value = fmt(data.spends);
    dash.getCell(row, 3).numFmt = "#,##0.00";
    dash.getCell(row, 3).alignment = { horizontal: "right" };
    dash.getCell(row, 4).value = fmt(data.payments);
    dash.getCell(row, 4).numFmt = "#,##0.00";
    dash.getCell(row, 4).alignment = { horizontal: "right" };
    dash.getCell(row, 5).value = fmt(data.spends - data.payments);
    dash.getCell(row, 5).numFmt = "#,##0.00";
    dash.getCell(row, 5).alignment = { horizontal: "right" };
    dash.getCell(row, 5).font = { ...bodyFont, color: { argb: ROSE } };

    for (let c = 1; c <= 5; c++) {
      dash.getCell(row, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      dash.getCell(row, c).border = allBorders;
      if (!dash.getCell(row, c).font) dash.getCell(row, c).font = bodyFont;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SHEET 2: Transactions
  // ═══════════════════════════════════════════════════════════════════════
  const txnSheet = wb.addWorksheet("Transactions", { properties: { tabColor: { argb: SLATE } } });

  const txnHeaders = ["Date", "Merchant", "Description", "Category", "Subcategory", "Card", "Type", "Amount", "Match Status", "Statement Month"];
  const txnWidths = [12, 22, 35, 18, 20, 20, 14, 14, 14, 14];

  // Header row
  txnHeaders.forEach((h, i) => {
    const cell = txnSheet.getCell(1, i + 1);
    cell.value = h;
    cell.font = headerFont;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROSE } };
    cell.border = allBorders;
    cell.alignment = { horizontal: i === 7 ? "right" : "left", vertical: "middle" };
  });
  txnSheet.getRow(1).height = 28;
  txnWidths.forEach((w, i) => { txnSheet.getColumn(i + 1).width = w; });

  // Data rows
  entries.forEach((e, i) => {
    const row = i + 2;
    const card = cardMap.get(e.credit_card_id);
    const cardLabel = card ? `${card.issuer} ..${card.card_last4}` : "";
    const bg = i % 2 === 0 ? WHITE : GRAY_BG;
    const isCredit = e.type === "credit";

    const values = [
      formatDateForTally(e.date),
      e.merchant_name || "",
      e.description,
      expenseCategoryLabel(e.category),
      e.subcategory || "",
      cardLabel,
      isCredit ? "Payment" : "Spend",
      isCredit ? e.amount : -e.amount,
      e.match_status === "matched" || e.match_status === "manual_match" ? "Matched" : e.match_status === "ignored" ? "Ignored" : "Unmatched",
      e.statement_month,
    ];

    values.forEach((v, ci) => {
      const cell = txnSheet.getCell(row, ci + 1);
      cell.value = v;
      cell.font = ci === 7
        ? { ...bodyFont, color: { argb: isCredit ? EMERALD : ROSE } }
        : bodyFont;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.border = allBorders;
      if (ci === 7) {
        cell.numFmt = "#,##0.00";
        cell.alignment = { horizontal: "right" };
      }
    });
  });

  // Summary rows
  const sumRow = entries.length + 2;
  [
    { label: "Total Spends", value: -totalSpends, color: ROSE },
    { label: "Total Payments", value: totalPayments, color: EMERALD },
    { label: "Outstanding", value: -outstanding, color: AMBER },
  ].forEach((s, i) => {
    const row = sumRow + i;
    txnSheet.getCell(row, 2).value = s.label;
    txnSheet.getCell(row, 2).font = { ...bodyFont, bold: true };
    txnSheet.getCell(row, 8).value = s.value;
    txnSheet.getCell(row, 8).numFmt = "#,##0.00";
    txnSheet.getCell(row, 8).font = { ...bodyFont, bold: true, color: { argb: s.color } };
    txnSheet.getCell(row, 8).alignment = { horizontal: "right" };
    for (let c = 1; c <= 10; c++) {
      txnSheet.getCell(row, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROSE_LIGHT } };
      txnSheet.getCell(row, c).border = allBorders;
    }
  });

  // Auto-filter
  txnSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: entries.length + 1, column: 10 } };
  // Freeze header
  txnSheet.views = [{ state: "frozen", ySplit: 1 }];

  // Download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `CreditCard_${label.replace(/[\s\/]/g, "_")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
