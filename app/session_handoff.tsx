import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useAccountStore } from "~/hooks/useAccountStore";
import { captureMobileAccountVaultEnvelope } from "~/services/mobile-handoff/snapshot";
import {
  claimMobileAccountVault,
  isMobileHandoffBuildEnabled,
  validateMobileHandoffParams,
} from "~/services/mobile-handoff/policy";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "~/constants/DesignSystem";

type SendState = "idle" | "sending" | "sent" | "error";

export default function SessionHandoffScreen() {
  const { t } = useTranslation();
  const rawParams = useLocalSearchParams<{ id?: string | string[]; code?: string | string[] }>();
  const accounts = useAccountStore((state) => state.accounts);
  const activeAccountId = useAccountStore((state) => state.activeAccountId);
  const [sendState, setSendState] = useState<SendState>("idle");
  const enabled = isMobileHandoffBuildEnabled({
    platform: Platform.OS,
    publicFlag: process.env.EXPO_PUBLIC_VSHOP_DESKTOP_HANDOFF,
  });
  let params: Readonly<{ id: string; code: string }> | null = null;
  try {
    params = validateMobileHandoffParams(rawParams);
  } catch {
    params = null;
  }
  const active = accounts.find((account) => account.id === activeAccountId);
  const canSend = enabled && Boolean(params) && accounts.length > 0 && sendState === "idle";

  const send = async () => {
    if (!canSend || !params) return;
    setSendState("sending");
    try {
      const envelope = captureMobileAccountVaultEnvelope();
      await claimMobileAccountVault({ ...params, envelope });
      setSendState("sent");
    } catch {
      setSendState("error");
    }
  };

  if (!enabled || !params) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text accessibilityRole="alert" style={styles.issue}>
          {t("mobile_handoff.unavailable")}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>{t("mobile_handoff.eyebrow")}</Text>
        <Text style={styles.title}>{t("mobile_handoff.title")}</Text>
        <Text style={styles.description}>{t("mobile_handoff.description")}</Text>
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>{t("mobile_handoff.account_count")}</Text>
          <Text style={styles.summaryValue}>{accounts.length}</Text>
          <Text style={styles.summaryLabel}>{t("mobile_handoff.active_account")}</Text>
          <Text style={styles.summaryValue}>
            {active ? `${active.name}#${active.tagLine}` : t("mobile_handoff.unknown_account")}
          </Text>
          <Text style={styles.summaryLabel}>{t("mobile_handoff.destination")}</Text>
          <Text style={styles.summaryValue}>Desktop localhost</Text>
        </View>
        <Text style={styles.warning}>{t("mobile_handoff.warning")}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSend, busy: sendState === "sending" }}
          disabled={!canSend}
          onPress={() => { void send(); }}
          style={[styles.button, !canSend && styles.buttonDisabled]}
          testID="mobile-handoff-send"
        >
          <Text style={styles.buttonText}>
            {sendState === "sending"
              ? t("mobile_handoff.sending")
              : t("mobile_handoff.send")}
          </Text>
        </Pressable>
        {sendState === "sent" ? (
          <Text accessibilityLiveRegion="polite" style={styles.success}>
            {t("mobile_handoff.sent")}
          </Text>
        ) : null}
        {sendState === "error" ? (
          <Text accessibilityRole="alert" style={styles.issue}>
            {t("mobile_handoff.error")}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    backgroundColor: COLORS.BACKGROUND,
    flex: 1,
    justifyContent: "center",
    padding: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.SURFACE,
    borderColor: COLORS.BORDER,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    gap: SPACING.md,
    maxWidth: 520,
    padding: SPACING.xl,
    width: "100%",
  },
  eyebrow: { color: COLORS.TEXT_SECONDARY, fontSize: TYPOGRAPHY.caption, fontWeight: "800" },
  title: { color: COLORS.TEXT_PRIMARY, fontSize: TYPOGRAPHY.title, fontWeight: "900" },
  description: { color: COLORS.TEXT_SECONDARY, fontSize: TYPOGRAPHY.body, lineHeight: 24 },
  summary: { backgroundColor: COLORS.SURFACE_MUTED, borderRadius: RADIUS.md, gap: SPACING.xs, padding: SPACING.md },
  summaryLabel: { color: COLORS.TEXT_SECONDARY, fontSize: TYPOGRAPHY.bodySmall, fontWeight: "700" },
  summaryValue: { color: COLORS.TEXT_PRIMARY, fontSize: TYPOGRAPHY.body, fontWeight: "800" },
  warning: { color: COLORS.WARNING, fontSize: TYPOGRAPHY.bodySmall, lineHeight: 20 },
  button: { alignItems: "center", backgroundColor: COLORS.PURE_BLACK, borderRadius: RADIUS.button, minHeight: 48, justifyContent: "center", paddingHorizontal: SPACING.md },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: COLORS.PURE_WHITE, fontSize: TYPOGRAPHY.body, fontWeight: "800" },
  success: { color: COLORS.SUCCESS, fontSize: TYPOGRAPHY.bodySmall, fontWeight: "700" },
  issue: { color: COLORS.WARNING, fontSize: TYPOGRAPHY.bodySmall, fontWeight: "700" },
});
