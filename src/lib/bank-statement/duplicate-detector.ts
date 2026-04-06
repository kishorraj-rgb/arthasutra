import { ParsedTransaction } from "./types";

interface ExistingEntry {
  date: string;
  amount: number;
  description: string;
}

export function markDuplicates(
  transactions: ParsedTransaction[],
  existingIncome: ExistingEntry[],
  existingExpenses: ExistingEntry[]
): ParsedTransaction[] {
  return transactions.map((tx) => {
    const existing = tx.type === "credit" ? existingIncome : existingExpenses;
    const isDuplicate = existing.some(
      (entry) =>
        entry.date === tx.date &&
        Math.abs(entry.amount - tx.amount) < 1 &&
        descriptionOverlap(tx.description, entry.description) > 0.4
    );

    return {
      ...tx,
      isDuplicate,
      selected: isDuplicate ? false : tx.selected,
    };
  });
}

function descriptionOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toUpperCase().split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.toUpperCase().split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  Array.from(wordsA).forEach((word) => {
    if (wordsB.has(word)) overlap++;
  });
  return overlap / Math.max(wordsA.size, wordsB.size);
}
