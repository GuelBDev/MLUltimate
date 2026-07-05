import * as React from "react";
import { cn } from "../../utils/cn";

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "app-card rounded-2xl border border-white/10 shadow-2xl shadow-black/20 backdrop-blur-xl",
      className,
    )}
    {...props}
  />
));

Card.displayName = "Card";
