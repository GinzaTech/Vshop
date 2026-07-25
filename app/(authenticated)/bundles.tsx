// ===== Import các thư viện =====
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";
import { Modal, Portal } from "react-native-paper";

import BundleImage from "~/components/BundleImage";
import BundleItem from "~/components/BundleItem";
import CurrencyIcon from "~/components/CurrencyIcon";
import { useUserStore } from "~/hooks/useUserStore";
import { COLORS } from "~/constants/DesignSystem";
import EmptyStateCard from "~/components/ui/EmptyStateCard";
import InfoPill from "~/components/ui/InfoPill";
import PageIntro from "~/components/ui/PageIntro";
import SectionHeader from "~/components/ui/SectionHeader";
import TwoColumnGrid from "~/components/ui/TwoColumnGrid";

// Component Bundles: hiển thị danh sách các bundle (gói hàng) trong shop
// Cho phép xem thông tin bundle và các item bên trong qua modal
function Bundles() {
  // Hook dịch thuật đa ngôn ngữ
  const { t } = useTranslation();
  // Lấy thông tin user từ store (bao gồm shops.bundles, balances.vp, ...)
  const user = useUserStore(({ user }) => user);
  // State: bundle đang được chọn để xem chi tiết (null = không có modal)
  const [selectedBundle, setSelectedBundle] =
    React.useState<BundleShopItem | null>(null);

  // dismissBundle: đóng modal chi tiết bundle bằng cách set selectedBundle về null
  const dismissBundle = React.useCallback(() => {
    setSelectedBundle(null);
  }, []);

  // Nếu không có bundle nào, hiển thị EmptyStateCard thông báo trống
  if (user.shops.bundles.length === 0) {
    return (
      <EmptyStateCard
        centered
        icon={
          <Icon
            name="package-variant-closed"
            size={38}
            color={COLORS.TEXT_PRIMARY}
          />
        }
        title={t("bundles_page.empty_title")}
        subtitle={t("bundles_page.empty_subtitle")}
      />
    );
  }

  return (
    <>
      {/* ScrollView chính: cuộn dọc, nền tối */}
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Tiêu đề trang */}
        <PageIntro
          title={t("bundles_page.title")}
          style={styles.header}
        />

        {/* Hiển thị số dư VP (Valorant Points) */}
        <InfoPill style={styles.balancePill}>
          <CurrencyIcon icon="vp" style={styles.balanceIcon} />
          <Text style={styles.balanceText}>{user.balances.vp}</Text>
        </InfoPill>

        {/* Duyệt danh sách bundle và hiển thị từng bundle */}
        {user.shops.bundles.map((bundle, index) => (
          <View key={bundle.uuid} style={styles.bundleBlock}>
            <BundleImage
              bundle={bundle}
              // remainingSecs: thời gian còn lại của bundle (tính bằng giây)
              remainingSecs={user.shops.remainingSecs.bundles[index]}
              // Khi nhấn vào bundle, mở modal chi tiết
              onPress={() => setSelectedBundle(bundle)}
            />
          </View>
        ))}
      </ScrollView>

      {/* Portal: hiển thị modal chi tiết bundle ở lớp trên cùng */}
      <Portal>
        <Modal
          visible={Boolean(selectedBundle)}
          onDismiss={dismissBundle}
          contentContainerStyle={styles.modalContainer}
        >
          {selectedBundle ? (
            // Sheet modal: chứa thông tin bundle
            <View style={styles.modalSheet}>
              {/* Header modal: tên bundle + nút đóng */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderText}>
                  <Text style={styles.modalEyebrow} numberOfLines={1}>
                    {t("bundles_page.hero_badge")}
                  </Text>
                  <Text style={styles.modalTitle} numberOfLines={2}>
                    {selectedBundle.displayName}
                  </Text>
                </View>
                {/* Nút đóng modal */}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t("common.close", {
                    defaultValue: "Đóng",
                  })}
                  activeOpacity={0.8}
                  onPress={dismissBundle}
                  style={styles.modalCloseButton}
                >
                  <Icon name="close" size={20} color={COLORS.TEXT_PRIMARY} />
                </TouchableOpacity>
              </View>

              {/* SectionHeader: tiêu đề "Items included" + số lượng */}
              <SectionHeader
                title={t("bundles_page.included_title")}
                meta={t("bundles_page.items_count", {
                  count: selectedBundle.items.length,
                })}
                style={styles.modalSectionHeader}
              />

              {/* ScrollView chứa danh sách item trong bundle (dạng lưới 2 cột) */}
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                <TwoColumnGrid
                  items={selectedBundle.items}
                  keyExtractor={(item) =>
                    `${selectedBundle.uuid}-${item.uuid}`
                  }
                  renderItem={(item) => <BundleItem item={item} />}
                />
              </ScrollView>
            </View>
          ) : null}
        </Modal>
      </Portal>
    </>
  );
}

// ===== StyleSheet định nghĩa giao diện =====
const styles = StyleSheet.create({
  // Màn hình chính: nền tối, chiếm toàn bộ không gian
  screen: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  // Nội dung ScrollView: padding 20, bottom 140 để chừa chỗ cho tab bar
  content: {
    padding: 20,
    paddingBottom: 140,
  },
  // Header (PageIntro): margin trên 6, dưới 18
  header: {
    marginTop: 6,
    marginBottom: 18,
  },
  // Pill hiển thị số dư VP: nền xanh đậm, tự canh trái
  balancePill: {
    alignSelf: "flex-start",
    marginBottom: 22,
    backgroundColor: COLORS.VALORANT_DARK_BLUE,
    borderColor: "rgba(255,255,255,0.08)",
  },
  // Icon VP: 14x14, màu trắng, cách phải 8
  balanceIcon: {
    width: 14,
    height: 14,
    marginRight: 8,
    tintColor: COLORS.PURE_WHITE,
  },
  // Text số dư: màu trắng, đậm
  balanceText: {
    color: COLORS.PURE_WHITE,
    fontWeight: "700",
  },
  // Mỗi block bundle: marginBottom 8
  bundleBlock: {
    marginBottom: 8,
  },
  // Container modal: canh giữa theo chiều dọc, padding ngang 16, trên/dưới 40
  modalContainer: {
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
  // Sheet modal: full width, max 88% chiều cao, bo góc, nền SURFACE, viền BORDER
  modalSheet: {
    width: "100%",
    maxHeight: "88%",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
  },
  // Header modal: dạng hàng ngang, căn trên
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  // Phần text trong header modal: co giãn, không tràn
  modalHeaderText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  // Eyebrow (nhãn phụ): chữ nhỏ, màu phụ, đậm
  modalEyebrow: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 4,
  },
  // Tiêu đề bundle: cỡ 20, đậm, lineHeight 25
  modalTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "800",
  },
  // Nút đóng modal: hình tròn 40x40, viền, nền mờ
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  // Section header trong modal: marginBottom 14
  modalSectionHeader: {
    marginBottom: 14,
  },
  // ScrollView trong modal: không co giãn (flexGrow 0)
  modalScroll: {
    flexGrow: 0,
  },
  // Nội dung ScrollView trong modal: paddingBottom 4
  modalScrollContent: {
    paddingBottom: 4,
  },
});

export default Bundles;
