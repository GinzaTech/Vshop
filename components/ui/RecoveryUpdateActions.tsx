import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "~/hooks/useAppTranslation";

import AppIcon from "~/components/ui/AppIcon";
import { COLORS, RADIUS, SPACING } from "~/constants/DesignSystem";
import { useRecoveryUpdate } from "~/hooks/useRecoveryUpdate";
import type { RecoveryUpdateState } from "~/utils/recovery-update";

function statusCopy(
  state: RecoveryUpdateState,
  t: (key: string, options?: { defaultValue?: string }) => string,
) {
  switch (state.kind) {
    case "checking":
      return t("recovery_update.checking", { defaultValue: "Checking for an update…" });
    case "downloading":
      return t("recovery_update.downloading", { defaultValue: "Downloading the update…" });
    case "restarting":
      return t("recovery_update.restarting", { defaultValue: "Restarting VShop…" });
    case "up-to-date":
      return t("recovery_update.up_to_date", { defaultValue: "VShop is already up to date." });
    case "native-update":
      return t("recovery_update.native_required", {
        defaultValue: "A newer native build is required.",
      });
    case "error":
      return state.message;
    case "idle":
    default:
      return " ";
  }
}

export default function RecoveryUpdateActions() {
  const { checkAndApply, state } = useRecoveryUpdate();
  return <RecoveryUpdateActionsView state={state} checkAndApply={checkAndApply} />;
}

/** Shared presentation permits DEV QA to supply local, non-network callbacks. */
export function RecoveryUpdateActionsView({ state, checkAndApply }: {
  state: RecoveryUpdateState; checkAndApply: () => void;
}) {
  const { t } = useTranslation();
  const busy =
    state.kind === "checking" ||
    state.kind === "downloading" ||
    state.kind === "restarting";

  return (
    <View style={styles.container}>
      <Text
        accessibilityLiveRegion={state.kind === "error" ? "assertive" : "polite"}
        testID="recovery-update-status"
        style={[styles.status, state.kind === "error" && styles.errorStatus]}
      >
        {statusCopy(state, t)}
      </Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("recovery_update.check", {
            defaultValue: "Check for app update",
          })}
          accessibilityState={{ busy, disabled: busy }}
          disabled={busy}
          onPress={checkAndApply}
          testID="recovery-check-update-button"
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && !busy && styles.pressed,
            busy && styles.disabled,
          ]}
        >
          <AppIcon
            name={busy ? "updateChecking" : "update"}
            size={18}
            color={COLORS.PURE_WHITE}
            decorative
          />
          <Text style={styles.primaryText}>
            {t("recovery_update.check", {
              defaultValue: "Check for app update",
            })}
          </Text>
        </Pressable>
        {state.kind === "native-update" ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t("recovery_update.open_release", {
              defaultValue: "Open latest release",
            })}
            onPress={() => Linking.openURL(state.releaseUrl)}
            testID="recovery-open-release-button"
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryText}>
              {t("recovery_update.open_release", {
                defaultValue: "Open latest release",
              })}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 86,
    marginTop: SPACING.sm,
  },
  status: {
    minHeight: 20,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 18,
  },
  errorStatus: {
    color: COLORS.WARNING,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  primaryButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.PURE_BLACK,
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  primaryText: {
    color: COLORS.PURE_WHITE,
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.55,
  },
});
