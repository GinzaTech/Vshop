import React from "react";
import { Text, View } from "react-native";
import { useTranslation } from "~/hooks/useAppTranslation";
import GlassCard from "~/components/ui/GlassCard";
import PartyMemberCard from "./PartyMemberCard";
import type { PartyActions, PartyMemberView } from "./party-types";
import { partyStyles as s } from "./party.styles";

type Props = {
  members: readonly PartyMemberView[];
  disabled: boolean;
  busy: boolean;
  onReady: PartyActions["onReady"];
};

export default function PartyTeamPanel({ members, disabled, busy, onReady }: Props) {
  const { t } = useTranslation();
  return <GlassCard testID="party-team-panel" variant="flat" style={s.card} contentStyle={s.teamContent}>
    <Text style={s.teamHeading} accessibilityRole="header">{t("party_page.members", { defaultValue: "Members" })}</Text>
    {members.length === 0
      ? <Text style={s.teamEmpty}>{t("party_page.members_unavailable", { defaultValue: "Members unavailable" })}</Text>
      : members.map((member, index) => <React.Fragment key={member.id}>
        {index > 0 && <View style={s.divider} />}
        <PartyMemberCard member={member} disabled={disabled} busy={busy} onReady={onReady} />
      </React.Fragment>)}
  </GlassCard>;
}
