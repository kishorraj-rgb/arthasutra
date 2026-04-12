"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  placeholder?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            "flex h-10 w-full rounded-lg border border-border-light bg-surface px-3 py-2 pr-9 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10 transition-colors disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer",
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" className="text-text-tertiary">
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
