// 📦 night_market.tsx – Màn hình Chợ đêm (Night Market) Valorant
// Hiển thị các skin giảm giá đặc biệt trong sự kiện Night Market,
// kèm đếm ngược thời gian còn lại

import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useTranslation } from "~/hooks/useAppTranslation";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppIcon from "~/components/ui/AppIcon";
import { useAppWindowDimensions } from "~/components/ui/AppViewport";
import Countdown from "~/components/Countdown";
import NightMarketItem from "~/components/NightMarketItem";
import { useUserStore } from "~/hooks/useUserStore";
import { COLORS } from "~/constants/DesignSystem";
import EmptyStateCard from "~/components/ui/EmptyStateCard";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import { useAsyncRefresh } from "~/hooks/useAsyncRefresh";
import { refreshShopAndBalances } from "~/utils/app-sync";
import { getGlassNavigationMetrics } from "~/features/navigation/navigation-model";
import {
  getNightMarketGridLayout,
  NIGHT_MARKET_CONTENT_PADDING as CONTENT_PADDING,
  NIGHT_MARKET_GRID_GAP as GRID_GAP,
  NIGHT_MARKET_GRID_BOTTOM_GAP,
} from "~/utils/night-market-layout";

/**
 * NightMarket – Component chính hiển thị Chợ đêm
 * Gồm header, countdown, danh sách item dạng grid (2-3 cột), và info note
 */
function NightMarket() {
  const { t } = useTranslation();
  // Kích thước màn hình để tính số cột và chiều rộng card
  const { width, fontScale = 1 } = useAppWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  // Thông tin user từ store
  const user = useUserStore(({ user }) => user);
  // refreshShop: pull-to-refresh làm mới night market + balances (force = true)
  const refreshShop = React.useCallback(
    () => refreshShopAndBalances(true),
    []
  );
  const { refreshing, onRefresh } = useAsyncRefresh(refreshShop);
  // Timestamp kết thúc Night Market (hiện tại + số giây còn lại)
  // FIX (L10): useMemo — trước đây tính `Date.now() + remaining` mỗi render nên
  // bất kỳ re-render nào (wishlist đổi, parent tick) cũng trượt mốc đếm ngược
  // tiến về phía trước thay vì giảm dần đều.
  const timestamp = React.useMemo(
    () => new Date().getTime() + user.shops.remainingSecs.nightMarket * 1000,
    [user.shops.remainingSecs.nightMarket]
  );
  const [viewport, setViewport] = React.useState({ width: 0, height: 0 });
  const [gridPosition, setGridPosition] = React.useState({ width: 0, fontScale: 0, top: 0 });
  const [footer, setFooter] = React.useState({ width: 0, fontScale: 0, height: 0 });
  const bottomClearance = getGlassNavigationMetrics(width, bottom).contentBottomPadding;
  const { cardWidth, cardHeight } = getNightMarketGridLayout({
    width, fontScale, itemCount: user.shops.nightMarket.length,
    viewportHeight: Math.abs(viewport.width - width) < 1 ? viewport.height : 0,
    gridTop: gridPosition.width === width && gridPosition.fontScale === fontScale ? gridPosition.top : 0,
    footerHeight: footer.width === width && footer.fontScale === fontScale ? footer.height : 0,
    bottomClearance,
  });
  const measureViewport = React.useCallback(({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    setViewport((current) => current.width === layout.width && current.height === layout.height
      ? current : { width: layout.width, height: layout.height });
  }, []);
  const measureGrid = React.useCallback(({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    setGridPosition((current) => current.width === width && current.fontScale === fontScale && current.top === layout.y
      ? current : { width, fontScale, top: layout.y });
  }, [width, fontScale]);
  const measureFooter = React.useCallback(({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    setFooter((current) => current.width === width && current.fontScale === fontScale && current.height === layout.height
      ? current : { width, fontScale, height: layout.height });
  }, [width, fontScale]);

  return (
    <ScrollView
      onLayout={measureViewport}
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: bottomClearance }]}
      refreshControl={
        <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      alwaysBounceVertical
      showsVerticalScrollIndicator={false}
    >
      {user.shops.nightMarket.length === 0 ? (
        <EmptyStateCard
          centered
          icon={<AppIcon name="nightMarket" size={36} color={COLORS.TEXT_PRIMARY} decorative />}
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
            <View style={{ marginRight: 4 }}>
              <AppIcon name="nightMarket" size={10} color="#ff4655" decorative />
            </View>
            <Text style={styles.marketBadgeText}>{t("night_market_page.badge")}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.headerBalance}>
            <Text style={styles.headerBalanceText}>{user.balances.vp} {t("vp")}</Text>
            {/* FIX (L15): bỏ hardcode handle dev, fallback trung tính */}
            <Text style={styles.headerBalanceSubText}>{user.name || "Player"}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user.name || "V").slice(0, 1).toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* Black Countdown Pill Banner: đếm ngược thời gian */}
      <View style={styles.countdownContainer}>
        <View style={styles.countdownPill}>
          <View style={{ marginRight: 6 }}>
            <AppIcon name="clock" size={16} color={COLORS.PURE_WHITE} decorative />
          </View>
          <Text style={styles.countdownPillLabel}>{t("night_market_page.ends_in")}</Text>
          <Countdown timestamp={timestamp} textStyle={{ color: COLORS.PURE_WHITE, fontWeight: "700" }} />
        </View>
      </View>

      {/* Items List: grid các item Night Market */}
      <View testID="night-market-grid" onLayout={measureGrid} style={styles.list}>
        {user.shops.nightMarket.map((item) => (
          <NightMarketItem item={item} key={item.uuid} width={cardWidth} cardHeight={cardHeight} />
        ))}
      </View>

      {/* Bottom Info Note: thông tin phụ */}
      <View testID="night-market-info" onLayout={measureFooter} style={styles.infoNoteCard}>
        <View style={{ marginRight: 12 }}>
          <AppIcon name="info" size={20} color={COLORS.TEXT_SECONDARY} decorative />
        </View>
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
  },
  // headerRow – Hàng header (trái: logo, phải: balance + avatar)
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingTop: 6,
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
    marginBottom: 12,
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
    marginBottom: NIGHT_MARKET_GRID_BOTTOM_GAP,
  },
  // infoNoteCard – Card thông tin phụ cuối trang
  infoNoteCard: {
    flexDirection: "row",
    backgroundColor: COLORS.SURFACE,
    padding: 12,
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
