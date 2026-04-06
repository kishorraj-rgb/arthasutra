import { BankFormat } from "../types";

export const axisFormat: BankFormat = {
  id: "axis",
  name: "Axis Bank",
  detectFormat: (headers: string[]) => {
    const h = headers.map((s) => s.toLowerCase().trim());
    return (
      h.some((c) => c.includes("tran date") || c.includes("transaction date")) &&
      (h.some((c) => c.includes("debit")) || h.some((c) => c.includes("amt")))
    );
  },
  dateColumns: ["tran date", "transaction date", "date", "value date", "trans date"],
  descriptionColumns: ["particulars", "description", "narration", "remarks", "transaction particulars"],
  debitColumns: ["debit", "debit amount", "dr amount", "withdrawal"],
  creditColumns: ["credit", "credit amount", "cr amount", "deposit"],
  balanceColumns: ["balance", "closing balance", "running bal"],
  referenceColumns: ["chq no", "ref no", "reference", "init.br"],
  dateFormats: ["dd-MM-yyyy", "dd/MM/yyyy", "dd-MMM-yyyy", "dd/MM/yy"],
};
