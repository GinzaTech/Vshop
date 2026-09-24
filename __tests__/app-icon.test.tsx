import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AppIcon from "~/components/ui/AppIcon";

const mockMorphProps: Record<string, unknown>[] = [];
const mockLegacyProps: Record<string, unknown>[] = [];

jest.mock("morphicons/react-native", () => ({
  MorphIcon: (props: Record<string, unknown>) => {
    mockMorphProps.push(props);
    return null;
  },
}));

jest.mock("@expo/vector-icons/MaterialCommunityIcons", () =>
  function MockMaterialCommunityIcons(props: Record<string, unknown>) {
    mockLegacyProps.push(props);
    return null;
  }
);

describe("AppIcon", () => {
  beforeEach(() => {
    mockMorphProps.splice(0);
    mockLegacyProps.splice(0);
  });

  it("always honors system Reduce Motion and ignores caller overrides", () => {
    const attemptedOverride = {
      reducedMotion: "never",
    } as Record<string, unknown>;

    act(() => {
      TestRenderer.create(
        <AppIcon
          {...attemptedOverride}
          name="search"
          size={20}
          color="#fff"
          strokeWidth={1.5}
          label="Search"
          testID="search-icon"
        />
      );
    });

    expect(mockMorphProps.at(-1)).toMatchObject({
      reducedMotion: "user",
      spring: "snappy",
      size: 20,
      color: "#fff",
      strokeWidth: 1.5,
      label: "Search",
      testID: "search-icon",
    });
  });

  it("exposes exactly one label when the icon is the accessible control", () => {
    act(() => {
      TestRenderer.create(
        <AppIcon name="search" size={20} color="#fff" label="Search" />
      );
    });

    const accessibleLabels = [...mockMorphProps, ...mockLegacyProps].filter(
      (props) => props.label === "Search" || props.accessibilityLabel === "Search"
    );

    expect(accessibleLabels).toHaveLength(1);
    expect(mockMorphProps.at(-1)?.label).toBe("Search");
  });

  it("keeps decorative morph icons out of the accessibility tree", () => {
    act(() => {
      TestRenderer.create(
        <AppIcon
          name="search"
          size={20}
          color="#fff"
          label="Search"
          decorative
        />
      );
    });

    expect(mockMorphProps).toHaveLength(1);
    expect(mockMorphProps.at(-1)?.label).toBeUndefined();
    expect(mockMorphProps.at(-1)?.reducedMotion).toBe("user");
  });

  it("updates one mounted morph when semantic state changes", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AppIcon name="search" size={20} color="#fff" />
      );
    });
    act(() => {
      renderer!.update(<AppIcon name="close" size={20} color="#fff" />);
    });

    expect(mockMorphProps).toHaveLength(2);
    expect(mockMorphProps[0].icon).not.toBe(mockMorphProps[1].icon);
    expect(mockMorphProps.every((props) => props.reducedMotion === "user")).toBe(
      true
    );
  });

  it("fills the same Heart glyph when the selected state changes", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AppIcon name="heart" size={20} color="#f43f5e" />
      );
    });
    act(() => {
      renderer!.update(
        <AppIcon name="heartFilled" size={20} color="#f43f5e" />
      );
    });

    expect(mockMorphProps).toHaveLength(2);
    expect(mockMorphProps[0]).toMatchObject({ fill: "none" });
    expect(mockMorphProps[1]).toMatchObject({ fill: "#f43f5e" });
    expect(mockMorphProps[0].icon).toBe(mockMorphProps[1].icon);
  });

  it("keeps the controlled legacy fallback hidden from accessibility", () => {
    act(() => {
      TestRenderer.create(
        <AppIcon
          name="weaponPistol"
          size={24}
          color="#f00"
          label="Sidearm"
          testID="sidearm-icon"
        />
      );
    });

    expect(mockMorphProps).toHaveLength(0);
    expect(mockLegacyProps.at(-1)).toMatchObject({
      name: "pistol",
      size: 24,
      color: "#f00",
      importantForAccessibility: "no",
      accessibilityElementsHidden: true,
      testID: "sidearm-icon",
    });
    expect(mockLegacyProps.at(-1)).not.toHaveProperty("accessibilityLabel");
  });
});
