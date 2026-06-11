import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { launcherApi } from "../services/launcherApi";

const downloadsKey = ["downloads"] as const;

export const useDownloads = () => {
  const queryClient = useQueryClient();
  const downloads = useQuery({
    queryKey: downloadsKey,
    queryFn: launcherApi.listDownloads,
    refetchInterval: false,
  });

  useEffect(
    () =>
      launcherApi.onDownloadsChange((items) => {
        queryClient.setQueryData(downloadsKey, items);
      }),
    [queryClient],
  );

  return downloads;
};
