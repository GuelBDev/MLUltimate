import * as React from "react";
import { cn } from "../../utils/cn";

type BadgeTone = "blue" | "green" | "red" | "slate";

const tones: Record<BadgeTone, string> = {
  blue: "border-blue-400/25 bg-blue-500/12 text-blue-200",
  green: "border-green-400/25 bg-green-500/12 text-green-200",
  red: "border-red-400/25 bg-red-500/12 text-red-200",
  slate: "border-white/10 bg-white/7 text-[#94A3B8]",
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
