import React from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CachedImage } from "~/components/CachedImage";
import AppIcon from "~/components/ui/AppIcon";
import EmptyStateCard from "~/components/ui/EmptyStateCard";
import ValorantButton from "~/components/ui/ValorantButton";
import { COLORS, RADIUS, SPACING } from "~/constants/DesignSystem";
import { LiquidGlassDecoration } from "~/components/ui/LiquidGlassSurface";
import { useMotionPreference } from "~/hooks/useMotionPreference";
import type { AgentSelectModalProps } from "./party-types";
import { usePartyActionGuard } from "./PartySelectors";
import { PARTY_ACCENT, partyStyles as s } from "./party.styles";

export function AgentSelectModal({ visible, agents, selectedAgentId, unavailableAgentIds = [],
  locking, errorMessage, onSelect, onLock, onClose }: AgentSelectModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useMotionPreference();
  const guard = usePartyActionGuard(locking,
    t("party_page.lock_failed", { defaultValue: "Unable to lock agent. Please try again." }));
  const busy = locking || guard.pending !== null;
  const selectedAvailable = agents.some(agent => agent.uuid === selectedAgentId)
    && !unavailableAgentIds.includes(selectedAgentId ?? "");
  const displayError = errorMessage || guard.localError;
  const close = () => { if (!busy) onClose(); };
  if (!visible) return null;
  return (
    <Modal visible transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={close}>
      <View style={[s.modalScreen, { paddingTop: insets.top + SPACING.md, paddingBottom: insets.bottom + SPACING.md }]}>
        <View style={s.agentDialog} accessibilityViewIsModal aria-modal>
          <LiquidGlassDecoration radius={RADIUS.screen} density="dense" />
          <View style={s.spread}>
            <Text accessibilityRole="header" style={[s.sectionTitle, s.flexible]}>{t("party_page.select_agent", { defaultValue: "Select agent" })}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t("party_page.close_agents", { defaultValue: "Close agent selection" })}
              accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={close} style={[s.iconButton, busy && s.disabled]}>
              <AppIcon name="close" size={24} color={COLORS.TEXT_PRIMARY} decorative />
            </Pressable>
          </View>
          <Text style={s.secondary}>{t("party_page.agent_instruction", { defaultValue: "Choose an agent, then lock to confirm." })}</Text>
          {!!displayError && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>{displayError}</Text>}
          <FlatList data={agents} keyExtractor={agent => agent.uuid} numColumns={3} style={s.agentGrid}
            contentContainerStyle={s.agentContent} columnWrapperStyle={s.agentColumns}
            ListEmptyComponent={<EmptyStateCard style={s.card} title={t("party_page.agents_unavailable", { defaultValue: "Agents unavailable" })} />}
            renderItem={({ item }) => {
              const unavailable = unavailableAgentIds.includes(item.uuid);
              const disabled = busy || unavailable;
              const selected = item.uuid === selectedAgentId;
              return <Pressable accessibilityRole="button" accessibilityLabel={item.displayName}
                accessibilityHint={unavailable ? t("party_page.agent_unavailable", { defaultValue: "Agent unavailable" })
                  : t("party_page.select_agent_hint", { defaultValue: "Selects this agent. Use Lock agent to confirm." })}
                accessibilityState={{ disabled, selected, busy }} disabled={disabled}
                onPress={() => { if (!disabled) onSelect(item.uuid); }} style={[s.agentTile, selected && s.selected, disabled && s.disabled]}>
                <LiquidGlassDecoration radius={RADIUS.md} />
                {item.displayIcon ? <CachedImage source={{ uri: item.displayIcon }} cacheId={`agent:${item.uuid}:icon`}
                  style={s.agentPortrait} contentFit="contain" accessible={false} />
                  : <View style={[s.agentPortrait, s.avatarFallback]}><AppIcon name="account" size={28} color={COLORS.TEXT_SECONDARY} decorative /></View>}
                <Text style={s.agentName} numberOfLines={1}>{item.displayName}</Text>
                {selected && <AppIcon name="check" size={16} color={PARTY_ACCENT} decorative />}
                {unavailable && <Text style={s.caption} numberOfLines={1}>{t("party_page.unavailable", { defaultValue: "Unavailable" })}</Text>}
              </Pressable>;
            }} />
          <ValorantButton title={t("party_page.lock_agent", { defaultValue: "Lock agent" })} variant="glass"
            onPress={() => { if (selectedAvailable && !busy) void guard.run("lock", onLock); }} loading={busy}
            disabled={busy || !selectedAvailable} style={s.primary} textStyle={s.primaryText}
            icon={<AppIcon name="lockAgent" size={22} color={COLORS.PURE_WHITE} decorative />} />
        </View>
      </View>
    </Modal>
  );
}

export default AgentSelectModal;
