import { AlertTriangle, LogOut, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { useAuthSession } from "../../hooks/useAuthSession";
import { launcherApi } from "../../services/launcherApi";
import type { LauncherSkin } from "../../types/launcher";

const licenseLabel = {
  verified: "Licença verificada",
  unverified: "Licença pendente",
  "offline-not-required": "Offline",
};

export const AccountPanel = () => {
  const { session, loginMicrosoft, loginOffline, logout } = useAuthSession();
  const skins = useQuery({
    queryKey: ["avatar", "skins"],
    queryFn: launcherApi.listSkins,
  });
  const [offlineName, setOfflineName] = useState("");
  const activeSession = session.data;
  const isSignedIn = activeSession?.status === "signed-in";
  const account = isSignedIn ? activeSession.account : null;
  const accountName =
    account?.displayName?.trim() ||
    (account?.provider === "offline" ? account.avatarLabel : "Nenhuma conta");
  const accountSubtitle = account?.provider === "microsoft" ? account.email : null;
  const equippedSkin = (skins.data ?? []).find((skin) => skin.equippedAt);
  const error =
    loginMicrosoft.error instanceof Error
      ? loginMicrosoft.error.message
      : loginOffline.error instanceof Error
        ? loginOffline.error.message
        : null;

  const submitOffline = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loginOffline.mutate({ username: offlineName });
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
              <span className="text-sm text-[#94A3B8]">Acesso</span>
              <Badge tone={account.serverAccess === "online-mode" ? "green" : "red"}>
                {account.serverAccess === "online-mode" ? "Online-mode" : "Offline-only"}
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
              onClick={() => logout.mutate()}
            >
              <LogOut className="h-4 w-4" />
              Trocar conta
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

      <Card className="border-red-400/20 bg-red-500/8 p-5">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-red-300" />
          <div>
            <p className="text-sm font-semibold text-red-100">Modo offline</p>
            <p className="mt-2 text-sm leading-6 text-red-100/75">
              Perfil offline não envia autenticação Microsoft. Servidores que exigem
              conta oficial, como Hypixel, devem bloquear a entrada.
            </p>
          </div>
        </div>
      </Card>

      {error ? (
        <Card className="border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </Card>
      ) : null}
    </div>
  );
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
  fallback,
}: {
  skin?: LauncherSkin;
  username?: string;
  fallback: string;
}) => {
  const skinUrl = skin?.imageDataUrl ?? skin?.previewUrl;
  const usernameHeadUrl =
    username?.trim() && username !== "Nenhuma conta"
      ? `https://mc-heads.net/avatar/${encodeURIComponent(username.trim())}/64`
      : "";

  if (skinUrl) {
    return (
      <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-[#1F2937] shadow-lg shadow-black/20">
        <img
          src={skinUrl}
          alt=""
          className="origin-top-left [image-rendering:pixelated]"
          style={{
            width: 512,
            height: "auto",
            transform: "translate(-64px, -64px)",
          }}
        />
      </div>
    );
  }

  if (usernameHeadUrl) {
    return (
      <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-[#1F2937] shadow-lg shadow-black/20">
        <img
          src={usernameHeadUrl}
          alt=""
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
