import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { launcherApi } from "../services/launcherApi";

const trashKey = ["trash-instances"] as const;

export const useTrash = () => {
  const queryClient = useQueryClient();

  const trashList = useQuery({
    queryKey: trashKey,
    queryFn: launcherApi.listTrash,
  });

  const restoreTrash = useMutation({
    mutationFn: (trashId: string) => launcherApi.restoreTrash(trashId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: trashKey });
      void queryClient.invalidateQueries({ queryKey: ["instances"] });
    },
  });

  const deleteTrash = useMutation({
    mutationFn: (trashIds: string[]) => launcherApi.deleteTrash(trashIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: trashKey });
    },
  });

  const emptyTrash = useMutation({
    mutationFn: () => launcherApi.emptyTrash(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: trashKey });
    },
  });

  return {
    trashList,
    restoreTrash,
    deleteTrash,
    emptyTrash,
  };
};
