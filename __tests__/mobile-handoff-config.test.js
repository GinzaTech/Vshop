/* eslint-env jest, node */

const appJson = require("../app.json");
const {
  applyDesktopHandoffManifest,
  isDesktopHandoffBuild,
  renderDesktopHandoffNetworkSecurity,
} = require("../plugins/withDesktopHandoff.cjs");

describe("desktop handoff Android config", () => {
  test("ordinary config stays closed", () => {
    const manifest = {
      manifest: {
        $: {},
        application: [{ $: { "android:allowBackup": "false" } }],
      },
    };
    expect(isDesktopHandoffBuild({})).toBe(false);
    expect(applyDesktopHandoffManifest(manifest, {})).toEqual(manifest);
    expect(JSON.stringify(appJson)).not.toContain("usesCleartextTraffic");
  });

  test("requires both private and public build flags", () => {
    expect(isDesktopHandoffBuild({
      VSHOP_DESKTOP_HANDOFF_BUILD: "1",
      EXPO_PUBLIC_VSHOP_DESKTOP_HANDOFF: "1",
    })).toBe(true);
    expect(isDesktopHandoffBuild({ VSHOP_DESKTOP_HANDOFF_BUILD: "1" })).toBe(false);
  });

  test("flagged config adds only the dedicated network security resource", () => {
    const manifest = {
      manifest: {
        $: {},
        application: [{ $: { "android:allowBackup": "false" } }],
      },
    };
    const result = applyDesktopHandoffManifest(manifest, {
      VSHOP_DESKTOP_HANDOFF_BUILD: "1",
      EXPO_PUBLIC_VSHOP_DESKTOP_HANDOFF: "1",
    });
    expect(result.manifest.application[0].$["android:networkSecurityConfig"])
      .toBe("@xml/vshop_desktop_handoff_network_security");
    expect(result.manifest.application[0].$["android:usesCleartextTraffic"]).toBe("false");
    expect(result.manifest.$["android:networkSecurityConfig"]).toBeUndefined();
    const xml = renderDesktopHandoffNetworkSecurity();
    expect(xml).toContain("127.0.0.1");
    expect(xml).not.toMatch(/cleartextTrafficPermitted="true"[^]*riotgames|0\.0\.0\.0/);
  });
});
