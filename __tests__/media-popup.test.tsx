import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Provider as PaperProvider } from "react-native-paper";

import MediaPopup, {
  useMediaPopupStore,
} from "~/components/popups/MediaPopup";

jest.mock("@expo/vector-icons/MaterialCommunityIcons", () =>
  function MockMaterialCommunityIcon() {
    return null;
  },
);

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => ({ chromas: "Chromas", levels: "Levels" })[key] ?? key,
  }),
}));

jest.mock("expo-video", () => ({
  useVideoPlayer: () => ({ play: jest.fn() }),
  VideoView: () => null,
}));

jest.mock("~/components/CachedImage", () => ({
  CachedImage: () => null,
}));

describe("MediaPopup", () => {
  beforeEach(() => {
    act(() => useMediaPopupStore.getState().hideMediaPopup());
  });

  it("mounts its portal only when opened so it is above lazy screen modals", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<MediaPopup />);
    });

    expect(renderer.toJSON()).toBeNull();

    act(() => renderer.unmount());

    act(() => {
      useMediaPopupStore
        .getState()
        .showMediaPopup(
          [
            {
              cacheId: "level-one",
              group: "level",
              kind: "image",
              label: "Level 1",
              uri: "https://example.com/skin.png",
            },
            {
              cacheId: "chroma-one",
              group: "chroma",
              kind: "image",
              label: "Red",
              uri: "https://example.com/red.png",
            },
          ],
          "Skin",
        );
    });

    act(() => {
      renderer = TestRenderer.create(
        <PaperProvider>
          <MediaPopup />
        </PaperProvider>,
      );
    });

    expect(
      renderer.root.findByProps({ accessibilityLabel: "Close media viewer" }),
    ).toBeDefined();
    expect(renderer.root.findByProps({ testID: "media-tab-level-0" }))
      .toBeDefined();
    expect(renderer.root.findByProps({ testID: "media-tab-chroma-0" }))
      .toBeDefined();

    act(() => {
      renderer.root.findByProps({ testID: "media-tab-chroma-0" }).props.onPress();
    });

    expect(useMediaPopupStore.getState().selectedIndex).toBe(1);

    act(() => useMediaPopupStore.getState().hideMediaPopup());

    expect(
      renderer.root.findAllByProps({
        accessibilityLabel: "Close media viewer",
      }),
    ).toHaveLength(0);
  });
});
