import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import TouchableOpacity from "~/components/ui/ContentCardTouchable";
import AppIcon from "~/components/ui/AppIcon";
import { COLORS, RADIUS, SPACING } from "~/constants/DesignSystem";
import { useTranslation } from "~/hooks/useAppTranslation";
import type { AccountDisplayRow } from "./AccountSwitcherDisplay";

export function AccountSwitcherRow({ account, isCurrent, busy, switching, onSelect, onRemove }: {
  account: AccountDisplayRow;
  isCurrent: boolean;
  busy: boolean;
  switching: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const disabled = isCurrent || busy;
  const statusKey = isCurrent ? "current" : account.status === "ready" ? "ready" : "login_required";
  return <View style={styles.row}>
    <TouchableOpacity testID={`settings-account-switch-${account.id}`} disabled={disabled}
      onPress={() => { if (!disabled) onSelect?.(); }} style={styles.main}
      accessibilityRole="button"
      accessibilityLabel={t("settings_page.accounts.switch_to", { account: account.displayName })}
      accessibilityState={{ disabled, selected: isCurrent, busy: switching }}>
      <View style={[styles.avatar, isCurrent && styles.currentAvatar]}>
        <AppIcon name="settingsAccount" size={21} color={isCurrent ? COLORS.PURE_WHITE : COLORS.TEXT_PRIMARY} decorative />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>{account.displayName}</Text>
        <Text style={styles.description} numberOfLines={1}>
          {t(`settings_page.accounts.${statusKey}`, { region: account.region })}
        </Text>
      </View>
      {switching ? <ActivityIndicator size="small" color={COLORS.TEXT_PRIMARY} />
        : <AppIcon name={isCurrent ? "success" : "settingsSwap"} size={22}
          color={isCurrent ? COLORS.SUCCESS : COLORS.TEXT_SECONDARY} decorative />}
    </TouchableOpacity>
    {!isCurrent && onRemove ? <TouchableOpacity testID={`settings-account-remove-${account.id}`}
      onPress={() => { if (!busy) onRemove(); }} disabled={busy} style={styles.remove}
      accessibilityRole="button" accessibilityState={{ disabled: busy }}
      accessibilityLabel={t("settings_page.accounts.remove_account", { account: account.displayName })}>
      <AppIcon name="close" size={20} color={COLORS.TEXT_SECONDARY} decorative />
    </TouchableOpacity> : null}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", minHeight: 64 },
  main: { flex: 1, minHeight: 56, flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingVertical: SPACING.xs },
  avatar: { width: 42, height: 42, borderRadius: RADIUS.chip, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.SURFACE_MUTED },
  currentAvatar: { backgroundColor: COLORS.PURE_BLACK },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: "700", color: COLORS.TEXT_PRIMARY },
  description: { marginTop: 2, color: COLORS.TEXT_SECONDARY, fontSize: 13 },
  remove: { width: 48, height: 48, borderRadius: RADIUS.chip, alignItems: "center", justifyContent: "center" },
});
