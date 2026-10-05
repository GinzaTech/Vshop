import React from "react";
import { Alert, FlatList, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Portal } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TouchableOpacity from "~/components/ui/ContentCardTouchable";
import AppIcon from "~/components/ui/AppIcon";
import { COLORS, RADIUS, SPACING } from "~/constants/DesignSystem";
import { useTranslation } from "~/hooks/useAppTranslation";
import { usePickerModalFocus } from "~/features/profile/usePickerModalFocus";
import { normalizeAccountId } from "~/utils/saved-accounts";
import type { AccountDisplayRow } from "./AccountSwitcherDisplay";
import { AccountSwitcherRow } from "./AccountSwitcherRow";

type Props = {
  visible: boolean;
  accounts: readonly AccountDisplayRow[];
  currentId: string;
  busyId: string | null;
  onDismiss: () => void;
  onSwitch: (id: string) => void | Promise<void>;
  onRemove: (id: string) => void;
};

function useAccountSelection(props: Props, t: ReturnType<typeof useTranslation>["t"]) {
  const live = React.useRef({ ...props, t });
  const mounted = React.useRef(false);
  React.useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  React.useLayoutEffect(() => { live.current = { ...props, t }; });
  const pending = React.useRef(false);
  const selectable = React.useCallback((id: string) => {
    const latest = live.current;
    if (!mounted.current || !latest.visible || latest.busyId || pending.current) return false;
    return latest.accounts.some((account) => account.id === id && account.status !== "current" &&
      normalizeAccountId(account.id) !== normalizeAccountId(latest.currentId));
  }, []);
  const choose = React.useCallback(async (id: string) => {
    if (!selectable(id)) return;
    pending.current = true;
    const latest = live.current;
    latest.onDismiss();
    try {
      await latest.onSwitch(id);
    } catch {
      if (mounted.current) Alert.alert(live.current.t("settings_page.accounts.switch_failed_title"),
        live.current.t("settings_page.accounts.switch_failed_description"));
    } finally {
      pending.current = false;
    }
  }, [selectable]);
  const remove = React.useCallback((id: string) => {
    if (selectable(id)) live.current.onRemove(id);
  }, [selectable]);
  return { choose, remove };
}

export function AccountSwitcherPopup(props: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { closeButtonRef, sheetRef, handleNativeShow } = usePickerModalFocus(props.visible, props.onDismiss);
  const { choose, remove } = useAccountSelection(props, t);
  if (!props.visible) return null;
  const alternatives = props.accounts.filter((account) => account.status !== "current" &&
    normalizeAccountId(account.id) !== normalizeAccountId(props.currentId));
  const content = <View style={[styles.backdrop, { paddingTop: insets.top + SPACING.md, paddingBottom: insets.bottom + SPACING.md }]}>
    <Pressable style={StyleSheet.absoluteFill} onPress={props.onDismiss} accessible={false} />
    <View ref={sheetRef} testID="settings-account-popup" accessibilityViewIsModal
      role={Platform.OS === "web" ? "dialog" : undefined} style={styles.sheet}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>{t("settings_page.accounts.logged_in")}</Text>
        <TouchableOpacity ref={closeButtonRef} testID="settings-account-close" style={styles.close}
          accessibilityRole="button" accessibilityLabel={t("settings_page.accounts.cancel")} onPress={props.onDismiss}>
          <AppIcon name="close" size={20} color={COLORS.TEXT_PRIMARY} decorative />
        </TouchableOpacity>
      </View>
      <FlatList data={alternatives} keyExtractor={(account) => account.id} style={styles.list}
        contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <AccountSwitcherRow account={item} isCurrent={false}
          busy={Boolean(props.busyId)} switching={props.busyId === item.id}
          onSelect={() => void choose(item.id)} onRemove={() => remove(item.id)} />}
        ListEmptyComponent={<Text style={styles.empty}>{t("settings_page.accounts.logged_in_count", { count: 0 })}</Text>} />
    </View>
  </View>;
  return Platform.OS === "web" ? <Portal>{content}</Portal>
    : <Modal visible transparent animationType="none" onShow={handleNativeShow} onRequestClose={props.onDismiss}>{content}</Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: SPACING.md, backgroundColor: COLORS.MODAL_BACKDROP },
  sheet: { width: "100%", maxWidth: 600, maxHeight: "82%", borderRadius: RADIUS.card, backgroundColor: COLORS.BACKGROUND, borderWidth: 1, borderColor: COLORS.BORDER, overflow: "hidden" },
  heading: { flexDirection: "row", alignItems: "center", gap: SPACING.xs, paddingLeft: SPACING.md, paddingRight: SPACING.xs },
  title: { flex: 1, fontSize: 18, fontWeight: "700", color: COLORS.TEXT_PRIMARY },
  close: { minHeight: 48, minWidth: 48, alignItems: "center", justifyContent: "center" },
  list: { flexGrow: 0 },
  listContent: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  empty: { color: COLORS.TEXT_SECONDARY, paddingVertical: SPACING.md },
});
