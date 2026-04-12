"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const buttonVariants = cva(
  "relative overflow-hidden inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-accent text-white hover:bg-accent/90 shadow-sm btn-click",
        destructive: "bg-rose text-white hover:bg-rose/90 btn-click",
        outline: "border border-gray-200 bg-transparent text-accent hover:bg-accent/5 hover:border-accent/30 btn-click",
        secondary: "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 btn-click",
        ghost: "text-gray-600 hover:text-gray-900 hover:bg-gray-50 btn-click",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-lg px-3.5",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onMouseDown, ...props }, ref) => {
    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Create ripple effect
      const button = e.currentTarget;
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dim = Math.max(rect.width, rect.height);

      const ripple = document.createElement("span");
      ripple.className = "ripple-effect";
      ripple.style.width = `${dim}px`;
      ripple.style.height = `${dim}px`;
      ripple.style.left = `${x - dim / 2}px`;
      ripple.style.top = `${y - dim / 2}px`;
      button.appendChild(ripple);

      setTimeout(() => ripple.remove(), 600);

      onMouseDown?.(e);
    };

    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref as React.Ref<HTMLElement>}
          {...props}
        />
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onMouseDown={handleMouseDown}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
