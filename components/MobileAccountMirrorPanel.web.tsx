import { useMemo } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useMobileAccountMirror } from "~/hooks/useMobileAccountMirror";
import { getPentestCompanionClient } from "~/services/pentest-companion/client.web";
import { createTransferredSessionDependencies } from "~/services/accounts/transferred-session.runtime";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "~/constants/DesignSystem";

type Props = Readonly<{ mode: "import" | "accounts" }>;

export default function MobileAccountMirrorPanel({ mode }: Props) {
  const { t } = useTranslation();
  const runtime = useMemo(() => {
    try {
      return {
        client: getPentestCompanionClient(),
        dependencies: createTransferredSessionDependencies(),
      };
    } catch {
      return null;
    }
  }, []);
  if (!runtime) {
    return (
      <View style={styles.panel}>
        <Text accessibilityRole="alert" style={styles.error}>
          {t("mobile_mirror.unavailable")}
        </Text>
      </View>
    );
  }
  return <ConnectedMobileAccountMirrorPanel mode={mode} {...runtime} />;
}

function ConnectedMobileAccountMirrorPanel({
  mode,
  client,
  dependencies,
}: Props & Readonly<{
  client: ReturnType<typeof getPentestCompanionClient>;
  dependencies: ReturnType<typeof createTransferredSessionDependencies>;
}>) {
  const { t } = useTranslation();
  const router = useRouter();
  const mirror = useMobileAccountMirror({ client, dependencies });
  const busy = ["checking", "waiting_for_phone", "importing", "activating"]
    .includes(mirror.status);

  if (mode === "accounts") {
    if (!mirror.manifest) return null;
    return (
      <View style={styles.panel} testID="mobile-mirror-accounts">
        <View style={styles.headingRow}>
          <Text accessibilityRole="header" style={styles.title}>
            {t("mobile_mirror.accounts_title")}
          </Text>
          <Text style={styles.badge}>
            {t("mobile_mirror.account_count", { count: mirror.manifest.accounts.length })}
          </Text>
        </View>
        <Text style={styles.description}>{t("mobile_mirror.accounts_description")}</Text>
        {mirror.manifest.accounts.map((account) => {
          const selected = account.handle === mirror.activeHandle;
          const disabled = selected || mirror.status === "activating" ||
            account.tokenStatus === "needs_reauth";
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${account.name}#${account.tagLine}`}
              accessibilityState={{
                selected,
                disabled,
                busy: mirror.status === "activating" && !selected,
              }}
              disabled={disabled}
              key={account.handle}
              onPress={() => { void mirror.activate(account.handle); }}
              style={[styles.accountRow, selected && styles.accountSelected]}
              testID={`mobile-mirror-account-${account.handle}`}
            >
              <View style={styles.accountCopy}>
                <Text style={styles.accountName}>{account.name}#{account.tagLine}</Text>
                <Text style={styles.accountMeta}>
                  {account.region.toUpperCase()} · {account.tokenStatus === "ready"
                    ? t("mobile_mirror.ready")
                    : t("mobile_mirror.needs_reauth")}
                </Text>
              </View>
              <Text style={styles.accountState}>
                {selected ? t("mobile_mirror.current") : t("mobile_mirror.switch")}
              </Text>
            </Pressable>
          );
        })}
        {mirror.status === "error" ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {t("mobile_mirror.error")}
          </Text>
        ) : null}
      </View>
    );
  }

  const start = async () => {
    try {
      await mirror.start();
      router.replace("/profile");
    } catch {
      // The hook publishes a stable localized error state.
    }
  };

  return (
    <View style={styles.panel} testID="mobile-mirror-import">
      <Text style={styles.eyebrow}>{t("mobile_mirror.eyebrow")}</Text>
      <Text style={styles.title}>{t("mobile_mirror.title")}</Text>
      <Text style={styles.description}>{t("mobile_mirror.description")}</Text>
      {mirror.status === "waiting_for_phone" ? (
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {t("mobile_mirror.waiting")}
        </Text>
      ) : busy ? (
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {t("mobile_mirror.working")}
        </Text>
      ) : null}
      {mirror.status === "error" ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t("mobile_mirror.error")}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          onPress={() => { void start(); }}
          style={[styles.primaryButton, busy && styles.disabled]}
          testID="mobile-mirror-start"
        >
          <Text style={styles.primaryText}>{t("mobile_mirror.start")}</Text>
        </Pressable>
        {busy ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => { void mirror.cancel(); }}
            style={styles.secondaryButton}
            testID="mobile-mirror-cancel"
          >
            <Text style={styles.secondaryText}>{t("mobile_mirror.cancel")}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: COLORS.SURFACE,
    borderColor: COLORS.BORDER_STRONG,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    gap: SPACING.sm,
    padding: SPACING.md,
    width: "100%",
  },
  headingRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  eyebrow: { color: COLORS.TEXT_SECONDARY, fontSize: TYPOGRAPHY.caption, fontWeight: "800" },
  title: { color: COLORS.TEXT_PRIMARY, fontSize: TYPOGRAPHY.titleSmall, fontWeight: "900" },
  description: { color: COLORS.TEXT_SECONDARY, fontSize: TYPOGRAPHY.bodySmall, lineHeight: 20 },
  status: { color: COLORS.STATUS_INFO, fontSize: TYPOGRAPHY.bodySmall, fontWeight: "700" },
  error: { color: COLORS.WARNING, fontSize: TYPOGRAPHY.bodySmall, fontWeight: "700" },
  badge: { backgroundColor: COLORS.SURFACE_MUTED, borderRadius: RADIUS.chip, color: COLORS.TEXT_PRIMARY, fontSize: TYPOGRAPHY.caption, fontWeight: "800", paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xxs },
  actions: { flexDirection: "row", gap: SPACING.sm },
  primaryButton: { alignItems: "center", backgroundColor: COLORS.PURE_BLACK, borderRadius: RADIUS.button, flex: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: SPACING.md },
  secondaryButton: { alignItems: "center", borderColor: COLORS.BORDER_STRONG, borderRadius: RADIUS.button, borderWidth: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: SPACING.md },
  primaryText: { color: COLORS.PURE_WHITE, fontSize: TYPOGRAPHY.bodySmall, fontWeight: "800" },
  secondaryText: { color: COLORS.TEXT_PRIMARY, fontSize: TYPOGRAPHY.bodySmall, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  accountRow: { alignItems: "center", borderColor: COLORS.BORDER, borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", gap: SPACING.sm, minHeight: 58, padding: SPACING.sm },
  accountSelected: { borderColor: COLORS.SUCCESS, backgroundColor: COLORS.SURFACE_MUTED },
  accountCopy: { flex: 1, minWidth: 0 },
  accountName: { color: COLORS.TEXT_PRIMARY, fontSize: TYPOGRAPHY.body, fontWeight: "800" },
  accountMeta: { color: COLORS.TEXT_SECONDARY, fontSize: TYPOGRAPHY.caption },
  accountState: { color: COLORS.TEXT_PRIMARY, fontSize: TYPOGRAPHY.caption, fontWeight: "800" },
});
