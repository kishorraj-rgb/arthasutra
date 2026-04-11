import { BankFormat } from "../types";

export const sbiFormat: BankFormat = {
  id: "sbi",
  name: "SBI",
  detectFormat: (headers: string[]) => {
    const h = headers.map((s) => s.toLowerCase().trim());
    return (
      // Actual SBI XLSX headers: Date, Details, Ref No/Cheque No, Debit, Credit, Balance
      (h.some((c) => c === "date" || c === "txn date" || c === "transaction date") &&
        h.some((c) => c === "details") &&
        h.some((c) => c === "debit" || c === "credit")) ||
      h.some((c) => c === "ref no/cheque no" || c === "ref no./cheque no.")
    );
  },
  // Actual SBI XLSX headers: Date, Details, Ref No/Cheque No, Debit, Credit, Balance
  dateColumns: ["date", "txn date", "transaction date", "value date"],
  descriptionColumns: ["details", "description", "narration", "particulars", "remarks"],
  debitColumns: ["debit", "debit amount", "withdrawal", "withdrawal amount"],
  creditColumns: ["credit", "credit amount", "deposit", "deposit amount"],
  balanceColumns: ["balance", "closing balance"],
  referenceColumns: ["ref no/cheque no", "ref no./cheque no.", "ref no", "chq no", "reference"],
  dateFormats: ["dd/MM/yyyy", "dd MMM yyyy", "d MMM yyyy", "dd-MM-yyyy", "dd-MMM-yyyy"],
};
