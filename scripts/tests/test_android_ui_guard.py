import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.android_ui_guard import DeviceNotReady, assert_screen_unlocked, assert_vshop_ready


class AndroidUiGuardTests(unittest.TestCase):
    def reader(self, power="mWakefulness=Awake", window=None, activity=None, binary=False):
        outputs = {
            ("shell", "dumpsys", "power"): power,
            ("shell", "dumpsys", "window"): window if window is not None else
                "mDreamingLockscreen=false\nmCurrentFocus=Window{a u0 com.android.vshop/com.android.vshop.MainActivity}",
            ("shell", "dumpsys", "activity", "activities"): activity if activity is not None else
                "topResumedActivity=ActivityRecord{a u0 com.android.vshop/.MainActivity}",
        }
        def read(*parts):
            result = outputs[parts]
            return result.encode() if binary else result
        return read

    def test_accepts_only_awake_unlocked_focused_app(self):
        assert_vshop_ready(self.reader())
        assert_vshop_ready(self.reader(binary=True))

    def test_rejects_sleep_and_unknown_power_without_more_reads(self):
        for state in ("Dozing", "Asleep", "Dreaming", ""):
            calls = []
            def read(*parts):
                calls.append(parts)
                return f"mWakefulness={state}"
            with self.subTest(state=state), self.assertRaises(DeviceNotReady):
                assert_vshop_ready(read)
            self.assertEqual(len(calls), 1)

    def test_rejects_any_active_keyguard_even_if_app_is_still_resumed(self):
        for flag in ("mDreamingLockscreen", "mKeyguardShowing", "isStatusBarKeyguard"):
            with self.subTest(flag=flag), self.assertRaises(DeviceNotReady):
                assert_vshop_ready(self.reader(window=f"{flag}=true\nmCurrentFocus=com.android.vshop/.MainActivity"))

    def test_unknown_lock_state_is_not_assumed_unlocked(self):
        with self.assertRaises(DeviceNotReady):
            assert_vshop_ready(self.reader(window="mCurrentFocus=com.android.vshop/.MainActivity"))

    def test_other_focused_window_blocks_actions_despite_stale_app_activity(self):
        with self.assertRaises(DeviceNotReady):
            assert_vshop_ready(self.reader(window="mDreamingLockscreen=false\nmCurrentFocus=Window{NotificationShade}"))

    def test_other_resumed_activity_blocks_actions_despite_stale_app_focus(self):
        with self.assertRaises(DeviceNotReady):
            assert_vshop_ready(self.reader(activity="topResumedActivity=ActivityRecord{com.other/.MainActivity}"))

    def test_missing_or_ambiguous_focus_is_rejected(self):
        for focus in ("", "mCurrentFocus=com.android.vshop/.MainActivity\nmCurrentFocus=com.android.vshop/.MainActivity"):
            with self.subTest(focus=focus), self.assertRaises(DeviceNotReady):
                assert_vshop_ready(self.reader(window="mDreamingLockscreen=false\n" + focus))

    def test_package_prefix_is_not_accepted(self):
        for package in ("com.android.vshop.other", "evil.com.android.vshop"):
            with self.subTest(package=package), self.assertRaises(DeviceNotReady):
                assert_vshop_ready(self.reader(window=f"mDreamingLockscreen=false\nmCurrentFocus={package}/.MainActivity"))

    def test_unlock_check_can_precede_an_explicit_app_launch(self):
        assert_screen_unlocked(self.reader(window="mDreamingLockscreen=false\nmCurrentFocus=com.miui.home/.Launcher"))

    def test_transport_failure_exposes_no_raw_diagnostic_payload(self):
        def read(*_parts):
            raise RuntimeError("private transport payload")
        with self.assertRaises(DeviceNotReady) as raised:
            assert_vshop_ready(read)
        self.assertNotIn("private", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
