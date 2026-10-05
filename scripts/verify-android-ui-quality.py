"""Exercise the observed DEV-only local QA picker; never equip a real account."""
import argparse
import json
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Callable

import uiautomator2

PACKAGE = "com.android.vshop"


def main() -> None:
    """Run guarded native smoke and frame samples with explicit state waits."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serial", required=True)
    parser.add_argument("--package", default=PACKAGE, choices=(PACKAGE, "com.android.vshop.startupqa"))
    parser.add_argument("--output", required=True)
    parser.add_argument("--phase", choices=("baseline", "after"), required=True)
    parser.add_argument("--cycles", type=int, default=30)
    args = parser.parse_args()
    package = args.package
    if not 1 <= args.cycles <= 60:
        raise ValueError("cycles must be between 1 and 60")
    output = Path(args.output).resolve()
    repo = Path(__file__).resolve().parent.parent
    if output == repo or repo in output.parents:
        raise ValueError("Evidence must be outside the checkout")
    output.mkdir(parents=True, exist_ok=True)
    device: Any = None
    cases: list[dict[str, Any]] = []
    ime_package = ""

    def adb(*parts: str) -> str:
        return subprocess.run(
            ["adb", "-s", args.serial, *parts], check=True,
            capture_output=True, timeout=20,
        ).stdout.decode(errors="replace")

    def nodes(allow_transition: bool = False) -> list[ET.Element]:
        # MIUI may expose its floating dev-tools window as app_current(). The
        # ActivityManager resumed activity plus a QA-only marker are authoritative.
        activity = adb("shell", "dumpsys", "activity", "activities")
        resumed = [line for line in activity.splitlines() if "topResumedActivity=" in line]
        if not any(f"{package}/" in line for line in resumed):
            raise RuntimeError("VShop is not foreground; no input permitted")
        found = list(ET.fromstring(device.dump_hierarchy()).iter("node"))
        permitted_packages = {package, "com.android.systemui", ime_package}
        if any(node.get("package") not in permitted_packages and node.get("clickable") == "true" for node in found):
            raise RuntimeError("Another application has an interactive overlay; no input permitted")
        if not any(node.get("resource-id") in ("ui-qa-screen", "ui-qa-route", "ui-qa-picker") for node in found):
            if allow_transition:
                return []  # Observe again; never inject input into an ungrounded window.
            raise RuntimeError("Local QA fixture missing; no input permitted")
        return [node for node in found if node.get("package") == package]

    def wait(predicate: Callable[[list[ET.Element]], bool], label: str) -> None:
        deadline = time.monotonic() + 12
        while time.monotonic() < deadline:
            found = nodes(allow_transition=True)
            if found and predicate(found):
                return
            time.sleep(0.15)
        raise AssertionError(f"Timed out: {label}")

    def is_open(found: list[ET.Element]) -> bool:
        return any(node.get("content-desc") == "Close modal" for node in found)

    def click_text(label: str) -> None:
        found = nodes()
        if not any(node.get("text") == label or node.get("content-desc") == label for node in found):
            raise AssertionError(f"Missing observed control: {label}")
        target = device(text=label)
        if not target.exists:
            target = device(description=label)
        target.click(timeout=5)

    def close() -> None:
        nodes()
        device.press("back")
        wait(lambda found: not is_open(found) and any(node.get("resource-id") in ("ui-qa-screen", "ui-qa-route") for node in found), "modal dismissed by Back")

    def capture(name: str) -> None:
        found = nodes()
        # Exclude system notifications and unrelated windows from persisted XML.
        root = ET.Element("vshop-ui", {"phase": args.phase})
        for node in found:
            ET.SubElement(root, "node", dict(node.attrib))
        ET.ElementTree(root).write(output / f"{args.phase}-{name}.xml", encoding="utf-8")
        device.screenshot().save(output / f"{args.phase}-{name}.png")

    def record(case_id: str, callback: Callable[[], None]) -> None:
        try:
            callback()
            cases.append({"id": case_id, "status": "PASS"})
        except AssertionError as error:
            cases.append({"id": case_id, "status": "FAIL", "reason": str(error)})

    def open_weapon() -> None:
        click_text("QA weapon picker")
        wait(is_open, "weapon picker visible")

    def modal_semantics() -> None:
        found = nodes()
        background = [node for node in found if node.get("clickable") == "true"
                      and node.get("content-desc", "").startswith("QA ")]
        assert not background, "Background QA controls remain in accessibility tree"
        targets = [node for node in found if node.get("content-desc", "").startswith("QASkin")]
        assert targets, "No skin options exposed"
        assert any(node.get("selected") == "true" for node in targets), "No selected skin state"
        close_node = next(node for node in found if node.get("content-desc") in ("Đóng", "Close"))
        x1, y1, x2, y2 = map(int, re.findall(r"\d+", close_node.get("bounds", "")))
        # Device density is read; pixel bounds are converted to dp, not CSS px.
        density_text = adb("shell", "wm", "density")
        density = int(re.findall(r"(?:Override|Physical) density: (\d+)", density_text)[-1]) / 160
        assert min(x2 - x1, y2 - y1) / density >= 47.5, "Close hit target below 48dp"

    def keyboard() -> None:
        click_text("QA title picker")
        wait(is_open, "title picker")
        nodes()
        search = device(className="android.widget.EditText")
        assert search.exists, "Search input missing"
        search.set_text("Tiếng Việt thử nghiệm không khớp 🧪")
        wait(lambda found: any("Tiếng Việt" in node.get("text", "") for node in found), "Unicode input")
        nodes()
        search.set_text("")
        wait(lambda found: any(node.get("text") == "QATitleB" for node in found), "clear restores results")
        nodes()
        device.press("back")  # Keyboard first when present; modal otherwise.
        if is_open(nodes()):
            close()

    report: dict[str, Any] = {"phase": args.phase, "serial": args.serial, "package": package,
        "build": "Native build identity captured from installed package; JS via local Metro", "cases": cases,
        "pixelLatency": "NOT MEASURED", "network": "local fixture; public preview art",
        "cycles": args.cycles, "timingLimit": "hierarchy checks add latency; not pixel timing"}
    try:
        ime_package = adb("shell", "settings", "get", "secure", "default_input_method").strip().split("/")[0]
        package_info = adb("shell", "dumpsys", "package", package)
        report["installedVersion"] = re.findall(r"version(?:Name|Code)=[^\s]+", package_info)
        device = uiautomator2.connect(args.serial)
        if is_open(nodes()):
            close()
        capture("fixture")
        record("N01", open_weapon)
        capture("weapon-picker")
        record("N02", modal_semantics)
        record("N03", close)
        record("N04", keyboard)
        if is_open(nodes()):
            close()
        adb("shell", "dumpsys", "gfxinfo", package, "reset")
        before_memory = adb("shell", "dumpsys", "meminfo", package)
        for _ in range(args.cycles):
            open_weapon()
            close()
        cases.append({"id": "N05", "status": "PASS", "samples": args.cycles})
        frame_summary = adb("shell", "dumpsys", "gfxinfo", package)
        (output / f"{args.phase}-gfxinfo.txt").write_text(frame_summary, encoding="utf-8")
        after_memory = adb("shell", "dumpsys", "meminfo", package)
        report["memoryTotalPssBeforeAfter"] = [
            re.findall(r"TOTAL PSS:\s*(\d+)", value) for value in (before_memory, after_memory)]
        report["gfxSummary"] = [line.strip() for line in frame_summary.splitlines()
            if any(term in line for term in ("Total frames", "Janky frames", "percentile", "Missed Vsync"))]
        capture("after-cycles")
    except Exception as error:
        report["blocked"] = str(error)
        recorded = {case["id"] for case in cases}
        cases.extend({"id": case_id, "status": "BLOCKED", "reason": str(error)}
                     for case_id in ("N01", "N02", "N03", "N04", "N05") if case_id not in recorded)
        raise
    finally:
        report["counts"] = {status: sum(case["status"] == status for case in cases)
                            for status in ("PASS", "FAIL", "BLOCKED")}
        (output / f"{args.phase}-native-results.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(report, ensure_ascii=False, indent=2))
    if any(case["status"] == "FAIL" for case in cases):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
