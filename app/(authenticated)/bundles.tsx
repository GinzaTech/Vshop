import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";

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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro
        title={t("bundles_page.title")}
        subtitle={t("bundles_page.subtitle")}
        style={styles.header}
      />

      <InfoPill style={styles.balancePill}>
        <CurrencyIcon icon="vp" style={styles.balanceIcon} />
        <Text style={styles.balanceText}>{user.balances.vp}</Text>
      </InfoPill>

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
                <SectionHeader
                  title={t("bundles_page.included_title")}
                  meta={t("bundles_page.included_count", {
                    count: bundle.items.length,
                  })}
                  style={styles.sectionHeader}
                />
                <TwoColumnGrid
                  items={bundle.items}
                  keyExtractor={(item) => `${bundle.uuid}-${item.uuid}`}
                  renderItem={(item) => <BundleItem item={item} />}
                />
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
  header: {
    marginTop: 6,
    marginBottom: 18,
  },
  balancePill: {
    alignSelf: "flex-start",
    marginBottom: 22,
    backgroundColor: "#b0bac6",
    borderColor: "rgba(23, 26, 31, 0.16)",
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
    marginBottom: 14,
  },
});

export default Bundles;
