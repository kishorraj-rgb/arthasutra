import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyCompact(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)}Cr`;
  } else if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)}L`;
  } else if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function getCurrentFinancialYear(): string {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${(year + 1).toString().slice(-2)}`;
}

export function getFinancialYearDates(fy: string): { start: string; end: string } {
  const [startYear] = fy.split("-");
  const year = parseInt(startYear);
  return {
    start: `${year}-04-01`,
    end: `${year + 1}-03-31`,
  };
}

export const EXPENSE_CATEGORIES = [
  { value: "housing", label: "Housing/Rent", icon: "Home" },
  { value: "food", label: "Food & Dining", icon: "UtensilsCrossed" },
  { value: "transport", label: "Transport", icon: "Car" },
  { value: "medical", label: "Medical", icon: "Heart" },
  { value: "education", label: "Education", icon: "GraduationCap" },
  { value: "insurance", label: "Insurance", icon: "Shield" },
  { value: "investment", label: "Investment", icon: "TrendingUp" },
  { value: "driver_salary", label: "Driver Salary", icon: "User" },
  { value: "school_fees", label: "School Fees", icon: "School" },
  { value: "utilities", label: "Utilities", icon: "Zap" },
  { value: "entertainment", label: "Entertainment", icon: "Film" },
  { value: "clothing", label: "Clothing & Apparel", icon: "Shirt" },
  { value: "grocery", label: "Grocery", icon: "ShoppingCart" },
  { value: "shopping", label: "Shopping", icon: "ShoppingBag" },
  { value: "personal_care", label: "Personal Care", icon: "Sparkles" },
  { value: "subscription", label: "Subscriptions", icon: "CreditCard" },
  { value: "donation", label: "Donations/Charity", icon: "Heart" },
  { value: "emi", label: "EMI/Loan Payment", icon: "Landmark" },
  { value: "rent", label: "Rent Payment", icon: "Home" },
  { value: "travel", label: "Travel", icon: "Plane" },
  { value: "cash_withdrawal", label: "Cash Withdrawal", icon: "Banknote" },
  { value: "transfer", label: "Transfer", icon: "ArrowLeftRight" },
  { value: "other", label: "Other", icon: "MoreHorizontal" },
] as const;

export const INCOME_TYPES = [
  { value: "salary", label: "Salary" },
  { value: "freelance", label: "Freelance/Consulting" },
  { value: "rental", label: "Rental Income" },
  { value: "interest", label: "Interest" },
  { value: "dividend", label: "Dividend" },
  { value: "refund", label: "Refund/Reversal" },
  { value: "reimbursement", label: "Reimbursement" },
  { value: "transfer", label: "Transfer" },
  { value: "other", label: "Other" },
] as const;

export const INVESTMENT_TYPES = [
  { value: "mutual_fund", label: "Mutual Fund" },
  { value: "stocks", label: "Stocks" },
  { value: "ppf", label: "PPF" },
  { value: "nps", label: "NPS" },
  { value: "fd", label: "Fixed Deposit" },
  { value: "rd", label: "Recurring Deposit" },
  { value: "gold", label: "Gold" },
  { value: "real_estate", label: "Real Estate" },
  { value: "elss", label: "ELSS" },
  { value: "ulip", label: "ULIP" },
] as const;

export const CHART_COLORS = {
  income: "#10B981",
  expense: "#F43F5E",
  gold: "#F0A500",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  cyan: "#06B6D4",
  orange: "#F97316",
  pink: "#EC4899",
  indigo: "#6366F1",
  teal: "#14B8A6",
};

export function amountInWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (amount === 0) return 'Zero Rupees';

  const num = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - num) * 100);

  function convertToWords(n: number): string {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convertToWords(n % 100) : '');
    if (n < 100000) return convertToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convertToWords(n % 1000) : '');
    if (n < 10000000) return convertToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convertToWords(n % 100000) : '');
    return convertToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convertToWords(n % 10000000) : '');
  }

  let result = convertToWords(num) + ' Rupees';
  if (paise > 0) result += ' and ' + convertToWords(paise) + ' Paise';
  return result + ' Only';
}

export const CATEGORY_COLORS: Record<string, string> = {
  housing: "#3B82F6",
  food: "#F97316",
  transport: "#8B5CF6",
  medical: "#F43F5E",
  education: "#06B6D4",
  insurance: "#10B981",
  investment: "#F0A500",
  driver_salary: "#EC4899",
  school_fees: "#6366F1",
  utilities: "#14B8A6",
  entertainment: "#A855F7",
  other: "#6B7280",
  salary: "#10B981",
  freelance: "#3B82F6",
  rental: "#F0A500",
  interest: "#8B5CF6",
  dividend: "#06B6D4",
  clothing: "#D946EF",
  grocery: "#84CC16",
  shopping: "#F97316",
  personal_care: "#EC4899",
  subscription: "#8B5CF6",
  donation: "#F43F5E",
  emi: "#DC2626",
  rent: "#2563EB",
  travel: "#0EA5E9",
  cash_withdrawal: "#78716C",
  refund: "#F59E0B",
  reimbursement: "#10B981",
  transfer: "#9CA3AF",
};
