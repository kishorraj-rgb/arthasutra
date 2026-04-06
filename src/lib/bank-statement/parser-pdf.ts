import { ParsedTransaction } from "./types";

export async function parsePDF(
  file: File,
  bankId?: string
): Promise<{ transactions: ParsedTransaction[]; bankName: string; error?: string }> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    if (bankId) formData.append("bank", bankId);

    const res = await fetch("/api/parse-pdf", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      return { transactions: [], bankName: "", error: `PDF parse failed: ${errText}` };
    }

    const data = await res.json();
    return {
      transactions: data.transactions || [],
      bankName: data.bankName || "",
      error: data.error,
    };
  } catch (err) {
    return {
      transactions: [],
      bankName: "",
      error: `PDF parse error: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}
