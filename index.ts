

import "expo-router/entry";
import { Platform } from "react-native";
import BackgroundFetch from "./utils/background-fetch";
import { wishlistBgTask } from "./utils/wishlist";

if (Platform.OS !== "web") {
  BackgroundFetch.registerHeadlessTask(async (event: {
    taskId: string;
    timeout: boolean;
  }) => {
    const taskId = event.taskId;
    const isTimeout = event.timeout;

    if (isTimeout) {
      console.log("[BackgroundFetch] Headless TIMEOUT:", taskId);
      BackgroundFetch.finish(taskId);
      return;
    }

    await wishlistBgTask();
    BackgroundFetch.finish(taskId);
  });
}
