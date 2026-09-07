import { useEffect, useState } from "react";
import { launcherApi } from "../services/launcherApi";
import type { LaunchEvent } from "../types/launcher";

type Listener = (events: Record<string, LaunchEvent>) => void;

let globalLaunchEvents: Record<string, LaunchEvent> = {};
const listeners = new Set<Listener>();
let isInitialized = false;

const notifyListeners = () => {
  for (const listener of listeners) {
    listener(globalLaunchEvents);
  }
};

const setupGlobalLaunchListener = () => {
  if (isInitialized) return;
  isInitialized = true;

  // Hydrate from active launches on backend
  void launcherApi.getAllActiveLaunches().then((active) => {
    if (active && Object.keys(active).length > 0) {
      globalLaunchEvents = { ...globalLaunchEvents, ...active };
      notifyListeners();
    }
  });

  // Listen to IPC stream
  launcherApi.onLaunchEvent((event) => {
    globalLaunchEvents = { ...globalLaunchEvents, [event.id]: event };
    notifyListeners();

    if (["complete", "cancelled", "closed", "killed"].includes(event.type)) {
      window.setTimeout(() => {
        if (globalLaunchEvents[event.id]?.createdAt === event.createdAt) {
          const next = { ...globalLaunchEvents };
          delete next[event.id];
          globalLaunchEvents = next;
          notifyListeners();
        }
      }, 1800);
    }
  });
};

export const useLaunchEvents = () => {
  const [events, setEvents] = useState<Record<string, LaunchEvent>>(() => {
    setupGlobalLaunchListener();
    return globalLaunchEvents;
  });

  useEffect(() => {
    setupGlobalLaunchListener();

    const listener: Listener = (nextEvents) => {
      setEvents(nextEvents);
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const getLaunchEvent = (instanceId: string): LaunchEvent | null => {
    return events[instanceId] ?? null;
  };

  const isLaunching = (instanceId: string): boolean => {
    const ev = events[instanceId];
    return Boolean(ev && ["step", "console", "security"].includes(ev.type));
  };

  const cancelLaunch = (instanceId: string) => {
    return launcherApi.cancel({ instanceId });
  };

  return {
    launchEvents: events,
    getLaunchEvent,
    isLaunching,
    cancelLaunch,
  };
};
