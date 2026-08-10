import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../utils/cn";

export type AppSelectOption<T extends string = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export type AppSelectProps<T extends string = string> = {
  value: T;
  onChange: (value: T) => void;
  options: AppSelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  "data-i18n-skip"?: boolean | string;
};

const ALL_TOKEN = "__all_options__";

export function AppSelect<T extends string = string>({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  triggerClassName,
  contentClassName,
  "data-i18n-skip": dataI18nSkip,
}: AppSelectProps<T>) {
  const safeValue = value === "" ? ALL_TOKEN : value;
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <Select.Root
      value={safeValue}
      onValueChange={(val) => onChange((val === ALL_TOKEN ? "" : val) as T)}
      disabled={disabled || options.length === 0}
    >
      <Select.Trigger
        data-i18n-skip={dataI18nSkip}
        className={cn(
          "inline-flex h-11 items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0D1117]/90 px-3 text-sm text-white transition hover:border-white/20 focus:border-[color:var(--app-primary)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          triggerClassName,
          className,
        )}
      >
        <Select.Value placeholder={placeholder}>
          {selectedOption ? selectedOption.label : placeholder || (value === "" ? "" : value)}
        </Select.Value>
        <Select.Icon className="text-white/60">
          <ChevronDown className="h-4 w-4 transition-transform duration-200" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          data-i18n-skip={dataI18nSkip}
          className={cn(
            "z-[9999] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-white/15 bg-[#121824]/95 p-1.5 shadow-2xl shadow-black/70 backdrop-blur-xl animate-in fade-in-0 zoom-in-95",
            contentClassName,
          )}
          position="popper"
          sideOffset={5}
        >
          <Select.ScrollUpButton className="flex items-center justify-center py-1 text-white/60">
            <ChevronUp className="h-4 w-4" />
          </Select.ScrollUpButton>

          <Select.Viewport className="max-h-[300px] p-1">
            {options.map((option, idx) => {
              const optValue = option.value === "" ? ALL_TOKEN : option.value;
              return (
                <Select.Item
                  key={optValue || idx}
                  value={optValue}
                  disabled={option.disabled}
                  className="relative flex cursor-pointer select-none items-center rounded-xl py-2.5 pl-8 pr-4 text-sm text-white/90 outline-none transition data-[disabled]:pointer-events-none data-[highlighted]:bg-[rgb(var(--app-primary-rgb)/0.25)] data-[highlighted]:text-white data-[state=checked]:font-semibold data-[state=checked]:text-white data-[disabled]:opacity-40"
                >
                  <Select.ItemIndicator className="absolute left-2.5 inline-flex items-center justify-center text-[color:var(--app-primary)]">
                    <Check className="h-4 w-4" />
                  </Select.ItemIndicator>
                  <Select.ItemText>{option.label}</Select.ItemText>
                </Select.Item>
              );
            })}
          </Select.Viewport>

          <Select.ScrollDownButton className="flex items-center justify-center py-1 text-white/60">
            <ChevronDown className="h-4 w-4" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
