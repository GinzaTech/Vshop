import React from "react";
import { TouchableOpacity } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import TestRenderer, { act } from "react-test-renderer";

import { ProfileHeroCard } from "~/features/profile/ProfileHeroCard";
import { ProfilePickerModal } from "~/features/profile/ProfilePickerModal";

function MockAppIcon(props: Record<string, unknown>) {
  return React.createElement("AppIcon", props);
}

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));
jest.mock("~/components/CachedImage", () => ({ CachedImage: () => null }));
jest.mock("~/components/CurrencyIcon", () => () => null);
jest.mock("~/components/profile/CompactPlayerProfileCard", () => ({
  CompactPlayerProfileCard: () => null,
}));
jest.mock("~/components/profile/RankSplitGroup", () => () => null);
jest.mock("~/components/profile/TypewriterSwapText", () => () => null);
jest.mock("~/components/ui/AppIcon", () => ({
  __esModule: true,
  default: MockAppIcon,
}));
jest.mock("react-native-paper/lib/module/components/Modal", () => {
  const ReactModule = require("react") as typeof React;

  return {
    __esModule: true,
    default: ({ children }: React.PropsWithChildren) =>
      ReactModule.createElement("Modal", null, children),
  };
});
jest.mock("react-native-paper/lib/module/components/Portal/Portal", () => {
  const ReactModule = require("react") as typeof React;

  return {
    __esModule: true,
    default: ({ children }: React.PropsWithChildren) =>
      ReactModule.createElement("Portal", null, children),
  };
});
jest.mock("react-native-paper/lib/module/components/Searchbar", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("react-native-reanimated", () => {
  const ReactModule = require("react") as typeof React;
  const AnimatedView = ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement("AnimatedView", props, children);

  return {
    __esModule: true,
    default: { View: AnimatedView },
    interpolate: (value: number, input: number[], output: number[]) =>
      value <= input[0] ? output[0] : output.at(-1),
    interpolateColor: (
      value: number,
      input: number[],
      output: string[],
    ) => (value <= input[0] ? output[0] : output.at(-1)),
    useAnimatedStyle: (factory: () => unknown) => factory(),
  };
});

const sharedValue = (value: number): SharedValue<number> =>
  ({ value }) as SharedValue<number>;

const createHeroProps = (
  isPlayerInfoMode: boolean,
): React.ComponentProps<typeof ProfileHeroCard> => ({
  accountLevel: 42,
  actRankSummaryStats: {
    left: [
      { icon: "target", key: "wins", label: "Wins", value: "1" },
      { icon: "target", key: "kills", label: "Kills", value: "2" },
    ],
    right: [
      { icon: "target", key: "assists", label: "Assists", value: "3" },
      { icon: "target", key: "headshots", label: "Headshots", value: "4" },
    ],
  },
  competitiveRank: null,
  expandedHeroHeight: sharedValue(292),
  hasAuth: true,
  heroModeProgress: sharedValue(isPlayerInfoMode ? 1 : 0),
  identityDetails: null,
  isPlayerInfoMode,
  name: "Player",
  onRegionPress: jest.fn(),
  onToggleMode: jest.fn(),
  pageModeProgress: sharedValue(isPlayerInfoMode ? 1 : 0),
  profileModeTransitioning: false,
  profileStats: [
    { icon: "vp", key: "vp", label: "VP", value: 1 },
    { icon: "rad", key: "rad", label: "RP", value: 2 },
    { icon: "kc", key: "kc", label: "KC", value: 3 },
  ],
  rankSplitContentMode: "rank",
  rankSplitProgress: sharedValue(isPlayerInfoMode ? 1 : 0),
  regionLabel: "AP",
  statsVisibilityProgress: sharedValue(1),
  synced: true,
  tagLine: "VSHOP",
});

const pickerBaseProps: Omit<
  React.ComponentProps<typeof ProfilePickerModal>,
  "pickerState"
> = {
  activeWeaponChroma: null,
  handleDismissPicker: jest.fn(),
  handleEquipExpression: jest.fn(),
  handleEquipIdentity: jest.fn(),
  handleEquipSpray: jest.fn(),
  handleEquipWeapon: jest.fn(),
  handleOpenExpressionPicker: jest.fn(),
  identityDetails: null,
  identityPickerQuery: "",
  palette: {
    accent: "#ff4655",
    background: "#ffffff",
    card: "#ffffff",
    cardBorder: "#dddddd",
    chipBackground: "#eeeeee",
    textPrimary: "#111111",
    textSecondary: "#666666",
  },
  pickerError: null,
  pickerLoading: false,
  setActiveWeaponChroma: jest.fn(),
  setIdentityPickerQuery: jest.fn(),
  updatingLoadout: false,
};

describe("Profile semantic icon state motion", () => {
  it("keeps the hero button mounted while changing equipmentProfile to playerStats", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <ProfileHeroCard {...createHeroProps(false)} />,
      );
    });

    const button = renderer!.root.findByProps({
      accessibilityLabel: "profile_page.player_info",
    });
    expect(button.props.accessibilityRole).toBe("button");
    expect(button.props.accessibilityState).toEqual({
      busy: false,
      disabled: false,
      selected: false,
    });
    expect(button.findByType(MockAppIcon).props).toMatchObject({
      decorative: true,
      name: "equipmentProfile",
    });

    act(() => {
      renderer!.update(<ProfileHeroCard {...createHeroProps(true)} />);
    });

    const updatedButton = renderer!.root.findByProps({
      accessibilityLabel: "profile_page.player_info",
    });
    expect(updatedButton).toBe(button);
    expect(updatedButton.props.accessibilityState).toEqual({
      busy: false,
      disabled: false,
      selected: true,
    });
    expect(updatedButton.findByType(MockAppIcon).props).toMatchObject({
      decorative: true,
      name: "playerStats",
    });
    act(() => renderer!.unmount());
  });

  it("keeps a picker row mounted while changing unselected to selected", () => {
    const createPicker = (selected: boolean) => (
      <ProfilePickerModal
        {...pickerBaseProps}
        pickerState={{
          options: [{ id: "title-1", name: "Champion", selected }],
          type: "player-title",
        }}
      />
    );
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(createPicker(false));
    });

    const closeTarget = renderer!.root.find(
      (node) =>
        node.type === TouchableOpacity &&
        node.props.accessibilityLabel === "common.close",
    );
    expect(closeTarget.props.accessibilityRole).toBe("button");
    const closeIcon = closeTarget.findByType(MockAppIcon);
    expect(closeIcon.props).toMatchObject({
      decorative: true,
      name: "close",
    });
    expect(closeIcon.props.label).toBeUndefined();

    const findPickerRow = (selected: boolean) =>
      renderer!.root.find(
        (node) =>
          node.type === TouchableOpacity &&
          node.props.accessibilityState?.selected === selected,
      );
    const row = findPickerRow(false);
    expect(row.props.accessibilityRole).toBe("button");
    expect(row.props.accessibilityState).toEqual({ selected: false });
    expect(row.props.disabled).toBe(false);
    expect(row.findByType(MockAppIcon).props).toMatchObject({
      decorative: true,
      name: "unselected",
    });

    act(() => {
      renderer!.update(createPicker(true));
    });

    const updatedRow = findPickerRow(true);
    expect(updatedRow).toBe(row);
    expect(updatedRow.props.accessibilityState).toEqual({ selected: true });
    expect(updatedRow.props.disabled).toBe(false);
    expect(updatedRow.findByType(MockAppIcon).props).toMatchObject({
      decorative: true,
      name: "selected",
    });
    act(() => renderer!.unmount());
  });
});
