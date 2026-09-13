/**
 * LoadingScreen — Màn hình loading có animation khi app đang fetch data.
 * Hiển thị skeleton gần với bố cục màn hình chính để tránh cảm giác blank screen.
 */
import React from "react";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useMotionPreference as useReducedMotion } from "~/hooks/useMotionPreference";
import { COLORS, RADIUS, SPACING } from "~/constants/DesignSystem";

/**
 * LoadingScreenProps – Props của LoadingScreen.
 *
 * @param message – (mặc định "Loading") Thông báo trạng thái hiển thị cạnh
 *                  spinner; cũng là accessibilityLabel của toàn màn hình.
 * @param showRecoveryActions – Nếu true, hiển thị panel phục hồi khi Riot
 *                              services không truy cập được (nút Retry...).
 * @param canUseCachedData – Nếu true, hiển thị thêm nút "Use cached data"
 *                           trong panel phục hồi.
 * @param onRetry – Callback khi bấm "Retry now" (chỉ hiện khi
 *                  showRecoveryActions).
 * @param onUseCachedData – Callback khi bấm "Use cached data" (chỉ hiện khi
 *                          canUseCachedData).
 */
type LoadingScreenProps = {
  message?: string;
  showRecoveryActions?: boolean;
  canUseCachedData?: boolean;
  onRetry?: () => void;
  onUseCachedData?: () => void;
};

/**
 * LoadingScreen – Màn hình skeleton splash khi app đang fetch dữ liệu.
 * Cấu trúc: brand VSHOP, hàng trạng thái (spinner + message), panel phục hồi
 * (tuỳ chọn) và skeleton nhấp nháy mô phỏng bố cục màn hình chính.
 *
 * @param message – Thông báo trạng thái (xem LoadingScreenProps).
 * @param showRecoveryActions – Bật panel phục hồi khi Riot services lỗi.
 * @param canUseCachedData – Cho phép tiếp tục bằng dữ liệu cache.
 * @param onRetry – Callback nút "Retry now".
 * @param onUseCachedData – Callback nút "Use cached data".
 * @returns View full màn hình (accessibilityRole progressbar).
 *
 * Side effects: animation pulse (withRepeat withTiming 850ms, yoyo) trên
 * shared value `pulse`; tôn trọng Reduce Motion (giữ opacity tĩnh);
 * cleanup: cancelAnimation(pulse) khi unmount hoặc dependency đổi.
 */
export default function LoadingScreen({
  message = "Loading",
  showRecoveryActions = false,
  canUseCachedData = false,
  onRetry,
  onUseCachedData,
}: LoadingScreenProps) {
  // reduceMotion: bật Reduce Motion thì skeleton đứng yên
  const reduceMotion = useReducedMotion();
  // pulse: shared value 0..1 điều khiển độ mờ skeleton (yoyo vô hạn)
  const pulse = useSharedValue(1);

  // Effect: chạy animation pulse lặp vô hạn (850ms, đảo chiều);
  // nếu Reduce Motion bật thì giữ pulse = 1 (opacity tĩnh 100%).
  // Cleanup: cancelAnimation khi unmount/dependency đổi.
  React.useEffect(() => {
    if (reduceMotion) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(withTiming(0, { duration: 850 }), -1, true);
    return () => {
      cancelAnimation(pulse);
    };
  }, [pulse, reduceMotion]);

  // skeletonAnimatedStyle: map pulse → opacity 0.5..1 cho khối skeleton
  const skeletonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + pulse.value * 0.5,
  }));

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.brandBlock}>
        <View style={styles.brandMark}>
          <Icon name="shopping-outline" size={42} color={COLORS.PURE_WHITE} />
        </View>
        <View>
          <Text style={styles.brandName}>VSHOP</Text>
          <Text style={styles.brandTagline}>VALORANT COMPANION</Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <ActivityIndicator size={14} color={COLORS.ACCENT_DEEP} />
        <Text style={styles.statusText}>{message}</Text>
      </View>

      {showRecoveryActions ? (
        <View style={styles.recoveryPanel} accessibilityLiveRegion="polite">
          <Text style={styles.recoveryText}>
            Riot services are unavailable. VShop will keep retrying automatically.
          </Text>
          <View style={styles.recoveryActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading VShop data"
              testID="startup-retry-button"
              onPress={onRetry}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Retry now</Text>
            </Pressable>
            {canUseCachedData ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open VShop with cached data"
                accessibilityHint="Cached data may be out of date"
                testID="startup-use-cache-button"
                onPress={onUseCachedData}
                style={styles.cacheButton}
              >
                <Text style={styles.cacheButtonText}>Use cached data</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      <Animated.View style={[styles.skeleton, skeletonAnimatedStyle]}>
        <View style={styles.profileCard}>
          <View style={styles.avatar} />
          <View style={styles.headerCopy}>
            <View style={[styles.line, styles.titleLine]} />
            <View style={[styles.line, styles.subtitleLine]} />
          </View>
        </View>
        <View style={styles.hero} />
        <View style={styles.sectionLine} />
        <View style={styles.cardRow}>
          <View style={styles.card} />
          <View style={styles.card} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    paddingHorizontal: SPACING.lg,
    paddingTop: 72,
  },
  brandBlock: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  brandMark: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.ACCENT_DEEP,
  },
  brandName: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  brandTagline: {
    marginTop: 2,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  statusRow: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginTop: SPACING.xl,
  },
  statusText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "600",
  },
  recoveryPanel: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
  },
  recoveryText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 18,
  },
  recoveryActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  retryButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.PURE_BLACK,
  },
  retryButtonText: {
    color: COLORS.PURE_WHITE,
    fontSize: 13,
    fontWeight: "800",
  },
  cacheButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  cacheButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "700",
  },
  skeleton: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    gap: SPACING.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  headerCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  line: {
    height: 12,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  titleLine: { width: "42%" },
  subtitleLine: { width: "64%", height: 9 },
  hero: {
    height: 136,
    marginTop: SPACING.xl,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  sectionLine: {
    width: 120,
    height: 16,
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  cardRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  card: {
    flex: 1,
    height: 176,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
});
