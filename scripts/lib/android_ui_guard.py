"""Fail-closed preflight for local Android UI tests; no wake/unlock actions."""
import re
from collections.abc import Callable


class DeviceNotReady(RuntimeError):
    """Environmental precondition failure, not a product assertion failure."""


def _read(adb: Callable[..., str | bytes], *parts: str) -> str:
    try:
        value = adb(*parts)
        return value.decode(errors="replace") if isinstance(value, bytes) else str(value)
    except Exception:
        raise DeviceNotReady("Device state could not be read; no actions allowed") from None


def assert_screen_unlocked(adb: Callable[..., str | bytes]) -> str:
    power = _read(adb, "shell", "dumpsys", "power")
    if not re.search(r"\bmWakefulness=Awake\b", power):
        raise DeviceNotReady("Device is not verifiably awake; unlock it before testing")
    window = _read(adb, "shell", "dumpsys", "window")
    states = re.findall(r"\b(?:mDreamingLockscreen|mKeyguardShowing|isStatusBarKeyguard)=(true|false)\b", window)
    if not states or "true" in states:
        raise DeviceNotReady("Device is locked or lock state is unknown; no actions allowed")
    return window


def assert_vshop_ready(adb: Callable[..., str | bytes]) -> None:
    window = assert_screen_unlocked(adb)
    focus = re.findall(r"(?m)^\s*mCurrentFocus=(.*)$", window)
    if len(focus) != 1 or not re.search(r"(?<![\w.])com\.android\.vshop/", focus[0]):
        raise DeviceNotReady("VShop does not own the focused window; no actions allowed")
    activity = _read(adb, "shell", "dumpsys", "activity", "activities")
    if not re.search(r"(?:topResumedActivity|mResumedActivity)[=:].*(?<![\w.])com\.android\.vshop/", activity):
        raise DeviceNotReady("VShop is not the resumed activity; no actions allowed")
