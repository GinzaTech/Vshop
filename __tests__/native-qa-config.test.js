/* eslint-env node, jest */
const original = require("../app.json").expo;
const appConfigFactory = require("../app.config.js");
const { resolveAppConfig } = appConfigFactory;

it("preserves the default application and creates a separate explicit native test identity", () => {
  const before = JSON.stringify(original);
  expect(resolveAppConfig({})).toEqual(original);
  expect(resolveAppConfig({ VSHOP_NATIVE_QA: "0" })).toEqual(original);
  const qa = resolveAppConfig({ VSHOP_NATIVE_QA: "1" });
  expect(qa.android.package).toBe("com.android.vshop.startupqa");
  expect(qa.name).toBe("VShop QA");
  expect(qa.scheme).toBe("vshopqa");
  expect(qa.updates.enabled).toBe(false);
  expect(qa.icon).toBe(original.icon);
  expect(qa.plugins).toEqual(original.plugins);
  expect(JSON.stringify(original)).toBe(before);
});

it("merges the Expo-provided app.json config in dynamic config mode", () => {
  const config = { ...original, description: "doctor-config-marker" };
  expect(appConfigFactory({ config }).description).toBe("doctor-config-marker");
});
