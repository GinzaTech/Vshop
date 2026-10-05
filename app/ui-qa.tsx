import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import LocalUiQaScreen from "~/mocks/ui-qa";
import { isDevelopmentDemoRoute } from "~/utils/demo-mode";
import type { StartupPhase } from "~/constants/Startup";

export default function UiQaRoute() {
  const { demo, team, startup, recovery, phase } = useLocalSearchParams<{ demo?: string | string[]; team?: string; startup?: string; recovery?: string; phase?: string }>();
  const startupPhase: StartupPhase = phase === "session" || phase === "data" || phase === "ready" ? phase : "prepare";
  if (!isDevelopmentDemoRoute({ demo, isDev: __DEV__, pathname: "/ui-qa" })) return <Redirect href="/" />;
  return <><Stack.Screen options={{ headerShown: startup !== "1" }} />
    <LocalUiQaScreen teamPreview={team === "1"} startupPreview={startup === "1"} recoveryPreview={recovery === "1"} startupPhase={startupPhase} />
  </>;
}
