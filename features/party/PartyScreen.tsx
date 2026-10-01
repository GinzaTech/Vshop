import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "~/components/ui/AppIcon";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import EmptyStateCard from "~/components/ui/EmptyStateCard";
import GlassCard from "~/components/ui/GlassCard";
import ValorantButton from "~/components/ui/ValorantButton";
import { COLORS, SPACING } from "~/constants/DesignSystem";
import { useMotionPreference } from "~/hooks/useMotionPreference";
import PartyMemberCard from "./PartyMemberCard";
import PartyFriendRail from "./PartyFriendRail";
import PartyInviteControls from "./PartyInviteControls";
import PartySelectors, { usePartyActionGuard } from "./PartySelectors";
import type { PartyScreenProps } from "./party-types";
import { PARTY_ACCENT, partyStyles as s } from "./party.styles";

export function PartyScreen({ model, refreshing, busyAction, errorMessage, actions, chat }: PartyScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useMotionPreference();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [completedLeave, setCompletedLeave] = useState(false);
  const [inviteFormOpen, setInviteFormOpen] = useState(false);
  useEffect(() => { setConfirmLeave(false); }, [model.partyId]);
  useEffect(() => {
    if (!completedLeave) return;
    if (!errorMessage) setConfirmLeave(false);
    setCompletedLeave(false);
  }, [completedLeave, errorMessage]);
  const guard = usePartyActionGuard(busyAction !== null || refreshing,
    t("party_page.action_failed", { defaultValue: "Action failed. Please try again." }));
  const pending = busyAction ?? guard.pending;
  const locked = pending !== null || refreshing;
  const queueLabel = model.queueLabel || t("party_page.queue_unavailable", { defaultValue: "Queue unavailable" });
  const queueAction = model.isQueueing ? "cancel" : "start";
  const queueDisabled = locked || !model.partyId || (model.isQueueing ? !model.isLeader : !model.canStartQueue);
  const leaveDisabled = locked || !model.partyId || !model.canReady || model.isQueueing || !["DEFAULT", "CUSTOM_GAME_SETUP"].includes(model.partyState);
  const displayError = errorMessage || guard.localError;
  const leave = async () => {
    if (leaveDisabled) return;
    const succeeded = await guard.run("leave", actions.onLeave);
    if (succeeded) setCompletedLeave(true);
  };
  const header = (
    <>
      <View style={s.spread}>
        <Text style={s.heading} accessibilityRole="header">{t("party_page.title", { defaultValue: "Party" })}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t("party_page.refresh", { defaultValue: "Refresh party" })}
          accessibilityState={{ disabled: locked, busy: refreshing || pending === "refresh" }} disabled={locked}
          onPress={() => { void guard.run("refresh", actions.onRefresh); }} style={[s.iconButton, locked && s.disabled]}>
          {refreshing || pending === "refresh" ? <ActivityIndicator color={PARTY_ACCENT} />
            : <AppIcon name="refresh" size={24} color={COLORS.TEXT_SECONDARY} decorative />}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t("party_page.close", { defaultValue: "Close party" })}
          onPress={actions.onClose} style={s.iconButton}>
          <AppIcon name="close" size={28} color={COLORS.TEXT_PRIMARY} decorative />
        </Pressable>
      </View>
      {!!displayError && <Text style={s.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{displayError}</Text>}
      <GlassCard style={s.card} contentStyle={s.cardContent}>
        <View style={s.spread}>
          <Text style={s.queueTitle} numberOfLines={2}>{queueLabel}</Text>
          <ValorantButton title={t("party_page.leave", { defaultValue: "Leave" })} variant="glass"
            onPress={() => setConfirmLeave(true)} disabled={leaveDisabled} style={s.quietButton} textStyle={s.accentText}
            icon={<AppIcon name="leaveParty" size={18} color={PARTY_ACCENT} decorative />} />
        </View>
        <ValorantButton title={model.isQueueing ? t("party_page.cancel_queue", { defaultValue: "Cancel Queue" })
          : model.queueId === "custom" ? t("party_page.start_custom", { defaultValue: "Start Custom Game" })
            : t("party_page.start_queue", { defaultValue: "Start Queue" })} variant="glass"
          onPress={() => { if (!queueDisabled) void guard.run(queueAction, model.isQueueing ? actions.onCancelQueue : actions.onStartQueue); }}
          disabled={queueDisabled} loading={pending === queueAction} style={s.primary} textStyle={s.primaryText}
          icon={<AppIcon name={model.isQueueing ? "close" : "combatPregame"} size={22} color={COLORS.PURE_WHITE} decorative />} />
      </GlassCard>
      <View style={s.row}>
        <Text style={s.sectionTitle} accessibilityRole="header">{t("party_page.members", { defaultValue: "Members" })}</Text>
      </View>
    </>
  );
  const footer = (
    <View style={s.section}>
      <PartyFriendRail friends={model.friends} connectionStatus={model.friendConnectionStatus}
        disabled={locked || !model.partyId || !model.canReady || model.isQueueing} inviting={pending === "invite"} onAllFriends={actions.onAllFriends}
        onInvite={id => guard.run("invite", () => actions.onInvite(id))} />
      <View style={[s.section, { marginTop: SPACING.sm }]}>
        <Text style={s.sectionTitle} accessibilityRole="header">{t("party_page.settings", { defaultValue: "Settings" })}</Text>
        <PartySelectors key={model.partyId} model={model} disabled={locked} errorMessage={displayError}
          onQueueChange={id => guard.run("queue", () => actions.onQueueChange(id))}
          onPrivacyChange={privacy => guard.run("privacy", () => actions.onPrivacyChange(privacy))} />
      </View>
      <View style={[s.section, { marginTop: SPACING.sm }]}>
        <Text style={s.sectionTitle} accessibilityRole="header">{t("party_page.invite", { defaultValue: "Invite" })}</Text>
        <PartyInviteControls model={model} actions={actions} disabled={locked} pending={pending}
          errorMessage={displayError} run={guard.run} onModalChange={setInviteFormOpen} />
      </View>
      {chat}
    </View>
  );
  return (
    <View style={s.sheet}>
      <FlatList data={model.members} keyExtractor={member => member.id} showsVerticalScrollIndicator={false}
        accessibilityElementsHidden={confirmLeave || inviteFormOpen} importantForAccessibility={confirmLeave || inviteFormOpen ? "no-hide-descendants" : "auto"}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + SPACING.xl }]}
        refreshControl={<AppRefreshControl refreshing={refreshing || pending === "refresh"}
          enabled={!locked} onRefresh={() => { void guard.run("refresh", actions.onRefresh); }} />}
        ListHeaderComponent={<View style={s.section}>{header}</View>} ListFooterComponent={footer}
        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        ListEmptyComponent={<EmptyStateCard style={s.card} title={t("party_page.members_unavailable", { defaultValue: "Members unavailable" })} />}
        renderItem={({ item }) => <PartyMemberCard member={item} disabled={locked || !model.canReady}
          busy={pending === "ready"} onReady={ready => guard.run("ready", () => actions.onReady(ready))} />} />
      {confirmLeave && <Modal transparent visible animationType={reduceMotion ? "none" : "fade"}
        onRequestClose={() => { if (pending !== "leave") setConfirmLeave(false); }}>
        <View style={[s.backdrop, { paddingBottom: insets.bottom + SPACING.md }]}>
          <View style={s.dialog} accessibilityViewIsModal aria-modal>
            <Text style={s.title} accessibilityRole="header">{t("party_page.leave_title", { defaultValue: "Leave party?" })}</Text>
            <Text style={s.secondary}>{t("party_page.leave_message", { defaultValue: "You will leave this party. Continue?" })}</Text>
            {!!displayError && <Text style={s.error} accessibilityRole="alert">{displayError}</Text>}
            <ValorantButton title={t("party_page.confirm_leave", { defaultValue: "Confirm leave" })} variant="glass"
              disabled={leaveDisabled} loading={pending === "leave"} onPress={() => { void leave(); }} style={s.primary} textStyle={s.smallPrimaryText} />
            <ValorantButton title={t("party_page.stay", { defaultValue: "Stay in party" })} variant="secondary"
              disabled={pending === "leave"} onPress={() => setConfirmLeave(false)} />
          </View>
        </View>
      </Modal>}
    </View>
  );
}

export default PartyScreen;
