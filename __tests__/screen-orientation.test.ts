import * as ScreenOrientation from "expo-screen-orientation";

import {
  getScreenOrientationForPathname,
  lockScreenOrientation,
} from "~/utils/screen-orientation";

jest.mock("expo-screen-orientation", () => ({
  OrientationLock: {
    LANDSCAPE: "LANDSCAPE",
    PORTRAIT_UP: "PORTRAIT_UP",
  },
  lockAsync: jest.fn(),
}));

const mockLockAsync = ScreenOrientation.lockAsync as jest.MockedFunction<
  typeof ScreenOrientation.lockAsync
>;

describe("screen orientation", () => {
  beforeEach(() => {
    mockLockAsync.mockReset();
    mockLockAsync.mockResolvedValue(undefined);
  });

  it.each([
    ["/combat_session", "landscape"],
    ["/(authenticated)/combat_session", "landscape"],
    ["/combat_session/", "landscape"],
    ["/combat_session?source=combat", "landscape"],
    ["/combat", "portrait"],
    ["/store", "portrait"],
    ["/profile", "portrait"],
    ["/more", "portrait"],
    ["/not-combat_session-details", "portrait"],
  ])("resolves %s to %s", (pathname, expected) => {
    expect(getScreenOrientationForPathname(pathname)).toBe(expected);
  });

  it.each([
    ["landscape", "LANDSCAPE"],
    ["portrait", "PORTRAIT_UP"],
  ] as const)("maps %s to the native %s lock", async (orientation, nativeLock) => {
    await expect(lockScreenOrientation(orientation)).resolves.toBe(true);
    expect(mockLockAsync).toHaveBeenCalledWith(nativeLock);
  });

  it("fails safely when the installed native client lacks orientation support", async () => {
    mockLockAsync.mockRejectedValueOnce(new Error("native module unavailable"));

    await expect(lockScreenOrientation("portrait")).resolves.toBe(false);
  });
});
