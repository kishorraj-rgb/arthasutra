import { ParsedTransaction, IncomeType, ExpenseCategory } from "./types";

// Transfer detection - applied before income/expense rules
const TRANSFER_KEYWORDS: RegExp[] = [
  /NEFT|RTGS|IMPS/i,
  /TRANSFER\s*(TO|FROM)/i,
  /SELF\s*TRANSFER/i,
  /OWN\s*ACCOUNT/i,
  /FT\s*-\s*CR|FT\s*-\s*DR/i,
  /A\/C\s*TRANSFER/i,
  /FUND\s*TRANSFER/i,
  /INT\.?BANK/i,
  /IB\s*FUND/i,
];

const INCOME_RULES: { type: IncomeType; keywords: RegExp[] }[] = [
  {
    type: "salary",
    keywords: [/SALARY/i, /SAL\s*CR/i, /PAYROLL/i, /NEFT.*SALARY/i, /MONTHLY\s*PAY/i, /WAGES/i],
  },
  {
    type: "freelance",
    keywords: [/CONSULT/i, /FREELANCE/i, /PROFESSIONAL\s*FEE/i, /INVOICE/i, /CLIENT\s*PAY/i],
  },
  {
    type: "rental",
    keywords: [/RENT\s*(?:INCOME|CR|RECEIVED)/i, /RENTAL\s*INCOME/i, /LEASE\s*INCOME/i, /TENANT/i],
  },
  {
    type: "interest",
    keywords: [/INT\s*CR/i, /INTEREST/i, /INT\.?\s*CREDIT/i, /FD\s*INT/i, /SB\s*INT/i, /SAVING.*INT/i, /NEFT.*INT/i],
  },
  {
    type: "dividend",
    keywords: [/DIVIDEND/i, /DIV\s*CR/i, /DIVD/i],
  },
];

const EXPENSE_RULES: { category: ExpenseCategory; keywords: RegExp[] }[] = [
  {
    category: "food",
    keywords: [/SWIGGY/i, /ZOMATO/i, /RESTAURANT/i, /DOMINOS/i, /MCDONALD/i, /KFC/i, /PIZZA/i, /CAFE/i, /FOOD/i, /BURGER/i, /STARBUCKS/i, /DUNKIN/i, /BARBEQUE/i, /BIRYANI/i, /DINING/i, /EATERY/i, /BAKERY/i, /CHAI/i, /HALDIRAM/i, /BIKANERVALA/i],
  },
  {
    category: "transport",
    keywords: [/UBER/i, /OLA/i, /RAPIDO/i, /IRCTC/i, /METRO/i, /FUEL/i, /PETROL/i, /DIESEL/i, /PARKING/i, /FASTAG/i, /TOLL/i, /INDIGO/i, /SPICEJET/i, /AIR\s*INDIA/i, /VISTARA/i, /MAKE\s*MY\s*TRIP/i, /GOIBIBO/i, /REDBUS/i, /CLEARTRIP/i, /BHARAT\s*PETRO/i, /INDIAN\s*OIL/i, /HP\s*PETROL/i, /NHAI/i],
  },
  {
    category: "housing",
    keywords: [/RENT\b/i, /MAINTENANCE/i, /SOCIETY/i, /HOUSING/i, /APARTMENT/i, /FLAT/i, /PG\s*RENT/i, /LANDLORD/i, /HOUSE\s*TAX/i, /PROPERTY\s*TAX/i],
  },
  {
    category: "utilities",
    keywords: [/ELECTRICITY/i, /BESCOM/i, /WATER\s*BILL/i, /BROADBAND/i, /AIRTEL/i, /JIO/i, /VODAFONE/i, /VI\s*PREPAID/i, /GAS\s*BILL/i, /PIPED\s*GAS/i, /BSNL/i, /ACT\s*FIBERNET/i, /TATA\s*SKY/i, /DISH\s*TV/i, /WIFI/i, /INTERNET/i, /MOBILE\s*RECHARGE/i, /MSEB/i, /TANGEDCO/i, /CESC/i, /TORRENT\s*POWER/i],
  },
  {
    category: "medical",
    keywords: [/PHARMACY/i, /HOSPITAL/i, /DOCTOR/i, /MEDICAL/i, /APOLLO/i, /MEDPLUS/i, /1MG/i, /PHARMEASY/i, /NETMEDS/i, /CLINIC/i, /DIAGNOSTIC/i, /LAB\s*TEST/i, /FORTIS/i, /MAX\s*HEALTH/i, /MANIPAL/i, /PRACTO/i],
  },
  {
    category: "education",
    keywords: [/SCHOOL\s*FEE/i, /COLLEGE/i, /TUITION/i, /COURSE/i, /UDEMY/i, /COURSERA/i, /UNACADEMY/i, /BYJU/i, /UPGRAD/i, /SKILL/i, /TRAINING/i, /COACHING/i, /ACADEMY/i],
  },
  {
    category: "entertainment",
    keywords: [/NETFLIX/i, /AMAZON\s*PRIME/i, /HOTSTAR/i, /SPOTIFY/i, /BOOKMYSHOW/i, /PVR/i, /INOX/i, /YOUTUBE\s*PREMIUM/i, /GAMING/i, /STEAM/i, /APPLE\s*MUSIC/i, /JIOCINEMA/i, /SONY\s*LIV/i, /ZEE5/i, /CINEMA/i, /MOVIE/i],
  },
  {
    category: "insurance",
    keywords: [/LIC/i, /INSURANCE\s*PREM/i, /PREMIUM/i, /HDFC\s*LIFE/i, /ICICI\s*PRUD/i, /SBI\s*LIFE/i, /MAX\s*LIFE/i, /BAJAJ\s*ALLIANZ/i, /STAR\s*HEALTH/i, /TATA\s*AIA/i, /POLICY\s*BAZAAR/i],
  },
  {
    category: "investment",
    keywords: [/SIP/i, /MUTUAL\s*FUND/i, /ZERODHA/i, /GROWW/i, /KUVERA/i, /NPS/i, /PPF/i, /COIN/i, /CAMS/i, /KFINTECH/i, /BSE\s*STAR/i, /ANGEL\s*ONE/i, /UPSTOX/i, /PAYTM\s*MONEY/i, /ET\s*MONEY/i, /MF\s*UTILITY/i],
  },
  {
    category: "school_fees",
    keywords: [/SCHOOL(?!\s*FEE)/i, /DAYCARE/i, /CRECHE/i, /PLAYSCHOOL/i, /NURSERY/i],
  },
  {
    category: "driver_salary",
    keywords: [/DRIVER/i, /CHAUFFEUR/i, /MAID/i, /COOK/i, /DOMESTIC\s*HELP/i, /SERVANT/i, /GARDENER/i],
  },
];

export function categorizeTransaction(tx: ParsedTransaction): ParsedTransaction {
  const desc = tx.description.toUpperCase();

  // Check for transfers first (both credits and debits)
  const isTransfer = TRANSFER_KEYWORDS.some((kw) => kw.test(desc));

  if (tx.type === "credit") {
    if (isTransfer) {
      // Check if it matches a specific income type first
      for (const rule of INCOME_RULES) {
        if (rule.keywords.some((kw) => kw.test(desc))) {
          return { ...tx, incomeType: rule.type };
        }
      }
      return { ...tx, incomeType: "transfer" };
    }
    for (const rule of INCOME_RULES) {
      if (rule.keywords.some((kw) => kw.test(desc))) {
        return { ...tx, incomeType: rule.type };
      }
    }
    return { ...tx, incomeType: "other" };
  }

  // Debit
  if (isTransfer) {
    for (const rule of EXPENSE_RULES) {
      if (rule.keywords.some((kw) => kw.test(desc))) {
        return { ...tx, expenseCategory: rule.category };
      }
    }
    return { ...tx, expenseCategory: "transfer" };
  }
  for (const rule of EXPENSE_RULES) {
    if (rule.keywords.some((kw) => kw.test(desc))) {
      return { ...tx, expenseCategory: rule.category };
    }
  }
  return { ...tx, expenseCategory: "other" };
}

export function categorizeAll(transactions: ParsedTransaction[]): ParsedTransaction[] {
  return transactions.map(categorizeTransaction);
}
