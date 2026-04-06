import { BankFormat } from "../types";

export const iciciFormat: BankFormat = {
  id: "icici",
  name: "ICICI Bank",
  detectFormat: (headers: string[]) => {
    const h = headers.map((s) => s.toLowerCase().trim());
    return (
      (h.some((c) => c === "particulars" || c.includes("transaction remarks") || c.includes("remarks")) &&
        (h.some((c) => c === "withdrawals" || c.includes("withdrawal")) ||
         h.some((c) => c === "deposits" || c.includes("deposit")))) ||
      (h.some((c) => c.includes("transaction date")) && h.some((c) => c.includes("cr/dr")))
    );
  },
  dateColumns: ["date", "transaction date", "value date", "txn date"],
  descriptionColumns: ["particulars", "transaction remarks", "remarks", "description", "narration"],
  debitColumns: ["withdrawals", "withdrawal amount", "withdrawal amt", "withdrawal", "debit amount", "debit"],
  creditColumns: ["deposits", "deposit amount", "deposit amt", "deposit", "credit amount", "credit"],
  balanceColumns: ["balance", "closing balance", "running balance"],
  referenceColumns: ["mode", "cheque number", "chq no", "ref no", "reference"],
  dateFormats: ["dd-MM-yyyy", "dd/MM/yyyy", "dd-MMM-yyyy", "dd/MM/yy"],
};
