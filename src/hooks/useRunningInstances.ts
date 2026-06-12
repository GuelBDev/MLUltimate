import { useEffect, useState } from "react";
import { launcherApi } from "../services/launcherApi";

export const useRunningInstances = () => {
  const [runningIds, setRunningIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let mounted = true;

    void launcherApi.listRunningInstances().then((ids) => {
      if (!mounted) {
        return;
      }

      setRunningIds(new Set(ids));
    });

    const unsubscribe = launcherApi.onLaunchEvent((event) => {
      if (event.type === "running") {
        setRunningIds((current) => new Set(current).add(event.id));
        return;
      }

      if (["closed", "killed", "cancelled", "error"].includes(event.type)) {
        setRunningIds((current) => {
          const next = new Set(current);
          next.delete(event.id);
          return next;
        });
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return {
    runningIds,
    isRunning: (instanceId: string) => runningIds.has(instanceId),
  };
};
