import React from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleProp,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
  StyleSheet
} from "react-native";
import { ActivityIndicator, Searchbar, useTheme } from "react-native-paper";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import axios from "axios";

import { useUserStore } from "~/hooks/useUserStore";
import { playerLoadout } from "~/utils/valorant-api";
import { getAssets } from "~/utils/valorant-assets";
import {
  CATEGORY_ORDER,
  FALLBACK_IMAGE,
  TabKey,
  PlayerLoadoutGun,
  PlayerLoadoutSpray,
  PlayerLoadoutIdentity,
  PlayerLoadoutData,
  WeaponMetadata,
  WeaponMetadataMap,
  EquippedWeapon,
  EquippedSpray,
  IdentityDetails,
  resolveCategory,
  formatSpraySlot,
  buildMetadataTags,
} from "~/components/GalleryProfile";

function Equip() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);

  const [activeTab, setActiveTab] = React.useState<TabKey>("loadout");
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rawGuns, setRawGuns] = React.useState<PlayerLoadoutGun[]>([]);
  const [rawSprays, setRawSprays] = React.useState<PlayerLoadoutSpray[]>([]);
  const [identity, setIdentity] = React.useState<PlayerLoadoutIdentity | null>(null);
  const [weaponMetadata, setWeaponMetadata] = React.useState<WeaponMetadataMap>({});
  const [searchQuery, setSearchQuery] = React.useState("");

  const palette = React.useMemo(
    () => {
      const accent = colors?.primary ?? "#ff4655";

      return {
        accent,
        background: colors?.background ?? "#05060a",
        card: colors?.elevation?.level2 ?? "#0d111b",
        cardBorder: colors?.outline ?? "rgba(255,255,255,0.12)",
        chipBackground: colors?.surfaceVariant ?? "rgba(255,255,255,0.08)",
        textPrimary: colors?.onSurface ?? "#ffffff",
        textSecondary: colors?.onSurfaceVariant ?? "rgba(255,255,255,0.68)",
      };
    },
    [colors]
  );

  const hasAuth = Boolean(
    user.accessToken &&
      user.entitlementsToken &&
      user.region &&
      user.id
  );

  const tabItems = React.useMemo(
    () => [
      { value: "loadout" as const, label: t("equip_page.tabs.loadout") },
      { value: "skins" as const, label: t("equip_page.tabs.skins") },
      { value: "collection" as const, label: t("equip_page.tabs.collection") },
    ],
    [t]
  );

  const categoryLabels = React.useMemo(
    () =>
      CATEGORY_ORDER.reduce<Record<string, string>>((acc, category) => {
        const translationKey = `equip_page.categories.${category}`;
        const translated = t(translationKey);
        acc[category] = translated !== translationKey ? translated : category;
        return acc;
      }, {}),
    [t]
  );

  const formatCategoryLabel = React.useCallback(
    (category: string) => {
      if (categoryLabels[category]) {
        return categoryLabels[category];
      }

      const translationKey = `equip_page.categories.${category}`;
      const translated = t(translationKey);
      if (translated !== translationKey) {
        return translated;
      }

      return category
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    },
    [categoryLabels, t]
  );

  const fetchLoadoutData = React.useCallback(
    async (showSpinner = true) => {
      if (!hasAuth) return;

      if (showSpinner) {
        setLoading(true);
      }
      setError(null);

      try {
        const response = (await playerLoadout(
          user.accessToken,
          user.entitlementsToken,
          user.region,
          user.id
        )) as PlayerLoadoutData;

        setRawGuns(response.Guns || []);
        setRawSprays(response.Sprays || []);
        setIdentity(response.Identity || null);
      } catch (err) {
        if (__DEV__) console.error(err);
        setError(t("equip_page.error_loading"));
      } finally {
        if (showSpinner) {
          setLoading(false);
        }
      }
    },
    [hasAuth, t, user.accessToken, user.entitlementsToken, user.id, user.region]
  );

  React.useEffect(() => {
    let isMounted = true;

    axios
      .get<{ data: WeaponMetadata[] }>("https://valorant-api.com/v1/weapons")
      .then((response) => {
        if (!isMounted) return;
        const map: WeaponMetadataMap = {};
        response.data.data.forEach((weapon) => {
          map[weapon.uuid] = weapon;
        });
        setWeaponMetadata(map);
      })
      .catch((err) => {
        if (__DEV__) console.error(err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!hasAuth) {
      setRawGuns([]);
      setRawSprays([]);
      setIdentity(null);
      setError(t("equip_page.missing_auth"));
      setLoading(false);
      return;
    }

    fetchLoadoutData();
  }, [fetchLoadoutData, hasAuth, t]);

  const loadoutDetails = React.useMemo<EquippedWeapon[]>(() => {
    const assets = getAssets();

    return rawGuns.map((gun) => {
      const metadata = weaponMetadata[gun.ID];
      const category = resolveCategory(metadata);

      const skin =
        assets.skins.find((item) => item.uuid === gun.SkinID) ||
        assets.skins.find((item) =>
          item.levels.some((level) => level.uuid === gun.SkinLevelID)
        );

      const chroma = skin?.chromas.find((item) => item.uuid === gun.ChromaID);
      const level = skin?.levels.find((item) => item.uuid === gun.SkinLevelID);

      const buddy = assets.buddies.find(
        (item) =>
          item.uuid === gun.CharmID ||
          item.levels.some((level) => level.uuid === gun.CharmLevelID)
      );

      const buddyLevel =
        buddy?.levels.find((level) => level.uuid === gun.CharmLevelID) ||
        buddy?.levels?.[0];

      const weaponName = metadata?.displayName || skin?.displayName || gun.ID;

      return {
        weaponId: gun.ID,
        weaponName,
        category,
        skinName: skin?.displayName || t("equip_page.unknown_skin"),
        skinLevelName: level?.displayName,
        chromaName: chroma?.displayName,
        image:
          chroma?.fullRender ||
          chroma?.displayIcon ||
          level?.displayIcon ||
          skin?.displayIcon,
        buddyName: buddyLevel?.displayName || buddy?.displayName,
        buddyIcon: buddyLevel?.displayIcon,
      };
    });
  }, [rawGuns, t, weaponMetadata]);

  const loadoutSorted = React.useMemo(() => {
    const categoryWeight = (category: string) => {
      const index = CATEGORY_ORDER.indexOf(
        category as (typeof CATEGORY_ORDER)[number]
      );
      return index === -1 ? CATEGORY_ORDER.length : index;
    };

    return [...loadoutDetails].sort((a, b) => {
      const diff = categoryWeight(a.category) - categoryWeight(b.category);
      if (diff !== 0) return diff;
      return a.weaponName.localeCompare(b.weaponName);
    });
  }, [loadoutDetails]);

  const loadoutByCategory = React.useMemo(
    () =>
      loadoutSorted.reduce<Record<string, EquippedWeapon[]>>((acc, weapon) => {
        const key = weapon.category || "Other";
        if (!acc[key]) acc[key] = [];
        acc[key].push(weapon);
        return acc;
      }, {}),
    [loadoutSorted]
  );

  const orderedCategories = React.useMemo(() => {
    const seen = new Set<string>();
    const categories: string[] = [];

    CATEGORY_ORDER.forEach((category) => {
      if (loadoutByCategory[category]?.length) {
        categories.push(category);
        seen.add(category);
      }
    });

    Object.keys(loadoutByCategory)
      .filter((category) => loadoutByCategory[category].length)
      .forEach((category) => {
        if (!seen.has(category)) {
          categories.push(category);
        }
      });

    return categories;
  }, [loadoutByCategory]);

  const sprayDetails = React.useMemo<EquippedSpray[]>(() => {
    const assets = getAssets();

    return rawSprays
      .map((spray) => {
        const sprayAsset = assets.sprays.find(
          (item) => item.uuid === spray.SprayID
        );

        if (!sprayAsset) return null;

        return {
          id: spray.SprayID,
          slot: spray.EquipSlotID,
          name: sprayAsset.displayName,
          icon: sprayAsset.displayIcon,
        };
      })
      .filter(Boolean) as EquippedSpray[];
  }, [rawSprays]);

  const identityDetails = React.useMemo<IdentityDetails | null>(() => {
    if (!identity) return null;

    const assets = getAssets();
    const card = assets.cards.find((item) => item.uuid === identity.PlayerCardID);
    const title = assets.titles.find((item) => item.uuid === identity.PlayerTitleID);

    return {
      cardArt: card?.wideArt || card?.largeArt || card?.displayIcon,
      cardName: card?.displayName,
      titleName: title?.titleText || title?.displayName,
      level: identity.AccountLevel,
      hideLevel: identity.HideAccountLevel,
    };
  }, [identity]);

  const filteredCollection = React.useMemo(() => {
    if (!searchQuery.trim()) return loadoutSorted;

    const query = searchQuery.trim().toLowerCase();
    return loadoutSorted.filter((item) =>
      item.skinName.toLowerCase().includes(query)
    );
  }, [loadoutSorted, searchQuery]);

  const handleRefresh = React.useCallback(async () => {
    if (!hasAuth) return;

    setRefreshing(true);
    await fetchLoadoutData(false);
    setRefreshing(false);
  }, [fetchLoadoutData, hasAuth]);

  const renderSegmentedControl = () => (
    <View
      style={[
        styles.segmentContainer,
        { backgroundColor: palette.accent },
      ]}
    >
      {tabItems.map((tab, index) => {
        const active = activeTab === tab.value;
        return (
          <TouchableOpacity
            key={tab.value}
            onPress={() => setActiveTab(tab.value)}
            activeOpacity={0.85}
            style={[
              styles.segmentButton,
              {
                backgroundColor: active ? palette.background : "transparent",
                marginLeft: index === 0 ? 0 : 12,
              },
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                {
                  color: active
                    ? palette.accent
                    : "rgba(255,255,255,0.92)",
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderIdentitySection = () => {
    if (!identityDetails) return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
          {t("equip_page.sections.identity")}
        </Text>
        <View
          style={[
            styles.identityContainer,
            { backgroundColor: palette.card, borderColor: palette.cardBorder },
          ]}
        >
          <Image
            source={
              identityDetails.cardArt
                ? { uri: identityDetails.cardArt }
                : FALLBACK_IMAGE
            }
            style={styles.identityImage}
            contentFit="cover"
          />
          <View style={styles.identityInfo}>
            <Text style={[styles.identityTitle, { color: palette.textPrimary }]}>
              {identityDetails.cardName || t("equip_page.identity.card_fallback")}
            </Text>
            <Text
              style={[styles.identitySubtitle, { color: palette.textSecondary }]}
            >
              {identityDetails.titleName ||
                t("equip_page.identity.title_fallback")}
            </Text>
            <Text
              style={[styles.identitySubtitle, { color: palette.textSecondary }]}
            >
              {t("equip_page.identity.account_level", {
                level: identityDetails.level,
              })}
            </Text>
            {identityDetails.hideLevel && (
              <Text
                style={[styles.identitySubtitle, { color: palette.textSecondary }]}
              >
                {t("equip_page.identity.level_hidden")}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderSpraySection = () => {
    if (sprayDetails.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
          {t("equip_page.sections.sprays")}
        </Text>
        <View style={styles.sprayList}>
          {sprayDetails.map((spray) => (
            <View
              key={`${spray.slot}-${spray.id}`}
              style={[
                styles.sprayCard,
                { backgroundColor: palette.card, borderColor: palette.cardBorder },
              ]}
            >
              <Image
                source={spray.icon ? { uri: spray.icon } : FALLBACK_IMAGE}
                style={styles.sprayImage}
                contentFit="contain"
              />
              <Text
                style={[styles.sprayName, { color: palette.textPrimary }]}
                numberOfLines={2}
              >
                {spray.name}
              </Text>
              <Text
                style={[styles.spraySlot, { color: palette.textSecondary }]}
              >
                {formatSpraySlot(spray.slot, t)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderMetadataTags = React.useCallback(
    (tags: string[]) => {
      if (tags.length === 0) return null;

      return (
        <View style={styles.weaponTags}>
          {tags.map((tag) => (
            <View
              key={tag}
              style={[
                styles.weaponTag,
                {
                  backgroundColor: palette.chipBackground,
                  borderColor: palette.cardBorder,
                },
              ]}
            >
              <Text
                style={[styles.weaponTagText, { color: palette.textSecondary }]}
                numberOfLines={1}
              >
                {tag}
              </Text>
            </View>
          ))}
        </View>
      );
    },
    [palette]
  );

  const renderLoadoutWeaponCard = React.useCallback(
    (weapon: EquippedWeapon) => {
      const metadataTags = buildMetadataTags(weapon);

      return (
        <View
          key={weapon.weaponId}
          style={[
            styles.weaponCard,
            { backgroundColor: palette.card, borderColor: palette.cardBorder },
          ]}
        >
          <View style={styles.weaponDetails}>
            <Text
              style={[styles.cardTitle, { color: palette.textPrimary }]}
              numberOfLines={2}
            >
              {weapon.skinName}
            </Text>
            <Text
              style={[styles.cardSubtitle, { color: palette.textSecondary }]}
              numberOfLines={1}
            >
              {weapon.weaponName}
            </Text>
            {renderMetadataTags(metadataTags)}
          </View>
          <View style={styles.weaponImageWrapper}>
            <Image
              source={weapon.image ? { uri: weapon.image } : FALLBACK_IMAGE}
              style={styles.weaponImage}
              contentFit="contain"
            />
          </View>
        </View>
      );
    },
    [palette, renderMetadataTags]
  );

  const renderSkinCard = React.useCallback(
    (weapon: EquippedWeapon, category: string) => {
      const metadataTags = buildMetadataTags(weapon);

      return (
        <View
          key={`${category}-${weapon.weaponId}`}
          style={[
            styles.weaponCard,
            { backgroundColor: palette.card, borderColor: palette.cardBorder },
          ]}
        >
          <View style={styles.weaponDetails}>
            <Text
              style={[styles.cardTitle, { color: palette.textPrimary }]}
              numberOfLines={2}
            >
              {weapon.skinName}
            </Text>
            <Text
              style={[styles.cardSubtitle, { color: palette.textSecondary }]}
            >
              {weapon.weaponName}
            </Text>
            {renderMetadataTags(metadataTags)}
          </View>
          <View style={styles.weaponImageWrapper}>
            <Image
              source={weapon.image ? { uri: weapon.image } : FALLBACK_IMAGE}
              style={styles.weaponImage}
              contentFit="contain"
            />
          </View>
        </View>
      );
    },
    [palette, renderMetadataTags]
  );

  const renderWeaponCategories = React.useCallback(
    (
      renderCard: (weapon: EquippedWeapon, category: string) => React.ReactNode,
      sectionStyle: StyleProp<ViewStyle> = styles.categorySection
    ) =>
      orderedCategories.map((category) => {
        const weapons = loadoutByCategory[category];
        if (!weapons?.length) return null;

        return (
          <View key={category} style={sectionStyle}>
            <Text style={[styles.categoryTitle, { color: palette.textPrimary }]}>
              {formatCategoryLabel(category)}
            </Text>
            {weapons.map((weapon) => renderCard(weapon, category))}
          </View>
        );
      }),
    [formatCategoryLabel, loadoutByCategory, orderedCategories, palette]
  );

  const renderScroll = (
    children: React.ReactNode,
    contentStyle: StyleProp<ViewStyle> = styles.scrollContent
  ) => (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={contentStyle}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={palette.accent}
          colors={[palette.accent]}
        />
      }
    >
      {children}
    </ScrollView>
  );

  const renderWeaponsSection = () => {
    if (loadoutSorted.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
          {t("equip_page.sections.weapons")}
        </Text>
        {renderWeaponCategories(renderLoadoutWeaponCard)}
      </View>
    );
  };

  const renderSkinsTab = () =>
    renderScroll(renderWeaponCategories(renderSkinCard, styles.section));

  const renderCollectionTab = () => (
    <View style={styles.collectionContainer}>
      <Searchbar
        placeholder={t("equip_page.search_placeholder")}
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={[
          styles.searchBar,
          { backgroundColor: palette.card, borderColor: palette.cardBorder },
        ]}
        inputStyle={{ color: palette.textPrimary }}
        iconColor={palette.textSecondary}
      />
      <FlatList
        data={filteredCollection}
        keyExtractor={(item) => item.weaponId}
        numColumns={2}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.collectionList}
        columnWrapperStyle={styles.collectionRow}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
            {t("equip_page.empty")}
          </Text>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.collectionCard,
              { backgroundColor: palette.card, borderColor: palette.cardBorder },
            ]}
          >
            <Image
              source={item.image ? { uri: item.image } : FALLBACK_IMAGE}
              style={styles.collectionImage}
              contentFit="contain"
            />
            <Text
              style={[styles.collectionSkinName, { color: palette.textPrimary }]}
              numberOfLines={2}
            >
              {item.skinName}
            </Text>
            <Text
              style={[styles.collectionWeaponName, { color: palette.textSecondary }]}
              numberOfLines={1}
            >
              {item.weaponName}
            </Text>
          </View>
        )}
      />
    </View>
  );

  const renderLoadoutTab = () =>
    renderScroll(
      <>
        {renderIdentitySection()}
        {renderSpraySection()}
        {renderWeaponsSection()}
      </>
    );

  const renderStatusScroll = (
    text: string,
    textStyle: StyleProp<TextStyle>
  ) => renderScroll(<Text style={textStyle}>{text}</Text>, styles.centered);

  let content: React.ReactNode = null;

  if (loading) {
    content = (
      <View style={styles.centered}>
        <ActivityIndicator animating color={palette.accent} />
      </View>
    );
  } else if (error) {
    content = renderStatusScroll(error, [
      styles.errorText,
      { color: palette.textSecondary },
    ]);
  } else if (loadoutSorted.length === 0) {
    content = renderStatusScroll(t("equip_page.empty"), [
      styles.emptyText,
      { color: palette.textSecondary },
    ]);
  } else {
    switch (activeTab) {
      case "skins":
        content = renderSkinsTab();
        break;
      case "collection":
        content = renderCollectionTab();
        break;
      case "loadout":
      default:
        content = renderLoadoutTab();
        break;
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      {renderSegmentedControl()}
      <View style={styles.contentWrapper}>{content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
  },
  tabScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  segmentContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 28,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  identityContainer: {
    flexDirection: "row",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
  },
  identityImage: {
    width: 150,
    height: 150,
  },
  identityInfo: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
  },
  identityTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
  identitySubtitle: {
    fontSize: 14,
    marginBottom: 2,
  },
  sprayList: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  sprayCard: {
    width: 160,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    marginHorizontal: 6,
    marginBottom: 12,
  },
  sprayImage: {
    width: 96,
    height: 96,
  },
  sprayName: {
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
  },
  spraySlot: {
    fontSize: 12,
    textAlign: "center",
  },
  categorySection: {
    marginBottom: 16,
    gap: 12,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  weaponCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 12,
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  weaponImageWrapper: {
    width: 132,
    height: 72,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginLeft: 12,
  },
  weaponImage: {
    width: "100%",
    aspectRatio: 3.4,
  },
  weaponDetails: {
    flex: 1,
    gap: 6,
    paddingRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: "500",
  },
  weaponTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  weaponTag: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  weaponTagText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  collectionContainer: {
    flex: 1,
  },
  searchBar: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  collectionList: {
    paddingBottom: 24,
    paddingHorizontal: 8,
  },
  collectionRow: {
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  collectionCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    alignItems: "center",
    marginHorizontal: 8,
  },
  collectionImage: {
    width: "100%",
    aspectRatio: 2.8,
    marginBottom: 8,
  },
  collectionSkinName: {
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
    marginBottom: 4,
  },
  collectionWeaponName: {
    fontSize: 12,
    textAlign: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
});

export default Equip;