export interface ParsedTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // Always positive
  type: "credit" | "debit";
  balance?: number;
  reference?: string;
  incomeType: "salary" | "freelance" | "rental" | "interest" | "dividend" | "refund" | "reimbursement" | "transfer" | "other";
  expenseCategory: "housing" | "food" | "transport" | "medical" | "education" | "insurance" | "investment" | "driver_salary" | "school_fees" | "utilities" | "entertainment" | "transfer" | "other";
  isDuplicate: boolean;
  selected: boolean;
}

export interface BankFormat {
  id: string;
  name: string;
  detectFormat: (headers: string[]) => boolean;
  dateColumns: string[];
  descriptionColumns: string[];
  debitColumns: string[];
  creditColumns: string[];
  balanceColumns: string[];
  referenceColumns: string[];
  dateFormats: string[]; // e.g., ["dd/MM/yyyy", "dd-MM-yyyy"]
  skipRows?: number;
  amountInSingleColumn?: boolean; // Some banks use one column with +/- sign
  singleAmountColumn?: string;
}

export type IncomeType = ParsedTransaction["incomeType"];
export type ExpenseCategory = ParsedTransaction["expenseCategory"];
