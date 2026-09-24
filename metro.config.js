/* eslint-disable */

// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Needed for https-browsify
config.resolver.extraNodeModules = {
  http: require.resolve("@tradle/react-native-http"),
  url: require.resolve("url"),
  stream: require.resolve("stream-browserify"),
  util: require.resolve("util"),
  events: require.resolve("events"),
};

// UI fixtures are available only to DEV deep links. Resolve tiny fail-closed
// stubs in production so release bundles do not ship test-only match payloads.
const productionMockStubs = new Map([
  [
    "~/mocks/match-ui",
    path.join(__dirname, "mocks", "disabled.production.js"),
  ],
  [
    "~/mocks/profile-ui",
    path.join(__dirname, "mocks", "profile-ui.production.js"),
  ],
  [
    "~/utils/flow-tracer",
    path.join(__dirname, "utils", "flow-tracer.production.js"),
  ],
]);
config.resolver.resolveRequest = (context, moduleName, platform) =>
  context.resolveRequest(
    context,
    context.dev ? moduleName : productionMockStubs.get(moduleName) ?? moduleName,
    platform
  );

module.exports = config;
