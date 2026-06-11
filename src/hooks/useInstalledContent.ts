import { useQuery } from "@tanstack/react-query";
import { launcherApi } from "../services/launcherApi";

export const useInstalledContent = (instanceId?: string) =>
  useQuery({
    queryKey: ["installed-content", instanceId],
    queryFn: () => launcherApi.listInstalledContent(instanceId ?? ""),
    enabled: Boolean(instanceId),
  });
