"""Open and close the four real Profile expression selectors, never equip an item."""
import argparse
import json
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET
import uiautomator2
from lib.android_ui_guard import (
    ALLOWED_VSHOP_PACKAGES, DEFAULT_VSHOP_PACKAGE, DeviceNotReady,
    assert_vshop_ready, read_vshop_package_info, validate_vshop_package,
)


class ProfileContextNotReady(RuntimeError):
    """Observe-only modal entrance; no input until its owned markers are ready."""


def profile_context_visible(nodes):
    """Native Modal hides its background; validate the observed picker instead."""
    modal = any(n.get("content-desc") == "Close modal" for n in nodes)
    if not modal:
        return any(n.get("resource-id") == "profile-expression-row" for n in nodes)
    return (any(n.get("resource-id") == "modal-surface" for n in nodes)
            and any(n.get("text") in ("Chọn Graffiti hoặc Flex", "Choose Graffiti or Flex") for n in nodes)
            and any(re.fullmatch(r"(?:Vị trí|Slot) [1-4]", n.get("text", "")) for n in nodes)
            and any(n.get("content-desc") in ("Đóng", "Close") and n.get("clickable") == "true" for n in nodes))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serial", required=True)
    parser.add_argument("--allow-physical", action="store_true")
    parser.add_argument("--output", required=True)
    parser.add_argument("--adb", default="adb")
    parser.add_argument("--package", choices=ALLOWED_VSHOP_PACKAGES, default=DEFAULT_VSHOP_PACKAGE,
                        help="Exact app target; startupqa requires explicit opt-in")
    args = parser.parse_args()
    validate_vshop_package(args.package)
    if not re.fullmatch(r"emulator-\d+", args.serial) and not args.allow_physical:
        raise RuntimeError("Physical testing needs explicit --allow-physical authorization")
    output = Path(args.output).resolve()
    repo = Path(__file__).resolve().parent.parent
    if output == repo or repo in output.parents:
        raise RuntimeError("Evidence must stay outside the checkout")
    output.mkdir(parents=True, exist_ok=True)

    def adb(*parts):
        return subprocess.run([args.adb, "-s", args.serial, *parts], check=True,
                              capture_output=True, timeout=15).stdout.decode(errors="replace")

    report = {"serial": args.serial, "package": args.package,
              "scope": "open/close only; no equip action", "slots": []}

    def tree():
        assert_vshop_ready(adb, package=args.package)
        _ = device.info
        nodes = list(ET.fromstring(device.dump_hierarchy()).iter("node"))
        if not profile_context_visible(nodes):
            raise ProfileContextNotReady("Verified Profile/picker context missing; no taps allowed")
        return nodes

    def rect(node):
        values = [int(v) for v in re.findall(r"\d+", node.get("bounds", ""))]
        if len(values) != 4 or values[2] <= values[0] or values[3] <= values[1]:
            raise RuntimeError("Control has no usable visible bounds")
        return values

    def modal_open(nodes):
        return any(n.get("content-desc") == "Close modal" for n in nodes)

    def wait_for(predicate, label):
        deadline = time.monotonic() + 12
        while True:
            try:
                nodes = tree()
            except ProfileContextNotReady:
                if time.monotonic() >= deadline:
                    raise
                time.sleep(0.2)
                continue  # Observation only; focused-package guard still runs.
            if predicate(nodes):
                return nodes
            if time.monotonic() > deadline:
                raise AssertionError(f"Timed out: {label}")
            time.sleep(0.2)

    def press(node):
        assert_vshop_ready(adb, package=args.package)
        x1, y1, x2, y2 = rect(node)
        x, y = (x1 + x2) // 2, (y1 + y2) // 2
        adb("shell", "input", "swipe", str(x), str(y), str(x), str(y), "120")
        time.sleep(0.5)

    def close(nodes):
        # Allowlisted dismiss control only. Never tap option names or thumbnails.
        node = next(n for n in nodes if n.get("content-desc") in ("Đóng", "Close") and n.get("clickable") == "true")
        press(node)
        return wait_for(lambda ns: not modal_open(ns), "picker dismissal")

    def cells(nodes):
        return [n for n in nodes if n.get("clickable") == "true" and
                re.search(r", (?:Vị trí|Slot) [1-4]$", n.get("content-desc", ""))]

    try:
        assert_vshop_ready(adb, package=args.package)
        report.update(read_vshop_package_info(adb, package=args.package))
        device = uiautomator2.connect(args.serial)
        nodes = tree()
        if modal_open(nodes):
            nodes = close(nodes)
        original = [n.get("content-desc") for n in cells(nodes)]
        if len(original) != 4:
            raise RuntimeError("Expected four expression slot controls")
        for slot in range(1, 5):
            nodes = tree()
            if modal_open(nodes):
                raise RuntimeError("Unexpected modal before slot tap")
            target = next(n for n in cells(nodes) if re.search(rf"(?:Vị trí|Slot) {slot}$", n.get("content-desc")))
            slot_bounds = rect(target)
            press(target)
            nodes = wait_for(modal_open, f"slot {slot} picker")
            # Validate the modal slot header; its background is hidden natively.
            labels = [n for n in nodes if n.get("text") in (f"Vị trí {slot}", f"Slot {slot}")]
            assert labels and min(rect(n)[1] for n in labels) < slot_bounds[1], "Wrong or missing picker slot header"
            nodes = close(nodes)
            assert [n.get("content-desc") for n in cells(nodes)] == original, "Displayed equipment changed"
            report["slots"].append({"slot": slot, "opened": True, "dismissed": True, "bounds": slot_bounds})
        report["status"] = "PASS_OPEN_CLOSE_ONLY"
    except Exception as error:
        report["status"] = "BLOCKED_DEVICE_NOT_READY" if isinstance(error, DeviceNotReady) else "FAIL"
        report["error"] = str(error)
        raise
    finally:
        (output / "profile-selectors-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
