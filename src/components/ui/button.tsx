import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 ease-spring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-gold text-white hover:bg-gold/90 shadow-gold hover:shadow-lg hover:shadow-gold/20",
        destructive: "bg-rose text-white hover:bg-rose/90",
        outline: "border border-gold/30 bg-transparent text-gold hover:bg-gold/5 hover:border-gold/50",
        secondary: "bg-surface-tertiary text-text-primary hover:bg-gray-200 border border-border",
        ghost: "text-text-secondary hover:text-text-primary hover:bg-surface-tertiary",
        link: "text-gold underline-offset-4 hover:underline",
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
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
