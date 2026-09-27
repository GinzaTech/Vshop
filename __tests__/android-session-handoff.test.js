/* eslint-env jest, node */

const {
  createAndroidSessionHandoffBridge,
} = require("../scripts/lib/android-session-handoff.cjs");

const ok = (stdout = "") => ({ status: 0, stdout, stderr: "" });

test("prepares reverse and fixed deep link for the only authorized device", () => {
  const spawnSync = jest.fn()
    .mockReturnValueOnce(ok("List of devices attached\n45218ba\tdevice product:mondrian model:23013PC75G device:mondrian transport_id:1\n"))
    .mockReturnValueOnce(ok())
    .mockReturnValueOnce(ok("Starting: Intent"));
  const bridge = createAndroidSessionHandoffBridge({ spawnSyncImpl: spawnSync });
  const result = bridge.prepare({
    companionPort: 43127,
    handoffId: "a".repeat(64),
    pairingCode: "b".repeat(64),
  });
  expect(result).toEqual({ serial: "45218ba", model: "23013PC75G", devicePort: 49331 });
  expect(spawnSync.mock.calls[1]?.slice(0, 2)).toEqual([
    "adb",
    ["-s", "45218ba", "reverse", "tcp:49331", "tcp:43127"],
  ]);
  expect(spawnSync.mock.calls[2]?.[1]).toEqual([
    "-s",
    "45218ba",
    "shell",
    // The remote command must be a single argument with the URI single-quoted:
    // adb shell joins argv and the device sh would otherwise treat the "&" in
    // the URI as a background operator, truncating the link (exit 127).
    `am start -W -a android.intent.action.VIEW -d 'vshop://session_handoff?id=${"a".repeat(64)}&code=${"b".repeat(64)}' com.android.vshop`,
  ]);
  expect(spawnSync.mock.calls.every((call) => call[2]?.shell === false)).toBe(true);
});

test.each([
  ["List of devices attached\n", "DEVICE_UNAVAILABLE"],
  ["List of devices attached\n45218ba\tunauthorized product:x model:y\n", "DEVICE_UNAUTHORIZED"],
  ["List of devices attached\na\tdevice model:one\nb\tdevice model:two\n", "DEVICE_AMBIGUOUS"],
])("fails closed for adb inventory", (stdout, code) => {
  const bridge = createAndroidSessionHandoffBridge({
    spawnSyncImpl: jest.fn(() => ok(stdout)),
  });
  expect(() => bridge.prepare({
    companionPort: 43127,
    handoffId: "a".repeat(64),
    pairingCode: "b".repeat(64),
  })).toThrow(code);
});

test("rejects untrusted identifiers and ports before adb", () => {
  const spawnSync = jest.fn();
  const bridge = createAndroidSessionHandoffBridge({ spawnSyncImpl: spawnSync });
  expect(() => bridge.prepare({
    companionPort: 0,
    handoffId: "a".repeat(64),
    pairingCode: "b".repeat(64),
  })).toThrow("HANDOFF_INPUT_REJECTED");
  expect(() => bridge.prepare({
    companionPort: 43127,
    handoffId: "a&shell=1",
    pairingCode: "b".repeat(64),
  })).toThrow("HANDOFF_INPUT_REJECTED");
  expect(spawnSync).not.toHaveBeenCalled();
});

test("removes only the fixed reverse mapping", () => {
  const spawnSync = jest.fn(() => ok());
  const bridge = createAndroidSessionHandoffBridge({ spawnSyncImpl: spawnSync });
  bridge.cleanup("45218ba");
  expect(spawnSync).toHaveBeenCalledWith(
    "adb",
    ["-s", "45218ba", "reverse", "--remove", "tcp:49331"],
    expect.objectContaining({ shell: false, windowsHide: true }),
  );
});

test("fails closed when reverse setup fails", () => {
  const spawnSync = jest.fn()
    .mockReturnValueOnce(ok("List of devices attached\n45218ba\tdevice model:23013PC75G\n"))
    .mockReturnValueOnce({ status: 1, stdout: "", stderr: "reverse failed" });
  const bridge = createAndroidSessionHandoffBridge({ spawnSyncImpl: spawnSync });
  expect(() => bridge.prepare({
    companionPort: 43127,
    handoffId: "a".repeat(64),
    pairingCode: "b".repeat(64),
  })).toThrow("ADB_REVERSE_FAILED");
});

test("removes the fixed reverse when deep-link launch fails", () => {
  const spawnSync = jest.fn()
    .mockReturnValueOnce(ok("List of devices attached\n45218ba\tdevice model:23013PC75G\n"))
    .mockReturnValueOnce(ok())
    .mockReturnValueOnce({ status: 1, stdout: "", stderr: "launch failed" })
    .mockReturnValueOnce(ok());
  const bridge = createAndroidSessionHandoffBridge({ spawnSyncImpl: spawnSync });
  expect(() => bridge.prepare({
    companionPort: 43127,
    handoffId: "a".repeat(64),
    pairingCode: "b".repeat(64),
  })).toThrow("DEVICE_LAUNCH_FAILED");
  expect(spawnSync.mock.calls[3]?.[1]).toEqual([
    "-s", "45218ba", "reverse", "--remove", "tcp:49331",
  ]);
});
