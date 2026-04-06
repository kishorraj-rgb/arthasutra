import { BankFormat } from "../types";
import { hdfcFormat } from "./hdfc";
import { iciciFormat } from "./icici";
import { sbiFormat } from "./sbi";
import { axisFormat } from "./axis";

export const ALL_BANK_FORMATS: BankFormat[] = [hdfcFormat, iciciFormat, sbiFormat, axisFormat];

export function autoDetectBank(headers: string[]): BankFormat | null {
  for (const format of ALL_BANK_FORMATS) {
    if (format.detectFormat(headers)) {
      return format;
    }
  }
  return null;
}

export function getBankFormatById(id: string): BankFormat | null {
  return ALL_BANK_FORMATS.find((f) => f.id === id) || null;
}

export { hdfcFormat, iciciFormat, sbiFormat, axisFormat };
