/* eslint-env node */
const base = require("./app.json").expo;

/** Explicit local QA identity keeps device testing separate from real app data. */
function resolveAppConfig(env, source = base) {
  if (env.VSHOP_NATIVE_QA !== "1") return source;
  return {
    ...source,
    name: "VShop QA",
    scheme: "vshopqa",
    android: { ...source.android, package: "com.android.vshop.startupqa" },
    ios: { ...source.ios, bundleIdentifier: "dev.vasc.vshop.startupqa" },
    updates: { ...source.updates, enabled: false },
    extra: { ...source.extra, nativeQaBuild: true },
  };
}

module.exports = ({ config }) => resolveAppConfig(process.env, config);
module.exports.resolveAppConfig = resolveAppConfig;
