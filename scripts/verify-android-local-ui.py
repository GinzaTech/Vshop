"""Repeatable native QA for the DEV-only, isolated /ui-qa screen.

Run with ARTEMIS's Python runtime (which includes UIAutomator2). This deliberately
requires explicit opt-in for physical devices and refuses to tap unless the local QA marker/evidence
is present. No account state or Riot transport is read or modified.
"""

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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serial", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--adb", default="adb")
    parser.add_argument("--package", choices=ALLOWED_VSHOP_PACKAGES, default=DEFAULT_VSHOP_PACKAGE,
                        help="Exact app target; startupqa requires explicit opt-in")
    parser.add_argument("--allow-physical", action="store_true", help="Only use after explicit human physical-device authorization")
    args = parser.parse_args()
    validate_vshop_package(args.package)
    if not re.fullmatch(r"emulator-\d+", args.serial) and not args.allow_physical:
        raise RuntimeError("Physical device requires explicit --allow-physical authorization")
    output = Path(args.output).resolve()
    workspace = Path(__file__).resolve().parent.parent
    if output == workspace or workspace in output.parents:
        raise RuntimeError("Keep screenshots and diagnostic output outside the repository")
    output.mkdir(parents=True, exist_ok=True)

    def adb(*arguments):
        return subprocess.run([args.adb, "-s", args.serial, *arguments],
                              check=True, capture_output=True, timeout=15).stdout

    emulator = adb("shell", "getprop", "ro.kernel.qemu").decode().strip() == "1"
    if not emulator and not args.allow_physical:
        raise RuntimeError("Target is not an authorized physical device")
    # ARTEMIS exploration establishes the real controls. UIAutomator2 supplies
    # fresh runtime trees here; the helper backend was observed retaining stale
    # nodes after modal changes on this Android 16 emulator.
    latest_nodes = []
    last_snapshot_at = 0.0
    trace = []
    started = time.monotonic()
    report = {"serial": args.serial, "package": args.package, "isEmulator": emulator,
              "scope": "local fixture, no Riot", "checks": []}

    def snapshot():
        nonlocal latest_nodes, last_snapshot_at
        assert_vshop_ready(adb, package=args.package)
        root = ET.fromstring(client.dump_hierarchy(compressed=False))
        nodes = list(root.iter("node"))
        marker = next((n for n in nodes if n.get("text") == "Local QA (no Riot)"), None)
        evidence = next((n for n in nodes if n.get("resource-id") == "ui-qa-transport-stats"), None)
        if marker is None or evidence is None:
            raise RuntimeError("Local QA guard missing; refusing all taps")
        state = json.loads(evidence.get("content-desc") or evidence.get("text"))
        trace.append({"ms": round((time.monotonic() - started) * 1000), "state": state})
        latest_nodes, last_snapshot_at = nodes, time.monotonic()
        return nodes, state

    def wait_for(predicate, label, timeout=20, ready_nodes=lambda _nodes: True):
        deadline = time.monotonic() + timeout
        while True:
            try:
                nodes, state = snapshot()
            except DeviceNotReady:
                raise
            except RuntimeError:
                # Reset remounts the fixture. Observe only until it is present;
                # never fall back to coordinates or tap a different screen.
                if time.monotonic() >= deadline:
                    raise
                time.sleep(0.035)
                continue
            if predicate(state) and ready_nodes(nodes):
                return nodes, state
            if time.monotonic() >= deadline:
                raise AssertionError(f"Timed out: {label}; last local state={state}")
            time.sleep(0.035)

    def locate(nodes, value, attribute="resource-id"):
        candidates = [n for n in nodes if n.get(attribute) == value]
        if not candidates:
            raise AssertionError(f"Missing visible QA locator {attribute}={value}")
        node = next((n for n in candidates if n.get("clickable") == "true"), candidates[0])
        bounds = [int(v) for v in re.findall(r"\d+", node.get("bounds", ""))]
        if len(bounds) != 4 or bounds[2] <= bounds[0] or bounds[3] <= bounds[1]:
            raise AssertionError(f"Invalid bounds for {value}")
        return [(bounds[0] + bounds[2]) // 2, (bounds[1] + bounds[3]) // 2]

    def tap(value, attribute="resource-id", nodes=None):
        assert_vshop_ready(adb, package=args.package)
        current = nodes if nodes is not None else (
            latest_nodes if time.monotonic() - last_snapshot_at < 0.75 else snapshot()[0])
        x, y = locate(current, value, attribute)
        trace.append({"ms": round((time.monotonic() - started) * 1000),
                      "input": {"locator": value, "x": x, "y": y, "durationMs": 120}})
        # A zero-duration ADB down/up was intermittently missed by the busy
        # emulator. A stationary 120ms press matches the explored user gesture;
        # it is below long-press threshold and does not change the target.
        adb("shell", "input", "swipe", str(x), str(y), str(x), str(y), "120")
        # Native Paper portals publish their state before their views mount.
        # Give the observed 600ms render window before asking UIAutomator to
        # synchronously traverse this large native hierarchy.
        time.sleep(0.6)

    def capture(name):
        # Foreground and fixture guard immediately precede every capture.
        snapshot()
        assert_vshop_ready(adb, package=args.package)
        (output / f"{name}.png").write_bytes(adb("exec-out", "screencap", "-p"))

    def open_picker(control, kind):
        tap(control)
        prefix = "QASkinB," if kind == "weapon" else "QATitleB"
        return wait_for(lambda s: s["picker"] == kind, f"open {kind}",
                        ready_nodes=lambda ns: any(n.get("content-desc", "").startswith(prefix) for n in ns))

    def choose_skin(name):
        nodes, _ = open_picker("ui-qa-open-weapon", "weapon")
        # A semantic parent carries the name plus tier/selected state.
        option = next((n for n in nodes if n.get("content-desc", "").startswith(name + ",")), None)
        if option is None:
            raise AssertionError(f"Missing skin {name}")
        tap(option.get("content-desc"), "content-desc", nodes)
        wait_for(lambda s: s["desiredSkin"] == name and s["picker"] is None,
                 f"selected {name} rendered and picker closed")

    try:
        assert_vshop_ready(adb, package=args.package)
        report.update(read_vshop_package_info(adb, package=args.package))
        if not report["debuggable"]:
            raise RuntimeError("Local fixture testing requires the verified development package")
        client = uiautomator2.connect(args.serial)
        nodes, state = wait_for(lambda _state: True, "local QA screen ready")
        if state["picker"] is not None:
            tap("Close", "content-desc", nodes)
            wait_for(lambda s: s["picker"] is None, "close prior picker")
        tap("ui-qa-reset")
        nodes, _ = wait_for(lambda s: s["writeCount"] == 0 and not s["pending"], "fresh isolated session")
        slots = [next(n for n in nodes if n.get("content-desc", "").startswith(f"QASlot{i},")) for i in range(1, 5)]
        rects = [[int(v) for v in re.findall(r"\d+", n.get("bounds"))] for n in slots]
        assert len({r[1] for r in rects}) == 1 and len({r[3] for r in rects}) == 1, "Expression cells wrap"
        assert all(rects[i][2] <= rects[i + 1][0] for i in range(3)), "Expression cells overlap"
        report["checks"].append({"name": "four-expression-cells-one-row", "bounds": rects})
        capture("01-initial")

        choose_skin("QASkinB")
        _, pending = wait_for(lambda s: s["desiredSkin"] == "QASkinB" and s["inFlight"] == 1,
                              "optimistic skin visible before ACK", timeout=4)
        assert pending["serverSkin"] == "QASkinA" and pending["picker"] is None
        nodes, opened = open_picker("ui-qa-open-title", "player-title")
        assert opened["inFlight"] == 1, "Second picker did not open before first save completed"
        report["checks"].append({"name": "second-picker-during-save", "state": opened})
        tap("QATitleB", "content-desc", nodes)
        wait_for(lambda s: s["desiredTitle"] == "QATitleB" and s["picker"] is None,
                 "optimistic title", timeout=4)
        choose_skin("QASkinC")
        _, final = wait_for(lambda s: not s["pending"] and s["inFlight"] == 0, "queue drained")
        assert final["serverSkin"] == final["desiredSkin"] == "QASkinC"
        assert final["serverTitle"] == final["desiredTitle"] == "QATitleB"
        assert final["maxInFlight"] == 1 and final["serverVersion"] == final["writeCount"] + 1
        report["checks"].append({"name": "serialized-versioned-multi-field-save", "state": final})
        capture("02-rapid-selections-confirmed")

        tap("ui-qa-fail-next")
        wait_for(lambda s: s["failNext"], "arm isolated failure")
        choose_skin("QASkinA")
        wait_for(lambda s: s["desiredSkin"] == "QASkinA" and s["inFlight"] == 1,
                 "failed intent was initially optimistic", timeout=4)
        _, failed = wait_for(lambda s: not s["pending"] and bool(s["error"]), "current field rollback")
        assert failed["desiredSkin"] == failed["serverSkin"] == "QASkinC"
        assert failed["desiredTitle"] == failed["serverTitle"] == "QATitleB"
        assert failed["maxInFlight"] == 1
        report["checks"].append({"name": "failed-field-rollback-preserves-title", "state": failed})
        capture("03-failure-rollback")
        report["status"] = "PASS"
    except Exception as error:
        report["status"] = "BLOCKED_DEVICE_NOT_READY" if isinstance(error, DeviceNotReady) else "FAIL"
        report["error"] = str(error)
        raise
    finally:
        report["elapsedMs"] = round((time.monotonic() - started) * 1000)
        report["trace"] = trace
        (output / "local-ui-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps({k: v for k, v in report.items() if k != "trace"}, indent=2))


if __name__ == "__main__":
    main()
