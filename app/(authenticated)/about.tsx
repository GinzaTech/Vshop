import React from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { useTranslation } from "react-i18next";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";

import { useUserStore } from "~/hooks/useUserStore";
import {
  getPlayerInfo,
  getRiotClientConfig,
  getContent,
} from "~/utils/valorant-api";
import { getStoredItem, setStoredItem, removeStoredItem } from "~/utils/storage";
import GlassCard from "~/components/ui/GlassCard";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

type ToggleOverrides = Record<string, boolean>;

const STORAGE_KEY_TOGGLES = "about:feature_toggle_overrides";

// ─── Component chính ──────────────────────────────────────────────────────────
export default function AboutScreen() {
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);

  const [playerInfo, setPlayerInfo] = React.useState<PlayerInfoResponse | null>(null);
  const [riotConfig, setRiotConfig] = React.useState<RiotClientConfigResponse | null>(null);
  const [content, setContent] = React.useState<ContentResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Toggle overrides: key → boolean (value khác với riot default)
  const [toggleOverrides, setToggleOverrides] = React.useState<ToggleOverrides>({});
  // Keys nào đang có override (để hiển thị badge)
  const toggleOverrideKeys = React.useMemo(
    () => new Set(Object.keys(toggleOverrides)),
    [toggleOverrides]
  );

  // ── Load data ────────────────────────────────────────────────────────────
  React.useEffect(() => {
    const fetchAll = async () => {
      if (!user.accessToken || !user.entitlementsToken || !user.region) {
        setLoading(false);
        return;
      }
      try {
        const [pi, rc, ct, toggleRaw] = await Promise.all([
          getPlayerInfo(user.accessToken).catch(() => null),
          getRiotClientConfig(user.accessToken, user.entitlementsToken).catch(() => null),
          getContent(user.accessToken, user.entitlementsToken, user.region).catch(() => null),
          getStoredItem(STORAGE_KEY_TOGGLES).catch(() => null),
        ]);
        if (pi) setPlayerInfo(pi);
        if (rc) setRiotConfig(rc);
        if (ct) setContent(ct);
        if (toggleRaw) {
          try { setToggleOverrides(JSON.parse(toggleRaw)); } catch {}
        }
      } catch (err) {
        console.error("[about] fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [user]);

  // ── Toggle helpers ───────────────────────────────────────────────────────
  const getToggleValue = (key: string, riotDefault: boolean): boolean =>
    key in toggleOverrides ? toggleOverrides[key] : riotDefault;

  const handleToggleChange = async (key: string, riotDefault: boolean, newVal: boolean) => {
    const next: ToggleOverrides = { ...toggleOverrides };
    if (newVal === riotDefault) {
      // Nếu trả về mặc định → xóa override
      delete next[key];
    } else {
      next[key] = newVal;
    }
    setToggleOverrides(next);
    try {
      await setStoredItem(STORAGE_KEY_TOGGLES, JSON.stringify(next));
    } catch (err) {
      console.error("[about] Failed to save toggle overrides:", err);
    }
  };

  const handleResetToggles = () => {
    Alert.alert(t("about_page.reset_toggles_title"), t("about_page.reset_toggles_confirm"), [
      { text: t("about_page.cancel"), style: "cancel" },
      {
        text: t("about_page.reset_action"),
        style: "destructive",
        onPress: async () => {
          await removeStoredItem(STORAGE_KEY_TOGGLES);
          setToggleOverrides({});
        },
      },
    ]);
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderInfoRow = (label: string, value: string) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable numberOfLines={1}>
        {value}
      </Text>
    </View>
  );

  const renderBoolReadRow = (label: string, value: boolean) =>
    renderInfoRow(label, value ? t("about_page.yes") : t("about_page.no"));

  /** Toggle switch row — interactive */
  const renderToggleRow = (key: string, riotDefault: boolean) => {
    const currentVal = getToggleValue(key, riotDefault);
    const isOverridden = toggleOverrideKeys.has(key);
    return (
      <View key={key} style={styles.toggleRow}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleKey} numberOfLines={1}>
            {key}
          </Text>
          {isOverridden && (
            <View style={styles.overrideBadge}>
              <Text style={styles.overrideBadgeText}>{t("about_page.overridden")}</Text>
            </View>
          )}
        </View>
        <Switch
          value={currentVal}
          onValueChange={(val) => handleToggleChange(key, riotDefault, val)}
          trackColor={{ false: COLORS.SURFACE_MUTED, true: COLORS.ACCENT }}
          thumbColor={Platform.OS === "android" ? COLORS.PURE_WHITE : undefined}
        />
      </View>
    );
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator animating color={COLORS.ACCENT} size="large" />
        <Text style={styles.loadingText}>{t("about_page.loading")}</Text>
      </View>
    );
  }

  const activeAct = content?.Seasons?.find((s) => s.Type === "act" && s.IsActive);
  const activeEpisode = content?.Seasons?.find((s) => s.Type === "episode" && s.IsActive);
  const hasToggleOverrides = Object.keys(toggleOverrides).length > 0;

  const boolEntries = riotConfig
    ? (Object.entries(riotConfig) as [string, unknown][]).filter(
        ([, v]) => typeof v === "boolean"
      ).slice(0, 30)
    : [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Hero ── */}
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Icon name="information-outline" size={24} color={COLORS.PURE_WHITE} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.title}>{t("about_page.title")}</Text>
          <Text style={styles.subtitle}>{t("about_page.subtitle")}</Text>
        </View>
      </View>

      {/* ── Thông tin tài khoản ── */}
      {playerInfo && (
        <>
          <Text style={styles.sectionTitle}>{t("about_page.player_info_title")}</Text>
          <GlassCard style={styles.card}>
            {renderInfoRow(
              t("about_page.profile") ?? "Profile",
              `${playerInfo.acct.game_name}#${playerInfo.acct.tag_line}`
            )}
            {renderInfoRow("PUUID", playerInfo.sub)}
            {renderInfoRow(t("about_page.country"), playerInfo.country)}
            {renderInfoRow("Language", playerInfo.player_locale || "---")}
            {renderBoolReadRow(t("about_page.email_verified"), playerInfo.email_verified)}
            {renderBoolReadRow(t("about_page.phone_verified"), playerInfo.phone_number_verified)}
            {renderInfoRow(
              t("about_page.account_created"),
              playerInfo.acct.created_at
                ? new Date(playerInfo.acct.created_at).toLocaleDateString()
                : "---"
            )}
          </GlassCard>
        </>
      )}

      {/* ── Season hiện tại ── */}
      {(activeEpisode || activeAct) && (
        <>
          <Text style={styles.sectionTitle}>{t("about_page.current_season_title")}</Text>
          <GlassCard style={styles.card}>
            {activeEpisode && renderInfoRow(t("about_page.episode"), activeEpisode.Name)}
            {activeAct && renderInfoRow(t("about_page.act"), activeAct.Name)}
            {activeAct &&
              renderInfoRow(
                t("about_page.act_ends"),
                new Date(activeAct.EndTime).toLocaleDateString()
              )}
          </GlassCard>
        </>
      )}

      {/* ── Feature Toggles (interactive Switch) ── */}
      {riotConfig && boolEntries.length > 0 && (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t("about_page.feature_toggles")}</Text>
            {hasToggleOverrides && (
              <TouchableOpacity style={styles.btnDanger} onPress={handleResetToggles}>
                <Icon name="restore" size={14} color={COLORS.WARNING} />
                <Text style={styles.btnDangerText}>{t("about_page.reset_action")}</Text>
              </TouchableOpacity>
            )}
          </View>

          {hasToggleOverrides && (
            <View style={styles.overrideBanner}>
              <Icon name="information-outline" size={14} color={COLORS.ACCENT} />
              <Text style={styles.overrideBannerText}>
                {t("about_page.toggle_override_active", {
                  count: Object.keys(toggleOverrides).length,
                })}
              </Text>
            </View>
          )}

          <View style={styles.configNote}>
            <Icon name="information-outline" size={16} color={COLORS.TEXT_SECONDARY} />
            <Text style={styles.configNoteText}>
              Các switch bên dưới là feature flag Riot Client trả về. Khi bạn đổi switch, VShop chỉ lưu override cục bộ để app thử hành vi khác; nó không thay đổi tài khoản Riot hay game client.
            </Text>
          </View>

          <GlassCard style={styles.card}>
            {boolEntries.map(([k, v]) => renderToggleRow(k, v as boolean))}
          </GlassCard>
        </>
      )}

      {/* Empty */}
      {!playerInfo && !riotConfig && !content && (
        <GlassCard style={styles.emptyCard}>
          <Text style={styles.emptyText}>{t("about_page.loading")}</Text>
        </GlassCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  content: { padding: 20, paddingBottom: 140 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.BACKGROUND,
  },
  loadingText: { marginTop: 12, color: COLORS.TEXT_SECONDARY, fontSize: 14 },

  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 6,
    marginBottom: 18,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.PURE_BLACK,
  },
  heroCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 28, fontWeight: "800", color: COLORS.TEXT_PRIMARY },
  subtitle: { marginTop: 6, fontSize: 15, lineHeight: 22, color: COLORS.TEXT_SECONDARY },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 12,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    flexShrink: 1,
  },
  rowActions: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },

  btnDanger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.WARNING_SURFACE,
    borderWidth: 1,
    borderColor: COLORS.WARNING_BORDER,
  },
  btnDangerText: { fontSize: 13, fontWeight: "600", color: COLORS.WARNING },

  overrideBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(104,112,118,0.08)",
    borderRadius: RADIUS.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  overrideBannerText: { fontSize: 12, color: COLORS.ACCENT, flex: 1 },

  card: { padding: 14, marginBottom: 12 },

  // ── Read-only info row ──
  row: {
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
    gap: 4,
  },
  rowLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  rowLabel: { fontSize: 12, fontWeight: "600", color: COLORS.TEXT_SECONDARY },
  rowValue: { fontSize: 13, fontWeight: "700", color: COLORS.TEXT_PRIMARY },
  rowValueOverride: { color: COLORS.ACCENT },
  overrideBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(104,112,118,0.12)",
  },
  overrideBadgeText: { fontSize: 10, fontWeight: "700", color: COLORS.ACCENT },

  // ── Toggle row ──
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  toggleInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  toggleKey: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
    flexShrink: 1,
  },
  configNote: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 16,
    backgroundColor: COLORS.SURFACE_MUTED,
    marginBottom: 10,
  },
  configNoteText: {
    flex: 1,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },

  emptyCard: { padding: 24, alignItems: "center" },
  emptyText: { fontSize: 14, color: COLORS.TEXT_SECONDARY },
});
