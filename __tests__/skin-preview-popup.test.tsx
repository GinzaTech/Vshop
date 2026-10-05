import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { Provider as PaperProvider } from "react-native-paper";
import MediaPopup, { useMediaPopupStore, type MediaPopupEntry } from "~/components/popups/MediaPopup";
import { SKIN_PREVIEW_MATERIAL } from "~/constants/DesignSystem";

jest.mock("~/components/ui/AppIcon", () => () => null);
jest.mock("~/components/CachedImage", () => ({ CachedImage: () => null }));
jest.mock("~/components/ui/AppViewport", () => ({ useAppWindowDimensions: () => ({ width: 390, height: 844, fontScale: 1 }) }));
jest.mock("react-native-safe-area-context", () => ({ ...jest.requireActual("react-native-safe-area-context"), useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }) }));
jest.mock("~/utils/valorant-assets", () => ({ getAssets: () => ({}) }));
jest.mock("~/hooks/useAppTranslation", () => ({ useTranslation: () => ({ t: (key: string, args?: { defaultValue?: string }) => args?.defaultValue ?? key }) }));
jest.mock("expo-video", () => ({ useVideoPlayer: () => ({ play: jest.fn(), status: "loading", addListener: () => ({ remove: jest.fn() }) }), VideoView: "VideoView" }));
const entries: MediaPopupEntry[] = [
  { cacheId: "one", group: "level", kind: "video", label: "Level 1", uri: "https://example.com/video", imageUri: "https://example.com/one.png", videoUri: "https://example.com/video" },
  { cacheId: "two", group: "level", kind: "image", label: "Level 2", uri: "https://example.com/two.png", imageUri: "https://example.com/two.png" },
  { cacheId: "blue", group: "chroma", kind: "image", label: "Blue", uri: "https://example.com/blue.png", imageUri: "https://example.com/blue.png", swatchUri: "https://example.com/swatch.png" },
];
let renderer: TestRenderer.ReactTestRenderer;
function mount() {
  act(() => useMediaPopupStore.getState().showMediaPopup(entries, "CYRAX Stinger"));
  act(() => { renderer = TestRenderer.create(<PaperProvider><MediaPopup /></PaperProvider>); });
  return renderer.root;
}
beforeEach(() => { act(() => { useMediaPopupStore.getState().hideMediaPopup(); useMediaPopupStore.setState({ videoMode: false }); }); });
afterEach(() => { act(() => renderer?.unmount()); });

it("opens a still preview first with the named header above the art and an explicit video action", () => {
  const root = mount();
  expect(root.findAllByType("VideoView" as React.ElementType)).toHaveLength(0);
  expect(root.findByProps({ testID: "media-preview-artwork" }).props.source).toEqual({ uri: entries[0].imageUri });
  const output = JSON.stringify(renderer.toJSON());
  expect(root.findByProps({ testID: "media-preview-header" })).toBeDefined();
  expect(output.indexOf("media-preview-header")).toBeLessThan(output.indexOf("media-preview-frame"));
  expect(root.findByProps({ testID: "media-video-toggle" }).props.accessibilityRole).toBe("button");
});
it("renders as a centered bounded popup with four rounded corners instead of a full-screen sheet", () => {
  const root = mount();
  const modal = root.findByProps({ testID: "media-popup-dialog" }).parent!.parent!;
  expect(StyleSheet.flatten(modal.props.style).justifyContent).toBe("center");
  const sheet = root.findByProps({ testID: "media-popup-dialog" });
  const style = StyleSheet.flatten(sheet.props.style);
  expect(style.height).toBeUndefined();
  expect(style.maxHeight).toBeLessThan(844);
  expect(style).toMatchObject({ borderRadius: 28, width: "100%" });
  expect(StyleSheet.flatten(sheet.parent!.props.style).paddingHorizontal).toBe(16);
});
it("shows red level selection, actual variant swatch and a native48dp close target", () => {
  const root = mount();
  const selected = root.findByProps({ testID: "media-tab-level-0" });
  expect(StyleSheet.flatten(selected.props.style({ pressed: false })).backgroundColor).toBe(SKIN_PREVIEW_MATERIAL.activeLevel);
  expect(root.findByProps({ testID: "media-variant-swatch-0" }).props.source).toEqual({ uri: entries[2].swatchUri });
  const close = root.findByProps({ accessibilityLabel: "Close media viewer" });
  expect(StyleSheet.flatten(close.props.style({ pressed: false })).width).toBeGreaterThanOrEqual(48);
  expect(StyleSheet.flatten(close.props.style({ pressed: false })).height).toBeGreaterThanOrEqual(48);
});
it("resets video mode atomically when opening, selecting or closing", () => {
  mount();
  act(() => useMediaPopupStore.getState().setVideoMode(true));
  expect(useMediaPopupStore.getState().videoMode).toBe(true);
  act(() => useMediaPopupStore.getState().setSelectedIndex(1));
  expect(useMediaPopupStore.getState().videoMode).toBe(false);
  act(() => useMediaPopupStore.getState().setVideoMode(true));
  expect(useMediaPopupStore.getState().videoMode).toBe(false); // Image-only entry has no video.
  act(() => useMediaPopupStore.getState().hideMediaPopup());
  expect(useMediaPopupStore.getState().entries).toHaveLength(0);
});
it("retains the video action owner while replacing the media decoder", () => {
  const root = mount();
  const button = root.findByProps({ testID: "media-video-toggle" });
  act(() => button.props.onPress());
  expect(root.findAllByType("VideoView" as React.ElementType)).toHaveLength(1);
  expect(root.findByProps({ testID: "media-video-toggle" })).toBe(button);
  act(() => root.findByProps({ testID: "media-video-toggle" }).props.onPress());
  expect(root.findAllByType("VideoView" as React.ElementType)).toHaveLength(0);
  expect(root.findByProps({ testID: "media-video-toggle" })).toBe(button);
});
it("rejects old selector, video and dismiss callbacks after reopening the same input", () => {
  const root = mount();
  const selectOld = root.findByProps({ testID: "media-tab-level-1" }).props.onPress;
  const videoOld = root.findByProps({ testID: "media-video-toggle" }).props.onPress;
  const closeOld = root.findByProps({ accessibilityLabel: "Close media viewer" }).props.onPress;
  act(() => useMediaPopupStore.getState().showMediaPopup(entries, "New owner"));
  const current = useMediaPopupStore.getState().entries;
  act(() => { selectOld(); videoOld(); closeOld(); });
  expect(useMediaPopupStore.getState().entries).toBe(current);
  expect(useMediaPopupStore.getState()).toMatchObject({ text: "New owner", selectedIndex: 0, videoMode: false });
});
it("switches from a variant to the exact level preview instead of mixing their media", () => {
  const root = mount();
  act(() => useMediaPopupStore.getState().showMediaPopup([...entries.slice(0,2),
    { ...entries[2], cacheId: "base", imageUri: entries[0].imageUri }, entries[2]], "Variants"));
  act(() => root.findByProps({ testID: "media-tab-chroma-1" }).props.onPress());
  expect(root.findByProps({ testID: "media-preview-artwork" }).props.source).toEqual({ uri: entries[2].imageUri });
  act(() => root.findByProps({ testID: "media-tab-level-1" }).props.onPress());
  expect(root.findByProps({ testID: "media-preview-artwork" }).props.source).toEqual({ uri: entries[1].imageUri });
  expect(root.findByProps({ testID: "media-tab-level-1" }).props.accessibilityState.selected).toBe(true);
  expect(root.findByProps({ testID: "media-tab-chroma-1" }).props.accessibilityState.selected).toBe(false);
});
it("ignores retired still-image errors across image to video to image", () => {
  const root = mount();
  const errorOld = root.findByProps({ testID: "media-preview-artwork" }).props.onError;
  act(() => root.findByProps({ testID: "media-video-toggle" }).props.onPress());
  act(() => root.findByProps({ testID: "media-video-toggle" }).props.onPress());
  act(() => errorOld());
  expect(root.findAllByProps({ testID: "media-popup-error" })).toHaveLength(0);
});
it("keeps video-only skin metadata opt-in with an honest missing-image placeholder", () => {
  const root = mount();
  act(() => useMediaPopupStore.getState().showMediaPopup([{ ...entries[0], imageUri: undefined }], "Video-only skin"));
  expect(root.findAllByType("VideoView" as React.ElementType)).toHaveLength(0);
  expect(root.findByProps({ testID: "media-video-toggle" })).toBeDefined();
  act(() => root.findByProps({ testID: "media-video-toggle" }).props.onPress());
  expect(root.findAllByType("VideoView" as React.ElementType)).toHaveLength(1);
});
