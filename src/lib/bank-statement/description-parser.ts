export type PaymentMethod =
  | "UPI"
  | "IMPS"
  | "NEFT"
  | "RTGS"
  | "ATM"
  | "Auto Debit"
  | "Bill Pay"
  | "Mutual Fund"
  | "ACH"
  | "GST"
  | "UPI Lite"
  | "Cash"
  | "Other";

export interface ParsedDescription {
  payee: string;
  method: PaymentMethod;
  upiId?: string;
  bank?: string;
  reference?: string;
  rawDescription: string;
}

const METHOD_COLORS: Record<PaymentMethod, string> = {
  UPI: "bg-violet-100 text-violet-700",
  IMPS: "bg-blue-100 text-blue-700",
  NEFT: "bg-cyan-100 text-cyan-700",
  RTGS: "bg-indigo-100 text-indigo-700",
  ATM: "bg-amber-100 text-amber-700",
  "Auto Debit": "bg-orange-100 text-orange-700",
  "Bill Pay": "bg-teal-100 text-teal-700",
  "Mutual Fund": "bg-emerald-100 text-emerald-700",
  ACH: "bg-slate-100 text-slate-700",
  GST: "bg-red-100 text-red-700",
  "UPI Lite": "bg-purple-100 text-purple-700",
  Cash: "bg-yellow-100 text-yellow-700",
  Other: "bg-gray-100 text-gray-600",
};

export function getMethodColor(method: PaymentMethod): string {
  return METHOD_COLORS[method] || METHOD_COLORS.Other;
}

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/[\s_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .trim();
}

function cleanPayee(name: string): string {
  if (!name) return "Unknown";
  // Remove trailing slashes, UPI IDs, reference numbers
  let cleaned = name
    .replace(/@[\w.]+/g, "") // Remove UPI IDs like @ybl, @icic
    .replace(/\/+$/, "")
    .replace(/^\s+|\s+$/g, "")
    .replace(/\s+/g, " ");

  // If it's all uppercase and short, title-case it
  if (cleaned.length > 0 && cleaned === cleaned.toUpperCase() && cleaned.length < 40) {
    cleaned = titleCase(cleaned);
  }

  return cleaned || "Unknown";
}

export function parseDescription(raw: string): ParsedDescription {
  const desc = raw.trim();

  // UPI: UPI/PayeeName/UPI_ID/Purpose/Bank/RefNumber/TxnID
  if (desc.startsWith("UPI/")) {
    const parts = desc.split("/").filter(Boolean);
    // parts[0] = "UPI", parts[1] = payee, parts[2] = upi id, parts[3] = purpose, parts[4] = bank, parts[5] = ref
    const payee = cleanPayee(parts[1] || "");
    const upiId = parts[2] && parts[2].includes("@") ? parts[2] : undefined;
    const bank = parts.length > 4 ? cleanBankName(parts[4] || "") : undefined;
    const reference = parts.length > 5 ? parts[5] : undefined;
    return { payee, method: "UPI", upiId, bank, reference, rawDescription: desc };
  }

  // UPI Lite: UPL/ref/UPILi/...
  if (desc.startsWith("UPL/")) {
    const parts = desc.split("/").filter(Boolean);
    const reference = parts[1] || undefined;
    return { payee: "UPI Lite Payment", method: "UPI Lite", reference, rawDescription: desc };
  }

  // IMPS: MMT/IMPS/RefNumber/PayeeName/IFSC or MMT/IMPS/RefNumber/Purpose/PayeeName/IFSC
  if (desc.startsWith("MMT/IMPS/")) {
    const parts = desc.split("/").filter(Boolean);
    // parts[0]=MMT, parts[1]=IMPS, parts[2]=ref, parts[3]=payee or purpose, parts[4]=payee or IFSC
    const reference = parts[2] || undefined;
    let payee = "Unknown";
    let bank: string | undefined;

    if (parts.length >= 5) {
      // Check if parts[3] is a purpose like "Pay", "Own"
      if (parts[3] && parts[3].length <= 4) {
        payee = cleanPayee(parts[4] || "");
        bank = parts[5] ? ifscToBank(parts[5]) : undefined;
      } else {
        payee = cleanPayee(parts[3] || "");
        bank = parts[4] ? ifscToBank(parts[4]) : undefined;
      }
    } else if (parts.length >= 4) {
      payee = cleanPayee(parts[3] || "");
    }

    return { payee, method: "IMPS", bank, reference, rawDescription: desc };
  }

  // NEFT: NEFT-CNRBN...-PayeeName-... or NEFT/...
  if (desc.startsWith("NEFT") || desc.includes("/NEFT/")) {
    const parts = desc.split(/[-\/]/).filter(Boolean);
    // Find the payee — usually the longest meaningful segment
    let payee = "Unknown";
    for (const part of parts) {
      const cleaned = part.trim();
      if (
        cleaned.length > 3 &&
        cleaned !== "NEFT" &&
        !/^\d+$/.test(cleaned) &&
        !/^[A-Z]{4}\d/.test(cleaned) && // Not IFSC
        !/^NA$/.test(cleaned)
      ) {
        payee = cleanPayee(cleaned);
        break;
      }
    }
    return { payee, method: "NEFT", rawDescription: desc };
  }

  // Mutual Fund: WMS/MF/SchemeCode/RefNumber
  if (desc.startsWith("WMS/MF/")) {
    const parts = desc.split("/").filter(Boolean);
    const fundCode = parts[2] || "Unknown Fund";
    return { payee: `SIP/MF: ${fundCode}`, method: "Mutual Fund", rawDescription: desc };
  }

  // Auto Debit: ATD/Auto Debit CCxxxxxx
  if (desc.startsWith("ATD/")) {
    const cardMatch = desc.match(/CC\w+/);
    const card = cardMatch ? `Card ***${cardMatch[0].slice(-4)}` : "Credit Card";
    return { payee: `Auto Debit - ${card}`, method: "Auto Debit", rawDescription: desc };
  }

  // ACH: ACH/BranchName/AccountRef/Reference
  if (desc.startsWith("ACH/")) {
    const parts = desc.split("/").filter(Boolean);
    const payee = cleanPayee(parts[1] || "ACH Payment");
    return { payee, method: "ACH", rawDescription: desc };
  }

  // ATM Cash: NFS/CASH WDL/Ref/ATMCode/City/DateTime
  if (desc.startsWith("NFS/") || desc.includes("CASH WDL")) {
    const parts = desc.split("/").filter(Boolean);
    const city = parts.find((p) => /^[A-Z]{3,}$/.test(p.trim()) && !p.includes("NFS") && !p.includes("WDL"));
    return {
      payee: city ? `ATM Withdrawal - ${titleCase(city)}` : "ATM Withdrawal",
      method: "ATM",
      rawDescription: desc,
    };
  }

  // Bill Pay: BIL/INFT/Ref/PayeeName or BIL/ONL/Ref/PayeeName/...
  if (desc.startsWith("BIL/")) {
    const parts = desc.split("/").filter(Boolean);
    // parts[0]=BIL, parts[1]=INFT or ONL, parts[2]=ref, parts[3+]=payee info
    let payee = "Bill Payment";
    if (parts.length >= 4) {
      // Concatenate remaining meaningful parts
      const payeeParts = parts.slice(3).filter((p) => p.trim().length > 1 && !/^\d+$/.test(p.trim()));
      if (payeeParts.length > 0) {
        payee = cleanPayee(payeeParts.join(" "));
      }
    }
    // Check for "Self" — it's a self-transfer
    if (desc.includes("/Self")) {
      payee = "Self Transfer";
    }
    return { payee, method: "Bill Pay", rawDescription: desc };
  }

  // GST Payment: GIB/Ref/GST/GSTIN
  if (desc.startsWith("GIB/")) {
    return { payee: "GST Payment", method: "GST", rawDescription: desc };
  }

  // Fallback: try to extract something meaningful
  return { payee: cleanPayee(desc.substring(0, 50)), method: "Other", rawDescription: desc };
}

function cleanBankName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  const bankMap: Record<string, string> = {
    "HDFC BANK": "HDFC Bank",
    "ICICI BANK": "ICICI Bank",
    "STATE BANK": "SBI",
    "AXIS BANK": "Axis Bank",
    "YES BANKL": "Yes Bank",
    "YES BANKP": "Yes Bank",
    "YES BANK L": "Yes Bank",
    "YES BANK P": "Yes Bank",
    "YES BANK": "Yes Bank",
    "CANARA BAN": "Canara Bank",
    "CANARA BANK": "Canara Bank",
    "KARNATAKA": "Karnataka Bank",
    "IDBI BANK": "IDBI Bank",
    "FEDERAL BA": "Federal Bank",
    "FEDERAL BANK": "Federal Bank",
    "UNITY SMAL": "Unity Small Finance",
    "AIRTEL PAY": "Airtel Payments",
    "SLICE SMAL": "Slice",
  };
  return bankMap[name.toUpperCase()] || titleCase(name);
}

function ifscToBank(ifsc: string): string | undefined {
  const code = ifsc.substring(0, 4).toUpperCase();
  const ifscMap: Record<string, string> = {
    HDFC: "HDFC Bank",
    ICIC: "ICICI Bank",
    SBIN: "SBI",
    UTIB: "Axis Bank",
    CNRB: "Canara Bank",
    KARB: "Karnataka Bank",
    KKBK: "Kotak Bank",
    IDFB: "IDFC First Bank",
    PUNB: "PNB",
    BARB: "Bank of Baroda",
    IDBI: "IDBI Bank",
    FDRL: "Federal Bank",
    YESB: "Yes Bank",
    INDB: "IndusInd Bank",
  };
  return ifscMap[code];
}

export function parseAllDescriptions(descriptions: string[]): ParsedDescription[] {
  return descriptions.map(parseDescription);
}
