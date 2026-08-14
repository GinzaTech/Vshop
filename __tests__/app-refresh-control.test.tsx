import React from "react";
import { RefreshControl, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import AppRefreshControl from "~/components/ui/AppRefreshControl";

describe("AppRefreshControl", () => {
  it("forwards the Android ScrollView child into the native refresh control", () => {
    const onRefresh = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <AppRefreshControl refreshing={false} onRefresh={onRefresh}>
          <View testID="scroll-content" />
        </AppRefreshControl>,
      );
    });

    expect(
      renderer.root.findByType(RefreshControl as never).props.children.props
        .testID,
    ).toBe("scroll-content");
  });
});
