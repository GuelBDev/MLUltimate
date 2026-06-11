import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[#3B82F6] text-white shadow-lg shadow-blue-500/20 hover:bg-[#60A5FA]",
        secondary:
          "border border-white/10 bg-white/6 text-white hover:border-[#60A5FA]/50 hover:bg-white/10",
        ghost: "text-[#94A3B8] hover:bg-white/8 hover:text-white",
        danger:
          "border border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/20",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-11 px-4",
        lg: "h-14 px-6 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);

Button.displayName = "Button";
