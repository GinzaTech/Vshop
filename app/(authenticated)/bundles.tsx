// ===== Import các thư viện =====
import React from "react";
import {
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { BlurView } from "expo-blur";
import { useTranslation } from "react-i18next";
import { Modal, Portal, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import BundleImage from "~/components/BundleImage";
import BundleItem from "~/components/BundleItem";
import CurrencyIcon from "~/components/CurrencyIcon";
import { useUserStore } from "~/hooks/useUserStore";
import { COLORS } from "~/constants/DesignSystem";
import EmptyStateCard from "~/components/ui/EmptyStateCard";
import InfoPill from "~/components/ui/InfoPill";
import PageIntro from "~/components/ui/PageIntro";
import TwoColumnGrid from "~/components/ui/TwoColumnGrid";

// Component Bundles: hiển thị danh sách các bundle (gói hàng) trong shop
// Cho phép xem thông tin bundle và các item bên trong qua modal
function Bundles() {
  // Hook dịch thuật đa ngôn ngữ
  const { t } = useTranslation();
  const paperTheme = useTheme();
  const transparentModalTheme = React.useMemo(
    () => ({
      ...paperTheme,
      colors: {
        ...paperTheme.colors,
        backdrop: "transparent",
      },
    }),
    [paperTheme],
  );
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
          overlayAccessibilityLabel={t("common.close")}
          style={styles.modalRoot}
          contentContainerStyle={styles.modalContainer}
          theme={transparentModalTheme}
        >
          {selectedBundle ? (
            <>
              <BlurView
                pointerEvents="none"
                intensity={72}
                tint="dark"
                experimentalBlurMethod="dimezisBlurView"
                style={StyleSheet.absoluteFill}
              />
              <View pointerEvents="none" style={styles.modalDim} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
                onPress={dismissBundle}
                style={StyleSheet.absoluteFill}
              />

              <SafeAreaView style={styles.modalContent} edges={["top", "bottom"]}>
                <View style={styles.modalToolbar}>
                  <View style={styles.modalCountBadge}>
                    <Text style={styles.modalCountText}>
                      {t("bundles_page.items_count", {
                        count: selectedBundle.items.length,
                      })}
                    </Text>
                  </View>

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t("common.close")}
                    activeOpacity={0.8}
                    onPress={dismissBundle}
                    style={styles.modalCloseButton}
                  >
                    <Icon name="close" size={22} color={COLORS.PURE_WHITE} />
                  </TouchableOpacity>
                </View>

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
                    renderItem={(item) => (
                      <View style={styles.modalCard}>
                        <BundleItem item={item} />
                      </View>
                    )}
                  />
                </ScrollView>
              </SafeAreaView>
            </>
          ) : null}
        </Modal>
      </Portal>
    </>
  );
}

const modalCardShadow =
  Platform.OS === "web"
    ? ({ boxShadow: "0px 10px 16px rgba(0, 0, 0, 0.34)" } as any)
    : {
        shadowColor: COLORS.PURE_BLACK,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.34,
        shadowRadius: 16,
        elevation: 12,
      };

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
  // Modal phủ toàn màn hình, nền trong suốt để BlurView xử lý phần phía sau.
  modalRoot: {
    marginTop: 0,
    marginBottom: 0,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "transparent",
  },
  modalDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7, 12, 20, 0.42)",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  modalToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 16,
  },
  modalCountBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(8,13,22,0.62)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  modalCountText: {
    color: COLORS.PURE_WHITE,
    fontSize: 12,
    fontWeight: "800",
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(8,13,22,0.68)",
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: 24,
  },
  modalCard: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: COLORS.SURFACE,
    ...modalCardShadow,
  },
});

export default Bundles;
