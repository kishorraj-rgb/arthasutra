"use client";

import { cn } from "@/lib/utils";

interface CreditCardVisualProps {
  cardName: string;
  last4: string;
  network: "visa" | "mastercard" | "rupay" | "amex";
  issuer: string;
  color?: string;
  className?: string;
}

const NETWORK_LABELS: Record<string, string> = {
  visa: "VISA",
  mastercard: "Mastercard",
  rupay: "RuPay",
  amex: "AMEX",
};

const ISSUER_COLORS: Record<string, string> = {
  "HDFC Bank": "from-blue-900 via-blue-800 to-blue-700",
  "ICICI Bank": "from-orange-700 via-orange-600 to-amber-600",
  "SBI": "from-blue-700 via-blue-600 to-sky-500",
  "State Bank of India": "from-blue-700 via-blue-600 to-sky-500",
  "Axis Bank": "from-rose-800 via-rose-700 to-pink-600",
  "Kotak": "from-red-700 via-red-600 to-red-500",
  "Kotak Mahindra": "from-red-700 via-red-600 to-red-500",
  "IDFC First": "from-red-800 via-red-700 to-rose-600",
  "IndusInd": "from-indigo-800 via-indigo-700 to-violet-600",
  "Yes Bank": "from-blue-800 via-blue-700 to-indigo-600",
  "RBL Bank": "from-amber-700 via-amber-600 to-yellow-500",
  "American Express": "from-slate-700 via-slate-600 to-gray-500",
  "Citi": "from-blue-600 via-blue-500 to-sky-400",
  "HSBC": "from-red-800 via-red-700 to-red-600",
  "Standard Chartered": "from-teal-800 via-teal-700 to-emerald-600",
  "AU Small Finance": "from-orange-800 via-orange-700 to-amber-600",
  "BOB": "from-orange-600 via-orange-500 to-amber-400",
  "Bank of Baroda": "from-orange-600 via-orange-500 to-amber-400",
  "Federal Bank": "from-blue-800 via-yellow-500 to-blue-600",
  "OneCard": "from-slate-900 via-zinc-800 to-neutral-700",
};

function getGradient(issuer: string, color?: string): string {
  if (color) return "";
  for (const [key, gradient] of Object.entries(ISSUER_COLORS)) {
    if (issuer.toLowerCase().includes(key.toLowerCase())) return gradient;
  }
  return "from-gray-800 via-gray-700 to-gray-600";
}

function VisaIcon() {
  return (
    <svg viewBox="0 0 48 16" className="h-5 w-auto fill-white/90">
      <text x="0" y="13" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="14" fontStyle="italic">
        VISA
      </text>
    </svg>
  );
}

function MastercardIcon() {
  return (
    <svg viewBox="0 0 40 24" className="h-6 w-auto">
      <circle cx="14" cy="12" r="10" fill="#EB001B" opacity="0.9" />
      <circle cx="26" cy="12" r="10" fill="#F79E1B" opacity="0.9" />
      <path d="M20 4.5a9.95 9.95 0 0 1 3.6 7.5 9.95 9.95 0 0 1-3.6 7.5 9.95 9.95 0 0 1-3.6-7.5A9.95 9.95 0 0 1 20 4.5z" fill="#FF5F00" opacity="0.9" />
    </svg>
  );
}

function RupayIcon() {
  return (
    <svg viewBox="0 0 56 16" className="h-4 w-auto">
      <text x="0" y="13" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="12" fill="white" opacity="0.9">
        RuPay
      </text>
    </svg>
  );
}

function AmexIcon() {
  return (
    <svg viewBox="0 0 48 16" className="h-5 w-auto">
      <text x="0" y="13" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="11" fill="white" opacity="0.9">
        AMEX
      </text>
    </svg>
  );
}

const NETWORK_ICONS: Record<string, () => JSX.Element> = {
  visa: VisaIcon,
  mastercard: MastercardIcon,
  rupay: RupayIcon,
  amex: AmexIcon,
};

export function CreditCardVisual({
  cardName,
  last4,
  network,
  issuer,
  color,
  className,
}: CreditCardVisualProps) {
  const gradient = getGradient(issuer, color);
  const NetworkIcon = NETWORK_ICONS[network] ?? VisaIcon;

  return (
    <div
      className={cn(
        "relative aspect-[1.586/1] w-full max-w-[320px] rounded-xl p-5 text-white shadow-xl overflow-hidden",
        "transition-transform duration-300 hover:scale-[1.02]",
        "transform-gpu",
        !color && `bg-gradient-to-br ${gradient}`,
        className
      )}
      style={
        color
          ? {
              background: `linear-gradient(135deg, ${color}, ${color}dd, ${color}bb)`,
            }
          : undefined
      }
    >
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/20 -translate-y-10 translate-x-10" />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/10 translate-y-8 -translate-x-8" />
      </div>

      <div className="relative h-full flex flex-col justify-between">
        {/* Top row: issuer + network */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/60 font-medium">
              {issuer}
            </p>
          </div>
          <NetworkIcon />
        </div>

        {/* Card chip */}
        <div className="my-2">
          <div className="w-10 h-7 rounded-md bg-gradient-to-br from-amber-300/80 to-amber-500/80 border border-amber-400/30 flex items-center justify-center">
            <div className="w-6 h-4 rounded-sm border border-amber-600/40" />
          </div>
        </div>

        {/* Card number */}
        <div className="space-y-3">
          <p className="font-mono text-base tracking-[0.2em] text-white/90">
            {"•••• •••• •••• "}
            {last4}
          </p>

          {/* Bottom row: name + network label */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-white/50 mb-0.5">
                Card Name
              </p>
              <p className="text-xs font-medium tracking-wide text-white/90 uppercase truncate max-w-[180px]">
                {cardName}
              </p>
            </div>
            <p className="text-[10px] font-semibold tracking-wider text-white/60 uppercase">
              {NETWORK_LABELS[network]}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
