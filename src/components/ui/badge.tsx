import * as React from "react";
import { cn } from "../../utils/cn";

type BadgeTone = "blue" | "green" | "red" | "slate";

const tones: Record<BadgeTone, string> = {
  blue: "app-badge-blue",
  green: "border-green-400/25 bg-green-500/12 text-green-200",
  red: "border-red-400/25 bg-red-500/12 text-red-200",
  slate: "app-badge-slate",
};

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export const Badge = ({ className, tone = "slate", ...props }: BadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
      tones[tone],
      className,
    )}
    {...props}
  />
);
