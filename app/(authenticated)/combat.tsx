import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "~/hooks/useAppTranslation";

import { COLORS, SPACING } from "~/constants/DesignSystem";
import ValorantButton from "~/components/ui/ValorantButton";
import { useUserStore } from "~/hooks/useUserStore";
import { useRiotScreenSession } from "~/hooks/useRiotScreenSession";
import { useCombatSnapshot } from "~/features/combat/useCombatSnapshot";
import { useCombatScreenActivity } from "~/features/combat/useCombatScreenActivity";
import PartyScreen from "~/features/party/PartyScreen";
import AgentSelectModal from "~/features/party/AgentSelectModal";
import { usePartyController } from "~/features/party/usePartyController";
import { usePregameAgentFlow } from "~/features/party/usePregameAgentFlow";
import { getAgent } from "~/utils/valorant-assets";

// Preserve the existing chat component's public entry point for other screens.
export { PartyChatPanel } from "~/features/party/PartyChatPanel";

export default function Combat() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const session = useRiotScreenSession(user);
  const activity = useCombatScreenActivity();
  const snapshot = useCombatSnapshot(session);
  const controller = usePartyController({ session, snapshot, enabled: activity.isActive });
  const agents = getAgent().agents;
  const onEnterMatch = React.useCallback(() => {
    router.push("/combat_session" as never);
  }, [router]);
  const flow = usePregameAgentFlow({
    session, snapshot, enabled: activity.isActive, agents, onEnterMatch,
  });
  const unavailableAgentIds = React.useMemo(
    () => (snapshot.pregameMatch?.AllyTeam?.Players ?? [])
      .filter((player) => player.Subject !== session.id && player.CharacterSelectionState === "locked")
      .map((player) => player.CharacterID),
    [session.id, snapshot.pregameMatch?.AllyTeam?.Players],
  );
  const onCloseParty = React.useCallback(() => router.back(), [router]);
  const onAllFriends = React.useCallback(() => router.push("/friends" as never), [router]);
  const selfLocked = snapshot.pregameMatch?.AllyTeam?.Players.some(
    (player) => player.Subject === session.id && player.CharacterSelectionState === "locked",
  ) ?? false;

  return (
    <View style={styles.screen}>
      <View style={styles.preview} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.previewText}>{t("combat")}</Text>
        <Text style={styles.previewText}>{session.region.toUpperCase()}</Text>
      </View>
      <View style={styles.body} accessibilityElementsHidden={flow.visible}
        importantForAccessibility={flow.visible ? "no-hide-descendants" : "auto"}>
        {snapshot.state === "pregame" && !flow.visible && !selfLocked ? (
          <ValorantButton title={t("party_page.select_agent", { defaultValue: "Select agent" })}
            variant="secondary" onPress={flow.onOpen} style={styles.reopen} />
        ) : null}
        <PartyScreen model={controller.model} refreshing={controller.refreshing}
          busyAction={controller.busyAction} errorMessage={controller.errorMessage}
          actions={{ ...controller.actions, onClose: onCloseParty, onAllFriends }} />
      </View>
      <AgentSelectModal visible={flow.visible} agents={agents}
        selectedAgentId={flow.selectedAgentId} unavailableAgentIds={unavailableAgentIds}
        locking={flow.locking} errorMessage={flow.errorMessage}
        onSelect={flow.onSelect} onLock={flow.onLock} onClose={flow.onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.BACKGROUND, paddingTop: SPACING.xs },
  preview: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xs,
  },
  previewText: { color: COLORS.TEXT_SECONDARY, fontSize: 12 },
  body: { flex: 1 },
  reopen: { marginHorizontal: SPACING.md, marginBottom: SPACING.xs },
});
