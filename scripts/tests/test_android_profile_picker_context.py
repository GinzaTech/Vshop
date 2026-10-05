"""Host-only guard regressions grounded in the observed native Modal tree."""
import ast
from pathlib import Path
import re
import unittest
from unittest.mock import Mock
import xml.etree.ElementTree as ET


class ProfilePickerContextTests(unittest.TestCase):
    def setUp(self):
        harness = Path(__file__).resolve().parents[1] / "verify-android-profile-selectors.py"
        parsed = ast.parse(harness.read_text(encoding="utf-8"))
        function = next(n for n in parsed.body if isinstance(n, ast.FunctionDef)
                        and n.name == "profile_context_visible")
        namespace = {"re": re}
        exec(compile(ast.fix_missing_locations(ast.Module(body=[function], type_ignores=[])), str(harness), "exec"), namespace)
        self.check = namespace["profile_context_visible"]

    def node(self, **attrs):
        return ET.Element("node", attrs)

    def modal(self, title="Chọn Graffiti hoặc Flex", slot="Vị trí 1"):
        return [self.node(**{"resource-id": "modal-surface"}),
                self.node(**{"content-desc": "Close modal"}),
                self.node(text=title), self.node(text=slot),
                self.node(**{"content-desc": "Đóng", "clickable": "true"})]

    def test_native_modal_is_valid_without_hidden_background_profile_row(self):
        self.assertTrue(self.check(self.modal()))
        self.assertTrue(self.check(self.modal("Choose Graffiti or Flex", "Slot 4")))

    def test_closed_profile_requires_its_actual_row_marker(self):
        self.assertTrue(self.check([self.node(**{"resource-id": "profile-expression-row"})]))
        self.assertFalse(self.check([]))

    def test_backdrop_alone_other_modal_invalid_slot_or_missing_close_are_rejected(self):
        self.assertFalse(self.check([self.node(**{"content-desc": "Close modal"})]))
        self.assertFalse(self.check(self.modal("Skin preview")))
        self.assertFalse(self.check(self.modal(slot="Vị trí 5")))
        self.assertFalse(self.check(self.modal()[:-1]))

    def test_background_row_does_not_authorize_an_unrelated_modal(self):
        self.assertFalse(self.check(self.modal("Other modal") + [self.node(**{"resource-id": "profile-expression-row"})]))

    def wait_function(self, tree):
        harness = Path(__file__).resolve().parents[1] / "verify-android-profile-selectors.py"
        parsed = ast.parse(harness.read_text(encoding="utf-8"))
        context = next(n for n in parsed.body if isinstance(n, ast.ClassDef) and n.name == "ProfileContextNotReady")
        main = next(n for n in parsed.body if isinstance(n, ast.FunctionDef) and n.name == "main")
        wait = next(n for n in main.body if isinstance(n, ast.FunctionDef) and n.name == "wait_for")
        namespace = {"tree": tree, "time": Mock()}
        namespace["time"].monotonic.return_value = 0
        exec(compile(ast.fix_missing_locations(ast.Module(body=[context, wait], type_ignores=[])), str(harness), "exec"), namespace)
        return namespace

    def test_wait_observes_again_without_evaluating_or_tapping_unknown_modal(self):
        tree = Mock()
        ns = self.wait_function(tree)
        nodes = self.modal()
        tree.side_effect = [ns["ProfileContextNotReady"]("entrance"), nodes]
        predicate = Mock(return_value=True)
        self.assertIs(ns["wait_for"](predicate, "modal"), nodes)
        predicate.assert_called_once()
        self.assertEqual(tree.call_count, 2)

    def test_wait_does_not_swallow_other_guard_or_transport_failures(self):
        tree = Mock(side_effect=RuntimeError("not ready"))
        ns = self.wait_function(tree)
        predicate = Mock()
        with self.assertRaisesRegex(RuntimeError, "not ready"):
            ns["wait_for"](predicate, "modal")
        predicate.assert_not_called()
        ns["time"].sleep.assert_not_called()


if __name__ == "__main__":
    unittest.main()
