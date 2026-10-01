import { Redirect, useLocalSearchParams } from "expo-router";
import LocalUiQaScreen from "~/mocks/ui-qa";
import { isDevelopmentDemoRoute } from "~/utils/demo-mode";

export default function UiQaRoute() {
  const { demo } = useLocalSearchParams<{ demo?: string | string[] }>();
  return isDevelopmentDemoRoute({ demo, isDev: __DEV__, pathname: "/ui-qa" })
    ? <LocalUiQaScreen /> : <Redirect href="/" />;
}
