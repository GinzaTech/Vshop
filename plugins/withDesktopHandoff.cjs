/* eslint-env node */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  withAndroidManifest,
  withDangerousMod,
} = require("expo/config-plugins");

const RESOURCE_NAME = "vshop_desktop_handoff_network_security";

const isDesktopHandoffBuild = (env = process.env) =>
  env.VSHOP_DESKTOP_HANDOFF_BUILD === "1" &&
  env.EXPO_PUBLIC_VSHOP_DESKTOP_HANDOFF === "1";

function applyDesktopHandoffManifest(manifest, env = process.env) {
  if (!isDesktopHandoffBuild(env)) return manifest;
  const next = JSON.parse(JSON.stringify(manifest));
  const applications = next.manifest?.application;
  const attributes = Array.isArray(applications) && applications.length === 1
    ? applications[0]?.$
    : null;
  if (!attributes) throw new Error("DESKTOP_HANDOFF_MANIFEST_REJECTED");
  attributes["android:usesCleartextTraffic"] = "false";
  attributes["android:networkSecurityConfig"] = `@xml/${RESOURCE_NAME}`;
  return next;
}

const renderDesktopHandoffNetworkSecurity = () => `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">127.0.0.1</domain>
  </domain-config>
</network-security-config>
`;

function withDesktopHandoff(config) {
  if (!isDesktopHandoffBuild()) return config;
  const withManifest = withAndroidManifest(config, (androidConfig) => {
    androidConfig.modResults = applyDesktopHandoffManifest(androidConfig.modResults);
    return androidConfig;
  });
  return withDangerousMod(withManifest, ["android", async (androidConfig) => {
    const directory = path.join(
      androidConfig.modRequest.platformProjectRoot,
      "app",
      "src",
      "main",
      "res",
      "xml",
    );
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, `${RESOURCE_NAME}.xml`),
      renderDesktopHandoffNetworkSecurity(),
      "utf8",
    );
    return androidConfig;
  }]);
}

module.exports = withDesktopHandoff;
module.exports.applyDesktopHandoffManifest = applyDesktopHandoffManifest;
module.exports.isDesktopHandoffBuild = isDesktopHandoffBuild;
module.exports.renderDesktopHandoffNetworkSecurity = renderDesktopHandoffNetworkSecurity;
module.exports.RESOURCE_NAME = RESOURCE_NAME;
