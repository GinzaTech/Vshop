import React from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useTranslation } from "~/hooks/useAppTranslation";
import { CachedImage } from "~/components/CachedImage";
import EmptyStateCard from "~/components/ui/EmptyStateCard";
import AppIcon from "~/components/ui/AppIcon";
import { COLORS } from "~/constants/DesignSystem";
import type { PartyActions, PartyFriendView } from "./party-types";
import { PARTY_ACCENT, partyStyles as s } from "./party.styles";

type Props = {
  friends: readonly PartyFriendView[];
  connectionStatus: string;
  disabled: boolean;
  inviting: boolean;
  onInvite: PartyActions["onInvite"];
  onAllFriends: PartyActions["onAllFriends"];
};

export default function PartyFriendRail({ friends, connectionStatus, disabled, inviting, onInvite, onAllFriends }: Props) {
  const { t } = useTranslation();
  const connected = ["authenticated", "connected"].includes(connectionStatus.toLowerCase());
  return (
    <View style={s.section}>
      <View style={s.spread}>
        <Text accessibilityRole="header" style={s.sectionTitle}>{t("party_page.online_friends", { defaultValue: "Online friends" })}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t("party_page.all_friends", { defaultValue: "All friends" })}
          onPress={onAllFriends} style={s.link}>
          <View style={s.row}><Text style={s.accentText}>{t("party_page.all_friends", { defaultValue: "All friends" })}</Text>
            <AppIcon name="chevronRight" size={16} color={PARTY_ACCENT} decorative /></View>
        </Pressable>
      </View>
      {!connected && friends.length > 0 && <Text style={s.secondary}>{t("party_page.friends_unavailable", { defaultValue: "Friends unavailable" })}</Text>}
      {inviting && <View style={s.row} accessibilityLiveRegion="polite"><ActivityIndicator color={PARTY_ACCENT} />
        <Text style={s.secondary}>{t("party_page.inviting", { defaultValue: "Sending invitation…" })}</Text></View>}
      <FlatList horizontal data={friends} keyExtractor={item => item.id} showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.friendList}
        ListEmptyComponent={<EmptyStateCard variant="flat" style={s.card} title={connected
          ? t("party_page.no_friends", { defaultValue: "No online friends" })
          : t("party_page.friends_unavailable", { defaultValue: "Friends unavailable" })} />}
        renderItem={({ item }) => {
          const blocked = disabled || !connected || !item.canInvite;
          const name = item.name || t("party_page.name_unavailable", { defaultValue: "Name unavailable" });
          const presenceLabel = item.presence === "available" ? t("party_page.available", { defaultValue: "Available" })
            : item.presence === "busy" ? t("party_page.busy", { defaultValue: "Busy" }) : t("party_page.away", { defaultValue: "Away" });
          const presenceColor = item.presence === "available" ? COLORS.SUCCESS : item.presence === "busy" ? COLORS.STATUS_BUSY : COLORS.STATUS_AWAY;
          const activityKey = item.activityLabel === "MENUS" ? "friends_page.in_menu"
            : item.activityLabel === "INGAME" ? "friends_page.in_game"
              : item.activityLabel === "PREGAME" ? "friends_page.in_pregame" : null;
          const activityText = activityKey ? t(activityKey, { defaultValue: item.activityLabel }) : item.activityLabel || presenceLabel;
          return <View style={s.friendCard}>
            <Pressable accessibilityRole="button" accessibilityLabel={t("party_page.invite_friend", { defaultValue: "Invite {{name}}", name })}
              accessibilityHint={t("party_page.invite_hint", { defaultValue: "Sends a party invitation" })}
              accessibilityValue={{ text: presenceLabel }} accessibilityState={{ disabled: blocked, busy: inviting }} disabled={blocked}
              onPress={() => { if (!blocked) void onInvite(item.id); }} style={blocked && s.disabled}>
              {item.avatarUrl ? <CachedImage source={{ uri: item.avatarUrl }} cacheId={`party-friend:${item.id}:${item.avatarUrl}`}
                style={s.friendAvatar} contentFit="cover" accessible={false} />
                : <View style={[s.friendAvatar, s.avatarFallback]}><AppIcon name="account" size={24} color={COLORS.TEXT_SECONDARY} decorative /></View>}
              <View style={[s.presence, { backgroundColor: presenceColor }]} />
            </Pressable>
            <Text style={s.friendName} numberOfLines={1}>{name}</Text>
            <Text style={s.friendStatus} numberOfLines={2}>{activityText}</Text>
          </View>;
        }} />
    </View>
  );
}
