import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import axios from "axios";

import { useUserStore } from "~/hooks/useUserStore";
import { getContracts } from "~/utils/valorant-api";
import { getAgent } from "~/utils/valorant-assets";
import { getVAPILang } from "~/utils/localization";
import GlassCard from "~/components/ui/GlassCard";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

type ContractEntry = {
  ContractDefinitionID: string;
  ProgressionLevelReached: number;
  ProgressionTowardsNextLevel: number;
  ContractProgression: {
    TotalProgressionEarned: number;
  };
};

type ContractDefinition = {
  uuid: string;
  displayName: string;
  displayIcon?: string | null;
  content?: {
    relationType?: string;
    relationUuid?: string;
  };
};

const BATTLEPASS_CONTRACT_PREFIX = "79cf2ea0-";
const EVENTPASS_CONTRACT_PREFIXES = ["c3a4c9e0-"];

function isBattlePass(id: string) {
  return id.startsWith(BATTLEPASS_CONTRACT_PREFIX);
}

function isEventPass(id: string) {
  return EVENTPASS_CONTRACT_PREFIXES.some((p) => id.startsWith(p));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(Math.max(0, Math.floor(value || 0)));
}

export default function ContractsScreen() {
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const agents = getAgent().agents || [];

  const [contracts, setContracts] = React.useState<ContractsResponse | null>(null);
  const [contractDefinitions, setContractDefinitions] = React.useState<ContractDefinition[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchData = React.useCallback(async () => {
    if (!user.accessToken || !user.entitlementsToken || !user.region || !user.id) {
      setLoading(false);
      return;
    }
    try {
      const [data, definitionsResponse] = await Promise.all([
        getContracts(
          user.accessToken,
          user.entitlementsToken,
          user.region,
          user.id
        ),
        axios
          .get<{ data: ContractDefinition[] }>(
            `https://valorant-api.com/v1/contracts?language=${getVAPILang()}`
          )
          .catch(() => null),
      ]);
      setContracts(data);
      setContractDefinitions(definitionsResponse?.data?.data ?? []);
    } catch (err) {
      console.error("Failed to fetch contracts:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getAgentForContract = (contractId: string) => {
    const definition = contractDefinitions.find((item) => item.uuid === contractId);
    const relationUuid = definition?.content?.relationUuid;
    return agents.find(
      (agent: any) =>
        agent.uuid === contractId ||
        (relationUuid && agent.uuid === relationUuid)
    );
  };

  const getContractDefinition = (contractId: string) =>
    contractDefinitions.find((item) => item.uuid === contractId);

  const contractsList = contracts?.Contracts ?? [];
  const battlePass = contractsList.find((c) => isBattlePass(c.ContractDefinitionID));
  const eventPasses = contractsList.filter((c) => isEventPass(c.ContractDefinitionID));
  const agentContracts = contractsList.filter(
    (c) => !isBattlePass(c.ContractDefinitionID) && !isEventPass(c.ContractDefinitionID)
  );

  const missionList = contracts?.Missions ?? [];
  const activeSpecial = contracts?.ActiveSpecialContract;

  const renderContractCard = (
    contract: ContractEntry,
    type: "battlepass" | "eventpass" | "agent_contract"
  ) => {
    const agent = type === "agent_contract"
      ? getAgentForContract(contract.ContractDefinitionID)
      : null;
    const definition = getContractDefinition(contract.ContractDefinitionID);
    const isActive = contract.ContractDefinitionID === activeSpecial;
    const nextLevelCost =
      contract.ProgressionTowardsNextLevel > 0
        ? contract.ProgressionTowardsNextLevel
        : 0;
    const progressPercent =
      nextLevelCost > 0
        ? Math.min(
            100,
            (contract.ContractProgression.TotalProgressionEarned / nextLevelCost) * 100
          )
        : 0;
    const title =
      agent?.displayName ||
      definition?.displayName ||
      (type === "battlepass"
        ? t("contracts_page.battlepass")
        : type === "eventpass"
          ? t("contracts_page.eventpass")
          : t("contracts_page.agent_contract"));
    const iconName =
      type === "battlepass"
        ? "ticket-confirmation-outline"
        : type === "eventpass"
          ? "calendar-star"
          : "account-star-outline";
    const portrait =
      agent?.fullPortraitV2 ||
      agent?.fullPortrait ||
      agent?.bustPortrait ||
      definition?.displayIcon ||
      agent?.displayIcon;

    return (
      <GlassCard
        key={contract.ContractDefinitionID}
        style={[
          styles.contractCard,
          isActive && styles.contractCardActive,
        ]}
      >
        <View style={styles.contractHeader}>
          <View style={styles.contractVisual}>
            {portrait ? (
              <Image
                source={{ uri: portrait }}
                style={styles.contractImage}
                contentFit="contain"
              />
            ) : (
              <Icon name={iconName} size={34} color={COLORS.TEXT_SECONDARY} />
            )}
          </View>

          <View style={styles.contractMain}>
            <View style={styles.contractTitleRow}>
              <View style={styles.contractTypeIcon}>
                <Icon name={iconName} size={15} color={COLORS.PURE_WHITE} />
              </View>
              <Text style={styles.contractName} numberOfLines={1}>
                {title}
              </Text>
            </View>

            <View style={styles.contractMetaRow}>
              <View style={styles.levelBadge}>
                <Icon name="stairs-up" size={13} color={COLORS.TEXT_PRIMARY} />
                <Text style={styles.levelBadgeText}>
                  Lv. {contract.ProgressionLevelReached}
                </Text>
              </View>
              {isActive ? (
                <View style={styles.activeBadge}>
                  <Icon name="check" size={12} color={COLORS.PURE_WHITE} />
                  <Text style={styles.activeBadgeText}>
                    {t("contracts_page.activated")}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.xpBar}>
              <View
                style={[
                  styles.xpBarFill,
                  { width: `${progressPercent}%` },
                ]}
              />
            </View>
            <Text style={styles.xpText} numberOfLines={1}>
              {t("contracts_page.xp_progress", {
                current: formatNumber(contract.ContractProgression.TotalProgressionEarned),
                next: nextLevelCost ? formatNumber(nextLevelCost) : "---",
              })}
            </Text>
          </View>

        </View>
      </GlassCard>
    );
  };

  const renderMission = (mission: any) => {
    const target = Object.values(mission.Objectives)[0] as number | undefined;
    const current = 0;
    const isComplete = mission.Complete;

    return (
      <View key={mission.ID} style={styles.missionRow}>
        <View style={styles.missionIcon}>
          <Icon
            name={isComplete ? "check-circle" : "flag-checkered"}
            size={18}
            color={isComplete ? COLORS.SUCCESS : COLORS.TEXT_PRIMARY}
          />
        </View>
        <View style={styles.missionInfo}>
          <Text style={styles.missionId} numberOfLines={1}>
            {mission.ID.substring(0, 8)}...
          </Text>
          {isComplete ? (
            <Text style={styles.missionComplete}>
              {t("contracts_page.mission_complete")}
            </Text>
          ) : target ? (
            <Text style={styles.missionProgress}>
              {t("contracts_page.mission_progress", {
                current,
                target,
              })}
            </Text>
          ) : null}
        </View>
        {isComplete ? (
          <Icon name="check-circle" size={20} color="#4ade80" />
        ) : (
          <View style={styles.missionBarWrap}>
            <View
              style={[
                styles.missionBarFill,
                {
                  width: target && target > 0 ? `${(current / target) * 100}%` : "0%",
                },
              ]}
            />
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator animating color={COLORS.ACCENT} size="large" />
        <Text style={styles.loadingText}>{t("contracts_page.loading")}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Icon name="passport" size={26} color={COLORS.PURE_WHITE} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.title}>{t("contracts_page.title")}</Text>
          <Text style={styles.subtitle}>{t("contracts_page.subtitle")}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Icon name="account-star-outline" size={18} color={COLORS.TEXT_PRIMARY} />
          <Text style={styles.statValue}>{agentContracts.length}</Text>
          <Text style={styles.statLabel}>{t("contracts_page.agent_contracts_title")}</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="clipboard-check-outline" size={18} color={COLORS.TEXT_PRIMARY} />
          <Text style={styles.statValue}>{missionList.length}</Text>
          <Text style={styles.statLabel}>{t("contracts_page.missions_title")}</Text>
        </View>
      </View>

      {battlePass && renderContractCard(battlePass, "battlepass")}

      {eventPasses.map((ep) => renderContractCard(ep, "eventpass"))}

      {agentContracts.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            {t("contracts_page.agent_contracts_title")}
          </Text>
          {agentContracts.map((ac) =>
            renderContractCard(ac, "agent_contract")
          )}
        </>
      )}

      {missionList.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            {t("contracts_page.missions_title")}
          </Text>
          <GlassCard style={styles.missionsCard}>
            {missionList.map(renderMission)}
          </GlassCard>
        </>
      )}

      {contractsList.length === 0 && (
        <GlassCard style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            {t("contracts_page.empty_title")}
          </Text>
          <Text style={styles.emptySubtitle}>
            {t("contracts_page.empty_subtitle")}
          </Text>
        </GlassCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    padding: 20,
    paddingBottom: 140,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.BACKGROUND,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 6,
    marginBottom: 18,
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.PURE_BLACK,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.TEXT_SECONDARY,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    minHeight: 84,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
    padding: 12,
    justifyContent: "center",
  },
  statValue: {
    marginTop: 7,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "900",
  },
  statLabel: {
    marginTop: 2,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 12,
    marginTop: 8,
  },
  contractCard: {
    marginBottom: 12,
    padding: 0,
    overflow: "hidden",
  },
  contractCardActive: {
    borderColor: COLORS.PURE_BLACK,
    borderWidth: 1,
  },
  contractHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 116,
    padding: 12,
  },
  contractVisual: {
    width: 86,
    height: 92,
    borderRadius: 18,
    backgroundColor: COLORS.SURFACE_MUTED,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  contractImage: {
    width: "120%",
    height: "120%",
  },
  contractMain: {
    flex: 1,
    minWidth: 0,
  },
  contractTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  contractTypeIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.PURE_BLACK,
  },
  contractName: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.TEXT_PRIMARY,
    flex: 1,
  },
  contractMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 10,
  },
  levelBadge: {
    minHeight: 27,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  levelBadgeText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 11,
    fontWeight: "800",
  },
  activeBadge: {
    minHeight: 27,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SUCCESS,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.PURE_WHITE,
  },
  xpBar: {
    marginTop: 12,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.SURFACE_MUTED,
    overflow: "hidden",
  },
  xpBarFill: {
    height: "100%",
    backgroundColor: COLORS.VALORANT_RED,
    borderRadius: 4,
  },
  xpText: {
    marginTop: 7,
    fontSize: 11,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: "700",
  },
  missionsCard: {
    padding: 8,
    marginBottom: 12,
  },
  missionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 58,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  missionIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  missionInfo: {
    flex: 1,
    minWidth: 0,
  },
  missionId: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  missionComplete: {
    marginTop: 2,
    fontSize: 12,
    color: "#4ade80",
    fontWeight: "600",
  },
  missionProgress: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
  },
  missionBarWrap: {
    width: 80,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.SURFACE_MUTED,
    overflow: "hidden",
  },
  missionBarFill: {
    height: "100%",
    backgroundColor: COLORS.VALORANT_RED,
    borderRadius: 3,
  },
  emptyCard: {
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 20,
  },
});
