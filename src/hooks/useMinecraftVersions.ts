import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { launcherApi } from "../services/launcherApi";

const versionsKey = ["minecraft", "versions"] as const;

export const useMinecraftVersions = () => {
  const queryClient = useQueryClient();
  const versions = useQuery({
    queryKey: versionsKey,
    queryFn: launcherApi.listVersions,
  });

  const installVersion = useMutation({
    mutationFn: launcherApi.installVersion,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: versionsKey });
    },
  });

  return { versions, installVersion };
};
