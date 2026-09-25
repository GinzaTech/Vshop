/* eslint-env node */

"use strict";

const { spawnSync } = require("node:child_process");

const DEVICE_PORT = 49331;
const PACKAGE_NAME = "com.android.vshop";
const HEX_256 = /^[a-f0-9]{64}$/i;
const SERIAL = /^[a-z0-9._:-]{1,128}$/i;

class AndroidHandoffError extends Error {
  constructor(code) {
    super(code);
    this.name = "AndroidHandoffError";
    this.code = code;
  }
}

const parseDevices = (stdout) => String(stdout || "")
  .split(/\r?\n/)
  .slice(1)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [serial, state] = line.split(/\s+/, 2);
    return {
      serial,
      state,
      model: /(?:^|\s)model:([^\s]+)/.exec(line)?.[1] || "unknown",
    };
  });

function createAndroidSessionHandoffBridge({
  adbCommand = "adb",
  spawnSyncImpl = spawnSync,
} = {}) {
  const run = (args, failureCode) => {
    const result = spawnSyncImpl(adbCommand, args, {
      encoding: "utf8",
      shell: false,
      windowsHide: true,
    });
    if (result?.error || result?.status !== 0) {
      throw new AndroidHandoffError(failureCode);
    }
    return String(result.stdout || "");
  };

  const prepare = ({ companionPort, handoffId, pairingCode }) => {
    if (
      !Number.isInteger(companionPort) || companionPort < 1 || companionPort > 65_535 ||
      !HEX_256.test(handoffId) || !HEX_256.test(pairingCode)
    ) throw new AndroidHandoffError("HANDOFF_INPUT_REJECTED");

    const devices = parseDevices(run(["devices", "-l"], "ADB_FAILED"));
    const ready = devices.filter((device) => device.state === "device");
    if (ready.length > 1) throw new AndroidHandoffError("DEVICE_AMBIGUOUS");
    if (ready.length === 0) {
      if (devices.some((device) => device.state === "unauthorized")) {
        throw new AndroidHandoffError("DEVICE_UNAUTHORIZED");
      }
      throw new AndroidHandoffError("DEVICE_UNAVAILABLE");
    }
    const device = ready[0];
    if (!SERIAL.test(device.serial)) throw new AndroidHandoffError("DEVICE_REJECTED");

    run(
      ["-s", device.serial, "reverse", `tcp:${DEVICE_PORT}`, `tcp:${companionPort}`],
      "ADB_REVERSE_FAILED",
    );
    const deepLink = `vshop://session_handoff?id=${handoffId}&code=${pairingCode}`;
    try {
      run([
        "-s", device.serial, "shell", "am", "start", "-W",
        "-a", "android.intent.action.VIEW",
        "-d", deepLink,
        PACKAGE_NAME,
      ], "DEVICE_LAUNCH_FAILED");
    } catch (error) {
      try {
        run(
          ["-s", device.serial, "reverse", "--remove", `tcp:${DEVICE_PORT}`],
          "ADB_CLEANUP_FAILED",
        );
      } catch {
        // Preserve the launch error; stale reverse is bounded to this fixed port.
      }
      throw error;
    }
    return Object.freeze({
      serial: device.serial,
      model: device.model,
      devicePort: DEVICE_PORT,
    });
  };

  const cleanup = (serial) => {
    if (!SERIAL.test(serial)) throw new AndroidHandoffError("DEVICE_REJECTED");
    run(
      ["-s", serial, "reverse", "--remove", `tcp:${DEVICE_PORT}`],
      "ADB_CLEANUP_FAILED",
    );
  };

  return Object.freeze({ cleanup, prepare });
}

module.exports = {
  AndroidHandoffError,
  createAndroidSessionHandoffBridge,
};
