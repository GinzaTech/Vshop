import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { MatchImage } from "~/components/matches/MatchImage";
import {
  MATCH_COLORS,
  MATCH_LAYOUT,
  MATCH_RADIUS,
  MATCH_SPACING,
} from "~/constants/MatchTheme";
import type { MatchPlayerRef } from "~/types/match-ui";

type TeamAgentStripProps = {
  players: MatchPlayerRef[];
  selectedPlayerId: string;
  onSelectPlayer: (playerId: string) => void;
};

export const TeamAgentStrip = React.memo(function TeamAgentStrip({
  players,
  selectedPlayerId,
  onSelectPlayer,
}: TeamAgentStripProps) {
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      directionalLockEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {players.map((player) => {
        const selected = player.playerId === selectedPlayerId;
        return (
          <Pressable
            key={player.playerId}
            accessibilityRole="button"
            accessibilityLabel={`${player.playerName}, ${player.agentName}`}
            accessibilityState={{ selected }}
            onPress={() => onSelectPlayer(player.playerId)}
            style={({ pressed }) => [
              styles.target,
              pressed && styles.targetPressed,
            ]}
          >
            <View
              style={[
                styles.agentShell,
                player.team === "A" ? styles.teamA : styles.teamB,
                selected && styles.selected,
                player.isCurrentUser && styles.currentUser,
              ]}
            >
              <MatchImage
                uri={player.agentIconUrl}
                cacheId={`agent:${player.playerId}:performance-strip`}
                style={styles.agentImage}
                icon="account-outline"
                iconSize={22}
              />
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  content: {
    gap: MATCH_SPACING.sm,
    paddingHorizontal: MATCH_SPACING.lg,
    paddingVertical: MATCH_SPACING.md,
  },
  target: {
    width: 56,
    height: MATCH_LAYOUT.minTouchTarget + 12,
    alignItems: "center",
    justifyContent: "center",
  },
  targetPressed: {
    opacity: 0.72,
  },
  agentShell: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: MATCH_RADIUS.medium,
    borderWidth: 2,
    overflow: "hidden",
  },
  teamA: {
    borderColor: MATCH_COLORS.teamAHeader,
    backgroundColor: MATCH_COLORS.teamAHeader,
  },
  teamB: {
    borderColor: MATCH_COLORS.teamBHeader,
    backgroundColor: MATCH_COLORS.teamBHeader,
  },
  selected: {
    borderColor: MATCH_COLORS.textPrimary,
  },
  currentUser: {
    shadowColor: MATCH_COLORS.teamA,
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 4,
  },
  agentImage: {
    width: 46,
    height: 46,
  },
});
