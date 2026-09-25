import { useTranslation } from "react-i18next";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import type { LoginWebViewProps } from "./LoginWebView.types";
import {
  COLORS,
  LAYOUT,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from "~/constants/DesignSystem";
import { useRiotInteractiveLogin } from "~/hooks/useRiotInteractiveLogin";
import {
  useRiotWebAuthBroker,
  type RiotWebAuthState,
} from "~/hooks/useRiotWebAuthBroker";

export type { LoginWebViewProps } from "./LoginWebView.types";

const statusKey = (state: RiotWebAuthState) => {
  switch (state.kind) {
    case "checking": return "login_web_view.desktop_checking";
    case "ready": return state.mutationMode
      ? "login_web_view.desktop_ready_mutation"
      : "login_web_view.desktop_ready_read_only";
    case "opening": return "login_web_view.desktop_opening";
    case "waiting": return "login_web_view.desktop_waiting";
    case "completing": return "login_web_view.desktop_completing";
    case "cancelled": return "login_web_view.desktop_cancelled";
    case "error": return state.code === "AUTH_TIMEOUT"
      ? "login_web_view.desktop_timeout"
      : "login_web_view.desktop_unavailable";
  }
};

export default function LoginWebView({
  minHeight,
  style,
  expectedAccountId,
}: LoginWebViewProps) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const interactive = useRiotInteractiveLogin({ expectedAccountId });
  const broker = useRiotWebAuthBroker({
    loginUrl: interactive.loginUrl,
    onCallback: interactive.completeCallback,
  });
  const resolvedMinHeight = minHeight ?? Math.max(420, Math.min(height * 0.68, 620));
  const busy = ["checking", "opening", "waiting", "completing"]
    .includes(broker.state.kind);
  const canStart = interactive.authReady && Boolean(interactive.loginUrl) &&
    broker.state.kind === "ready";
  const canCancel = broker.state.kind === "opening" || broker.state.kind === "waiting";
  const canRetry = broker.state.kind === "error" || broker.state.kind === "cancelled";
  const issue = interactive.completionIssue;
  const status = interactive.loading || t(statusKey(broker.state));

  return (
    <View style={[styles.container, { minHeight: resolvedMinHeight }, style]}>
      <View style={styles.copyBlock}>
        <Text style={styles.eyebrow}>{t("login_web_view.desktop_eyebrow")}</Text>
        <Text style={styles.title}>{t("login_web_view.desktop_title")}</Text>
        <Text style={styles.description}>
          {t("login_web_view.desktop_description")}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          testID="riot-web-login-open"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canStart, busy }}
          disabled={!canStart}
          onPress={() => { void broker.start(); }}
          style={({ pressed }) => [
            styles.primaryButton,
            !canStart && styles.buttonDisabled,
            pressed && canStart && styles.buttonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {t("login_web_view.desktop_open")}
          </Text>
        </Pressable>

        {canCancel ? (
          <Pressable
            testID="riot-web-login-cancel"
            accessibilityRole="button"
            onPress={() => { void broker.cancel(); }}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>
              {t("login_web_view.desktop_cancel")}
            </Text>
          </Pressable>
        ) : null}

        {canRetry ? (
          <Pressable
            testID="riot-web-login-retry"
            accessibilityRole="button"
            onPress={() => { void broker.retry(); }}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>
              {t("login_web_view.desktop_retry")}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.statusPanel}>
        <Text
          testID="riot-web-login-status"
          accessibilityLiveRegion="polite"
          style={styles.statusText}
        >
          {status}
        </Text>
        {issue || broker.state.kind === "error" ? (
          <Text accessibilityRole="alert" style={styles.issueText}>
            {issue ? t(issue) : t(statusKey(broker.state))}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignSelf: "stretch",
    justifyContent: "space-between",
    gap: SPACING.lg,
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
  },
  copyBlock: {
    gap: SPACING.sm,
  },
  eyebrow: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: TYPOGRAPHY.caption,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: TYPOGRAPHY.title,
    fontWeight: "700",
  },
  description: {
    maxWidth: 620,
    color: COLORS.TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.body,
    lineHeight: 24,
  },
  actions: {
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  primaryButton: {
    minWidth: 220,
    minHeight: LAYOUT.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.button,
    backgroundColor: COLORS.PURE_BLACK,
  },
  primaryButtonText: {
    color: COLORS.PURE_WHITE,
    fontSize: TYPOGRAPHY.bodySmall,
    fontWeight: "700",
  },
  secondaryButton: {
    minHeight: LAYOUT.minTouchTarget,
    justifyContent: "center",
    paddingHorizontal: SPACING.sm,
  },
  secondaryButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: TYPOGRAPHY.bodySmall,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.78,
  },
  statusPanel: {
    gap: SPACING.xs,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  statusText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: TYPOGRAPHY.bodySmall,
  },
  issueText: {
    color: COLORS.WARNING,
    fontSize: TYPOGRAPHY.bodySmall,
    fontWeight: "600",
  },
});
