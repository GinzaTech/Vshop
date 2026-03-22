import { Platform } from "react-native";

import { isExpoGo } from "./runtime";

const fallbackBackgroundFetch = {
  NETWORK_TYPE_ANY: 0,
  registerHeadlessTask: () => {},
  finish: () => {},
  configure: async () => 0,
  stop: async () => {},
};

const BackgroundFetch =
  Platform.OS === "web" || isExpoGo
    ? fallbackBackgroundFetch
    : require("react-native-background-fetch").default;

export default BackgroundFetch;
