import { createContext, useContext } from "react";

export type DialogTone = "info" | "danger" | "success" | "loading";

export type DialogRequest = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
  progress?: number;
  locked?: boolean;
};

export type AppDialogApi = {
  alert: (request: DialogRequest) => Promise<void>;
  confirm: (request: DialogRequest) => Promise<boolean>;
};

export const AppDialogContext = createContext<AppDialogApi | null>(null);

export const useAppDialog = () => {
  const context = useContext(AppDialogContext);

  if (!context) {
    throw new Error("useAppDialog must be used inside AppDialogProvider.");
  }

  return context;
};
