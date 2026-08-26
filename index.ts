import "expo-router/entry";
import * as Application from "expo-application";
import { Platform } from "react-native";
import * as Sentry from "@sentry/react";
import BackgroundFetch from "./utils/background-fetch";
import { wishlistBgTask } from "./utils/wishlist";

if (Platform.OS !== "web") {
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";
  Sentry.init({
    dsn: sentryDsn,
    enabled: Boolean(sentryDsn),
    environment:
      process.env.EXPO_PUBLIC_APP_ENV ??
      (__DEV__ ? "development" : "production"),
    release: Application.nativeApplicationVersion
      ? `vshop@${Application.nativeApplicationVersion}`
      : undefined,
    sendDefaultPii: false,
    tracesSampleRate: __DEV__ ? 0 : 0.1,
  });

  BackgroundFetch.registerHeadlessTask(async (event: {
    taskId: string;
    timeout: boolean;
  }) => {
    const taskId = event.taskId;
    const isTimeout = event.timeout;

    if (isTimeout) {
      if (__DEV__) console.log("[BackgroundFetch] Headless TIMEOUT:", taskId);
      BackgroundFetch.finish(taskId);
      return;
    }

    await wishlistBgTask();
    BackgroundFetch.finish(taskId);
  });
}
