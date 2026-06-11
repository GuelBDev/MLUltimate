import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "../../utils/cn";

type ProgressProps = {
  value: number;
  className?: string;
};

export const Progress = ({ value, className }: ProgressProps) => (
  <ProgressPrimitive.Root
    className={cn("h-2.5 overflow-hidden rounded-full bg-white/8", className)}
    value={value}
  >
    <ProgressPrimitive.Indicator
      className="h-full rounded-full bg-[#3B82F6] shadow-[0_0_20px_rgba(59,130,246,0.55)] transition-all duration-500"
      style={{ transform: `translateX(-${100 - Math.max(0, Math.min(100, value))}%)` }}
    />
  </ProgressPrimitive.Root>
);
