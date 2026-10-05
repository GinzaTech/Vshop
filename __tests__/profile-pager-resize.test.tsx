import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useProfilePager } from "~/features/profile/useProfilePager";

jest.mock("~/features/profile/useProfileCollapsibleHeader", () => ({
  useProfileCollapsibleHeader: () => ({ headerHeight: 0 }),
}));
jest.mock("~/components/GalleryProfile", () => ({}));

type Props = Parameters<typeof useProfilePager>[0];
function Probe(props: Props) { useProfilePager(props); return null; }

it.each(["skins", "collection"] as const)("keeps %s selected and scrolls the recreated pager to its new offset", (activeTab) => {
  const scrollTo = jest.fn();
  const setActiveTab = jest.fn();
  const props = {
    viewportWidth: 400, activeTab, reduceMotionEnabled: false, isPlayerInfoMode: false,
    profileExpandedHeroHeight: 260, pageModeProgress: { value: 0 },
    skinWhitespacePagerOriginRef: { current: 0 },
    profilePagerRef: { current: { scrollTo, setNativeProps: jest.fn() } },
    setActiveTab, handleDismissPicker: jest.fn(),
  } as unknown as Props;
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<Probe {...props} />); });
  scrollTo.mockClear();
  act(() => { renderer.update(<Probe {...props} viewportWidth={320} />); });
  expect(scrollTo).toHaveBeenLastCalledWith({ x: (activeTab === "skins" ? 1 : 2) * 320, y: 0, animated: false });
  expect(setActiveTab).not.toHaveBeenCalled();
  act(() => { renderer.unmount(); });
});
