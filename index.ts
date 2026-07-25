import "expo-router/entry";
import { Platform } from "react-native";
import * as Sentry from "@sentry/react";
import BackgroundFetch from "./utils/background-fetch";
import { wishlistBgTask } from "./utils/wishlist";

if (Platform.OS !== "web") {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? "",
  } as any);

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
