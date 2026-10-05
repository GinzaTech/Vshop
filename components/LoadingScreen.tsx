import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "~/hooks/useAppTranslation";
import RecoveryUpdateActions from "~/components/ui/RecoveryUpdateActions";
import StartupBrandMark from "~/components/ui/StartupBrandMark";
import StartupLaunchSurface from "~/components/ui/StartupLaunchSurface";
import { COLORS, RADIUS, SPACING } from "~/constants/DesignSystem";
import { STARTUP_RECOVERY_ART_SOURCE, type StartupPhase } from "~/constants/Startup";

type LoadingScreenProps = {
  message?: string;
  showRecoveryActions?: boolean;
  canUseCachedData?: boolean;
  recoveryKind?: "maintenance" | "unavailable";
  cachedDataUpdatedAt?: number | null;
  onRetry?: () => void;
  onUseCachedData?: () => void;
  showUpdateRecovery?: boolean;
  onReady?: () => void;
  recoveryUpdateActions?: React.ReactNode;
  phase?: StartupPhase;
};

/** Designed launch composition; real error/watchdog states retain recovery. */
export default function LoadingScreen({ message, phase = "prepare", showRecoveryActions = false,
  canUseCachedData = false, recoveryKind = "unavailable", cachedDataUpdatedAt = null,
  onRetry, onUseCachedData, showUpdateRecovery = false, onReady, recoveryUpdateActions }: LoadingScreenProps) {
  const { t } = useTranslation();
  const recovery = showRecoveryActions;
  const cachedDataTime = Number.isFinite(cachedDataUpdatedAt) && Number(cachedDataUpdatedAt) > 0
    ? new Date(Number(cachedDataUpdatedAt)).toLocaleString() : null;
  const brand = <StartupBrandMark onReady={onReady} />;
  return <View testID="startup-icon-screen" style={styles.container}>
    {recovery ? <ScrollView style={styles.scroll} contentContainerStyle={styles.recoveryContent}>
      {brand}
      <View testID="startup-recovery-panel" style={styles.recoveryPanel} accessibilityLiveRegion="polite">
        <Image source={STARTUP_RECOVERY_ART_SOURCE} style={styles.recoveryArt} resizeMode="contain" accessible={false} />
        {showRecoveryActions ? <>
          <Text style={styles.recoveryText}>{recoveryKind === "maintenance"
            ? t("startup_recovery.maintenance")
            : t("startup_recovery.unavailable", { defaultValue: "Riot services are unavailable. VShop will keep retrying automatically." })}</Text>
          {canUseCachedData && cachedDataTime ? <Text style={styles.cacheTimestamp}>
            {t("startup_recovery.last_updated", { time: cachedDataTime })}
          </Text> : null}
          <View style={styles.recoveryActions}>
            <Pressable accessibilityRole="button" accessibilityLabel={t("startup_recovery.retry", { defaultValue: "Retry now" })}
              accessibilityState={{ disabled: !onRetry }} disabled={!onRetry} testID="startup-retry-button"
              onPress={onRetry} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>{t("startup_recovery.retry", { defaultValue: "Retry now" })}</Text>
            </Pressable>
            {canUseCachedData ? <Pressable accessibilityRole="button" accessibilityLabel={t("startup_recovery.use_cache")}
              accessibilityHint={t("startup_recovery.cache_hint")} accessibilityState={{ disabled: !onUseCachedData }}
              disabled={!onUseCachedData} testID="startup-use-cache-button" onPress={onUseCachedData} style={styles.cacheButton}>
              <Text style={styles.cacheButtonText}>{t("startup_recovery.use_cache")}</Text>
            </Pressable> : null}
          </View>
        </> : null}
        {showUpdateRecovery ? recoveryUpdateActions ?? <RecoveryUpdateActions /> : null}
      </View>
    </ScrollView> : <>
      <StartupLaunchSurface phase={phase} message={message} onReady={onReady} />
      {showUpdateRecovery ? <View testID="startup-watchdog-actions" style={styles.watchdog}>
        {onRetry ? <Pressable testID="startup-retry-button" accessibilityRole="button"
          accessibilityLabel={t("startup_recovery.retry")} onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>{t("startup_recovery.retry")}</Text>
        </Pressable> : null}
        {recoveryUpdateActions ?? <RecoveryUpdateActions />}
      </View> : null}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  watchdog: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  scroll: { flex: 1 },
  recoveryContent: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xxl },
  recoveryPanel: { width: "100%", maxWidth: 420, marginTop: SPACING.xl, padding: SPACING.md,
    borderRadius: RADIUS.card, borderWidth: 1, borderColor: COLORS.BORDER, backgroundColor: COLORS.SURFACE },
  recoveryArt: { width: 72, height: 72, alignSelf: "center", marginBottom: SPACING.sm },
  recoveryText: { color: COLORS.TEXT_SECONDARY, fontSize: 12, lineHeight: 18 },
  cacheTimestamp: { marginTop: SPACING.xs, color: COLORS.TEXT_PRIMARY, fontSize: 11, lineHeight: 16 },
  recoveryActions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginTop: SPACING.sm },
  retryButton: { minHeight: 48, justifyContent: "center", paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.chip, backgroundColor: COLORS.PURE_BLACK },
  retryButtonText: { color: COLORS.PURE_WHITE, fontSize: 13, fontWeight: "800" },
  cacheButton: { minHeight: 48, justifyContent: "center", paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.chip, borderWidth: 1, borderColor: COLORS.BORDER, backgroundColor: COLORS.SURFACE_MUTED },
  cacheButtonText: { color: COLORS.TEXT_PRIMARY, fontSize: 13, fontWeight: "700" },
});
