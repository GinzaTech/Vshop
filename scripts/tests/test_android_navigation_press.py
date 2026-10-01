"""Host-only regression tests; never import or connect the device harness."""
import ast
from pathlib import Path
import unittest
from unittest.mock import Mock, call


HARNESS = Path(__file__).resolve().parents[1] / "verify-android-navigation.py"


class AndroidNavigationPressTests(unittest.TestCase):
    def setUp(self):
        # Isolate the nested function with mocked closure dependencies so these
        # tests need neither UIAutomator2 installed nor an attached Android device.
        source = ast.parse(HARNESS.read_text(encoding="utf-8"))
        main = next(node for node in source.body
                    if isinstance(node, ast.FunctionDef) and node.name == "main")
        press = next(node for node in main.body
                     if isinstance(node, ast.FunctionDef) and node.name == "press")
        self.actions = Mock()
        namespace = {
            "foreground": self.actions.foreground,
            "device": self.actions.device,
            "adb": self.actions.adb,
            "time": self.actions.time,
        }
        isolated = ast.fix_missing_locations(ast.Module(body=[press], type_ignores=[]))
        exec(compile(isolated, str(HARNESS), "exec"), namespace)
        self.press = namespace["press"]

    def test_verified_shop_bounds_use_center_click_after_readiness_check(self):
        # Main's ARTEMIS observation: Android 15, 1080x2400, density 420.
        self.press([244, 2223, 442, 2362])
        self.assertEqual(self.actions.mock_calls, [
            call.foreground(), call.device.click(343, 2292), call.time.sleep(0.7),
        ])

    def test_center_tracks_each_supplied_bounds_without_mutating_them(self):
        for rect, point in (([10, 20, 30, 60], (20, 40)),
                            ([101, 203, 302, 404], (201, 303)),
                            ([700, 1000, 900, 1200], (800, 1100))):
            with self.subTest(rect=rect):
                original = rect.copy()
                self.actions.reset_mock()
                self.press(rect)
                self.actions.device.click.assert_called_once_with(*point)
                self.assertEqual(rect, original)
                self.actions.adb.assert_not_called()

    def test_rapid_sequence_preserves_requested_delay(self):
        self.press([244, 2223, 442, 2362], delay=0.04)
        self.actions.time.sleep.assert_called_once_with(0.04)

    def test_readiness_failure_prevents_click_and_delay(self):
        self.actions.foreground.side_effect = RuntimeError("Device not ready")
        with self.assertRaisesRegex(RuntimeError, "Device not ready"):
            self.press([244, 2223, 442, 2362])
        self.assertEqual(self.actions.mock_calls, [call.foreground()])

    def test_click_failure_propagates_without_delay(self):
        self.actions.device.click.side_effect = RuntimeError("Click failed")
        with self.assertRaisesRegex(RuntimeError, "Click failed"):
            self.press([244, 2223, 442, 2362])
        self.actions.time.sleep.assert_not_called()


if __name__ == "__main__":
    unittest.main()
