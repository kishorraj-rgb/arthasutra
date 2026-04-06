let counter = 0;

export function generateId(): string {
  return `tx_${Date.now()}_${++counter}`;
}

export function findColumn(headers: string[], candidates: string[]): string | null {
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());
  for (const candidate of candidates) {
    const idx = normalizedHeaders.findIndex((h) => h === candidate.toLowerCase());
    if (idx !== -1) return headers[idx];
  }
  // Partial match fallback
  for (const candidate of candidates) {
    const idx = normalizedHeaders.findIndex((h) => h.includes(candidate.toLowerCase()) || candidate.toLowerCase().includes(h));
    if (idx !== -1) return headers[idx];
  }
  return null;
}

export function parseAmount(value: string | undefined | null): number {
  if (!value) return 0;
  // Remove commas, spaces, currency symbols
  const cleaned = value.replace(/[,\s₹$INR]/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "") return 0;
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.abs(num);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function parseDate(rawDate: string, formats?: string[]): string | null {
  if (!rawDate || rawDate.trim() === "") return null;

  const cleaned = rawDate.trim();

  // Try ISO format first (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // Try common Indian date formats
  // dd/MM/yyyy or dd-MM-yyyy
  let match = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // dd/MM/yy
  match = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (match) {
    const [, day, month, shortYear] = match;
    const year = parseInt(shortYear) > 50 ? `19${shortYear}` : `20${shortYear}`;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // dd MMM yyyy or dd-MMM-yyyy (e.g., "01 Jan 2025" or "01-Jan-2025")
  const monthMap: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  match = cleaned.match(/^(\d{1,2})[\s\-]([A-Za-z]{3})[\s\-](\d{4})$/);
  if (match) {
    const [, day, monthStr, year] = match;
    const month = monthMap[monthStr.toLowerCase()];
    if (month) return `${year}-${month}-${day.padStart(2, "0")}`;
  }

  // dd-MMM-yy
  match = cleaned.match(/^(\d{1,2})[\s\-]([A-Za-z]{3})[\s\-](\d{2})$/);
  if (match) {
    const [, day, monthStr, shortYear] = match;
    const month = monthMap[monthStr.toLowerCase()];
    const year = parseInt(shortYear) > 50 ? `19${shortYear}` : `20${shortYear}`;
    if (month) return `${year}-${month}-${day.padStart(2, "0")}`;
  }

  // MM/dd/yyyy (US format fallback)
  match = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    if (parseInt(month) <= 12 && parseInt(day) <= 31) {
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }

  return null;
}
