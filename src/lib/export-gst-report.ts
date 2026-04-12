/**
 * GST Compliance Report — Multi-sheet Excel export
 * Sheets: Summary, Monthly Breakdown, GSTR-1 Detail, Purchase Bills (ITC),
 *         Cash Ledger, Reconciliation
 */

interface GSTMonthData {
  month: string;
  invoiceCount: number;
  taxableAmount: number;
  igst: number;
  cgst: number;
  sgst: number;
  totalGst: number;
  inputGST: number;
  netLiability: number;
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  buyerName: string;
  buyerGstin: string;
  subtotal: number;
  igst: number;
  cgst: number;
  sgst: number;
  gstTotal: number;
  tdsAmount: number;
  netTotal: number;
}

interface PurchaseBillData {
  billDate: string;
  vendorName: string;
  vendorGstin: string;
  billNumber: string;
  description: string;
  hsnSac: string;
  subtotal: number;
  igst: number;
  cgst: number;
  sgst: number;
  totalGst: number;
  totalAmount: number;
  itcClaimed: boolean;
}

interface CashLedgerData {
  srNo: number;
  date: string;
  referenceNo: string;
  taxPeriod: string;
  description: string;
  txnType: string;
  igst: number;
  cgst: number;
  sgst: number;
  total: number;
  interestIgst: number;
  interestCgst: number;
  interestSgst: number;
  balanceTotal: number;
}

interface ReconciliationData {
  month: string;
  gstLiability: number;
  cashPaid: number;
  interest: number;
  filedOnPortal: boolean;
}

interface GSTReportInput {
  fy: string;
  gstin: string;
  name: string;
  monthlyData: GSTMonthData[];
  invoices: InvoiceData[];
  purchaseBills: PurchaseBillData[];
  cashLedger: CashLedgerData[];
  reconciliation: ReconciliationData[];
  summary: {
    totalRevenue: number;
    totalTaxable: number;
    totalOutputGst: number;
    totalIgst: number;
    totalCgst: number;
    totalSgst: number;
    totalInputItc: number;
    totalNetLiability: number;
    totalDeposited: number;
    totalDebited: number;
    totalInterest: number;
    cashBalance: number;
    invoiceCount: number;
    purchaseBillCount: number;
    filedPeriods: number;
  };
}

export async function exportGSTReport(data: GSTReportInput): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "ArthaSutra";
  wb.created = new Date();

  // Color palette
  const INDIGO = "4F46E5";
  const INDIGO_LIGHT = "EEF2FF";
  const ROSE = "F43F5E";
  const EMERALD = "10B981";
  const EMERALD_LIGHT = "ECFDF5";
  const AMBER = "F59E0B";
  const BLUE = "3B82F6";
  const PURPLE = "8B5CF6";
  const SLATE = "1E293B";
  const GRAY_BG = "F8FAFC";
  const WHITE = "FFFFFF";

  const headerFont = { name: "Helvetica", bold: true, size: 11, color: { argb: WHITE } };
  const bodyFont = { name: "Helvetica", size: 10 };
  const monoFont = { name: "Helvetica", size: 10 };
  const titleFont = { name: "Helvetica", bold: true, size: 20, color: { argb: SLATE } };
  const subtitleFont = { name: "Helvetica", size: 11, color: { argb: "64748B" } };
  const kpiValueFont = { name: "Helvetica", bold: true, size: 16 };
  const kpiLabelFont = { name: "Helvetica", size: 9, color: { argb: "94A3B8" } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const thinBorder: any = { style: "thin", color: { argb: "E2E8F0" } };
  const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
  const numFmt = "#,##,##0";
  const numFmt2 = "#,##,##0.00";

  // Helper: style a header row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function styleHeaderRow(row: any, color: string) {
    row.height = 30;
    row.eachCell((cell: any) => {
      cell.font = headerFont;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = allBorders;
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function styleDataRow(row: any, isAlt: boolean) {
    row.eachCell((cell: any) => {
      cell.font = bodyFont;
      cell.border = allBorders;
      cell.alignment = { vertical: "middle" };
      if (isAlt) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRAY_BG } };
      }
    });
  }

  const s = data.summary;

  // ═════════════════════════════════════════════════════════════════════
  // SHEET 1: GST Summary
  // ═════════════════════════════════════════════════════════════════════
  const dash = wb.addWorksheet("GST Summary", { properties: { tabColor: { argb: INDIGO } } });
  dash.properties.defaultColWidth = 18;

  // Title
  dash.mergeCells("A1:F1");
  dash.getCell("A1").value = `GST Compliance Report — FY ${data.fy}`;
  dash.getCell("A1").font = titleFont;
  dash.getRow(1).height = 40;

  dash.mergeCells("A2:F2");
  dash.getCell("A2").value = `${data.name} | GSTIN: ${data.gstin} | Generated: ${new Date().toLocaleDateString("en-IN")}`;
  dash.getCell("A2").font = subtitleFont;
  dash.getRow(2).height = 24;

  // KPI Grid
  const kpis = [
    { label: "Total Revenue (incl. GST)", value: s.totalRevenue, color: SLATE },
    { label: "Taxable Value", value: s.totalTaxable, color: SLATE },
    { label: "Output GST", value: s.totalOutputGst, color: ROSE },
    { label: "Input ITC", value: s.totalInputItc, color: EMERALD },
    { label: "Net GST Liability", value: s.totalNetLiability, color: AMBER },
    { label: "Invoices Raised", value: s.invoiceCount, color: BLUE },
    { label: "Cash Deposited", value: s.totalDeposited, color: INDIGO },
    { label: "Cash Utilized", value: s.totalDebited, color: ROSE },
    { label: "Interest/Penalties", value: s.totalInterest, color: AMBER },
    { label: "Cash Balance", value: s.cashBalance, color: EMERALD },
    { label: "Purchase Bills", value: s.purchaseBillCount, color: PURPLE },
    { label: "Periods Filed", value: s.filedPeriods, color: EMERALD },
  ];

  let kpiRow = 4;
  for (let i = 0; i < kpis.length; i += 3) {
    for (let j = 0; j < 3 && i + j < kpis.length; j++) {
      const col = j * 2 + 1;
      const kpi = kpis[i + j];
      const labelCell = dash.getCell(kpiRow, col);
      labelCell.value = kpi.label;
      labelCell.font = kpiLabelFont;
      const valCell = dash.getCell(kpiRow + 1, col);
      valCell.value = kpi.value;
      valCell.font = { ...kpiValueFont, color: { argb: kpi.color } };
      valCell.numFmt = numFmt;
    }
    kpiRow += 3;
  }

  // GST Breakup table
  kpiRow += 1;
  dash.getCell(kpiRow, 1).value = "Output GST Breakup";
  dash.getCell(kpiRow, 1).font = { name: "Helvetica", bold: true, size: 12, color: { argb: SLATE } };
  kpiRow++;
  const breakupHeaders = ["Component", "Amount"];
  breakupHeaders.forEach((h, i) => { dash.getCell(kpiRow, i + 1).value = h; });
  styleHeaderRow(dash.getRow(kpiRow), INDIGO);
  kpiRow++;
  const breakupData = [
    ["IGST", s.totalIgst],
    ["CGST", s.totalCgst],
    ["SGST", s.totalSgst],
    ["Total Output GST", s.totalOutputGst],
    ["Less: Input ITC", s.totalInputItc],
    ["Net GST Liability", s.totalNetLiability],
  ];
  breakupData.forEach(([label, val], i) => {
    dash.getCell(kpiRow + i, 1).value = label;
    dash.getCell(kpiRow + i, 2).value = val;
    dash.getCell(kpiRow + i, 2).numFmt = numFmt;
    styleDataRow(dash.getRow(kpiRow + i), i % 2 === 1);
    if (i >= 4) {
      dash.getCell(kpiRow + i, 1).font = { ...bodyFont, bold: true };
      dash.getCell(kpiRow + i, 2).font = { ...bodyFont, bold: true };
    }
  });

  // ═════════════════════════════════════════════════════════════════════
  // SHEET 2: Monthly Breakdown
  // ═════════════════════════════════════════════════════════════════════
  const monthly = wb.addWorksheet("Monthly Breakdown", { properties: { tabColor: { argb: BLUE } } });
  const mHeaders = ["Month", "Invoices", "Taxable Value", "IGST", "CGST", "SGST", "Total GST", "Input ITC", "Net Liability"];
  mHeaders.forEach((h, i) => { monthly.getCell(1, i + 1).value = h; });
  styleHeaderRow(monthly.getRow(1), BLUE);
  monthly.getColumn(1).width = 14;
  for (let i = 2; i <= 9; i++) monthly.getColumn(i).width = 16;

  data.monthlyData.forEach((m, i) => {
    const r = i + 2;
    monthly.getCell(r, 1).value = m.month;
    monthly.getCell(r, 2).value = m.invoiceCount || "";
    monthly.getCell(r, 3).value = m.taxableAmount; monthly.getCell(r, 3).numFmt = numFmt;
    monthly.getCell(r, 4).value = m.igst; monthly.getCell(r, 4).numFmt = numFmt;
    monthly.getCell(r, 5).value = m.cgst; monthly.getCell(r, 5).numFmt = numFmt;
    monthly.getCell(r, 6).value = m.sgst; monthly.getCell(r, 6).numFmt = numFmt;
    monthly.getCell(r, 7).value = m.totalGst; monthly.getCell(r, 7).numFmt = numFmt;
    monthly.getCell(r, 8).value = m.inputGST; monthly.getCell(r, 8).numFmt = numFmt;
    monthly.getCell(r, 9).value = m.netLiability; monthly.getCell(r, 9).numFmt = numFmt;
    styleDataRow(monthly.getRow(r), i % 2 === 1);
  });

  // Totals row
  const mTotalRow = data.monthlyData.length + 2;
  monthly.getCell(mTotalRow, 1).value = "TOTAL";
  monthly.getCell(mTotalRow, 1).font = { ...bodyFont, bold: true };
  [3, 4, 5, 6, 7, 8, 9].forEach((col) => {
    const sum = data.monthlyData.reduce((s, m) => {
      const vals = [0, 0, m.taxableAmount, m.igst, m.cgst, m.sgst, m.totalGst, m.inputGST, m.netLiability];
      return s + (vals[col - 1] || 0);
    }, 0);
    monthly.getCell(mTotalRow, col).value = sum;
    monthly.getCell(mTotalRow, col).numFmt = numFmt;
    monthly.getCell(mTotalRow, col).font = { ...bodyFont, bold: true };
  });
  styleDataRow(monthly.getRow(mTotalRow), false);

  // ═════════════════════════════════════════════════════════════════════
  // SHEET 3: GSTR-1 Detail
  // ═════════════════════════════════════════════════════════════════════
  const gstr1 = wb.addWorksheet("GSTR-1 Detail", { properties: { tabColor: { argb: INDIGO } } });
  const gHeaders = ["Invoice #", "Date", "Buyer", "GSTIN", "Taxable", "IGST", "CGST", "SGST", "Total GST", "TDS", "Net Total"];
  gHeaders.forEach((h, i) => { gstr1.getCell(1, i + 1).value = h; });
  styleHeaderRow(gstr1.getRow(1), INDIGO);
  gstr1.getColumn(1).width = 14;
  gstr1.getColumn(2).width = 12;
  gstr1.getColumn(3).width = 30;
  gstr1.getColumn(4).width = 18;
  for (let i = 5; i <= 11; i++) gstr1.getColumn(i).width = 14;

  data.invoices.forEach((inv, i) => {
    const r = i + 2;
    gstr1.getCell(r, 1).value = inv.invoiceNumber;
    gstr1.getCell(r, 2).value = inv.invoiceDate;
    gstr1.getCell(r, 3).value = inv.buyerName;
    gstr1.getCell(r, 4).value = inv.buyerGstin;
    gstr1.getCell(r, 4).font = monoFont;
    gstr1.getCell(r, 5).value = inv.subtotal; gstr1.getCell(r, 5).numFmt = numFmt2;
    gstr1.getCell(r, 6).value = inv.igst || ""; if (inv.igst) gstr1.getCell(r, 6).numFmt = numFmt2;
    gstr1.getCell(r, 7).value = inv.cgst || ""; if (inv.cgst) gstr1.getCell(r, 7).numFmt = numFmt2;
    gstr1.getCell(r, 8).value = inv.sgst || ""; if (inv.sgst) gstr1.getCell(r, 8).numFmt = numFmt2;
    gstr1.getCell(r, 9).value = inv.gstTotal; gstr1.getCell(r, 9).numFmt = numFmt2;
    gstr1.getCell(r, 10).value = inv.tdsAmount || ""; if (inv.tdsAmount) gstr1.getCell(r, 10).numFmt = numFmt2;
    gstr1.getCell(r, 11).value = inv.netTotal; gstr1.getCell(r, 11).numFmt = numFmt2;
    styleDataRow(gstr1.getRow(r), i % 2 === 1);
  });

  // ═════════════════════════════════════════════════════════════════════
  // SHEET 4: Purchase Bills (ITC)
  // ═════════════════════════════════════════════════════════════════════
  const itc = wb.addWorksheet("Purchase Bills (ITC)", { properties: { tabColor: { argb: EMERALD } } });
  const pHeaders = ["Date", "Vendor", "GSTIN", "Bill #", "Description", "HSN/SAC", "Subtotal", "IGST", "CGST", "SGST", "Total GST", "Total Amt", "ITC Claimed"];
  pHeaders.forEach((h, i) => { itc.getCell(1, i + 1).value = h; });
  styleHeaderRow(itc.getRow(1), EMERALD);
  itc.getColumn(1).width = 12;
  itc.getColumn(2).width = 25;
  itc.getColumn(3).width = 18;
  itc.getColumn(4).width = 16;
  itc.getColumn(5).width = 30;
  itc.getColumn(6).width = 12;
  for (let i = 7; i <= 13; i++) itc.getColumn(i).width = 14;

  data.purchaseBills.forEach((b, i) => {
    const r = i + 2;
    itc.getCell(r, 1).value = b.billDate;
    itc.getCell(r, 2).value = b.vendorName;
    itc.getCell(r, 3).value = b.vendorGstin; itc.getCell(r, 3).font = monoFont;
    itc.getCell(r, 4).value = b.billNumber;
    itc.getCell(r, 5).value = b.description;
    itc.getCell(r, 6).value = b.hsnSac;
    itc.getCell(r, 7).value = b.subtotal; itc.getCell(r, 7).numFmt = numFmt2;
    itc.getCell(r, 8).value = b.igst || ""; if (b.igst) itc.getCell(r, 8).numFmt = numFmt2;
    itc.getCell(r, 9).value = b.cgst || ""; if (b.cgst) itc.getCell(r, 9).numFmt = numFmt2;
    itc.getCell(r, 10).value = b.sgst || ""; if (b.sgst) itc.getCell(r, 10).numFmt = numFmt2;
    itc.getCell(r, 11).value = b.totalGst; itc.getCell(r, 11).numFmt = numFmt2;
    itc.getCell(r, 12).value = b.totalAmount; itc.getCell(r, 12).numFmt = numFmt2;
    itc.getCell(r, 13).value = b.itcClaimed ? "Yes" : "No";
    itc.getCell(r, 13).font = { ...bodyFont, color: { argb: b.itcClaimed ? EMERALD : AMBER } };
    styleDataRow(itc.getRow(r), i % 2 === 1);
  });

  if (data.purchaseBills.length === 0) {
    itc.getCell(2, 1).value = "No purchase bills uploaded";
    itc.getCell(2, 1).font = { ...bodyFont, italic: true, color: { argb: "94A3B8" } };
  }

  // ═════════════════════════════════════════════════════════════════════
  // SHEET 5: Cash Ledger
  // ═════════════════════════════════════════════════════════════════════
  const cl = wb.addWorksheet("Cash Ledger", { properties: { tabColor: { argb: PURPLE } } });
  const clHeaders = ["#", "Date", "Ref No", "Tax Period", "Description", "Type", "IGST", "CGST", "SGST", "Total", "Interest", "Balance"];
  clHeaders.forEach((h, i) => { cl.getCell(1, i + 1).value = h; });
  styleHeaderRow(cl.getRow(1), PURPLE);
  cl.getColumn(1).width = 5;
  cl.getColumn(2).width = 12;
  cl.getColumn(3).width = 18;
  cl.getColumn(4).width = 10;
  cl.getColumn(5).width = 25;
  cl.getColumn(6).width = 8;
  for (let i = 7; i <= 12; i++) cl.getColumn(i).width = 14;

  data.cashLedger.forEach((e, i) => {
    const r = i + 2;
    cl.getCell(r, 1).value = e.srNo;
    cl.getCell(r, 2).value = e.date;
    cl.getCell(r, 3).value = e.referenceNo; cl.getCell(r, 3).font = monoFont;
    cl.getCell(r, 4).value = e.taxPeriod;
    cl.getCell(r, 5).value = e.description;
    cl.getCell(r, 6).value = e.txnType;
    cl.getCell(r, 6).font = { ...bodyFont, color: { argb: e.txnType === "Credit" ? EMERALD : ROSE } };
    cl.getCell(r, 7).value = e.igst || ""; if (e.igst) cl.getCell(r, 7).numFmt = numFmt;
    cl.getCell(r, 8).value = e.cgst || ""; if (e.cgst) cl.getCell(r, 8).numFmt = numFmt;
    cl.getCell(r, 9).value = e.sgst || ""; if (e.sgst) cl.getCell(r, 9).numFmt = numFmt;
    cl.getCell(r, 10).value = e.total; cl.getCell(r, 10).numFmt = numFmt;
    const interest = e.interestIgst + e.interestCgst + e.interestSgst;
    cl.getCell(r, 11).value = interest || ""; if (interest) cl.getCell(r, 11).numFmt = numFmt;
    cl.getCell(r, 12).value = e.balanceTotal; cl.getCell(r, 12).numFmt = numFmt;
    styleDataRow(cl.getRow(r), i % 2 === 1);
  });

  if (data.cashLedger.length === 0) {
    cl.getCell(2, 1).value = "No cash ledger data imported";
    cl.getCell(2, 1).font = { ...bodyFont, italic: true, color: { argb: "94A3B8" } };
  }

  // ═════════════════════════════════════════════════════════════════════
  // SHEET 6: Reconciliation
  // ═════════════════════════════════════════════════════════════════════
  const recon = wb.addWorksheet("Reconciliation", { properties: { tabColor: { argb: AMBER } } });
  const rHeaders = ["Month", "GST Liability (ArthaSutra)", "Cash Paid (Portal)", "Interest", "Filed on Portal"];
  rHeaders.forEach((h, i) => { recon.getCell(1, i + 1).value = h; });
  styleHeaderRow(recon.getRow(1), AMBER);
  recon.getColumn(1).width = 14;
  for (let i = 2; i <= 5; i++) recon.getColumn(i).width = 22;

  data.reconciliation.forEach((r, i) => {
    const row = i + 2;
    recon.getCell(row, 1).value = r.month;
    recon.getCell(row, 2).value = r.gstLiability; recon.getCell(row, 2).numFmt = numFmt;
    recon.getCell(row, 3).value = r.cashPaid || ""; if (r.cashPaid) recon.getCell(row, 3).numFmt = numFmt;
    recon.getCell(row, 4).value = r.interest || ""; if (r.interest) recon.getCell(row, 4).numFmt = numFmt;
    recon.getCell(row, 5).value = r.filedOnPortal ? "Filed" : "Not Filed";
    recon.getCell(row, 5).font = { ...bodyFont, bold: true, color: { argb: r.filedOnPortal ? EMERALD : AMBER } };
    styleDataRow(recon.getRow(row), i % 2 === 1);
  });

  if (data.reconciliation.length === 0) {
    recon.getCell(2, 1).value = "Import Cash Ledger to see reconciliation";
    recon.getCell(2, 1).font = { ...bodyFont, italic: true, color: { argb: "94A3B8" } };
  }

  // ═════════════════════════════════════════════════════════════════════
  // Download
  // ═════════════════════════════════════════════════════════════════════
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ArthaSutra_GST_Report_FY_${data.fy}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
