import React from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useFocusEffect } from "expo-router";

/** Keep an imperative guard as well as state so async completions see blur immediately. */
export function useCombatScreenActivity() {
  const focused = React.useRef(false);
  const appState = React.useRef(AppState.currentState);
  const [isActive, setIsActive] = React.useState(false);
  React.useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      appState.current = next;
      setIsActive(focused.current && next === "active");
    };
    onChange(AppState.currentState);
    const subscription = AppState.addEventListener("change", onChange);
    return () => { subscription.remove(); };
  }, []);
  useFocusEffect(React.useCallback(() => {
    focused.current = true;
    appState.current = AppState.currentState;
    setIsActive(appState.current === "active");
    return () => {
      focused.current = false;
      setIsActive(false);
    };
  }, []));
  const isActiveNow = React.useCallback(() => focused.current && appState.current === "active", []);
  return { isActive, isActiveNow };
}
