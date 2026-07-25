import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { MatchImage } from "~/components/matches/MatchImage";
import {
  MATCH_COLORS,
  MATCH_LAYOUT,
  MATCH_RADIUS,
} from "~/constants/MatchTheme";

type MatchHistoryHeaderProps = {
  playerName: string;
  tagLine: string;
  avatarUrl?: string;
  rankIconUrl?: string;
  onBack: () => void;
};

function MatchHistoryHeaderComponent({
  playerName,
  tagLine,
  avatarUrl,
  rankIconUrl,
  onBack,
}: MatchHistoryHeaderProps) {
  const { t } = useTranslation();

  return (
    <View>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("match_ui.actions.back")}
          onPress={onBack}
          hitSlop={8}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.iconButtonPressed,
          ]}
        >
          <Icon name="arrow-left" size={22} color={MATCH_COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.screenTitle}>{t("match_ui.history_title")}</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.profileHeader}>
        <MatchImage
          uri={avatarUrl}
          cacheId={avatarUrl ? `profile-card:${avatarUrl}` : undefined}
          style={styles.avatar}
          icon="account-outline"
          iconSize={28}
        />
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text style={styles.playerName} numberOfLines={1}>
              {playerName || t("match_ui.player_fallback")}
            </Text>
            {tagLine ? (
              <Text style={styles.tagLine} numberOfLines={1}>
                #{tagLine.replace(/^#/, "")}
              </Text>
            ) : null}
          </View>
        </View>
        {rankIconUrl ? (
          <View style={styles.rankContainer}>
            <MatchImage
              uri={rankIconUrl}
              cacheId={`rank:${rankIconUrl}`}
              style={styles.rankIcon}
              icon="shield-outline"
              iconSize={18}
              contentFit="contain"
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: MATCH_LAYOUT.minTouchTarget,
    height: MATCH_LAYOUT.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: MATCH_RADIUS.medium,
  },
  iconButtonPressed: {
    backgroundColor: MATCH_COLORS.pressed,
  },
  screenTitle: {
    color: MATCH_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  topBarSpacer: {
    width: MATCH_LAYOUT.minTouchTarget,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingTop: 32,
    paddingBottom: 24,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 5,
    minWidth: 0,
  },
  playerName: {
    flexShrink: 1,
    color: MATCH_COLORS.textPrimary,
    fontSize: 26,
    fontWeight: "700",
  },
  tagLine: {
    color: MATCH_COLORS.textMuted,
    fontSize: 18,
    fontWeight: "500",
  },
  rankContainer: {
    width: 46,
    height: 46,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#252A31",
    flexShrink: 0,
    marginLeft: 8,
  },
  rankIcon: {
    width: 36,
    height: 36,
  },
});

export const MatchHistoryHeader = React.memo(MatchHistoryHeaderComponent);
