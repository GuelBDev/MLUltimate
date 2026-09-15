import { useEffect, useState, useMemo, type FormEvent } from "react";
import {
  Check,
  ExternalLink,
  Loader2,
  Lock,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  UserRound,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useAuthSession } from "../../hooks/useAuthSession";
import { useAppDialog } from "../ui/appDialogContext";
import type { PublicAccount, SavedAuthAccount } from "../../types/launcher";

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: "mlultimate" | "microsoft" | "offline";
}

const mergeActiveAccount = (
  accounts: SavedAuthAccount[],
  activeAccount: PublicAccount | null | undefined,
): SavedAuthAccount[] => {
  if (!activeAccount) {
    return accounts;
  }

  const found = accounts.some(
    (account) => account.provider === activeAccount.provider && account.id === activeAccount.id,
  );

  if (found) {
    return accounts.map((account) => ({
      ...account,
      active: account.provider === activeAccount.provider && account.id === activeAccount.id,
    }));
  }

  return [{ ...activeAccount, active: true }, ...accounts];
};

export const AccountModal = ({
  open,
  onClose,
  defaultTab = "mlultimate",
}: AccountModalProps) => {
  const dialog = useAppDialog();
  const {
    session,
    accounts,
    loginMicrosoft,
    loginMlultimate,
    loginOffline,
    switchAccount,
    removeAccount,
  } = useAuthSession();

  const [activeTab, setActiveTab] = useState<"mlultimate" | "microsoft" | "offline">(defaultTab);
  const [mlultimateLogin, setMlultimateLogin] = useState("");
  const [mlultimatePassword, setMlultimatePassword] = useState("");
  const [offlineName, setOfflineName] = useState("");
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const activeSession = session.data;
  const isSignedIn = activeSession?.status === "signed-in";
  const activeAccount = isSignedIn ? activeSession.account : null;
  const savedAccounts = useMemo(
    () => mergeActiveAccount(accounts.data ?? [], activeAccount),
    [accounts.data, activeAccount],
  );

  const canAddAccount = savedAccounts.length < 3;

  // Fechar com a tecla Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Mensagem temporária de sucesso
  const triggerSuccess = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  const handleLoginMlultimate = (e: FormEvent) => {
    e.preventDefault();
    const cleanLogin = mlultimateLogin.trim();
    if (!cleanLogin || !mlultimatePassword || !canAddAccount) return;

    if (loginMlultimate.isPending) {
      loginMlultimate.reset();
    }

    loginMlultimate.mutate(
      { login: cleanLogin, password: mlultimatePassword },
      {
        onSuccess: () => {
          setMlultimatePassword("");
          triggerSuccess(`Conta MLUltimate "${cleanLogin}" conectada com sucesso!`);
        },
      },
    );
  };

  const handleLoginMicrosoft = () => {
    if (!canAddAccount) return;
    if (loginMicrosoft.isPending) {
      loginMicrosoft.reset();
    }
    loginMicrosoft.mutate(undefined, {
      onSuccess: () => {
        triggerSuccess("Conta Microsoft conectada e ativada com sucesso!");
      },
    });
  };

  const handleLoginOffline = (e: FormEvent) => {
    e.preventDefault();
    const cleanNick = offlineName.trim();
    if (!cleanNick || cleanNick.length < 3 || cleanNick.length > 16 || !canAddAccount) return;

    loginOffline.mutate(
      { username: cleanNick },
      {
        onSuccess: () => {
          setOfflineName("");
          triggerSuccess(`Conta offline "${cleanNick}" ativada com sucesso!`);
        },
      },
    );
  };

  const handleSwitch = (acc: SavedAuthAccount) => {
    if (acc.active || switchAccount.isPending) return;
    switchAccount.mutate(
      { provider: acc.provider, id: acc.id },
      {
        onSuccess: () => {
          triggerSuccess(`Perfil alternado para "${acc.displayName}".`);
        },
      },
    );
  };

  const handleRemoveAccount = async (acc: SavedAuthAccount) => {
    const providerLabel =
      acc.provider === "microsoft"
        ? "Microsoft Original"
        : acc.provider === "mlultimate"
          ? "Conta MLUltimate"
          : "Offline";

    const confirmed = await dialog.confirm({
      title: "Remover Conta?",
      description: `Deseja realmente remover a conta "${acc.displayName}" (${providerLabel}) deste launcher?`,
      confirmLabel: "Remover Conta",
      cancelLabel: "Cancelar",
      tone: "danger",
    });

    if (!confirmed) return;

    removeAccount.mutate(
      { provider: acc.provider, id: acc.id },
      {
        onSuccess: () => {
          triggerSuccess(`Conta "${acc.displayName}" removida.`);
        },
      },
    );
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-3 sm:p-6 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
        className="flex w-full max-w-5xl h-[88vh] max-h-[820px] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#0C1018]/98 text-white shadow-2xl shadow-black/80 backdrop-blur-2xl animate-in zoom-in-95 duration-200"
      >
        {/* ================================================================== */}
        {/* HEADER                                                             */}
        {/* ================================================================== */}
        <div className="relative flex shrink-0 items-center justify-between border-b border-white/10 bg-gradient-to-r from-[#141B28]/90 via-[#0F141F]/95 to-[#161F30]/90 px-6 py-4 sm:px-8 sm:py-5">
          <div className="flex items-center gap-3.5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-blue-500/30 bg-blue-500/15 text-[#60A5FA] shadow-inner">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 id="account-modal-title" className="text-lg font-bold tracking-tight text-white sm:text-xl">
                  Gerenciador de Contas
                </h2>
                <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-2.5 py-0.5 text-[10px] font-bold text-[#60A5FA]">
                  {savedAccounts.length}/3 Cadastradas
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] sm:text-sm">
                Adicione e alterne livremente entre contas <b>Originais (Microsoft)</b> e <b>Offline</b>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeAccount && (
              <div className="hidden sm:flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                <span className="font-semibold">{activeAccount.displayName}</span>
                <span className="text-[10px] text-emerald-400/70 capitalize">({activeAccount.provider})</span>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/15 hover:text-white transition"
              title="Fechar (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Feedback Success Notification Toast */}
        {actionSuccessMsg && (
          <div className="shrink-0 bg-emerald-500/20 border-b border-emerald-500/30 px-6 py-2 flex items-center justify-between text-xs text-emerald-200 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 font-medium">
              <Check className="h-4 w-4 text-emerald-400" />
              <span>{actionSuccessMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionSuccessMsg(null)}
              className="text-emerald-300/70 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ================================================================== */}
        {/* BODY (2 COLUMNS)                                                   */}
        {/* ================================================================== */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-6 p-6 sm:p-8 overflow-y-auto">
          {/* ---------------------------------------------------------------- */}
          {/* COLUMN 1: PERFIS SALVOS (md:col-span-5)                           */}
          {/* ---------------------------------------------------------------- */}
          <div className="flex flex-col gap-3.5 md:col-span-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Perfis Salvos
                </h3>
                <p className="text-[11px] text-[#94A3B8]">
                  Clique em um perfil para ativá-lo para o jogo.
                </p>
              </div>

              {/* Slot Indicator Dots */}
              <div className="flex items-center gap-1.5" title={`${savedAccounts.length} de 3 perfis ocupados`}>
                {[0, 1, 2].map((slotIdx) => {
                  const isFilled = slotIdx < savedAccounts.length;
                  return (
                    <span
                      key={slotIdx}
                      className={`h-2.5 w-2.5 rounded-full transition-all ${
                        isFilled
                          ? "bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]"
                          : "border border-white/20 bg-white/5"
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Account Cards List */}
            <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto pr-1">
              {savedAccounts.map((acc) => {
                const isCurrentActive = acc.active;

                return (
                  <div
                    key={`${acc.provider}:${acc.id}`}
                    className={`group relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200 ${
                      isCurrentActive
                        ? "border-[#60A5FA] bg-[#60A5FA]/15 shadow-lg shadow-blue-500/10 ring-1 ring-[#60A5FA]/40"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Avatar & Names */}
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={`https://mc-heads.net/avatar/${encodeURIComponent(acc.displayName)}/48`}
                          alt=""
                          className="h-10 w-10 rounded-xl [image-rendering:pixelated] border border-white/15 bg-black/40 p-0.5 shrink-0 shadow-sm"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white group-hover:text-[#60A5FA] transition-colors">
                            {acc.displayName}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {acc.provider === "microsoft" ? (
                              <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-300">
                                <MicrosoftMiniLogo />
                                <span>Microsoft Original</span>
                              </span>
                            ) : acc.provider === "mlultimate" ? (
                              <span className="flex items-center gap-1 text-[10px] font-semibold text-cyan-300">
                                <Sparkles className="h-3 w-3 text-cyan-400" />
                                <span>Conta MLUltimate</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-300">
                                <UserRound className="h-3 w-3" />
                                <span>Conta Offline</span>
                              </span>
                            )}
                          </div>
                          {acc.email && (
                            <p className="truncate text-[10px] text-[#94A3B8] mt-0.5">
                              {acc.email}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Remove / Logout Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveAccount(acc)}
                        disabled={removeAccount.isPending}
                        className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/40 hover:border-red-500/30 hover:bg-red-500/15 hover:text-red-300 transition shrink-0"
                        title={`Remover conta "${acc.displayName}"`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Bottom Status / Switch Action */}
                    <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2.5 text-xs">
                      {isCurrentActive ? (
                        <span className="flex items-center gap-1.5 font-bold text-emerald-400 text-[11px]">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                          <span>Ativa para Jogar</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSwitch(acc)}
                          disabled={switchAccount.isPending}
                          className="flex items-center gap-1.5 rounded-lg bg-blue-500/20 px-2.5 py-1 text-[11px] font-bold text-[#60A5FA] transition hover:bg-blue-500/30 active:scale-95"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          <span>Usar Esta Conta</span>
                        </button>
                      )}

                      <span className="text-[10px] text-[#94A3B8]">
                        {acc.provider === "microsoft"
                          ? "Java Edition"
                          : acc.provider === "mlultimate"
                            ? "Skins Yggdrasil"
                            : "Livre de Senha"}
                      </span>
                    </div>
                  </div>
                );
              })}

              {savedAccounts.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-xs text-[#94A3B8]">
                  <Users className="mx-auto mb-2.5 h-8 w-8 text-white/20" />
                  <p className="font-semibold text-white">Nenhum perfil salvo</p>
                  <p className="mt-1 text-[11px]">Conecte uma conta ao lado para poder jogar.</p>
                </div>
              )}

              {/* Free Slot Placeholder */}
              {canAddAccount && (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] p-3 text-center text-[11px] text-white/40">
                  + {3 - savedAccounts.length} slot(s) disponível(is) para adicionar contas
                </div>
              )}
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* COLUMN 2: ADICIONAR NOVA CONTA (md:col-span-7)                    */}
          {/* ---------------------------------------------------------------- */}
          <div className="flex flex-col gap-4 md:col-span-7">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Adicionar Nova Conta
              </h3>
              <p className="text-[11px] text-[#94A3B8]">
                Selecione o tipo de conta que deseja vincular ao MLUltimate.
              </p>
            </div>

            {/* Type Selector Tabs */}
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5">
              <button
                type="button"
                onClick={() => setActiveTab("mlultimate")}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs font-bold transition ${
                  activeTab === "mlultimate"
                    ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/25 ring-1 ring-cyan-400/50"
                    : "text-[#94A3B8] hover:bg-white/5 hover:text-white"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-cyan-300 shrink-0" />
                <span className="truncate">Conta MLUltimate</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("microsoft")}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs font-bold transition ${
                  activeTab === "microsoft"
                    ? "bg-[#3B82F6] text-white shadow-lg shadow-blue-500/20"
                    : "text-[#94A3B8] hover:bg-white/5 hover:text-white"
                }`}
              >
                <MicrosoftMiniLogo />
                <span className="truncate">Microsoft</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("offline")}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs font-bold transition ${
                  activeTab === "offline"
                    ? "bg-[#3B82F6] text-white shadow-lg shadow-blue-500/20"
                    : "text-[#94A3B8] hover:bg-white/5 hover:text-white"
                }`}
              >
                <Zap className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Offline</span>
              </button>
            </div>

            {/* TAB CONTENT: MLULTIMATE */}
            {activeTab === "mlultimate" && (
              <form
                onSubmit={handleLoginMlultimate}
                className="flex flex-col justify-between flex-1 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-[#0c1626] via-[#0b1320] to-[#070b12] p-5 sm:p-6 shadow-xl shadow-cyan-950/20 ring-1 ring-cyan-500/20"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-500/30 bg-cyan-500/15 shadow-[0_0_15px_rgba(6,182,212,0.25)] text-cyan-300">
                        <Sparkles className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-white">Conta MLUltimate</h4>
                          <span className="rounded-full bg-cyan-500/20 border border-cyan-400/40 px-2 py-0.5 text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
                            Yggdrasil
                          </span>
                        </div>
                        <p className="text-xs text-[#94A3B8]">
                          Autenticação nativa com sincronização de capas e skins.
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed text-white/80">
                    Faça login com a sua conta do site oficial do MLUltimate. Suas capas e skins personalizadas são carregadas automaticamente em qualquer versão através do authlib-injector integrado.
                  </p>

                  <div className="space-y-2 rounded-xl border border-cyan-500/15 bg-cyan-950/20 p-3 text-xs text-[#94A3B8]">
                    <div className="flex items-center gap-2 text-white/90">
                      <Check className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Skins e capas carregadas automaticamente via API MLUltimate</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/90">
                      <Check className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Compatível com todos os servidores do launcher e parceiros</span>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                        Nickname ou E-mail
                      </label>
                      <input
                        type="text"
                        value={mlultimateLogin}
                        onChange={(e) => setMlultimateLogin(e.target.value)}
                        placeholder="Ex: GuelPlayer ou seu@email.com"
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        disabled={loginMlultimate.isPending || !canAddAccount}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                        Senha
                      </label>
                      <input
                        type="password"
                        value={mlultimatePassword}
                        onChange={(e) => setMlultimatePassword(e.target.value)}
                        placeholder="Sua senha do site MLUltimate"
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        disabled={loginMlultimate.isPending || !canAddAccount}
                        required
                      />
                    </div>
                  </div>

                  {loginMlultimate.isPending && (
                    <div className="flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-200 animate-pulse">
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                      <span>Conectando aos servidores do MLUltimate...</span>
                    </div>
                  )}

                  {loginMlultimate.error instanceof Error && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                      <p className="font-bold">Erro no login MLUltimate:</p>
                      <p className="mt-0.5 text-[11px] opacity-90">{loginMlultimate.error.message}</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-white/10 space-y-3">
                  <button
                    type="submit"
                    disabled={loginMlultimate.isPending || !canAddAccount || !mlultimateLogin.trim() || !mlultimatePassword}
                    className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white transition-all duration-200 shadow-xl ${
                      canAddAccount && mlultimateLogin.trim() && mlultimatePassword
                        ? "bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 shadow-cyan-600/30 active:scale-[0.99]"
                        : "cursor-not-allowed bg-white/10 text-white/40"
                    }`}
                  >
                    {loginMlultimate.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Entrando...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-cyan-300" />
                        <span>{canAddAccount ? "Entrar com Conta MLUltimate" : "Limite de 3 Contas Atingido"}</span>
                      </>
                    )}
                  </button>

                  <div className="text-center">
                    <a
                      href="https://mlultimate-omega.vercel.app"
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-400 hover:text-amber-300 font-medium hover:underline"
                    >
                      <span>Não tem uma conta? Crie no site oficial do MLUltimate</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {!canAddAccount && (
                    <p className="text-center text-[11px] text-amber-300">
                      Remova um perfil da coluna à esquerda para liberar espaço.
                    </p>
                  )}
                </div>
              </form>
            )}

            {/* TAB CONTENT: MICROSOFT */}
            {activeTab === "microsoft" && (
              <div className="flex flex-col justify-between flex-1 rounded-2xl border border-white/10 bg-gradient-to-br from-[#121824] to-[#0D121B] p-5 sm:p-6 shadow-md">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-blue-500/20 bg-blue-500/10 shadow-inner">
                        <MicrosoftLargeLogo />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">Login Oficial Microsoft</h4>
                        <p className="text-xs text-[#94A3B8]">
                          Autenticação segura via navegador / OAuth 2.0 oficial.
                        </p>
                      </div>
                    </div>

                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                      Oficial
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed text-white/80">
                    Conecte sua conta oficial da Mojang / Microsoft para ter acesso ilimitado a todos os
                    servidores protegidos, sua skin original e capas personalizadas.
                  </p>

                  <div className="space-y-2 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-xs text-[#94A3B8]">
                    <div className="flex items-center gap-2 text-white/90">
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Sincronização automática de skins e capas oficiais</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/90">
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Acesso a servidores originais com segurança (Hypixel, Mush, etc.)</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/90">
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Seus dados são protegidos diretamente pela Microsoft</span>
                    </div>
                  </div>

                  {loginMicrosoft.isPending && (
                    <div className="flex items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-200 animate-pulse">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                      <span>Uma janela segura do navegador foi aberta para o seu login...</span>
                    </div>
                  )}

                  {loginMicrosoft.error instanceof Error && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                      <p className="font-bold">Erro no login Microsoft:</p>
                      <p className="mt-0.5 text-[11px] opacity-90">{loginMicrosoft.error.message}</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={handleLoginMicrosoft}
                    disabled={loginMicrosoft.isPending || !canAddAccount}
                    className={`flex h-12 w-full items-center justify-center gap-3 rounded-xl px-5 text-sm font-bold text-white transition-all duration-200 shadow-xl ${
                      canAddAccount
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99]"
                        : "cursor-not-allowed bg-white/10 text-white/40"
                    }`}
                  >
                    {loginMicrosoft.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Aguardando autorização...</span>
                      </>
                    ) : (
                      <>
                        <MicrosoftMiniLogo />
                        <span>{canAddAccount ? "Entrar com Conta Microsoft" : "Limite de 3 Contas Atingido"}</span>
                      </>
                    )}
                  </button>

                  {!canAddAccount && (
                    <p className="mt-2 text-center text-[11px] text-amber-300">
                      Remova um perfil da coluna à esquerda para liberar espaço.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: OFFLINE */}
            {activeTab === "offline" && (
              <form
                onSubmit={handleLoginOffline}
                className="flex flex-col justify-between flex-1 rounded-2xl border border-white/10 bg-gradient-to-br from-[#121824] to-[#0D121B] p-5 sm:p-6 shadow-md"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-amber-500/20 bg-amber-500/10 shadow-inner text-amber-400">
                        <Zap className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">Criar Perfil Offline</h4>
                        <p className="text-xs text-[#94A3B8]">
                          Jogue com qualquer nome de usuário sem necessidade de senha.
                        </p>
                      </div>
                    </div>

                    <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                      Offline
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed text-white/80">
                    Ideal para servidores comunitários sem autenticação online ou jogatinas solo.
                    Basta digitar seu nickname abaixo para começar imediatamente.
                  </p>

                  {/* Nickname Input with Live Head Preview */}
                  <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <img
                        src={`https://mc-heads.net/avatar/${encodeURIComponent(offlineName.trim() || "Steve")}/56`}
                        alt="Preview"
                        className="h-14 w-14 rounded-xl border border-white/15 bg-black/40 p-0.5 [image-rendering:pixelated] shadow-md"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                      <span className="text-[10px] text-[#94A3B8]">Visual</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-white">Nome de Jogador (Nick):</label>
                        <span className="text-[10px] text-[#94A3B8]">{offlineName.trim().length}/16</span>
                      </div>
                      <input
                        type="text"
                        value={offlineName}
                        onChange={(e) => setOfflineName(e.target.value)}
                        placeholder="Ex: GuelBait_PvP"
                        maxLength={16}
                        minLength={3}
                        disabled={loginOffline.isPending || !canAddAccount}
                        className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3.5 text-sm text-white placeholder-white/40 outline-none transition focus:border-[#60A5FA] focus:bg-white/10"
                      />
                      <p className="mt-1 text-[10px] text-[#94A3B8]">
                        Permitido de 3 a 16 caracteres (letras, números e sublinhados).
                      </p>
                    </div>
                  </div>

                  {loginOffline.isPending && (
                    <div className="flex items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-200 animate-pulse">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                      <span>Cadastrando novo perfil offline...</span>
                    </div>
                  )}

                  {loginOffline.error instanceof Error && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                      <p className="font-bold">Erro ao adicionar conta offline:</p>
                      <p className="mt-0.5 text-[11px] opacity-90">{loginOffline.error.message}</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-white/10">
                  <button
                    type="submit"
                    disabled={loginOffline.isPending || offlineName.trim().length < 3 || !canAddAccount}
                    className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white transition-all duration-200 shadow-xl ${
                      canAddAccount && offlineName.trim().length >= 3
                        ? "bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 active:scale-[0.99]"
                        : "cursor-not-allowed bg-white/10 text-white/40"
                    }`}
                  >
                    {loginOffline.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Criando perfil...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        <span>{canAddAccount ? "Adicionar e Usar Conta Offline" : "Limite de 3 Contas Atingido"}</span>
                      </>
                    )}
                  </button>

                  {!canAddAccount && (
                    <p className="mt-2 text-center text-[11px] text-amber-300">
                      Remova um perfil da coluna à esquerda para liberar espaço.
                    </p>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>

        {/* ================================================================== */}
        {/* FOOTER                                                             */}
        {/* ================================================================== */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#0B0E15] px-6 py-3.5 sm:px-8 text-xs">
          <div className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
            <Lock className="h-3.5 w-3.5 text-blue-400" />
            <span>
              Suas credenciais são salvas localmente de forma segura e criptografada pelo launcher.
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-2 text-xs font-semibold text-white transition hover:bg-white/10 hover:border-white/20 active:scale-95"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

const MicrosoftMiniLogo = () => (
  <span className="grid h-3.5 w-3.5 grid-cols-2 gap-0.5 shrink-0" aria-hidden="true">
    <span className="bg-[#F25022] rounded-[1px]" />
    <span className="bg-[#7FBA00] rounded-[1px]" />
    <span className="bg-[#00A4EF] rounded-[1px]" />
    <span className="bg-[#FFB900] rounded-[1px]" />
  </span>
);

const MicrosoftLargeLogo = () => (
  <span className="grid h-6 w-6 grid-cols-2 gap-1 shrink-0" aria-hidden="true">
    <span className="bg-[#F25022] rounded-[2px]" />
    <span className="bg-[#7FBA00] rounded-[2px]" />
    <span className="bg-[#00A4EF] rounded-[2px]" />
    <span className="bg-[#FFB900] rounded-[2px]" />
  </span>
);
