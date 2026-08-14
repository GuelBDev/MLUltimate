import * as React from "react";
import { cn } from "../../utils/cn";

type BadgeTone = "blue" | "green" | "red" | "slate";

const tones: Record<BadgeTone, string> = {
  blue: "app-badge-blue",
  green: "app-badge-green",
  red: "app-badge-red",
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
