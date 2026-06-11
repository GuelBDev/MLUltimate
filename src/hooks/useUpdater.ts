import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { launcherApi } from "../services/launcherApi";

const updaterKey = ["updater"] as const;

export const useUpdater = () => {
  const queryClient = useQueryClient();
  const updater = useQuery({
    queryKey: updaterKey,
    queryFn: launcherApi.getUpdaterState,
  });

  useEffect(
    () =>
      launcherApi.onUpdaterState((state) => {
        queryClient.setQueryData(updaterKey, state);
      }),
    [queryClient],
  );

  const check = useMutation({
    mutationFn: launcherApi.checkForUpdates,
    onSuccess: (state) => queryClient.setQueryData(updaterKey, state),
  });

  const install = useMutation({
    mutationFn: launcherApi.installUpdate,
  });

  return { updater, check, install };
};
