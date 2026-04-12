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
    type: "refund",
    keywords: [/REFUND/i, /REVERSAL/i, /REV\s*CR/i, /MANDATE\s*REFUND/i, /CASHBACK/i, /RETURN/i, /REVERSED/i, /CREDIT\s*REVERSAL/i],
  },
  {
    type: "reimbursement",
    keywords: [/REIMBURSE/i, /REIMBURSEMENT/i, /EXPENSE\s*CLAIM/i],
  },
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
    category: "clothing",
    keywords: [/CLOTHING/i, /APPAREL/i, /FASHION/i, /MYNTRA/i, /AJIO/i, /H&M/i, /ZARA/i, /LEVIS/i, /PUMA/i, /NIKE/i, /ADIDAS/i, /RAYMOND/i, /PETER\s*ENGLAND/i, /ALLEN\s*SOLLY/i, /VAN\s*HEUSEN/i, /FABINDIA/i, /WESTSIDE/i, /PANTALOONS/i, /LIFESTYLE/i, /MAX\s*FASHION/i, /RELIANCE\s*TRENDS/i, /SAI\s*SILKS/i, /RAMRAJ/i, /COTTON/i, /SILK/i, /SAREE/i, /TRENT/i],
  },
  {
    category: "grocery",
    keywords: [/GROCERY/i, /BIGBASKET/i, /BLINKIT/i, /ZEPTO/i, /DMART/i, /MORE\s*MEGA/i, /RELIANCE\s*FRESH/i, /STAR\s*BAZAAR/i, /LULU/i, /SPAR/i, /NATURE.*BASKET/i, /SPENCERS/i, /METRO\s*CASH/i],
  },
  {
    category: "shopping",
    keywords: [/AMAZON/i, /FLIPKART/i, /MEESHO/i, /SNAPDEAL/i, /CROMA/i, /VIJAY\s*SALES/i, /RELIANCE\s*DIGITAL/i],
  },
  {
    category: "personal_care",
    keywords: [/SALON/i, /SPA/i, /PARLOUR/i, /PARLOR/i, /BEAUTY/i, /NYKAA/i, /PURPLLE/i, /BODYSHOP/i, /LAKME/i, /BARBER/i, /HAIRCUT/i],
  },
  {
    category: "subscription",
    keywords: [/SUBSCRIPTION/i, /ANNUAL\s*PLAN/i, /MONTHLY\s*PLAN/i, /CHATGPT/i, /OPENAI/i, /NOTION/i, /FIGMA/i, /GITHUB/i, /GOOGLE\s*ONE/i, /ICLOUD/i, /APPLE.*STORAGE/i],
  },
  {
    category: "donation",
    keywords: [/DONATION/i, /CHARITY/i, /NGO/i, /TEMPLE/i, /CHURCH/i, /MOSQUE/i, /GURUDWARA/i, /POOJA/i, /DAKSHINA/i],
  },
  {
    category: "emi",
    keywords: [/EMI/i, /LOAN\s*REPAY/i, /HOME\s*LOAN/i, /CAR\s*LOAN/i, /PERSONAL\s*LOAN/i, /BAJAJ\s*FINSERV/i, /CREDIT\s*CARD\s*BILL/i, /AUTO\s*DEBIT.*CC/i],
  },
  {
    category: "rent",
    keywords: [/RENT\s*PAY/i, /HOUSE\s*RENT/i, /FLAT\s*RENT/i, /PG\s*RENT/i, /INDIQUBE/i, /COWORK/i],
  },
  {
    category: "travel",
    keywords: [/TRAVEL/i, /HOTEL/i, /OYO/i, /TREEBO/i, /GOIBIBO/i, /BOOKING\.COM/i, /AIRBNB/i, /MAKE\s*MY\s*TRIP/i, /YATRA/i, /IXIGO/i, /CLEARTRIP/i, /FLIGHT/i, /AIRLINE/i],
  },
  {
    category: "tax_payment",
    keywords: [/GST\s*PAY/i, /GIB\//i, /GST\s*$/i, /INCOME\s*TAX/i, /ADVANCE\s*TAX/i, /TDS\s*PAY/i, /CHALLAN/i, /OLTAS/i, /\+GST$/i, /GST\s*PAYMENT/i],
  },
  {
    category: "credit_card_bill",
    keywords: [/ATD\/Auto\s*Debit\s*CC/i, /AUTO\s*DEBIT.*CC/i, /CREDIT\s*CARD\s*BILL/i, /CC\s*PAYMENT/i, /CARD\s*PAYMENT/i, /CREDIT\s*CARD.*PAY/i],
  },
  {
    category: "recharge",
    keywords: [/PREPAID/i, /RECHARGE/i, /JIO.*PREPAID/i, /AIRTEL.*PREPAID/i, /VI\s*PREPAID/i, /BSNL.*RECHARGE/i, /MOBILE\s*RECHARGE/i, /DTH\s*RECHARGE/i],
  },
  {
    category: "household",
    keywords: [/MAID/i, /COOK/i, /DOMESTIC\s*HELP/i, /SERVANT/i, /GARDENER/i, /WATCHMAN/i, /SWEEPER/i, /HOUSEKEEP/i],
  },
  {
    category: "cash_withdrawal",
    keywords: [/CASH\s*WDL/i, /ATM\s*WDL/i, /NFS.*CASH/i, /CASH\s*WITHDRAWAL/i],
  },
  {
    category: "driver_salary",
    keywords: [/DRIVER/i, /CHAUFFEUR/i],
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

// ─── Subscription Detection ──────────────────────────────────────────────

const KNOWN_SUBSCRIPTIONS: { pattern: RegExp; name: string }[] = [
  { pattern: /NETFLIX/i, name: "Netflix" },
  { pattern: /SPOTIFY/i, name: "Spotify" },
  { pattern: /AMAZON\s*PRIME/i, name: "Amazon Prime" },
  { pattern: /HOTSTAR|DISNEY/i, name: "Hotstar/Disney+" },
  { pattern: /YOUTUBE\s*(PREMIUM|GOOGLE)/i, name: "YouTube Premium" },
  { pattern: /APPLE\s*(MUSIC|TV|ONE|ICLOUD)/i, name: "Apple" },
  { pattern: /GOOGLE\s*(PLAY|ONE|CLOUD|WORKSPACE)/i, name: "Google" },
  { pattern: /MICROSOFT|OFFICE\s*365/i, name: "Microsoft 365" },
  { pattern: /ADOBE/i, name: "Adobe" },
  { pattern: /OPENAI|CHATGPT/i, name: "OpenAI/ChatGPT" },
  { pattern: /ANTHROPIC|CLAUDE/i, name: "Anthropic/Claude" },
  { pattern: /CURSOR/i, name: "Cursor" },
  { pattern: /GITHUB/i, name: "GitHub" },
  { pattern: /LINKEDIN\s*PREMIUM/i, name: "LinkedIn Premium" },
  { pattern: /ZOOM/i, name: "Zoom" },
  { pattern: /SLACK/i, name: "Slack" },
  { pattern: /NOTION/i, name: "Notion" },
  { pattern: /FIGMA/i, name: "Figma" },
  { pattern: /CANVA/i, name: "Canva" },
  { pattern: /ZERODHA|KITE/i, name: "Zerodha" },
  { pattern: /GROWW/i, name: "Groww" },
  { pattern: /ZEE5/i, name: "Zee5" },
  { pattern: /SONY\s*LIV/i, name: "SonyLIV" },
  { pattern: /JIO\s*(PREPAID|FIBER|CINEMA)/i, name: "Jio" },
  { pattern: /AIRTEL/i, name: "Airtel" },
  { pattern: /VI\s*PREPAID|VODAFONE/i, name: "Vi/Vodafone" },
  { pattern: /SETAPP|PADDLE/i, name: "Setapp" },
  { pattern: /VERCEL/i, name: "Vercel" },
  { pattern: /AWS|AMAZON\s*WEB/i, name: "AWS" },
  { pattern: /HOSTINGER/i, name: "Hostinger" },
  { pattern: /CLOUDFLARE/i, name: "Cloudflare" },
];

/**
 * Detect if a transaction is a known subscription.
 * Returns the subscription name if matched, null otherwise.
 */
export function detectSubscription(description: string): string | null {
  for (const sub of KNOWN_SUBSCRIPTIONS) {
    if (sub.pattern.test(description)) return sub.name;
  }
  return null;
}

/**
 * Detect recurring transactions from a list of transactions.
 * Groups by normalized merchant + amount and finds patterns.
 */
export function detectRecurringSubscriptions(
  transactions: Array<{ date: string; amount: number; description: string; type?: string }>
): Array<{
  name: string;
  amount: number;
  frequency: "monthly" | "quarterly" | "half_yearly" | "yearly";
  occurrences: number;
  lastDate: string;
  source: "known" | "detected";
}> {
  // Group by known subscription name or normalized description
  const groups = new Map<string, Array<{ date: string; amount: number }>>();

  for (const tx of transactions) {
    if (tx.type === "credit") continue; // Skip credits
    const knownName = detectSubscription(tx.description);
    const key = knownName || tx.description.substring(0, 30).trim().toUpperCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ date: tx.date, amount: tx.amount });
  }

  const results: ReturnType<typeof detectRecurringSubscriptions> = [];

  for (const [name, entries] of Array.from(groups.entries())) {
    if (entries.length < 2) continue;

    // Check if amounts are consistent (±10%)
    const amounts = entries.map((e) => e.amount);
    const avgAmt = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const consistent = amounts.every((a) => Math.abs(a - avgAmt) / avgAmt < 0.1);
    if (!consistent) continue;

    // Estimate frequency from date gaps
    const dates = entries.map((e) => e.date).sort();
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      const diff = (new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / (1000 * 60 * 60 * 24);
      gaps.push(diff);
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;

    let frequency: "monthly" | "quarterly" | "half_yearly" | "yearly";
    if (avgGap > 300) frequency = "yearly";
    else if (avgGap > 150) frequency = "half_yearly";
    else if (avgGap > 75) frequency = "quarterly";
    else frequency = "monthly";

    const isKnown = detectSubscription(name) !== null;

    results.push({
      name: isKnown ? detectSubscription(entries[0]?.date ? name : name)! || name : name,
      amount: Math.round(avgAmt),
      frequency,
      occurrences: entries.length,
      lastDate: dates[dates.length - 1],
      source: isKnown ? "known" : "detected",
    });
  }

  return results.sort((a, b) => b.occurrences - a.occurrences);
}
