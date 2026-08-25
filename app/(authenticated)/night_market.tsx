// 📦 night_market.tsx – Màn hình Chợ đêm (Night Market) Valorant
// Hiển thị các skin giảm giá đặc biệt trong sự kiện Night Market,
// kèm đếm ngược thời gian còn lại

import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";

import Countdown from "~/components/Countdown";
import NightMarketItem from "~/components/NightMarketItem";
import { useUserStore } from "~/hooks/useUserStore";
import { COLORS } from "~/constants/DesignSystem";
import EmptyStateCard from "~/components/ui/EmptyStateCard";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import { useAsyncRefresh } from "~/hooks/useAsyncRefresh";
import { refreshShopAndBalances } from "~/utils/app-sync";

// Khoảng cách padding cho nội dung
const CONTENT_PADDING = 20;
// Khoảng cách giữa các item trong grid
const GRID_GAP = 12;

/**
 * NightMarket – Component chính hiển thị Chợ đêm
 * Gồm header, countdown, danh sách item dạng grid (2-3 cột), và info note
 */
function NightMarket() {
  const { t } = useTranslation();
  // Kích thước màn hình để tính số cột và chiều rộng card
  const { width } = useWindowDimensions();
  // Thông tin user từ store
  const user = useUserStore(({ user }) => user);
  const refreshShop = React.useCallback(
    () => refreshShopAndBalances(true),
    []
  );
  const { refreshing, onRefresh } = useAsyncRefresh(refreshShop);
  // Timestamp kết thúc Night Market (hiện tại + số giây còn lại)
  const timestamp =
    new Date().getTime() + user.shops.remainingSecs.nightMarket * 1000;
  // Số cột: 3 nếu màn hình rộng >= 700, ngược lại 2
  const columnCount = width >= 700 ? 3 : 2;
  // Tính chiều rộng mỗi card dựa trên kích thước màn hình, padding, gap
  const cardWidth = Math.floor(
    (width - CONTENT_PADDING * 2 - GRID_GAP * (columnCount - 1)) /
      columnCount
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      alwaysBounceVertical
      showsVerticalScrollIndicator={false}
    >
      {user.shops.nightMarket.length === 0 ? (
        <EmptyStateCard
          centered
          icon={<Icon name="weather-night" size={36} color={COLORS.TEXT_PRIMARY} />}
          title={t("night_market_page.empty_title")}
          subtitle={t("night_market_page.empty_subtitle")}
        />
      ) : (
        <>
      {/* Premium Custom Header: logo + badge + balance + avatar */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Vshop</Text>
          <View style={styles.marketBadge}>
            <Icon name="moon-waning-crescent" size={10} color="#ff4655" style={{ marginRight: 4 }} />
            <Text style={styles.marketBadgeText}>{t("night_market_page.badge")}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.headerBalance}>
            <Text style={styles.headerBalanceText}>{user.balances.vp} {t("vp")}</Text>
            <Text style={styles.headerBalanceSubText}>{user.name || "KONA_Prime"}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user.name || "V").slice(0, 1).toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* Black Countdown Pill Banner: đếm ngược thời gian */}
      <View style={styles.countdownContainer}>
        <View style={styles.countdownPill}>
          <Icon name="clock-outline" size={16} color={COLORS.PURE_WHITE} style={{ marginRight: 6 }} />
          <Text style={styles.countdownPillLabel}>{t("night_market_page.ends_in")}</Text>
          <Countdown timestamp={timestamp} textStyle={{ color: COLORS.PURE_WHITE, fontWeight: "700" }} />
        </View>
      </View>

      {/* Items List: grid các item Night Market */}
      <View style={styles.list}>
        {user.shops.nightMarket.map((item) => (
          <NightMarketItem item={item} key={item.uuid} width={cardWidth} />
        ))}
      </View>

      {/* Bottom Info Note: thông tin phụ */}
      <View style={styles.infoNoteCard}>
        <Icon name="information-outline" size={20} color={COLORS.TEXT_SECONDARY} style={{ marginRight: 12 }} />
        <Text style={styles.infoNoteText}>
          {t("night_market_page.info_note")}
        </Text>
      </View>
        </>
      )}
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════
// StyleSheet – Định nghĩa styles cho màn hình Night Market
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  // screen – Container chính full màn hình
  screen: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  // content – Padding cho ScrollView
  content: {
    flexGrow: 1,
    padding: CONTENT_PADDING,
    paddingBottom: 32,
  },
  // headerRow – Hàng header (trái: logo, phải: balance + avatar)
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 10,
  },
  // headerLeft – Bên trái header (logo + badge)
  headerLeft: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  // headerTitle – Tiêu đề "Vshop"
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
    letterSpacing: -0.5,
  },
  // marketBadge – Badge "NIGHT MARKET" màu đỏ nhạt
  marketBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 70, 85, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  // marketBadgeText – Text trong badge
  marketBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#ff4655",
    letterSpacing: 1,
  },
  // headerRight – Bên phải header (balance + avatar)
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  // headerBalance – Vùng balance VP
  headerBalance: {
    alignItems: "flex-end",
    marginRight: 10,
  },
  // headerBalanceText – Số dư VP
  headerBalanceText: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  // headerBalanceSubText – Tên người dùng
  headerBalanceSubText: {
    fontSize: 11,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 1,
  },
  // avatar – Vòng tròn avatar người dùng
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.PURE_BLACK,
    justifyContent: "center",
    alignItems: "center",
  },
  // avatarText – Chữ cái đầu trong avatar
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.PURE_WHITE,
  },
  // countdownContainer – Container cho pill countdown
  countdownContainer: {
    marginBottom: 20,
    alignItems: "flex-start",
  },
  // countdownPill – Pill đen chứa countdown
  countdownPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.PURE_BLACK,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  // countdownPillLabel – Label "Ends in"
  countdownPillLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "600",
  },
  // list – Grid chứa các item Night Market (flexWrap)
  list: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    marginBottom: 24,
  },
  // infoNoteCard – Card thông tin phụ cuối trang
  infoNoteCard: {
    flexDirection: "row",
    backgroundColor: COLORS.SURFACE,
    padding: 16,
    borderRadius: 16,
    borderColor: COLORS.BORDER,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  // infoNoteText – Text trong info note
  infoNoteText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 16,
  },
});

export default NightMarket;
