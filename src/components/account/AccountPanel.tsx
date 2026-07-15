import { LogOut, Plus, ShieldCheck, UserRound, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { useAppDialog } from "../ui/appDialogContext";
import { useAuthSession } from "../../hooks/useAuthSession";
import { launcherApi } from "../../services/launcherApi";
import type { LauncherSkin, PublicAccount, SavedAuthAccount } from "../../types/launcher";

const licenseLabel = {
  verified: "Licença verificada",
  unverified: "Licença pendente",
  "offline-not-required": "Offline",
};

export const AccountPanel = () => {
  const { session, accounts, loginMicrosoft, loginOffline, switchAccount, logout } = useAuthSession();
  const dialog = useAppDialog();
  const skins = useQuery({
    queryKey: ["avatar", "skins"],
    queryFn: launcherApi.listSkins,
  });
  const [offlineName, setOfflineName] = useState("");
  const [showSwitcher, setShowSwitcher] = useState(false);
  const activeSession = session.data;
  const isSignedIn = activeSession?.status === "signed-in";
  const account = isSignedIn ? activeSession.account : null;
  const savedAccounts = mergeActiveAccount(accounts.data ?? [], account);
  const canAddAccount = savedAccounts.length < 3;
  const accountName =
    account?.provider === "offline"
      ? account.displayName
      : account?.displayName?.trim() || "Nenhuma conta";
  const accountSubtitle = account?.provider === "microsoft" ? account.email : null;
  const equippedSkin = (skins.data ?? []).find((skin) => skin.equippedAt);
  const error =
    loginMicrosoft.error instanceof Error
      ? loginMicrosoft.error.message
      : loginOffline.error instanceof Error
        ? loginOffline.error.message
        : switchAccount.error instanceof Error
          ? switchAccount.error.message
          : null;

  const submitOffline = (event: FormEvent<HTMLFormElement>, closeAfterLogin = false) => {
    event.preventDefault();
    loginOffline.mutate(
      { username: offlineName },
      {
        onSuccess: () => {
          setOfflineName("");
          if (closeAfterLogin) {
            setShowSwitcher(false);
          }
        },
      },
    );
  };

  const confirmLogout = async () => {
    const confirmed = await dialog.confirm({
      title: "Sair da conta?",
      description: account
        ? `A conta ${account.displayName} sera removida deste launcher.`
        : "A conta ativa sera removida deste launcher.",
      confirmLabel: "Sair da conta",
      cancelLabel: "Cancelar",
      tone: "danger",
    });

    if (confirmed) {
      logout.mutate();
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Conta do jogo</p>
            <p className="mt-1 text-xs text-[#94A3B8]">Microsoft ou offline</p>
          </div>
          <ShieldCheck className="h-5 w-5 text-[#22C55E]" />
        </div>

        <div className="mt-5 flex items-center gap-4">
          <MinecraftHead
            skin={equippedSkin}
            username={account?.displayName}
            accountSkinDataUrl={account?.skinDataUrl}
            fallback={account?.avatarLabel ?? "ML"}
          />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-white">
              {accountName}
            </p>
            {accountSubtitle ? (
              <p className="mt-1 truncate text-sm text-[#94A3B8]">
                {accountSubtitle}
              </p>
            ) : null}
          </div>
        </div>

        {account ? (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <span className="text-sm text-[#94A3B8]">Modo</span>
              <Badge tone={account.provider === "microsoft" ? "blue" : "slate"}>
                {account.provider === "microsoft" ? "Microsoft" : "Offline"}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <span className="text-sm text-[#94A3B8]">Licença</span>
              <Badge tone={account.license.status === "verified" ? "green" : "slate"}>
                {licenseLabel[account.license.status]}
              </Badge>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => setShowSwitcher(true)}
            >
              <UserRound className="h-4 w-4" />
              Alternar conta
            </Button>
            <Button
              type="button"
              variant="danger"
              className="w-full"
              onClick={confirmLogout}
              disabled={logout.isPending}
            >
              <LogOut className="h-4 w-4" />
              Sair da conta
            </Button>

          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                if (loginMicrosoft.isPending) {
                  loginMicrosoft.reset();
                }
                loginMicrosoft.mutate();
              }}
            >
              <MicrosoftIcon />
              {loginMicrosoft.isPending ? "Tentar login novamente" : "Entrar com Microsoft"}
            </Button>

            <form className="space-y-3" onSubmit={submitOffline}>
              <input
                value={offlineName}
                onChange={(event) => setOfflineName(event.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-[#0D1117] px-3 text-sm text-white outline-none transition placeholder:text-[#94A3B8] focus:border-[#60A5FA]/70"
                placeholder="Nome offline"
                minLength={3}
                maxLength={16}
              />
              <Button
                type="submit"
                variant="secondary"
                className="w-full"
                disabled={loginOffline.isPending || offlineName.trim().length < 3}
              >
                Usar modo offline
              </Button>
              <p className="text-xs leading-5 text-[#94A3B8]">
                O Play só libera offline depois que você salvar um nick válido.
              </p>
            </form>
          </div>
        )}
      </Card>

      {error ? (
        <Card className="border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </Card>
      ) : null}

      {showSwitcher ? (
        <AccountSwitcherDialog
          accounts={savedAccounts}
          canAddAccount={canAddAccount}
          offlineName={offlineName}
          setOfflineName={setOfflineName}
          isAddingMicrosoft={loginMicrosoft.isPending}
          isAddingOffline={loginOffline.isPending}
          isSwitching={switchAccount.isPending}
          onClose={() => setShowSwitcher(false)}
          onAddMicrosoft={() =>
            loginMicrosoft.mutate(undefined, {
              onSuccess: () => setShowSwitcher(false),
            })
          }
          onAddOffline={(event) => submitOffline(event, true)}
          onSwitch={(savedAccount) =>
            switchAccount.mutate(
              {
                provider: savedAccount.provider,
                id: savedAccount.id,
              },
              {
                onSuccess: () => setShowSwitcher(false),
              },
            )
          }
        />
      ) : null}
    </div>
  );
};

const AccountSwitcherDialog = ({
  accounts,
  canAddAccount,
  offlineName,
  setOfflineName,
  isAddingMicrosoft,
  isAddingOffline,
  isSwitching,
  onClose,
  onAddMicrosoft,
  onAddOffline,
  onSwitch,
}: {
  accounts: SavedAuthAccount[];
  canAddAccount: boolean;
  offlineName: string;
  setOfflineName: (value: string) => void;
  isAddingMicrosoft: boolean;
  isAddingOffline: boolean;
  isSwitching: boolean;
  onClose: () => void;
  onAddMicrosoft: () => void;
  onAddOffline: (event: FormEvent<HTMLFormElement>) => void;
  onSwitch: (account: SavedAuthAccount) => void;
}) => (
  <div className="fixed inset-0 z-[85] grid place-items-center bg-black/68 px-4 text-white backdrop-blur-md">
    <section className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/12 bg-[#161B22]/96 shadow-2xl shadow-black/50">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
        <div>
          <h2 className="text-lg font-semibold text-white">Alternar conta</h2>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Escolha um perfil salvo ou entre em uma nova conta.
          </p>
        </div>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-xl text-[#94A3B8] transition hover:bg-white/8 hover:text-white"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-5 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">Perfis salvos</p>
          <Badge tone={accounts.length >= 3 ? "slate" : "blue"}>{accounts.length}/3</Badge>
        </div>

        <div className="grid gap-2">
          {accounts.length ? (
            accounts.map((savedAccount) => (
              <button
                key={`${savedAccount.provider}:${savedAccount.id}`}
                type="button"
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition ${
                  savedAccount.active
                    ? "cursor-default border-white/10 bg-[#0D1117]/40 opacity-55"
                    : "border-white/10 bg-[#0D1117]/70 hover:border-[#60A5FA]/60 hover:bg-white/[0.045]"
                }`}
                onClick={() => !savedAccount.active && onSwitch(savedAccount)}
                disabled={savedAccount.active || isSwitching}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">
                    {savedAccount.displayName}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[#94A3B8]">
                    {savedAccount.provider === "microsoft"
                      ? savedAccount.email ?? "Microsoft"
                      : "Offline"}
                  </span>
                </span>
                <Badge tone={savedAccount.active ? "green" : "slate"}>
                  {savedAccount.active ? "Atual" : "Entrar"}
                </Badge>
              </button>
            ))
          ) : (
            <div className="rounded-xl border border-white/10 bg-[#0D1117]/70 px-3 py-4 text-sm text-[#94A3B8]">
              Nenhum perfil salvo ainda.
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-white/10 pt-5">
          <p className="text-sm font-semibold text-white">Entrar em nova conta</p>
          {canAddAccount ? (
            <>
              <Button
                type="button"
                className="w-full"
                onClick={onAddMicrosoft}
                disabled={isAddingMicrosoft}
              >
                <Plus className="h-4 w-4" />
                Nova conta Microsoft
              </Button>
              <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={onAddOffline}>
                <input
                  value={offlineName}
                  onChange={(event) => setOfflineName(event.target.value)}
                  className="h-11 min-w-0 rounded-xl border border-white/10 bg-[#0D1117] px-3 text-sm text-white outline-none transition placeholder:text-[#94A3B8] focus:border-[#60A5FA]/70"
                  placeholder="Novo nome offline"
                  minLength={3}
                  maxLength={16}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={isAddingOffline || offlineName.trim().length < 3}
                >
                  <Plus className="h-4 w-4" />
                  Offline
                </Button>
              </form>
            </>
          ) : (
            <p className="rounded-xl border border-white/10 bg-[#0D1117]/70 px-3 py-3 text-sm text-[#94A3B8]">
              Limite de 3 perfis atingido. Saia de uma conta para adicionar outra.
            </p>
          )}
        </div>
      </div>
    </section>
  </div>
);

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

const MicrosoftIcon = () => (
  <span className="grid h-4 w-4 grid-cols-2 gap-0.5" aria-hidden="true">
    <span className="bg-[#F25022]" />
    <span className="bg-[#7FBA00]" />
    <span className="bg-[#00A4EF]" />
    <span className="bg-[#FFB900]" />
  </span>
);

const MinecraftHead = ({
  skin,
  username,
  accountSkinDataUrl,
  fallback,
}: {
  skin?: LauncherSkin;
  username?: string;
  accountSkinDataUrl?: string;
  fallback: string;
}) => {
  const [failedUrl, setFailedUrl] = useState("");
  const skinUrl = skin?.imageDataUrl ?? skin?.previewUrl ?? accountSkinDataUrl;
  const usernameHeadUrl =
    username?.trim() && username !== "Nenhuma conta"
      ? `https://mc-heads.net/avatar/${encodeURIComponent(username.trim())}/64`
      : "";

  if (skinUrl && failedUrl !== skinUrl) {
    return (
      <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-[#1F2937] shadow-lg shadow-black/20">
        <img
          src={skinUrl}
          alt=""
          onError={() => setFailedUrl(skinUrl)}
          className="max-w-none origin-top-left [image-rendering:pixelated]"
          style={{
            width: 512,
            maxWidth: "none",
            height: "auto",
            transform: "translate(-64px, -64px)",
          }}
        />
      </div>
    );
  }

  if (usernameHeadUrl && failedUrl !== usernameHeadUrl) {
    return (
      <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-[#1F2937] shadow-lg shadow-black/20">
        <img
          src={usernameHeadUrl}
          alt=""
          onError={() => setFailedUrl(usernameHeadUrl)}
          className="h-full w-full object-cover [image-rendering:pixelated]"
        />
      </div>
    );
  }

  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-[#1F2937] text-lg font-bold text-white shadow-lg shadow-black/20">
      {fallback}
    </div>
  );
};
