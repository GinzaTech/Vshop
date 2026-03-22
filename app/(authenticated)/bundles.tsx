import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";

import BundleImage from "~/components/BundleImage";
import BundleItem from "~/components/BundleItem";
import CurrencyIcon from "~/components/CurrencyIcon";
import { useUserStore } from "~/hooks/useUserStore";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

function Bundles() {
  const { t } = useTranslation();
  const user = useUserStore(({ user }) => user);
  const [expandedBundles, setExpandedBundles] = React.useState<
    Record<string, boolean>
  >({});

  const toggleBundle = React.useCallback((bundleUuid: string) => {
    setExpandedBundles((current) => ({
      ...current,
      [bundleUuid]: !current[bundleUuid],
    }));
  }, []);

  if (user.shops.bundles.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Icon name="package-variant-closed" size={38} color={COLORS.TEXT_PRIMARY} />
        </View>
        <Text style={styles.emptyTitle}>{t("no_bundle")}</Text>
        <Text style={styles.emptySubtitle}>
          The featured collection is empty right now. Check back later.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Featured bundles</Text>
      <Text style={styles.subtitle}>
        Explore the current collection and preview every included skin.
      </Text>

      <View style={styles.balancePill}>
        <CurrencyIcon icon="vp" style={styles.balanceIcon} />
        <Text style={styles.balanceText}>{user.balances.vp}</Text>
      </View>

      {user.shops.bundles.map((bundle, index) => {
        const isExpanded = Boolean(expandedBundles[bundle.uuid]);

        return (
          <View key={bundle.uuid} style={styles.bundleBlock}>
            <BundleImage
              bundle={bundle}
              remainingSecs={user.shops.remainingSecs.bundles[index]}
              expanded={isExpanded}
              onPress={() => toggleBundle(bundle.uuid)}
            />
            {isExpanded ? (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Included items</Text>
                  <Text style={styles.sectionMeta}>{bundle.items.length} skins</Text>
                </View>
                {bundle.items.reduce<SkinShopItem[][]>((rows, item, index) => {
                  if (index % 2 === 0) {
                    rows.push([item]);
                  } else {
                    rows[rows.length - 1].push(item);
                  }
                  return rows;
                }, []).map((row, rowIndex) => (
                  <View key={`${bundle.uuid}-row-${rowIndex}`} style={styles.gridRow}>
                    {row.map((item) => (
                      <BundleItem item={item} key={item.uuid} />
                    ))}
                    {row.length === 1 ? <View style={styles.gridSpacer} /> : null}
                  </View>
                ))}
              </>
            ) : null}
          </View>
        );
      })}
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
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    marginTop: 6,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 18,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.TEXT_SECONDARY,
  },
  balancePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 22,
  },
  balanceIcon: {
    width: 14,
    height: 14,
    marginRight: 8,
  },
  balanceText: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "700",
  },
  bundleBlock: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  sectionMeta: {
    color: COLORS.TEXT_SECONDARY,
  },
  gridRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  gridSpacer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: COLORS.BACKGROUND,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SURFACE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  emptySubtitle: {
    marginTop: 8,
    textAlign: "center",
    color: COLORS.TEXT_SECONDARY,
  },
});

export default Bundles;
