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
        .showMediaPopup(["https://example.com/skin.png"], "Skin");
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

    act(() => useMediaPopupStore.getState().hideMediaPopup());

    expect(
      renderer.root.findAllByProps({
        accessibilityLabel: "Close media viewer",
      }),
    ).toHaveLength(0);
  });
});
