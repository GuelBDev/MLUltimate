import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "../../utils/cn";

type ProgressProps = {
  value: number;
  className?: string;
};

export const Progress = ({ value, className }: ProgressProps) => (
  <ProgressPrimitive.Root
    className={cn("h-2.5 overflow-hidden rounded-full bg-[color:var(--app-panel-bg)]", className)}
    value={value}
  >
    <ProgressPrimitive.Indicator
      className="app-progress-indicator h-full rounded-full transition-all duration-500"
      style={{ transform: `translateX(-${100 - Math.max(0, Math.min(100, value))}%)` }}
    />
  </ProgressPrimitive.Root>
);
