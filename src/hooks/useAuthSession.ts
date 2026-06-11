import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { launcherApi } from "../services/launcherApi";
import type { OfflineLoginInput } from "../types/launcher";

const sessionKey = ["auth", "session"] as const;

export const useAuthSession = () => {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: sessionKey,
    queryFn: launcherApi.getSession,
  });

  const loginMicrosoft = useMutation({
    mutationFn: launcherApi.loginMicrosoft,
    onSuccess: (data) => queryClient.setQueryData(sessionKey, data),
  });

  const loginOffline = useMutation({
    mutationFn: (input: OfflineLoginInput) => launcherApi.loginOffline(input),
    onSuccess: (data) => queryClient.setQueryData(sessionKey, data),
  });

  const logout = useMutation({
    mutationFn: launcherApi.logout,
    onSuccess: (data) => queryClient.setQueryData(sessionKey, data),
  });

  return {
    session,
    loginMicrosoft,
    loginOffline,
    logout,
  };
};
