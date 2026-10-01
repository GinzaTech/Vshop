"""Read-only VShop navigation/geometry QA; no account mutations.

Requires the five primary tabs already visible in the authorized app.
Records native screenshots and Android frame statistics, not production FPS.
"""
import argparse
import json
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET
import uiautomator2
from lib.android_ui_guard import DeviceNotReady, assert_vshop_ready

ROUTES = ("bundles", "shop", "profile", "night_market", "settings")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serial", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--adb", default="adb")
    parser.add_argument("--allow-physical", action="store_true", help="Only use after explicit human physical-device authorization")
    parser.add_argument("--verify-collapse", action="store_true", help="Exercise the verified Settings hold and expand controls")
    args = parser.parse_args()
    if not re.fullmatch(r"emulator-\d+", args.serial) and not args.allow_physical:
        raise RuntimeError("Physical device requires explicit --allow-physical authorization")
    output = Path(args.output).resolve()
    repo = Path(__file__).resolve().parent.parent
    if output == repo or repo in output.parents:
        raise RuntimeError("Evidence must stay outside the checkout")
    output.mkdir(parents=True, exist_ok=True)

    def adb(*parts):
        return subprocess.run([args.adb, "-s", args.serial, *parts], check=True,
                              capture_output=True, timeout=15).stdout

    def foreground():
        assert_vshop_ready(adb)

    emulator = adb("shell", "getprop", "ro.kernel.qemu").decode().strip() == "1"
    if not emulator and not args.allow_physical:
        raise RuntimeError("Target is not an authorized physical device")
    report = {"serial": args.serial, "isEmulator": emulator, "scope": "navigation only; no live mutations", "routes": []}

    def tree():
        foreground()
        # Match ARTEMIS's UIAutomatorClient connection/freshness check.
        _ = device.info
        return list(ET.fromstring(device.dump_hierarchy(compressed=False)).iter("node"))

    def find(nodes, identity):
        return next(n for n in nodes if n.get("resource-id") == identity)

    def bounds(node):
        return [int(x) for x in re.findall(r"\d+", node.get("bounds"))]

    def selected(route):
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            nodes = tree()
            if find(nodes, f"primary-tab-{route}").get("selected") == "true":
                return nodes
            time.sleep(0.2)
        raise AssertionError(f"Navigation did not select {route}")

    def press(rect, delay=0.7):
        foreground()
        # ARTEMIS verified a center click selects shop on the physical device.
        # Use current bounds to avoid the bottom gesture area; the failed edge
        # swipe does not establish an OS interception root cause.
        x, y = (rect[0] + rect[2]) // 2, (rect[1] + rect[3]) // 2
        device.click(x, y)
        time.sleep(delay)

    def verify_collapse():
        press(bounds(find(tree(), "primary-tab-bundles")))
        selected("bundles")
        original = bounds(find(tree(), "primary-navigation-frame"))
        # A short hold remains a normal tap. Long-hold duration brackets the
        # configured500ms threshold; this is not an end-to-end latency claim.
        def hold_settings(duration):
            rect = bounds(find(tree(), "primary-tab-settings"))
            foreground()
            x, y = (rect[0] + rect[2]) // 2, (rect[1] + rect[3]) // 2
            adb("shell", "input", "swipe", str(x), str(y), str(x), str(y), str(duration))

        hold_settings(350)
        selected("settings")
        press(bounds(find(tree(), "primary-tab-bundles")))
        selected("bundles")
        checks = [{"holdMs": 350, "result": "normal Settings navigation"}]
        for cycle in range(2):
            hold_settings(650)
            deadline = time.monotonic() + 12
            while True:
                nodes = tree()
                expand = next((n for n in nodes if n.get("resource-id") == "primary-navigation-expand"), None)
                frame = next((n for n in nodes if n.get("resource-id") == "primary-navigation-frame"), None)
                rect = bounds(frame) if frame is not None else None
                if expand is not None and rect and abs((rect[2] - rect[0]) - (rect[3] - rect[1])) <= 2:
                    break
                if time.monotonic() >= deadline:
                    raise AssertionError("Settings hold did not collapse to a circular frame")
                time.sleep(0.2)
            assert abs(rect[2] - original[2]) <= 2, "Collapsed frame must remain right anchored"
            assert not any(n.get("resource-id", "").startswith("primary-tab-") and
                           n.get("clickable") == "true" for n in nodes), "Hidden tabs remain accessible"
            foreground()
            (output / f"collapsed-{cycle}.png").write_bytes(adb("exec-out", "screencap", "-p"))
            press(bounds(expand))
            nodes = selected("bundles")
            deadline = time.monotonic() + 12
            while abs(bounds(find(nodes, "primary-navigation-frame"))[0] - original[0]) > 2:
                if time.monotonic() >= deadline:
                    raise AssertionError("Expanded frame width was not restored")
                nodes = tree()
                time.sleep(0.2)
            checks.append({"holdMs": 650, "cycle": cycle, "collapsedBounds": rect,
                           "routePreserved": True, "expanded": True})
        report["collapseChecks"] = checks

    try:
        foreground()
        device = uiautomator2.connect(args.serial)
        nodes = tree()
        initial_expand = next((n for n in nodes if n.get("resource-id") == "primary-navigation-expand"), None)
        report["startedCollapsed"] = initial_expand is not None
        if initial_expand is not None:
            press(bounds(initial_expand))
            deadline = time.monotonic() + 12
            while True:
                nodes = tree()
                if all(any(n.get("resource-id") == f"primary-tab-{route}" for n in nodes) for route in ROUTES):
                    break
                if time.monotonic() >= deadline:
                    raise AssertionError("Initial collapsed navigation did not expand")
                time.sleep(0.2)
        if not all(any(n.get("resource-id") == f"primary-tab-{route}" for n in nodes) for route in ROUTES):
            raise DeviceNotReady("Primary navigation is not visible; return to a primary VShop screen")
        tabs = {route: bounds(find(nodes, f"primary-tab-{route}")) for route in ROUTES}
        widths = [rect[2] - rect[0] for rect in tabs.values()]
        assert max(widths) - min(widths) <= 3, "Tab touch slots differ in width"
        report["tabBounds"] = tabs
        report["capsuleBounds"] = bounds(find(nodes, "primary-tab-capsule"))
        report["display"] = adb("shell", "wm", "size").decode().strip()
        report["density"] = adb("shell", "wm", "density").decode().strip()
        report["fontScale"] = adb("shell", "settings", "get", "system", "font_scale").decode().strip()
        report["animatorScale"] = adb("shell", "settings", "get", "global", "animator_duration_scale").decode().strip()
        report["transitionAnimationScale"] = adb("shell", "settings", "get", "global", "transition_animation_scale").decode().strip()
        if args.verify_collapse:
            verify_collapse()
        for route in ROUTES:
            foreground()
            nodes = tree()
            press(bounds(find(nodes, f"primary-tab-{route}")))
            selected(route)
            foreground()
            (output / f"{route}.png").write_bytes(adb("exec-out", "screencap", "-p"))
            report["routes"].append({"route": route, "selected": True,
                                     "screenshot": f"{route}.png", "bodyVisualReview": "required"})

        # Warm interrupt sequence; frame metrics include DEV/instrumentation overhead.
        foreground()
        adb("shell", "dumpsys", "gfxinfo", "com.android.vshop", "reset")
        sequence = ["bundles", "settings", "shop", "profile", "night_market", "shop", "settings", "profile"]
        for route in sequence:
            press(tabs[route], delay=0.04)
        selected("profile")
        time.sleep(0.7)
        gfx = adb("shell", "dumpsys", "gfxinfo", "com.android.vshop", "framestats").decode(errors="replace")
        (output / "warm-navigation-framestats.txt").write_text(gfx, encoding="utf-8")
        report["frameSummary"] = [line.strip() for line in gfx.splitlines()
                                  if re.search(r"Total frames|Janky frames|percentile:", line)]
        total = re.search(r"Total frames rendered:\s*(\d+)", gfx)
        assert total and int(total.group(1)) > 0, "No measured frames"
        report["rapidSequence"] = sequence
        report["interruptTimingVerified"] = False
        report["timingNote"] = "Every tap is readiness-guarded; command overhead means this is not proof of sub-300ms interruption."
        report["status"] = "PASS_NAVIGATION_SELECTION_AND_GEOMETRY"
        report["performanceVerdict"] = "MEASURED_ONLY: DEV/instrumentation overhead, no production FPS claim"
    except Exception as error:
        report["status"] = "BLOCKED_DEVICE_NOT_READY" if isinstance(error, DeviceNotReady) else "FAIL"
        report["error"] = str(error)
        raise
    finally:
        (output / "navigation-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
