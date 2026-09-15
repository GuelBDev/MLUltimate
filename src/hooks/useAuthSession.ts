import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { launcherApi } from "../services/launcherApi";
import type { MlultimateLoginInput, OfflineLoginInput, SwitchAccountInput } from "../types/launcher";

const sessionKey = ["auth", "session"] as const;
const accountsKey = ["auth", "accounts"] as const;

export const useAuthSession = () => {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: sessionKey,
    queryFn: launcherApi.getSession,
  });
  const accounts = useQuery({
    queryKey: accountsKey,
    queryFn: launcherApi.listAccounts,
  });

  const refreshAuth = (data: Awaited<ReturnType<typeof launcherApi.getSession>>) => {
    queryClient.setQueryData(sessionKey, data);
    void queryClient.invalidateQueries({ queryKey: accountsKey });
  };

  const loginMicrosoft = useMutation({
    mutationFn: launcherApi.loginMicrosoft,
    onSuccess: refreshAuth,
  });

  const loginMlultimate = useMutation({
    mutationFn: (input: MlultimateLoginInput) => launcherApi.loginMlultimate(input),
    onSuccess: refreshAuth,
  });

  const loginOffline = useMutation({
    mutationFn: (input: OfflineLoginInput) => launcherApi.loginOffline(input),
    onSuccess: refreshAuth,
  });

  const switchAccount = useMutation({
    mutationFn: (input: SwitchAccountInput) => launcherApi.switchAccount(input),
    onSuccess: refreshAuth,
  });

  const logout = useMutation({
    mutationFn: launcherApi.logout,
    onSuccess: refreshAuth,
  });

  const removeAccount = useMutation({
    mutationFn: (input: SwitchAccountInput) => launcherApi.removeAccount(input),
    onSuccess: refreshAuth,
  });

  return {
    session,
    accounts,
    loginMicrosoft,
    loginMlultimate,
    loginOffline,
    switchAccount,
    logout,
    removeAccount,
  };
};
