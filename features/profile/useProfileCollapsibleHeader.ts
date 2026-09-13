// ===== useProfileCollapsibleHeader.ts – Header Profile thu gọn được =====
// Điều khiển header (top bar + hero + segment) thu gọn/expand trực tiếp trên
// UI thread bằng Reanimated: body cuộn lên → header trượt theo cho tới khi
// chỉ còn thanh segment sticky. Toàn bộ gesture/animation chạy trên UI thread,
// Reduce Motion được tôn trọng ở pha decay (vụn đổ theo vận tốc).

import React from "react";
import type { LayoutChangeEvent } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  cancelAnimation,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
} from "react-native-reanimated";
import { useMotionPreference as useReducedMotion } from "~/hooks/useMotionPreference";

// Chiều cao của thanh segment sticky khi header đã thu gọn hoàn toàn.
export const PROFILE_STICKY_SEGMENT_HEIGHT = 70;

/**
 * Điều khiển header Profile thu gọn trực tiếp trên UI thread. Bảng hero và
 * vùng dữ liệu dùng chung một offset, nên kéo từ bảng sẽ dịch cả bố cục thay
 * vì chỉ thay đổi vị trí cuộn ẩn của danh sách con.
 */
/**
 * useProfileCollapsibleHeader – Quản lý trạng thái thu gọn của header Profile.
 * Trả về gesture, scroll handler và animated styles để gắn vào màn hình.
 * @returns {object} { bodyAnimatedStyle, contentPanGesture, handleContentScroll,
 *   handleHeaderLayout, headerAnimatedStyle, headerHeight, panGesture }
 */
export function useProfileCollapsibleHeader() {
  const reduceMotionEnabled = useReducedMotion();
  const [headerHeight, setHeaderHeight] = React.useState(0);
  const collapseDistance = useSharedValue(0);
  const collapseOffset = useSharedValue(0);
  const contentScrollOffset = useSharedValue(0);
  const dragOrigin = useSharedValue(0);
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);

  // Đo chiều cao header thật → tính quãn cách thu gọn (header - segment sticky);
  // giữ offset hiện tại không vượt khoảng cách mới khi layout đổi.
  const handleHeaderLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeaderHeight = event.nativeEvent.layout.height;
      const nextCollapseDistance = Math.max(
        0,
        nextHeaderHeight - PROFILE_STICKY_SEGMENT_HEIGHT
      );

      setHeaderHeight((current) =>
        Math.abs(current - nextHeaderHeight) > 0.5 ? nextHeaderHeight : current
      );
      collapseDistance.value = nextCollapseDistance;
      collapseOffset.value = Math.min(
        collapseOffset.value,
        nextCollapseDistance
      );
    },
    [collapseDistance, collapseOffset]
  );

  // Pan gesture kéo trực tiếp trên header: chỉ kích hoạt khi kéo dọc
  // (±8px), nhường cho cuộn ngang (quá ±18px ngang thì fail).
  const panGesture = React.useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-8, 8])
        .failOffsetX([-18, 18])
        .onBegin(() => {
          cancelAnimation(collapseOffset);
          dragOrigin.value = collapseOffset.value;
        })
        .onUpdate((event) => {
          collapseOffset.value = Math.max(
            0,
            Math.min(
              collapseDistance.value,
              dragOrigin.value - event.translationY
            )
          );
        })
        .onEnd((event) => {
          if (reduceMotionEnabled) return;
          collapseOffset.value = withDecay({
            velocity: -event.velocityY,
            clamp: [0, collapseDistance.value],
          });
        }),
    [collapseDistance, collapseOffset, dragOrigin, reduceMotionEnabled]
  );

  // Pan gesture cho vùng nội dung (manual activation): phân tích hướng chạm —
  // kéo dọc → thu gọn header (lên) hoặc mở rộng khi nội dung đã cuộn về đầu;
  // kéo ngang → fail để pager tab xử lý.
  const contentPanGesture = React.useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .onTouchesDown((event) => {
          const touch = event.allTouches[0];
          if (!touch) return;
          touchStartX.value = touch.absoluteX;
          touchStartY.value = touch.absoluteY;
        })
        .onTouchesMove((event, stateManager) => {
          const touch = event.allTouches[0];
          if (!touch) return;

          const deltaX = touch.absoluteX - touchStartX.value;
          const deltaY = touch.absoluteY - touchStartY.value;
          const horizontalDistance = Math.abs(deltaX);
          const verticalDistance = Math.abs(deltaY);

          if (horizontalDistance < 8 && verticalDistance < 8) return;
          if (horizontalDistance > verticalDistance * 1.15) {
            stateManager.fail();
            return;
          }
          if (verticalDistance <= horizontalDistance * 1.15) return;

          const canCollapse =
            deltaY < 0 &&
            collapseOffset.value < collapseDistance.value - 0.5;
          const canExpand =
            deltaY > 0 &&
            collapseOffset.value > 0.5 &&
            contentScrollOffset.value <= 1;

          if (canCollapse || canExpand) stateManager.activate();
          else stateManager.fail();
        })
        .onBegin(() => {
          cancelAnimation(collapseOffset);
          dragOrigin.value = collapseOffset.value;
        })
        .onUpdate((event) => {
          collapseOffset.value = Math.max(
            0,
            Math.min(
              collapseDistance.value,
              dragOrigin.value - event.translationY
            )
          );
        })
        .onEnd((event) => {
          if (reduceMotionEnabled) return;
          collapseOffset.value = withDecay({
            velocity: -event.velocityY,
            clamp: [0, collapseDistance.value],
          });
        }),
    [
      collapseDistance,
      collapseOffset,
      contentScrollOffset,
      dragOrigin,
      reduceMotionEnabled,
      touchStartX,
      touchStartY,
    ]
  );

  // Ghi offset cuộn của nội dung (≥ 0) để biết khi nào được phép mở header.
  const handleContentScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      contentScrollOffset.value = Math.max(
        0,
        event.contentOffset.y
      );
    },
  });

  // Header trượt lên theo collapseOffset; body trượt bù để không hở khoảng trống.
  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -collapseOffset.value }],
  }));

  const bodyAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: collapseDistance.value - collapseOffset.value,
      },
    ],
  }));

  return {
    bodyAnimatedStyle,
    contentPanGesture,
    handleContentScroll,
    handleHeaderLayout,
    headerAnimatedStyle,
    headerHeight,
    panGesture,
  };
}
