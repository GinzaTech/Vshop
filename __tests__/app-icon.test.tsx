import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AppIcon, { type AppIconHandle } from "~/components/ui/AppIcon";

const mockMorphProps: Record<string, unknown>[] = [];
const mockMorphSet = jest.fn();

jest.mock("morphicons/react-native", () => {
  const ReactModule = require("react") as typeof import("react");
  return {
    MorphIcon: ReactModule.forwardRef(
      (props: Record<string, unknown>, ref: React.ForwardedRef<unknown>) => {
        mockMorphProps.push(props);
        ReactModule.useImperativeHandle(ref, () => ({
          morphTo: jest.fn(),
          set: mockMorphSet,
        }));
        return null;
      },
    ),
  };
});

describe("AppIcon", () => {
  beforeEach(() => {
    mockMorphProps.splice(0);
    mockMorphSet.mockClear();
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

    const accessibleLabels = mockMorphProps.filter(
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

  it("supports a visible spring and settles the current glyph imperatively", () => {
    const ref = React.createRef<AppIconHandle>();
    act(() => {
      TestRenderer.create(
        <AppIcon
          ref={ref}
          name="search"
          size={20}
          color="#fff"
          spring="bouncy"
        />,
      );
    });

    act(() => ref.current?.settle());

    expect(mockMorphProps.at(-1)?.spring).toBe("bouncy");
    expect(mockMorphSet).toHaveBeenCalledWith(mockMorphProps.at(-1)?.icon);
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

  it("renders the Valorant pistol through the same animated boundary", () => {
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

    expect(mockMorphProps).toHaveLength(1);
    expect(mockMorphProps.at(-1)).toMatchObject({
      size: 24,
      color: "#f00",
      label: "Sidearm",
      reducedMotion: "user",
      testID: "sidearm-icon",
    });
  });
});
