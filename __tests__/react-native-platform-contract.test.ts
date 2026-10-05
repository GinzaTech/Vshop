import { Platform } from "react-native";

it("exposes the React Native Platform selector required by Paper and Expo", () => {
  expect(typeof Platform.select).toBe("function");
  expect(Platform.select({ ios: "ios", android: "android", default: "default" }))
    .toBe(Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "default");
});
