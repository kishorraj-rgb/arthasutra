import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-accent/20 bg-accent/10 text-accent-light",
        success: "border-emerald/20 bg-emerald/10 text-emerald",
        destructive: "border-rose/20 bg-rose/10 text-rose",
        warning: "border-amber-500/20 bg-amber-500/10 text-amber-400",
        secondary: "border-border bg-surface-tertiary text-text-secondary",
        outline: "border-border text-text-secondary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
