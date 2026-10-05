// ===== Import các thư viện =====
import React from "react";
import { Platform, ScrollView, StyleSheet, Text } from "react-native";
import { useTranslation } from "~/hooks/useAppTranslation";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BundleImage from "~/components/BundleImage";
import CurrencyIcon from "~/components/CurrencyIcon";
import { useUserStore } from "~/hooks/useUserStore";
import { useBundleOwnership } from "~/hooks/useBundleOwnership";
import { COLORS } from "~/constants/DesignSystem";
import EmptyStateCard from "~/components/ui/EmptyStateCard";
import InfoPill from "~/components/ui/InfoPill";
import PageIntro from "~/components/ui/PageIntro";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import AppIcon from "~/components/ui/AppIcon";
import { useAsyncRefresh } from "~/hooks/useAsyncRefresh";
import { refreshShopAndBalances } from "~/utils/app-sync";
import { getPrimaryTabContentBottomPadding } from "~/constants/Layout";
import { formatVp } from "~/utils/bundle-display";

/**
 * Bundles — Component hiển thị danh sách bundle (gói skin) trong shop.
 * Mỗi bundle render inline bằng BundleImage (card nền trắng kèm carousel
 * item ngang); không còn modal chi tiết tối.
 *
 * State:
 * - user (từ useUserStore): shops.bundles, balances.vp, remainingSecs.
 * - refreshing/onRefresh (useAsyncRefresh): pull-to-refresh gọi dữ liệu thật.
 *
 * @returns {JSX.Element} Danh sách bundle hoặc EmptyStateCard nếu trống.
 */
function Bundles() {
  // Hook dịch thuật đa ngôn ngữ
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Lấy thông tin user từ store (bao gồm shops.bundles, balances.vp, ...)
  const user = useUserStore(({ user }) => user);
  // Ownership theo đúng tài khoản/loại item cho badge trên skin và phụ kiện.
  const { isOwned, reload: reloadOwnership } = useBundleOwnership();
  // refreshShop: pull-to-refresh làm mới shop + balances (force = true)
  // và kiểm lại ownership cùng lúc — không dùng dữ liệu ownership cũ.
  const refreshShop = React.useCallback(
    async () => {
      await Promise.all([refreshShopAndBalances(true), reloadOwnership()]);
    },
    [reloadOwnership]
  );
  const { refreshing, onRefresh } = useAsyncRefresh(refreshShop);

  return (
    <ScrollView
      removeClippedSubviews={Platform.OS === "android"}
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: getPrimaryTabContentBottomPadding(insets.bottom) },
      ]}
      refreshControl={
        <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      alwaysBounceVertical
      showsVerticalScrollIndicator={false}
    >
      {user.shops.bundles.length === 0 ? (
        <EmptyStateCard
          centered
          icon={
            <AppIcon
              name="bundle"
              size={38}
              color={COLORS.TEXT_PRIMARY}
              decorative
            />
          }
          title={t("bundles_page.empty_title")}
          subtitle={t("bundles_page.empty_subtitle")}
        />
      ) : (
      <>
      {/* Tiêu đề trang */}
      <PageIntro
        title={t("bundles_page.title")}
        style={styles.header}
      />

      {/* Hiển thị số dư VP (Valorant Points) trên nền sáng */}
      <InfoPill style={styles.balancePill}>
        <CurrencyIcon icon="vp" style={styles.balanceIcon} />
        <Text style={styles.balanceText}>{formatVp(user.balances.vp)}</Text>
      </InfoPill>

      {/* Mỗi bundle là một card detail trắng tự chứa (hero + giá + carousel) */}
      {user.shops.bundles.map((bundle, index) => (
        <BundleImage
          key={bundle.uuid}
          bundle={bundle}
          // remainingSecs: thời gian còn lại của bundle (tính bằng giây)
          remainingSecs={user.shops.remainingSecs.bundles[index]}
          // isOwned: badge "đã sở hữu" theo entitlement của tài khoản hiện tại
          isOwned={isOwned}
        />
      ))}
      </>
      )}
    </ScrollView>
  );
}

// ===== StyleSheet định nghĩa giao diện (chỉ token sáng) =====
const styles = StyleSheet.create({
  // Shared gray page background; compact cards retain their own materials.
  screen: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  // Nội dung ScrollView: padding 20, bottom chừa chỗ cho tab bar
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 32,
  },
  // Header (PageIntro): margin trên 6, dưới 18
  header: {
    marginTop: 6,
    marginBottom: 18,
  },
  // Pill số dư VP: nền trắng, viền mờ, tự canh trái
  balancePill: {
    alignSelf: "flex-start",
    marginBottom: 22,
    backgroundColor: COLORS.SURFACE,
    borderColor: COLORS.BORDER,
  },
  // Icon VP: 14x14, màu chữ chính, cách phải 8
  balanceIcon: {
    width: 14,
    height: 14,
    marginRight: 8,
    tintColor: COLORS.TEXT_PRIMARY,
  },
  // Text số dư: màu chữ chính, đậm
  balanceText: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "700",
  },
});

export default Bundles;
