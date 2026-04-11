import { BankFormat } from "../types";

export const axisFormat: BankFormat = {
  id: "axis",
  name: "Axis Bank",
  detectFormat: (headers: string[]) => {
    const h = headers.map((s) => s.toLowerCase().trim());
    return (
      h.some((c) => c === "tran date" || c === "transaction date") &&
      h.some((c) => c === "particulars") &&
      (h.some((c) => c === "dr" || c === "debit") || h.some((c) => c === "cr" || c === "credit"))
    );
  },
  // Actual Axis XLS headers: SRL NO, Tran Date, CHQNO, PARTICULARS, DR, CR, BAL, SOL
  // Actual Axis CSV headers: Tran Date, CHQNO, PARTICULARS, DR, CR, BAL, SOL
  dateColumns: ["tran date", "transaction date", "date", "value date", "trans date"],
  descriptionColumns: ["particulars", "description", "narration", "remarks", "transaction particulars"],
  debitColumns: ["dr", "debit", "debit amount", "dr amount", "withdrawal"],
  creditColumns: ["cr", "credit", "credit amount", "cr amount", "deposit"],
  balanceColumns: ["bal", "balance", "closing balance", "running bal"],
  referenceColumns: ["chqno", "chq no", "ref no", "reference", "init.br", "sol"],
  dateFormats: ["dd-MM-yyyy", "dd/MM/yyyy", "dd-MMM-yyyy", "dd/MM/yy"],
};
