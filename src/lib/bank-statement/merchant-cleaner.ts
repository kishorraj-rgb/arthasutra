/**
 * Clean credit card transaction descriptions into readable merchant names.
 *
 * CC descriptions typically look like:
 *   "POS 437748XXXXXX3291 SWIGGY BANGALORE IN"
 *   "ECOM/000412345678/AMAZON PAY INDIA PRI/BENGALURU"
 *   "VPS/000912345678/UBER INDIA SYSTEMS/BANGALORE"
 *   "NFS/CASH WDL/ATM/STATE BANK/BANGALORE"
 *   "EMI/1234567890123456/BAJAJ FINSERV EMI"
 */

// Prefixes to strip
const PREFIX_PATTERNS: RegExp[] = [
  /^POS\s*\d*\s*/i,
  /^ECOM\s*[\/\\]?\s*/i,
  /^VPS\s*[\/\\]?\s*/i,
  /^NFS\s*[\/\\]?\s*/i,
  /^EMI\s*[\/\\]?\s*/i,
  /^IW\s*[\/\\]?\s*/i,
  /^MB\s*[\/\\]?\s*/i,
  /^UPI\s*[\/\\]?\s*/i,
  /^IMPS\s*[\/\\]?\s*/i,
  /^NEFT\s*[\/\\]?\s*/i,
  /^RTGS\s*[\/\\]?\s*/i,
  /^SI\s*[\/\\]?\s*/i,
  /^ATD\s*[\/\\]?\s*/i,
  /^AUTO\s*DEBIT\s*[\/\\]?\s*/i,
];

// Card number / reference number patterns (masked or full)
const REFERENCE_PATTERNS: RegExp[] = [
  /\d{12,19}/g,                     // 12-19 digit reference numbers
  /\d{4,6}X{4,8}\d{3,4}/gi,       // Masked card numbers like 437748XXXXXX3291
  /[A-Z0-9]{16,}/g,                // Long alphanumeric reference codes
  /\d{3,6}[\/\\]\d{6,}/g,         // Slash-separated reference pairs
];

// Card network codes
const NETWORK_PATTERNS: RegExp[] = [
  /\bVISA\b/gi,
  /\bM\/?C\b/gi,
  /\bMASTERCARD\b/gi,
  /\bRUPAY\b/gi,
  /\bAMEX\b/gi,
  /\bDINERS\b/gi,
  /\bJCB\b/gi,
];

// Common Indian city names that appear at the end of CC descriptions
const CITY_PATTERNS: RegExp[] = [
  /\b(BANGALORE|BENGALURU|MUMBAI|DELHI|NEW\s*DELHI|CHENNAI|HYDERABAD|PUNE|KOLKATA|AHMEDABAD|JAIPUR|LUCKNOW|NOIDA|GURGAON|GURUGRAM|GHAZIABAD|CHANDIGARH|INDORE|BHOPAL|NAGPUR|KOCHI|COIMBATORE|THIRUVANANTHAPURAM|VISAKHAPATNAM|VIZAG|MYSORE|MYSURU|VADODARA|SURAT|THANE|NAVI\s*MUMBAI|FARIDABAD)\s*(IN|IND|INDIA)?\s*$/gi,
];

// Trailing country codes
const COUNTRY_SUFFIX = /\s+(IN|IND|INDIA)\s*$/gi;

// Slashed segments: "000412345678/AMAZON PAY INDIA PRI/BENGALURU" -> extract merchant
const SLASH_SEGMENT_PATTERN = /^[\d\s]+[\/\\]/;

export function cleanMerchantName(description: string): string {
  if (!description) return "";

  let cleaned = description.trim();

  // Step 1: Strip prefixes (POS, ECOM, VPS, etc.)
  for (const pattern of PREFIX_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  cleaned = cleaned.trim();

  // Step 2: Handle slash-separated format (common in Indian CC statements)
  // e.g., "000412345678/AMAZON PAY INDIA PRI/BENGALURU"
  if (cleaned.includes("/") || cleaned.includes("\\")) {
    const parts = cleaned.split(/[\/\\]/).map((p) => p.trim()).filter(Boolean);
    // Find the most "merchant-like" segment (not a number, not a city)
    const merchantParts = parts.filter((p) => {
      // Skip purely numeric segments
      if (/^\d+$/.test(p)) return false;
      // Skip very short segments
      if (p.length < 3) return false;
      return true;
    });
    if (merchantParts.length > 0) {
      // Take the first non-numeric segment as merchant name, skip the rest (usually city)
      cleaned = merchantParts[0];
    }
  }

  // Step 3: Strip card reference numbers
  for (const pattern of REFERENCE_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }

  // Step 4: Strip card network codes
  for (const pattern of NETWORK_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }

  // Step 5: Strip city names at the end
  for (const pattern of CITY_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Step 6: Strip trailing country codes
  cleaned = cleaned.replace(COUNTRY_SUFFIX, "");

  // Step 7: Clean up leftover artifacts
  cleaned = cleaned
    .replace(/[\/\\]+/g, " ")     // Replace remaining slashes
    .replace(/\s*-\s*$/g, "")     // Remove trailing dashes
    .replace(/\s*\*\s*/g, " ")    // Remove asterisks
    .replace(/\s{2,}/g, " ")      // Collapse multiple spaces
    .trim();

  // Step 8: Title case
  cleaned = toTitleCase(cleaned);

  return cleaned || toTitleCase(description.trim());
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => {
      if (word.length <= 2) return word.toUpperCase(); // Keep short words like "IN", "PVT" etc.
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
