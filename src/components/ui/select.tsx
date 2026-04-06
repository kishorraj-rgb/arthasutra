"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  placeholder?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/10 transition-colors disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer",
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
    );
  }
);
Select.displayName = "Select";

export { Select };
