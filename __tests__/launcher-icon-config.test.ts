import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import appConfig from "../app.json";

const expoRequire = createRequire(require.resolve("expo/package.json"));
const { getPngInfo } = expoRequire("@expo/image-utils") as {
  getPngInfo(file: string): Promise<{ data: Buffer; width: number; height: number }>;
};
const { resolveAppConfig } = require("../app.config.js") as {
  resolveAppConfig(env: Record<string, string>): Pick<typeof appConfig.expo, "icon" | "android">;
};

describe("launcher identity follows the approved startup mark", () => {
  it("uses the opaque high-resolution launch mark for the common application icon", () => {
    expect(appConfig.expo.icon).toBe("./assets/generated/production/startup/vshop-app-icon-v1.png");
  });

  it("uses the padded transparent launch mark as the Android adaptive foreground", () => {
    expect(appConfig.expo.android.adaptiveIcon.foregroundImage)
      .toBe("./assets/generated/production/startup/vshop-app-icon-foreground-v1.png");
  });

  it("uses the updated gray splash while retaining the approved launcher artwork background", () => {
    const splash = appConfig.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen");
    expect(splash).toEqual(["expo-splash-screen", {
      image: "./assets/generated/production/startup/vshop-launch-mark-v1.png",
      imageWidth: 112, resizeMode: "contain", backgroundColor: "#eceef0",
    }]);
    expect(appConfig.expo.android.adaptiveIcon.backgroundColor).toBe("#f4f6f9");
  });

  it("retains the existing monochrome notification icon", () => {
    const notification = appConfig.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-notifications");
    expect(notification).toEqual(["expo-notifications", {
      icon: "./assets/images/notification-icon.png", color: "#7b838f",
    }]);
  });

  it.each([
    ["./assets/generated/production/startup/vshop-app-icon-v1.png", 2],
    ["./assets/generated/production/startup/vshop-app-icon-foreground-v1.png", 6],
  ] as const)("ships a 1024px PNG with the correct channel type at %s", (file, colorType) => {
    const png = readFileSync(resolve(__dirname, "..", file));
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(png.toString("ascii", 12, 16)).toBe("IHDR");
    expect(png.readUInt32BE(16)).toBe(1024);
    expect(png.readUInt32BE(20)).toBe(1024);
    expect(png[24]).toBe(8);
    expect(png[25]).toBe(colorType);
  });

  it("decodes an entirely opaque common icon with the startup-colored background", async () => {
    const image = await getPngInfo(resolve(__dirname, "..", appConfig.expo.icon));
    expect(image.data.length).toBe(1024 * 1024 * 4);
    let opaque = true;
    for (let i = 3; i < image.data.length; i += 4) {
      if (image.data[i] !== 255) opaque = false;
    }
    expect(opaque).toBe(true);
    expect([...image.data.subarray(0, 4)]).toEqual([244, 246, 249, 255]);
  });

  it("keeps the adaptive artwork centered inside the circular safe zone with transparent padding", async () => {
    const image = await getPngInfo(resolve(__dirname, "..", appConfig.expo.android.adaptiveIcon.foregroundImage));
    expect(image.data.length).toBe(1024 * 1024 * 4);
    let maxRadius = 0;
    let visiblePixels = 0;
    let transparentPadding = true;
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const alpha = image.data[(y * image.width + x) * 4 + 3];
        if ((x < 236 || x >= 788 || y < 236 || y >= 788) && alpha !== 0) transparentPadding = false;
        if (alpha >= 16) {
          visiblePixels += 1;
          maxRadius = Math.max(maxRadius, Math.hypot(x - 511.5, y - 511.5));
        }
      }
    }
    expect(transparentPadding).toBe(true);
    expect(visiblePixels).toBeGreaterThan(100000);
    expect(maxRadius).toBeLessThanOrEqual(1024 * 33 / 108);
  });

  it.each<Record<string, string>>([{}, { VSHOP_NATIVE_QA: "1" }])("resolves the same launcher assets in default/QA configuration %j", (env) => {
    const resolved = resolveAppConfig(env);
    expect(resolved.icon).toBe(appConfig.expo.icon);
    expect(resolved.android.adaptiveIcon).toEqual(appConfig.expo.android.adaptiveIcon);
  });
});
