import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { launcherApi } from "../services/launcherApi";
import type { CreateInstanceInput, ImportInstanceInput, UpdateInstanceInput } from "../types/launcher";

const instancesKey = ["instances"] as const;

export const useInstances = () => {
  const queryClient = useQueryClient();
  const instances = useQuery({
    queryKey: instancesKey,
    queryFn: launcherApi.listInstances,
  });

  const createInstance = useMutation({
    mutationFn: (input: CreateInstanceInput) => launcherApi.createInstance(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: instancesKey });
      void queryClient.invalidateQueries({ queryKey: ["minecraft", "versions"] });
    },
  });

  const removeInstance = useMutation({
    mutationFn: launcherApi.removeInstance,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: instancesKey });
    },
  });

  const updateInstance = useMutation({
    mutationFn: (input: UpdateInstanceInput) => launcherApi.updateInstance(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: instancesKey });
    },
  });

  const openFolder = useMutation({
    mutationFn: launcherApi.openInstanceFolder,
  });

  const importInstance = useMutation({
    mutationFn: (input: ImportInstanceInput) => launcherApi.importInstance(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: instancesKey });
      void queryClient.invalidateQueries({ queryKey: ["downloads"] });
    },
  });

  return { instances, createInstance, updateInstance, removeInstance, openFolder, importInstance };
};
