"""Host-only CLI regressions: all device transports are mocked."""
import contextlib
import io
import json
from pathlib import Path
import runpy
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.android_ui_guard import DeviceNotReady

SCRIPTS = Path(__file__).resolve().parents[1]
RUNNERS = (
    ("verify-android-navigation.py", "navigation-report.json"),
    ("verify-android-profile-selectors.py", "profile-selectors-report.json"),
    ("verify-android-local-ui.py", "local-ui-report.json"),
)
MAIN = "com.android.vshop"
QA = "com.android.vshop.startupqa"


class AndroidPackageHarnessTests(unittest.TestCase):
    def invoke(self, script, output, selected=None, foreground=QA, debuggable=True, complete_navigation=False):
        calls = []
        ui = Mock()
        ui.connect.side_effect = DeviceNotReady("Host regression stops before UI connection")
        if complete_navigation:
            routes = ("bundles", "shop", "profile", "night_market", "settings")
            active = [0]
            device = Mock()
            device.click.side_effect = lambda x, _y: active.__setitem__(0, x // 100)

            def hierarchy(**_kwargs):
                tabs = "".join(
                    f'<node resource-id="primary-tab-{route}" bounds="[{index * 100},100][{(index + 1) * 100},200]" '
                    f'selected="{str(index == active[0]).lower()}" />'
                    for index, route in enumerate(routes)
                )
                return ('<hierarchy><node resource-id="primary-navigation-frame" bounds="[0,100][500,200]" />'
                        '<node resource-id="primary-tab-capsule" bounds="[0,100][100,200]" />' + tabs + '</hierarchy>')

            device.dump_hierarchy.side_effect = hierarchy
            ui.connect.side_effect = None
            ui.connect.return_value = device

        def run(command, **_kwargs):
            parts = tuple(command[3:])
            calls.append(parts)
            if parts == ("shell", "getprop", "ro.kernel.qemu"):
                value = "0"
            elif parts == ("shell", "dumpsys", "power"):
                value = "mWakefulness=Awake"
            elif parts == ("shell", "dumpsys", "window"):
                value = f"mDreamingLockscreen=false\nmCurrentFocus={foreground}/.MainActivity"
            elif parts == ("shell", "dumpsys", "activity", "activities"):
                value = f"topResumedActivity={foreground}/.MainActivity"
            elif parts[:3] == ("shell", "dumpsys", "package"):
                flags = " DEBUGGABLE" if debuggable else ""
                value = (f"Packages:\n  Package [{parts[3]}] (abc):\n"
                         f"    versionCode=92 minSdk=24\n    versionName=4.2\n    pkgFlags=[ HAS_CODE{flags} ]\n")
            elif complete_navigation and parts[:3] == ("shell", "dumpsys", "gfxinfo"):
                value = "Total frames rendered: 8\nJanky frames: 0\n"
            elif complete_navigation and parts[:2] in (("shell", "wm"), ("shell", "settings")):
                value = "1"
            elif complete_navigation and parts == ("exec-out", "screencap", "-p"):
                value = "host mock screenshot"
            else:
                raise AssertionError(f"Unexpected host mock command: {parts}")
            return Mock(stdout=value.encode())

        argv = [script, "--serial", "45218ba", "--allow-physical", "--output", str(output)]
        if selected is not None:
            argv += ["--package", selected]
        with patch.dict(sys.modules, {"uiautomator2": ui}), patch("subprocess.run", side_effect=run), \
                patch.object(sys, "argv", argv), patch("time.sleep"), contextlib.redirect_stdout(io.StringIO()), \
                contextlib.redirect_stderr(io.StringIO()):
            namespace = runpy.run_path(str(SCRIPTS / script), run_name="host_regression")
            try:
                namespace["main"]()
            except (DeviceNotReady, RuntimeError, SystemExit) as error:
                return error, calls, ui
        if complete_navigation:
            return None, calls, ui
        self.fail("Host regression must stop before any UI action")

    def test_navigation_gfxinfo_and_every_guard_use_selected_package(self):
        with tempfile.TemporaryDirectory() as directory:
            for package in (MAIN, QA):
                with self.subTest(package=package):
                    output = Path(directory) / package
                    error, calls, _ui = self.invoke("verify-android-navigation.py", output,
                                                   selected=package, foreground=package, complete_navigation=True)
                    self.assertIsNone(error)
                    gfx_calls = [c for c in calls if c[:3] == ("shell", "dumpsys", "gfxinfo")]
                    self.assertEqual(gfx_calls, [("shell", "dumpsys", "gfxinfo", package, "reset"),
                                                 ("shell", "dumpsys", "gfxinfo", package, "framestats")])
                    report = json.loads((output / "navigation-report.json").read_text(encoding="utf-8"))
                    self.assertEqual(report["package"], package)
                    self.assertEqual(len(report["routes"]), 5)
                    self.assertEqual(report["status"], "PASS_NAVIGATION_SELECTION_AND_GEOMETRY")

    def test_all_runners_reject_invalid_package_before_any_transport(self):
        with tempfile.TemporaryDirectory() as directory:
            for script, _report in RUNNERS:
                for invalid in ("com.android.vshop.evil", "evil." + MAIN, QA + ".evil", "comXandroidXvshop"):
                    with self.subTest(script=script, invalid=invalid):
                        error, calls, ui = self.invoke(script, Path(directory), selected=invalid)
                        self.assertIsInstance(error, SystemExit)
                        self.assertEqual(error.code, 2)
                        self.assertEqual(calls, [])
                        ui.connect.assert_not_called()

    def test_opted_in_qa_queries_and_reports_its_own_installed_version(self):
        with tempfile.TemporaryDirectory() as directory:
            for script, report_name in RUNNERS:
                with self.subTest(script=script):
                    output = Path(directory) / script
                    error, calls, ui = self.invoke(script, output, selected=QA)
                    self.assertIsInstance(error, DeviceNotReady)
                    self.assertEqual([c for c in calls if c[:3] == ("shell", "dumpsys", "package")],
                                     [("shell", "dumpsys", "package", QA)])
                    ui.connect.assert_called_once_with("45218ba")
                    report = json.loads((output / report_name).read_text(encoding="utf-8"))
                    self.assertEqual(report["package"], QA)
                    self.assertEqual(report["installedVersionName"], "4.2")
                    self.assertEqual(report["installedVersionCode"], 92)
                    self.assertEqual(report["status"], "BLOCKED_DEVICE_NOT_READY")

    def test_default_main_stops_before_connecting_to_qa(self):
        with tempfile.TemporaryDirectory() as directory:
            for script, report_name in RUNNERS:
                with self.subTest(script=script):
                    output = Path(directory) / script
                    error, calls, ui = self.invoke(script, output)
                    self.assertIsInstance(error, DeviceNotReady)
                    ui.connect.assert_not_called()
                    report = json.loads((output / report_name).read_text(encoding="utf-8"))
                    self.assertEqual(report["package"], MAIN)
                    self.assertEqual(report["status"], "BLOCKED_DEVICE_NOT_READY")
                    self.assertFalse(any(c[:3] == ("shell", "dumpsys", "package") for c in calls))

    def test_default_main_queries_main_installed_version(self):
        with tempfile.TemporaryDirectory() as directory:
            for script, report_name in RUNNERS:
                with self.subTest(script=script):
                    output = Path(directory) / script
                    error, calls, _ui = self.invoke(script, output, foreground=MAIN)
                    self.assertIsInstance(error, DeviceNotReady)
                    self.assertIn(("shell", "dumpsys", "package", MAIN), calls)
                    report = json.loads((output / report_name).read_text(encoding="utf-8"))
                    self.assertEqual(report["package"], MAIN)
                    self.assertEqual(report["installedVersionCode"], 92)

    def test_local_fixture_still_rejects_non_debuggable_qa_before_ui_connect(self):
        with tempfile.TemporaryDirectory() as directory:
            error, calls, ui = self.invoke("verify-android-local-ui.py", Path(directory),
                                           selected=QA, debuggable=False)
            self.assertIsInstance(error, RuntimeError)
            self.assertNotIsInstance(error, DeviceNotReady)
            self.assertIn("development package", str(error))
            self.assertIn(("shell", "dumpsys", "package", QA), calls)
            ui.connect.assert_not_called()


if __name__ == "__main__":
    unittest.main()
