import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "~/hooks/useAppTranslation";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import StartupBrandMark from "~/components/ui/StartupBrandMark";
import { COLORS, SPACING } from "~/constants/DesignSystem";
import { MOTION_TIMING } from "~/constants/Motion";
import { STARTUP_COMPLETED_STAGES, type StartupPhase } from "~/constants/Startup";
import { useMotionPreference } from "~/hooks/useMotionPreference";

/** Progress follows completed bootstrap stages. Time never advances it. */
export default function StartupLaunchSurface({ phase, onReady, message }: {
  phase: StartupPhase; onReady?: () => void; message?: string;
}) {
  const { t } = useTranslation();
  const reduced = useMotionPreference();
  const completed = STARTUP_COMPLETED_STAGES[phase];
  const status = message || t(`startup_launch.${phase}`);
  const stageCount = t("startup_launch.stages", { completed, total: 3 });
  const progress = useSharedValue(completed / 3);
  const entrance = useSharedValue(reduced ? 1 : 0);
  React.useEffect(() => {
    cancelAnimation(progress); cancelAnimation(entrance);
    progress.value = reduced ? completed / 3 : withTiming(completed / 3, MOTION_TIMING.standard);
    entrance.value = reduced ? 1 : withTiming(1, MOTION_TIMING.emphasized);
    return () => { cancelAnimation(progress); cancelAnimation(entrance); };
  }, [completed, entrance, progress, reduced]);
  const reveal = useAnimatedStyle(() => ({ opacity: entrance.value, transform: [{ translateY: (1 - entrance.value) * SPACING.sm }] }));
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));
  return <ScrollView testID="startup-launch-surface" style={styles.scroll} contentContainerStyle={styles.content}>
    <Animated.View style={[styles.composition, reveal]}>
      <StartupBrandMark onReady={onReady} />
      <Text style={styles.name} accessibilityRole="header">VShop</Text>
      <Text testID="startup-phase-label" style={styles.status} accessibilityLiveRegion="polite">{status}</Text>
      <View testID="startup-progress" style={styles.progressRegion} accessible accessibilityRole="progressbar"
        accessibilityLabel={t("startup_launch.progress")} accessibilityState={{ busy: phase !== "ready" }}
        accessibilityValue={{ min: 0, max: 3, now: completed, text: `${status}. ${stageCount}` }}>
        <View style={styles.rail}>
          <Animated.View testID="startup-progress-fill" style={[styles.fill, fill]} />
        </View>
        <Text style={styles.stages} accessible={false}>{stageCount}</Text>
      </View>
    </Animated.View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  composition: { width: "100%", maxWidth: 300, alignItems: "center" },
  name: { alignSelf: "stretch", textAlign: "center", marginTop: SPACING.lg, fontSize: 32, lineHeight: 40,
    fontWeight: "700", color: COLORS.TEXT_PRIMARY },
  status: { marginTop: SPACING.sm, minHeight: 42, fontSize: 14, lineHeight: 21, textAlign: "center", color: COLORS.TEXT_SECONDARY },
  progressRegion: { width: "100%", maxWidth: 220, marginTop: SPACING.lg },
  rail: { height: 3, borderRadius: 2, overflow: "hidden", backgroundColor: COLORS.BORDER },
  fill: { width: "100%", height: "100%", backgroundColor: COLORS.ACCENT_DEEP, transformOrigin: "left center" },
  stages: { marginTop: SPACING.md, fontSize: 12, lineHeight: 18, textAlign: "center", color: COLORS.TEXT_SECONDARY },
});
