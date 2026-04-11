import { BankFormat } from "../types";

export const hdfcFormat: BankFormat = {
  id: "hdfc",
  name: "HDFC Bank",
  detectFormat: (headers: string[]) => {
    const h = headers.map((s) => s.toLowerCase().trim());
    return (
      h.some((c) => c === "narration") &&
      (h.some((c) => c === "withdrawal amt." || c === "withdrawal amt" || c.includes("withdrawal")) ||
        h.some((c) => c === "debit amount" || c === "debit"))
    );
  },
  // Actual HDFC XLS headers: Date, Narration, Chq./Ref.No., Value Dt, Withdrawal Amt., Deposit Amt., Closing Balance
  dateColumns: ["date", "transaction date", "txn date", "value dt", "value date"],
  descriptionColumns: ["narration", "description", "particulars", "transaction remarks"],
  debitColumns: ["withdrawal amt.", "withdrawal amt", "debit amount", "debit", "withdrawal amount", "withdrawal"],
  creditColumns: ["deposit amt.", "deposit amt", "credit amount", "credit", "deposit amount", "deposit"],
  balanceColumns: ["closing balance", "balance", "running balance"],
  referenceColumns: ["chq./ref.no.", "chq./ref.no", "chq/ref number", "ref no", "reference no", "chq no", "ref no./cheque no."],
  dateFormats: ["dd/MM/yy", "dd/MM/yyyy", "dd-MM-yyyy", "dd/MM/yy"],
};
