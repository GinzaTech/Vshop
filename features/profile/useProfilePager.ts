import React from "react";
import { NativeScrollEvent, NativeSyntheticEvent, PanResponder } from "react-native";
import { TabKey } from "~/components/GalleryProfile";
import { PROFILE_HERO_COMPACT_HEIGHT } from "~/features/profile/profile-transition";
import { useProfileCollapsibleHeader } from "~/features/profile/useProfileCollapsibleHeader";
import { PROFILE_TAB_KEYS } from "~/features/profile/profile-loadout";
import type { useProfilePickers } from "./useProfilePickers";
import type { useProfileMotion } from "./useProfileMotion";
import type { useProfileSession } from "./useProfileSession";

type Props = Pick<ReturnType<typeof useProfilePickers>, "handleDismissPicker"> &
Pick<ReturnType<typeof useProfileMotion>,
  "profilePagerRef" |
  "reduceMotionEnabled" |
  "setActiveTab" |
  "profileExpandedHeroHeight" |
  "pageModeProgress" |
  "activeTab" |
  "isPlayerInfoMode" |
  "skinWhitespacePagerOriginRef"> &
Pick<ReturnType<typeof useProfileSession>, "viewportWidth">;

export function useProfilePager({
  handleDismissPicker, profilePagerRef, viewportWidth, reduceMotionEnabled, setActiveTab,
  profileExpandedHeroHeight, pageModeProgress, activeTab, isPlayerInfoMode,
  skinWhitespacePagerOriginRef,
}: Props) {

  // handleTabChange: đóng picker + scroll pager đến tab (đổi state ngay nếu reduce motion).
  const handleTabChange = React.useCallback(
    (tab: TabKey) => {
      handleDismissPicker();
      const nextIndex = PROFILE_TAB_KEYS.indexOf(tab);

      if (nextIndex < 0) return;

      profilePagerRef.current?.scrollTo({
        x: nextIndex * viewportWidth,
        y: 0,
        animated: !reduceMotionEnabled,
      });

      if (reduceMotionEnabled) {
        setActiveTab(tab);
      }
    },
    [handleDismissPicker, profilePagerRef, reduceMotionEnabled, setActiveTab, viewportWidth]
  );
  const setPagerGestureEnabled = React.useCallback((enabled: boolean) => { // khoá/mở cuộn pager
    profilePagerRef.current?.setNativeProps({ scrollEnabled: enabled });
  }, [profilePagerRef]);
  const {
    bodyAnimatedStyle: collapsibleBodyAnimatedStyle,
    contentPanGesture: profileContentPanGesture,
    handleContentScroll: handleProfileContentScroll,
    handleHeaderLayout,
    headerAnimatedStyle: collapsibleHeaderAnimatedStyle,
    headerHeight: collapsibleHeaderHeight,
    panGesture: profileHeaderPanGesture,
  } = useProfileCollapsibleHeader({
    compactHeroHeight: PROFILE_HERO_COMPACT_HEIGHT,
    contentPanEnabled: !isPlayerInfoMode,
    expandedHeroHeight: profileExpandedHeroHeight,
    modeProgress: pageModeProgress,
  });
  const skinWhitespacePagerPanResponder = React.useMemo( // vuốt vùng trắng để kéo pager ngang
      () =>
          PanResponder.create({
            onMoveShouldSetPanResponder: (_event, gestureState) => {
              const horizontalDistance = Math.abs(gestureState.dx);
              const verticalDistance = Math.abs(gestureState.dy);

              return (
                  horizontalDistance > 8 &&
                  horizontalDistance > verticalDistance * 1.15
              );
            },
            onMoveShouldSetPanResponderCapture: (_event, gestureState) => {
              const horizontalDistance = Math.abs(gestureState.dx);
              const verticalDistance = Math.abs(gestureState.dy);

              return (
                  horizontalDistance > 8 &&
                  horizontalDistance > verticalDistance * 1.15
              );
            },
            onPanResponderGrant: () => {
              const currentIndex = PROFILE_TAB_KEYS.indexOf(activeTab);
              skinWhitespacePagerOriginRef.current =
                  currentIndex * viewportWidth;
              setPagerGestureEnabled(false);
            },
            onPanResponderMove: (_event, gestureState) => {
              const nextOffset = Math.max(
                  0,
                  Math.min(
                      (PROFILE_TAB_KEYS.length - 1) * viewportWidth,
                      skinWhitespacePagerOriginRef.current - gestureState.dx
                  )
              );

              profilePagerRef.current?.scrollTo({
                x: nextOffset,
                y: 0,
                animated: false,
              });
            },
            onPanResponderRelease: (_event, gestureState) => {
              const currentIndex = PROFILE_TAB_KEYS.indexOf(activeTab);
              const shouldChangePage =
                  Math.abs(gestureState.dx) > viewportWidth * 0.16 ||
                  Math.abs(gestureState.vx) > 0.35;
              const direction = gestureState.dx < 0 ? 1 : -1;
              const nextIndex = shouldChangePage
                  ? Math.max(
                      0,
                      Math.min(
                          PROFILE_TAB_KEYS.length - 1,
                          currentIndex + direction
                      )
                  )
                  : currentIndex;

              setPagerGestureEnabled(true);
              handleTabChange(PROFILE_TAB_KEYS[nextIndex]);
            },
            onPanResponderTerminate: () => {
              setPagerGestureEnabled(true);
              handleTabChange(activeTab);
            },
            onPanResponderTerminationRequest: () => false,
          }),
      [activeTab, handleTabChange, profilePagerRef, setPagerGestureEnabled, skinWhitespacePagerOriginRef, viewportWidth]
  );
  // handlePagerMomentumEnd: pager ngừng cuộn → cập nhật activeTab theo vị trí.
  const handlePagerMomentumEnd = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.max(
          0,
          Math.min(
              PROFILE_TAB_KEYS.length - 1,
              Math.round(event.nativeEvent.contentOffset.x / Math.max(1, viewportWidth))
          )
      );
      setActiveTab(PROFILE_TAB_KEYS[nextIndex]);
    },
    [setActiveTab, viewportWidth]
  );
  return {
    handleTabChange, setPagerGestureEnabled, collapsibleBodyAnimatedStyle, profileContentPanGesture,
    handleProfileContentScroll, handleHeaderLayout, collapsibleHeaderAnimatedStyle,
    collapsibleHeaderHeight, profileHeaderPanGesture, skinWhitespacePagerPanResponder,
    handlePagerMomentumEnd,
  };
}
