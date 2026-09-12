import { useCallback, useEffect, useRef } from "react";
import { runIdleSequence, type IdleTask } from "~/utils/idle-task";
import { MOTION_DURATION } from "~/constants/Motion";

type Route = { key: string; name: string };
export type TabTransitionNavigation = {
  addListener: (
    type: "transitionStart" | "transitionEnd",
    listener: (event: { target?: string }) => void,
  ) => () => void;
};

/** Keep mounts out of transitions, including Back/programmatic navigation. */
export function usePrimaryTabPreload({
  routes,
  activeKey,
  enabled,
  preload,
  descriptors,
}: {
  routes: readonly Route[];
  activeKey: string;
  enabled: boolean;
  preload?: (name: string) => void;
  descriptors: Record<string, { navigation?: TabTransitionNavigation }>;
}) {
  const latest = useRef({ routes, activeKey, enabled, preload });
  const loaded = useRef(new Set<string>());
  const transitionTarget = useRef<string | null>(null);
  const task = useRef<IdleTask | undefined>(undefined);
  const noTransitionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const transitionStarted = useRef(false);
  const routeKeys = routes.map((route) => route.key).join("|");

  const schedule = useCallback(() => {
    task.current?.cancel();
    const current = latest.current;
    if (!current.enabled || !current.preload || transitionTarget.current) return;
    task.current = runIdleSequence(current.routes
      .filter((route) => route.key !== current.activeKey && !loaded.current.has(route.key))
      .map((route) => () => {
        const next = latest.current;
        if (!next.enabled || transitionTarget.current || !next.preload ||
            route.key === next.activeKey || loaded.current.has(route.key)) return;
        loaded.current.add(route.key);
        next.preload(route.name);
      }));
  }, []);

  const pause = useCallback((key: string) => {
    transitionTarget.current = key;
    transitionStarted.current = false;
    task.current?.cancel();
    task.current = undefined;
    clearTimeout(noTransitionTimer.current);
    // A->B->A in one React batch can leave the route unchanged, so the
    // navigator emits no transitionEnd. Only settle that no-transition case.
    noTransitionTimer.current = setTimeout(() => {
      if (transitionTarget.current === key && !transitionStarted.current &&
          latest.current.activeKey === key) {
        transitionTarget.current = null;
        schedule();
      }
    }, MOTION_DURATION.standard);
  }, [schedule]);

  useEffect(() => {
    latest.current = { routes, activeKey, enabled, preload };
    loaded.current.add(activeKey);
  }, [routes, activeKey, enabled, preload]);

  // Navigation/descriptors can change identity on each state update. Rebind
  // listeners without restarting the mount queue or forgetting its progress.
  useEffect(() => {
    const unsubscribe = Object.entries(descriptors).flatMap(([key, descriptor]) => {
      if (!descriptor.navigation) return [];
      return [
        descriptor.navigation.addListener("transitionStart", () => {
          pause(key);
          transitionStarted.current = true;
          clearTimeout(noTransitionTimer.current);
        }),
        descriptor.navigation.addListener("transitionEnd", () => {
          if (transitionTarget.current !== key || latest.current.activeKey !== key) return;
          transitionTarget.current = null;
          clearTimeout(noTransitionTimer.current);
          schedule();
        }),
      ];
    });
    return () => unsubscribe.forEach((remove) => remove());
  }, [descriptors, pause, schedule]);

  useEffect(() => {
    schedule();
  }, [routeKeys, enabled, schedule]);

  useEffect(() => () => {
    task.current?.cancel();
    clearTimeout(noTransitionTimer.current);
  }, []);
  return pause;
}
