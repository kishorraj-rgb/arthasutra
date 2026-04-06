import { BankFormat } from "../types";

export const sbiFormat: BankFormat = {
  id: "sbi",
  name: "SBI",
  detectFormat: (headers: string[]) => {
    const h = headers.map((s) => s.toLowerCase().trim());
    return (
      (h.some((c) => c.includes("txn date") || c.includes("transaction date")) &&
        h.some((c) => c.includes("debit") || c.includes("withdrawal"))) ||
      h.some((c) => c.includes("ref no./cheque no."))
    );
  },
  dateColumns: ["txn date", "transaction date", "date", "value date"],
  descriptionColumns: ["description", "narration", "particulars", "remarks"],
  debitColumns: ["debit", "debit amount", "withdrawal", "withdrawal amount"],
  creditColumns: ["credit", "credit amount", "deposit", "deposit amount"],
  balanceColumns: ["balance", "closing balance"],
  referenceColumns: ["ref no./cheque no.", "ref no", "chq no", "reference"],
  dateFormats: ["dd MMM yyyy", "d MMM yyyy", "dd/MM/yyyy", "dd-MM-yyyy", "dd-MMM-yyyy"],
};
