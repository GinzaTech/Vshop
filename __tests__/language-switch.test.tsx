import React from "react";
import { Alert } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import Language from "~/app/language";

const mockEvents: string[] = [];
const mockGoBack = jest.fn(() => { mockEvents.push("back"); });
const mockChange = jest.fn(() => { mockEvents.push("change"); return Promise.resolve(); });
jest.mock("react", () => {
 const actual = jest.requireActual<typeof React>("react");
 return { ...actual, startTransition: (work: () => void) => {
   mockEvents.push("transition"); actual.startTransition(work);
 } };
});
jest.mock("expo-router", () => ({ useNavigation: () => ({ goBack: mockGoBack }) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({
  i18n: { language: "vi", changeLanguage: mockChange },
  t: (key: string) => key,
}) }));
jest.mock("~/utils/localization", () => ({ resources: { vi: {}, en: {} } }));
jest.mock("~/components/ui/GlassCard", () => ({ __esModule: true, default: ({ children }: React.PropsWithChildren) => <>{children}</> }));
jest.mock("react-native-paper/lib/module/components/RadioButton/index", () => {
 const ReactModule = require("react") as typeof React;
 return { __esModule: true, default: {
  Group: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => ReactModule.createElement("RadioGroup", props, children),
  Item: () => null,
} }; });

describe("Language selection responsiveness", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  beforeEach(() => {
    mockEvents.length = 0;
    mockChange.mockClear(); mockGoBack.mockClear();
    act(() => { renderer = TestRenderer.create(<Language />); });
  });
  afterEach(() => { act(() => renderer.unmount()); });
  const select = (value: string) => renderer.root.findByType("RadioGroup" as never).props.onValueChange(value);

  it("requests native Back before broadcasting translations at transition priority", async () => {
    await act(async () => { select("en"); });
    expect(mockEvents).toEqual(["back", "transition", "change"]);
    expect(mockChange).toHaveBeenCalledWith("en");
  });
  it("ignores a rapid duplicate selection", async () => {
    await act(async () => { select("en"); select("en"); });
    expect(mockChange).toHaveBeenCalledTimes(1);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
  it("closes an already-selected locale without another global text broadcast", async () => {
    await act(async () => { select("vi"); });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockChange).not.toHaveBeenCalled();
  });
  it("ignores unsupported locale values", async () => {
    await act(async () => { select("not-supported"); });
    expect(mockGoBack).not.toHaveBeenCalled();
    expect(mockChange).not.toHaveBeenCalled();
  });
  it("reports a rejected change instead of leaving an unhandled promise", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    mockChange.mockRejectedValueOnce(new Error("fixture"));
    await act(async () => { select("en"); });
    expect(alert).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });
});
