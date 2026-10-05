import sys
from pathlib import Path
import unittest
from unittest.mock import Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.android_ui_guard import DeviceNotReady, assert_screen_unlocked, assert_vshop_ready
from lib import android_ui_guard


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

    def package_reader(self, package, **kwargs):
        return self.reader(
            window=f"mDreamingLockscreen=false\nmCurrentFocus=Window{{a u0 {package}/.MainActivity}}",
            activity=f"topResumedActivity=ActivityRecord{{a u0 {package}/.MainActivity}}",
            **kwargs,
        )

    def test_explicit_startupqa_is_accepted_for_text_and_binary_readers(self):
        for binary in (False, True):
            with self.subTest(binary=binary):
                assert_vshop_ready(self.package_reader("com.android.vshop.startupqa", binary=binary),
                                   package="com.android.vshop.startupqa")

    def test_default_main_package_still_rejects_startupqa(self):
        with self.assertRaises(DeviceNotReady):
            assert_vshop_ready(self.package_reader("com.android.vshop.startupqa"))

    def test_invalid_package_is_rejected_before_any_device_read(self):
        for package in ("", "com.other", "evil.com.android.vshop", "com.android.vshop.evil",
                        "com.android.vshop.startupqa.evil", "comXandroidXvshop", None):
            read = Mock()
            with self.subTest(package=package), self.assertRaises(DeviceNotReady):
                assert_vshop_ready(read, package=package)
            read.assert_not_called()

    def test_selected_package_requires_exact_focus_and_resume_without_fallback(self):
        for selected in ("com.android.vshop", "com.android.vshop.startupqa"):
            for wrong in ("com.other", selected + ".evil", "evil." + selected,
                          selected.replace(".", "X"),
                          "com.android.vshop" if selected.endswith("startupqa") else "com.android.vshop.startupqa"):
                for field in ("focus", "resume"):
                    read = self.reader(
                        window=f"mDreamingLockscreen=false\nmCurrentFocus={wrong if field == 'focus' else selected}/.MainActivity",
                        activity=f"mResumedActivity: ActivityRecord{{{wrong if field == 'resume' else selected}/.MainActivity}}",
                    )
                    with self.subTest(selected=selected, wrong=wrong, field=field), self.assertRaises(DeviceNotReady):
                        assert_vshop_ready(read, package=selected)

    def test_startupqa_still_requires_awake_known_unlocked_screen(self):
        package = "com.android.vshop.startupqa"
        for power in ("mWakefulness=Asleep", "mWakefulness=Dozing", ""):
            with self.subTest(power=power), self.assertRaises(DeviceNotReady):
                assert_vshop_ready(self.package_reader(package, power=power), package=package)
        for state in ("", "mDreamingLockscreen=true", "mKeyguardShowing=true",
                      "isStatusBarKeyguard=true", "mKeyguardShowing=false\nisStatusBarKeyguard=true"):
            with self.subTest(state=state), self.assertRaises(DeviceNotReady):
                assert_vshop_ready(self.reader(window=f"{state}\nmCurrentFocus={package}/.MainActivity",
                                              activity=f"topResumedActivity={package}/.MainActivity"), package=package)

    def test_resumed_label_must_be_an_actual_activity_field(self):
        for label in ("notTopResumedActivity", "previous_mResumedActivity", "debug topResumedActivity"):
            with self.subTest(label=label), self.assertRaises(DeviceNotReady):
                assert_vshop_ready(self.reader(activity=f"{label}=com.android.vshop/.MainActivity"))

    def test_accepts_both_android_resumed_field_formats(self):
        for package in ("com.android.vshop", "com.android.vshop.startupqa"):
            for label in ("topResumedActivity=", "mResumedActivity: "):
                with self.subTest(package=package, label=label):
                    assert_vshop_ready(self.reader(
                        window=f"mDreamingLockscreen=false\nmCurrentFocus={package}/.MainActivity",
                        activity=f"  {label}ActivityRecord{{a u0 {package}/.MainActivity}}"), package=package)


class InstalledPackageTests(unittest.TestCase):
    def test_windows_line_endings_preserve_exact_package_metadata(self):
        dump = ("Packages:\r\n  Package [com.android.vshop.startupqa] (abc):\r\n"
                "    versionCode=92\r\n    versionName=4.2\r\n    pkgFlags=[ DEBUGGABLE ]\r\n")
        result = android_ui_guard.read_vshop_package_info(Mock(return_value=dump),
                                                         package="com.android.vshop.startupqa")
        self.assertEqual(result, {"installedVersionName": "4.2", "installedVersionCode": 92,
                                  "debuggable": True})

    def test_installed_versions_and_debug_flag_come_from_exact_selected_package(self):
        dump = (
            "Packages:\n"
            "  Package [com.android.vshop] (abc):\n"
            "    versionCode=91 minSdk=24\n    versionName=4.1\n    pkgFlags=[ HAS_CODE ]\n"
            "  Package [com.android.vshop.startupqa] (def):\n"
            "    versionCode=92 minSdk=24\n    versionName=4.2\n    pkgFlags=[ HAS_CODE DEBUGGABLE ]\n"
            "  Package [com.android.vshop.startupqa.evil] (fed):\n"
            "    versionCode=999\n    versionName=evil\n    pkgFlags=[ DEBUGGABLE ]\n"
        )
        for package, name, code, debug in (("com.android.vshop", "4.1", 91, False),
                                          ("com.android.vshop.startupqa", "4.2", 92, True)):
            for binary in (False, True):
                read = Mock(return_value=dump.encode() if binary else dump)
                with self.subTest(package=package, binary=binary):
                    result = android_ui_guard.read_vshop_package_info(read, package=package)
                    self.assertEqual(result, {"installedVersionName": name, "installedVersionCode": code,
                                              "debuggable": debug})
                read.assert_called_once_with("shell", "dumpsys", "package", package)

    def test_invalid_package_is_rejected_before_package_dumpsys(self):
        read = Mock()
        with self.assertRaises(DeviceNotReady):
            android_ui_guard.read_vshop_package_info(read, package="com.android.vshop.startupqa.evil")
        read.assert_not_called()

    def test_missing_ambiguous_or_incomplete_exact_package_is_rejected(self):
        header = "  Package [com.android.vshop.startupqa] (abc):\n"
        metadata = "    versionCode=92\n    versionName=4.2\n    pkgFlags=[ HAS_CODE ]\n"
        for dump in ("", header.replace("startupqa", "startupqa.evil") + metadata,
                     header + metadata + header + metadata, header + "    pkgFlags=[ DEBUGGABLE ]\n",
                     header + "    versionName=4.2\n" + header.replace("startupqa", "startupqa.evil") + metadata):
            with self.subTest(dump=dump), self.assertRaises(DeviceNotReady):
                android_ui_guard.read_vshop_package_info(Mock(return_value=dump), package="com.android.vshop.startupqa")


if __name__ == "__main__":
    unittest.main()
