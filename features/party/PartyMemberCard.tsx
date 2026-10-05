import React from "react";
import { Switch, Text, View } from "react-native";
import { useTranslation } from "~/hooks/useAppTranslation";
import { CachedImage } from "~/components/CachedImage";
import AppIcon from "~/components/ui/AppIcon";
import { COLORS } from "~/constants/DesignSystem";
import type { PartyMemberView, PartyActions } from "./party-types";
import { PARTY_ACCENT, partyStyles as s } from "./party.styles";

type Props = { member: PartyMemberView; disabled: boolean; busy: boolean; onReady: PartyActions["onReady"] };

export default function PartyMemberCard({ member, disabled, busy, onReady }: Props) {
  const { t } = useTranslation();
  const name = member.name || t("party_page.name_unavailable", { defaultValue: "Name unavailable" });
  const readyLabel = member.ready ? t("party_page.ready", { defaultValue: "Ready" })
    : t("party_page.not_ready", { defaultValue: "Not ready" });
  const levelLabel = member.level == null ? t("party_page.level_unavailable", { defaultValue: "Level unavailable" })
    : t("party_page.level", { defaultValue: "Level {{level}}", level: member.level });
  const pingLabel = member.pingMs == null ? t("party_page.ping_unavailable", { defaultValue: "Ping unavailable" })
    : t("party_page.ping", { defaultValue: "{{ping}} ms", ping: member.pingMs });
  const rankLabel = !member.rankName ? t("party_page.rank_unavailable", { defaultValue: "Rank unavailable" })
    : member.rr == null ? member.rankName
      : t("party_page.rank_rr", { defaultValue: "{{rank}} · {{rr}} RR", rank: member.rankName, rr: member.rr });
  return (
    <View testID={`party-member-${member.id}`} style={s.memberProfile}>
      {member.avatarUrl ? <CachedImage source={{ uri: member.avatarUrl }} cacheId={`party-member:${member.id}:${member.avatarUrl}`}
        style={s.avatar} contentFit="cover" accessible={false} />
        : <View style={[s.avatar, s.avatarFallback]}><AppIcon name="account" size={18} color={COLORS.TEXT_SECONDARY} decorative /></View>}
      <View style={s.flexible}>
        <View style={s.nameRow}>
          <Text style={s.memberName} numberOfLines={1}>{name}</Text>
          {!!member.tag && <Text style={s.memberCaption} numberOfLines={1}>{member.tag.startsWith("#") ? member.tag : `#${member.tag}`}</Text>}
          {member.isLeader && <AppIcon name="rank" size={14} color={COLORS.STATUS_AWAY}
            label={t("party_page.leader", { defaultValue: "Party leader" })} />}
          {member.ready && <AppIcon name="ready" size={14} color={COLORS.SUCCESS} decorative />}
          {member.isSelf && <View style={s.badge}><Text style={s.badgeText}>{t("party_page.you", { defaultValue: "YOU" })}</Text></View>}
        </View>
        <View style={s.metadata}>
          <Text style={s.memberCaption}>{levelLabel}</Text>
          <Text style={s.memberCaption}>{pingLabel}</Text>
          <Text style={s.memberCaption}>{readyLabel}</Text>
        </View>
      </View>
      {member.isSelf && <View style={s.readyTouch}>
        <Switch style={s.readyTouch} value={member.ready} onValueChange={ready => { if (!disabled) void onReady(ready); }} disabled={disabled}
          accessibilityRole="switch" accessibilityLabel={t("party_page.ready", { defaultValue: "Ready" })}
          accessibilityState={{ checked: member.ready, disabled, busy }}
          trackColor={{ false: COLORS.SURFACE_MUTED, true: PARTY_ACCENT }} thumbColor={COLORS.PURE_WHITE} />
      </View>}
      <View testID={`party-rank-${member.id}`} style={s.rank} accessible
        accessibilityRole="image" accessibilityLabel={rankLabel}>
        {member.rankIconUrl
          ? <CachedImage source={{ uri: member.rankIconUrl }} cacheId={`party-rank:${member.rankIconUrl}`}
            style={s.rankIcon} contentFit="contain" accessible={false} />
          : <AppIcon name="unknown" size={20} color={COLORS.TEXT_SECONDARY} decorative />}
      </View>
    </View>
  );
}
