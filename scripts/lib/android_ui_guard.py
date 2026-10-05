"""Fail-closed preflight for local Android UI tests; no wake/unlock actions."""
import re
from collections.abc import Callable
from typing import TypedDict

DEFAULT_VSHOP_PACKAGE = "com.android.vshop"
ALLOWED_VSHOP_PACKAGES = (DEFAULT_VSHOP_PACKAGE, "com.android.vshop.startupqa")


class DeviceNotReady(RuntimeError):
    """Environmental precondition failure, not a product assertion failure."""


class InstalledPackageInfo(TypedDict):
    installedVersionName: str
    installedVersionCode: int
    debuggable: bool


def validate_vshop_package(package: str) -> str:
    """Validate the exact opt-in package before any transport read or action."""
    if package not in ALLOWED_VSHOP_PACKAGES:
        raise DeviceNotReady("Package is not an allowed VShop target; no reads or actions allowed")
    return package


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


def assert_vshop_ready(adb: Callable[..., str | bytes], package: str = DEFAULT_VSHOP_PACKAGE) -> None:
    validate_vshop_package(package)
    component = rf"(?<![\w.]){re.escape(package)}/"
    window = assert_screen_unlocked(adb)
    focus = re.findall(r"(?m)^\s*mCurrentFocus=(.*)$", window)
    if len(focus) != 1 or not re.search(component, focus[0]):
        raise DeviceNotReady("VShop does not own the focused window; no actions allowed")
    activity = _read(adb, "shell", "dumpsys", "activity", "activities")
    if not re.search(rf"(?m)^[ \t]*(?:topResumedActivity|mResumedActivity)[=:][^\r\n]*{component}", activity):
        raise DeviceNotReady("VShop is not the resumed activity; no actions allowed")


def read_vshop_package_info(adb: Callable[..., str | bytes],
                            package: str = DEFAULT_VSHOP_PACKAGE) -> InstalledPackageInfo:
    """Read installed metadata from the exact selected package's dumpsys block."""
    validate_vshop_package(package)
    dump = _read(adb, "shell", "dumpsys", "package", package)
    headers = list(re.finditer(r"(?m)^[ \t]*Package \[([^\]\r\n]+)\][^\r\n]*", dump))
    selected = [index for index, header in enumerate(headers) if header.group(1) == package]
    if len(selected) != 1:
        raise DeviceNotReady("Selected installed package is missing or ambiguous")
    index = selected[0]
    end = headers[index + 1].start() if index + 1 < len(headers) else len(dump)
    block = re.split(r"(?m)^\S", dump[headers[index].end():end], maxsplit=1)[0]
    names = re.findall(r"(?m)^[ \t]*versionName=(\S+)[ \t]*\r?$", block)
    codes = re.findall(r"(?m)^[ \t]*versionCode=(\d+)(?:[ \t\r]|$)", block)
    flags = re.findall(r"(?m)^[ \t]*pkgFlags=\[([^\]\r\n]*)\]", block)
    if len(names) != 1 or len(codes) != 1 or len(flags) != 1:
        raise DeviceNotReady("Selected installed package metadata is incomplete or ambiguous")
    return {"installedVersionName": names[0], "installedVersionCode": int(codes[0]),
            "debuggable": "DEBUGGABLE" in flags[0].split()}
