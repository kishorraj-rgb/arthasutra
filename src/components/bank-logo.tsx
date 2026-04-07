"use client";

import { cn } from "@/lib/utils";

// Bank brand colors and metadata for Indian banks
export const BANK_PRESETS: Record<
  string,
  { name: string; color: string; bgColor: string; initials: string; accent: string }
> = {
  icici: {
    name: "ICICI Bank",
    color: "#F37920",
    bgColor: "#FFF4EB",
    initials: "IC",
    accent: "#B0361C",
  },
  hdfc: {
    name: "HDFC Bank",
    color: "#004B8D",
    bgColor: "#E8F0F8",
    initials: "HD",
    accent: "#ED1C24",
  },
  axis: {
    name: "Axis Bank",
    color: "#97144D",
    bgColor: "#F8E8EF",
    initials: "AX",
    accent: "#512B58",
  },
  sbi: {
    name: "State Bank of India",
    color: "#22409A",
    bgColor: "#E8ECF5",
    initials: "SBI",
    accent: "#1A1A6C",
  },
  kotak: {
    name: "Kotak Mahindra",
    color: "#ED1C24",
    bgColor: "#FDECEC",
    initials: "KM",
    accent: "#003B70",
  },
  bob: {
    name: "Bank of Baroda",
    color: "#F47721",
    bgColor: "#FEF3EA",
    initials: "BoB",
    accent: "#ED1C24",
  },
  pnb: {
    name: "Punjab National Bank",
    color: "#003580",
    bgColor: "#E6ECF4",
    initials: "PNB",
    accent: "#E31E25",
  },
  yes: {
    name: "YES Bank",
    color: "#0060AF",
    bgColor: "#E6F0FA",
    initials: "YES",
    accent: "#0060AF",
  },
  idfc: {
    name: "IDFC First",
    color: "#9C1D26",
    bgColor: "#F5E8E9",
    initials: "IDFC",
    accent: "#D4272E",
  },
  indusind: {
    name: "IndusInd Bank",
    color: "#7B2D26",
    bgColor: "#F3E8E7",
    initials: "IIB",
    accent: "#C4271C",
  },
  custom: {
    name: "Other Bank",
    color: "#6B7280",
    bgColor: "#F3F4F6",
    initials: "?",
    accent: "#374151",
  },
};

// All available bank preset IDs for the selection UI
export const BANK_PRESET_IDS = Object.keys(BANK_PRESETS).filter((id) => id !== "custom");

interface BankLogoProps {
  bankId: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  showName?: boolean;
  customColor?: string;
}

const SIZE_MAP = {
  xs: "w-6 h-6 text-[8px]",
  sm: "w-8 h-8 text-[10px]",
  md: "w-10 h-10 text-xs",
  lg: "w-14 h-14 text-sm",
};

export function BankLogo({ bankId, size = "md", className, showName, customColor }: BankLogoProps) {
  const preset = BANK_PRESETS[bankId] || BANK_PRESETS.custom;
  const color = customColor || preset.color;
  const bg = customColor ? `${customColor}18` : preset.bgColor;

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-xl font-bold shrink-0 select-none",
          SIZE_MAP[size]
        )}
        style={{
          backgroundColor: bg,
          color: color,
          boxShadow: `inset 0 0 0 1px ${color}30`,
        }}
      >
        {preset.initials}
      </div>
      {showName && (
        <span className="text-sm font-medium text-text-primary truncate">
          {preset.name}
        </span>
      )}
    </div>
  );
}

interface BankChipProps {
  bankId: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  count?: number;
  customColor?: string;
}

export function BankChip({ bankId, active, onClick, className, count, customColor }: BankChipProps) {
  const preset = BANK_PRESETS[bankId] || BANK_PRESETS.custom;
  const color = customColor || preset.color;

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200 border",
        active
          ? "shadow-sm scale-[1.02]"
          : "border-gray-200 bg-white text-text-secondary hover:border-gray-300 hover:bg-gray-50",
        className
      )}
      style={
        active
          ? {
              backgroundColor: `${color}12`,
              borderColor: `${color}40`,
              color: color,
            }
          : undefined
      }
    >
      <BankLogo bankId={bankId} size="xs" customColor={customColor} />
      <span>{preset.name}</span>
      {count !== undefined && (
        <span
          className={cn(
            "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
            active ? "bg-white/60" : "bg-gray-100 text-text-tertiary"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// Helper to resolve a bank name (from parsed description) to a preset ID
export function resolveBankPresetId(bankName: string): string {
  const lower = bankName.toLowerCase().trim();
  if (lower.includes("icici")) return "icici";
  if (lower.includes("hdfc")) return "hdfc";
  if (lower.includes("axis")) return "axis";
  if (lower.includes("sbi") || lower.includes("state bank")) return "sbi";
  if (lower.includes("kotak")) return "kotak";
  if (lower.includes("baroda") || lower === "bob") return "bob";
  if (lower.includes("pnb") || lower.includes("punjab national")) return "pnb";
  if (lower.includes("yes bank") || lower === "yes") return "yes";
  if (lower.includes("idfc")) return "idfc";
  if (lower.includes("indusind")) return "indusind";
  return "custom";
}
