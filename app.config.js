/* eslint-env node */
const base = require("./app.json").expo;

/** Explicit local QA identity keeps device testing separate from real app data. */
function resolveAppConfig(env) {
  if (env.VSHOP_NATIVE_QA !== "1") return base;
  return {
    ...base,
    name: "VShop QA",
    scheme: "vshopqa",
    android: { ...base.android, package: "com.android.vshop.startupqa" },
    ios: { ...base.ios, bundleIdentifier: "dev.vasc.vshop.startupqa" },
    updates: { ...base.updates, enabled: false },
    extra: { ...base.extra, nativeQaBuild: true },
  };
}

module.exports = () => resolveAppConfig(process.env);
module.exports.resolveAppConfig = resolveAppConfig;
