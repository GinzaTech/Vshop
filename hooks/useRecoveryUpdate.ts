import { useCallback, useEffect, useRef, useState } from "react";

import {
  startRecoveryUpdate,
  type RecoveryUpdateState,
} from "~/utils/recovery-update";

export function useRecoveryUpdate() {
  const [state, setState] = useState<RecoveryUpdateState>({ kind: "idle" });
  const mountedRef = useRef(true);
  const runningRef = useRef(false);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const checkAndApply = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      const result = await startRecoveryUpdate((nextState) => {
        if (mountedRef.current) setState(nextState);
      });
      if (mountedRef.current) setState(result);
    } finally {
      runningRef.current = false;
    }
  }, []);

  return { checkAndApply, state };
}
