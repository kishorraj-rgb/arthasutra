import { BankFormat } from "../types";

export const hdfcFormat: BankFormat = {
  id: "hdfc",
  name: "HDFC Bank",
  detectFormat: (headers: string[]) => {
    const h = headers.map((s) => s.toLowerCase().trim());
    return (
      h.some((c) => c.includes("narration")) &&
      (h.some((c) => c.includes("debit")) || h.some((c) => c.includes("withdrawal")))
    );
  },
  dateColumns: ["date", "transaction date", "txn date", "value date"],
  descriptionColumns: ["narration", "description", "particulars", "transaction remarks"],
  debitColumns: ["debit amount", "debit", "withdrawal amt", "withdrawal amount", "withdrawal"],
  creditColumns: ["credit amount", "credit", "deposit amt", "deposit amount", "deposit"],
  balanceColumns: ["closing balance", "balance", "running balance"],
  referenceColumns: ["chq/ref number", "ref no", "reference no", "chq no", "ref no./cheque no."],
  dateFormats: ["dd/MM/yyyy", "dd-MM-yyyy", "dd/MM/yy", "MM/dd/yyyy"],
};
