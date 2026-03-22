import React from "react";
import { useLocalSearchParams } from "expo-router";
import {
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
import Icon from "@expo/vector-icons/MaterialCommunityIcons";

import CurrencyIcon from "~/components/CurrencyIcon";
import { useUserStore } from "~/hooks/useUserStore";
import { ownedItems, playerLoadout } from "~/utils/valorant-api";
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
  OwnedWeaponCollectionItem,
  WEAPON_NAME_ORDER,
  resolveCategory,
  formatSpraySlot,
} from "~/components/GalleryProfile";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import { getContentTierVisual } from "~/utils/content-tier";
import { VItemTypes } from "~/utils/misc";

const formatUpgradeLevel = (weapon: EquippedWeapon) => {
  if (!weapon.upgradeLevel) {
    return null;
  }

  if (
    weapon.maxUpgradeLevel &&
    weapon.maxUpgradeLevel > 1
  ) {
    return `Lv ${weapon.upgradeLevel}/${weapon.maxUpgradeLevel}`;
  }

  return `Lv ${weapon.upgradeLevel}`;
};

const getWeaponNameWeight = (weaponName: string) => {
  const index = WEAPON_NAME_ORDER.indexOf(
    weaponName as (typeof WEAPON_NAME_ORDER)[number]
  );
  return index === -1 ? WEAPON_NAME_ORDER.length : index;
};

const inferWeaponNameFromSkin = (skinName: string) => {
  const normalized = skinName.toLowerCase();
  const matchedWeapon = WEAPON_NAME_ORDER.find((weaponName) =>
    normalized.includes(weaponName.toLowerCase())
  );

  return matchedWeapon ?? "Other";
};

function Profile() {
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const initialTabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const initialTab: TabKey =
    initialTabParam === "loadout" ||
    initialTabParam === "skins" ||
    initialTabParam === "collection"
      ? initialTabParam
      : "loadout";

  const [activeTab, setActiveTab] = React.useState<TabKey>(initialTab);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rawGuns, setRawGuns] = React.useState<PlayerLoadoutGun[]>([]);
  const [rawSprays, setRawSprays] = React.useState<PlayerLoadoutSpray[]>([]);
  const [identity, setIdentity] = React.useState<PlayerLoadoutIdentity | null>(null);
  const [ownedSkinLevelIds, setOwnedSkinLevelIds] = React.useState<string[]>(
    user.ownedSkinIds || []
  );
  const [weaponMetadata, setWeaponMetadata] = React.useState<WeaponMetadataMap>({});
  const [searchQuery, setSearchQuery] = React.useState("");
  const [expandedCollectionWeapons, setExpandedCollectionWeapons] = React.useState<
    string[]
  >([]);

  const palette = React.useMemo(
    () => {
      const accent = colors?.primary ?? COLORS.PURE_BLACK;

      return {
        accent,
        background: colors?.background ?? COLORS.BACKGROUND,
        card: COLORS.SURFACE,
        cardBorder: COLORS.BORDER,
        chipBackground: COLORS.SURFACE_MUTED,
        textPrimary: colors?.text ?? COLORS.TEXT_PRIMARY,
        textSecondary: COLORS.TEXT_SECONDARY,
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
  const regionLabel = user.region ? user.region.toUpperCase() : "VAL";

  const profileStats = React.useMemo(
    () => [
      { key: "vp", label: "VP", value: user.balances.vp, icon: "vp" as const },
      { key: "rad", label: "RAD", value: user.balances.rad, icon: "rad" as const },
      { key: "kc", label: "KC", value: user.balances.kc, icon: "kc" as const },
    ],
    [user.balances.kc, user.balances.rad, user.balances.vp]
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
        const [loadoutResult, ownedLevelsResult, ownedChromasResult] =
          await Promise.allSettled([
          playerLoadout(
            user.accessToken,
            user.entitlementsToken,
            user.region,
            user.id
          ) as Promise<PlayerLoadoutData>,
          ownedItems(
            user.accessToken,
            user.entitlementsToken,
            user.region,
            user.id,
            VItemTypes.SkinLevel
          ),
          ownedItems(
            user.accessToken,
            user.entitlementsToken,
            user.region,
            user.id,
            VItemTypes.SkinChroma
          ),
        ]);

        if (loadoutResult.status !== "fulfilled") {
          throw loadoutResult.reason;
        }

        const response = loadoutResult.value;
        setRawGuns(response.Guns || []);
        setRawSprays(response.Sprays || []);
        setIdentity(response.Identity || null);

        const equippedSkinLevelIds = Array.from(
          new Set(
            (response.Guns || [])
              .map((gun) => gun.SkinLevelID)
              .filter(Boolean)
          )
        );

        const fulfilledInventoryResults = [ownedLevelsResult, ownedChromasResult].filter(
          (
            result
          ): result is PromiseFulfilledResult<Awaited<ReturnType<typeof ownedItems>>> =>
            result.status === "fulfilled"
        );

        if (fulfilledInventoryResults.length > 0) {
          const nextOwnedSkinLevelIds = Array.from(
            new Set(
              fulfilledInventoryResults
                .flatMap((result) =>
                  Array.isArray(result.value?.EntitlementsByTypes)
                    ? result.value.EntitlementsByTypes
                    : []
                )
                .flatMap((entry) => entry.Entitlements || [])
                .map((entitlement) => entitlement.ItemID)
                .filter(Boolean)
            )
          );

          if (__DEV__) {
            console.log("[collection] owned items response", {
              entitlementGroups: fulfilledInventoryResults.reduce(
                (count, result) =>
                  count +
                  (Array.isArray(result.value?.EntitlementsByTypes)
                    ? result.value.EntitlementsByTypes.length
                    : 0),
                0
              ),
              ownedItemIds: nextOwnedSkinLevelIds.length,
              fallbackToEquipped: nextOwnedSkinLevelIds.length === 0,
            });
          }

          setOwnedSkinLevelIds(
            nextOwnedSkinLevelIds.length
              ? nextOwnedSkinLevelIds
              : user.ownedSkinIds?.length
                ? user.ownedSkinIds
                : equippedSkinLevelIds
          );
        } else {
          if (__DEV__) {
            console.error(ownedLevelsResult.status === "rejected" ? ownedLevelsResult.reason : null);
            console.error(ownedChromasResult.status === "rejected" ? ownedChromasResult.reason : null);
          }
          if (__DEV__) {
            console.log("[collection] owned items fallback", {
              storedItemIds: user.ownedSkinIds?.length ?? 0,
              equippedItemIds: equippedSkinLevelIds.length,
            });
          }
          setOwnedSkinLevelIds(
            user.ownedSkinIds?.length ? user.ownedSkinIds : equippedSkinLevelIds
          );
        }
      } catch (err) {
        if (__DEV__) console.error(err);
        setError(t("equip_page.error_loading"));
      } finally {
        if (showSpinner) {
          setLoading(false);
        }
      }
    },
    [
      hasAuth,
      t,
      user.accessToken,
      user.entitlementsToken,
      user.id,
      user.ownedSkinIds,
      user.region,
    ]
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
    if (user.ownedSkinIds?.length) {
      setOwnedSkinLevelIds(user.ownedSkinIds);
    }
  }, [user.ownedSkinIds]);

  React.useEffect(() => {
    if (!hasAuth) {
      setRawGuns([]);
      setRawSprays([]);
      setIdentity(null);
      setOwnedSkinLevelIds([]);
      setError(t("equip_page.missing_auth"));
      setLoading(false);
      return;
    }

    fetchLoadoutData();
  }, [fetchLoadoutData, hasAuth, t]);

  const skinWeaponMap = React.useMemo(
    () =>
      Object.values(weaponMetadata).reduce<
        Record<string, { weaponName: string; category: string }>
      >((acc, metadata) => {
        metadata.skins?.forEach((skin) => {
          acc[skin.uuid] = {
            weaponName: metadata.displayName,
            category: resolveCategory(metadata),
          };
        });
        return acc;
      }, {}),
    [weaponMetadata]
  );

  const loadoutDetails = React.useMemo<EquippedWeapon[]>(() => {
    const assets = getAssets();

    return rawGuns.map((gun) => {
      const metadata = weaponMetadata[gun.ID];
      const category = resolveCategory(metadata);

      const skin =
        assets.skins.find((item) => item.uuid === gun.SkinID) ||
        assets.skins.find((item) =>
          Array.isArray(item.levels) &&
          item.levels.some((level) => level.uuid === gun.SkinLevelID)
        );
      const skinChromas = Array.isArray(skin?.chromas) ? skin.chromas : [];
      const skinLevels = Array.isArray(skin?.levels) ? skin.levels : [];

      const chroma = skinChromas.find((item) => item.uuid === gun.ChromaID);
      const level = skinLevels.find((item) => item.uuid === gun.SkinLevelID);
      const upgradeLevelIndex = skinLevels.findIndex(
        (item) => item.uuid === gun.SkinLevelID
      );
      const tierVisual = getContentTierVisual(skin?.contentTierUuid);

      const buddy = assets.buddies.find(
        (item) =>
          item.uuid === gun.CharmID ||
          (Array.isArray(item.levels) &&
            item.levels.some((level) => level.uuid === gun.CharmLevelID))
      );
      const buddyLevels = Array.isArray(buddy?.levels) ? buddy.levels : [];

      const buddyLevel =
        buddyLevels.find((level) => level.uuid === gun.CharmLevelID) ||
        buddyLevels[0];

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
        contentTierUuid: skin?.contentTierUuid,
        contentTierName: tierVisual.label,
        upgradeLevel:
          typeof upgradeLevelIndex === "number" && upgradeLevelIndex >= 0
            ? upgradeLevelIndex + 1
            : undefined,
        maxUpgradeLevel: skinLevels.length,
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

  const ownedCollection = React.useMemo<OwnedWeaponCollectionItem[]>(() => {
    const assets = getAssets();
    const collectionMap = new Map<
      string,
      { skin: ValorantSkin; ownedIds: Set<string> }
    >();

    ownedSkinLevelIds.forEach((ownedId) => {
      const skin = assets.skins.find((item) =>
        item.uuid === ownedId ||
        (Array.isArray(item.levels) &&
          item.levels.some((level) => level.uuid === ownedId)) ||
        (Array.isArray(item.chromas) &&
          item.chromas.some((chroma) => chroma.uuid === ownedId))
      );

      if (!skin) {
        return;
      }

      const existing = collectionMap.get(skin.uuid);
      if (existing) {
        existing.ownedIds.add(ownedId);
        return;
      }

      collectionMap.set(skin.uuid, {
        skin,
        ownedIds: new Set([ownedId]),
      });
    });

    return Array.from(collectionMap.values())
      .map(({ skin, ownedIds }) => {
        const levels = Array.isArray(skin.levels) ? skin.levels : [];
        const chromas = Array.isArray(skin.chromas) ? skin.chromas : [];
        const weaponInfo = skinWeaponMap[skin.uuid];
        const weaponName =
          weaponInfo?.weaponName || inferWeaponNameFromSkin(skin.displayName);
        const category =
          weaponInfo?.category || (weaponName === "Melee" ? "Melee" : "Other");
        const highestOwnedLevelIndex = levels.reduce(
          (highestIndex, level, index) =>
            ownedIds.has(level.uuid) ? index : highestIndex,
          -1
        );
        const tier = getContentTierVisual(skin.contentTierUuid);

        return {
          collectionId: skin.uuid,
          weaponId: skin.uuid,
          weaponName,
          category,
          skinName: skin.displayName,
          image:
            chromas[0]?.fullRender ||
            chromas[0]?.displayIcon ||
            levels[highestOwnedLevelIndex]?.displayIcon ||
            levels[0]?.displayIcon ||
            skin.displayIcon,
          contentTierUuid: skin.contentTierUuid,
          contentTierName: tier.label,
          upgradeLevel:
            highestOwnedLevelIndex >= 0 || ownedIds.has(skin.uuid)
              ? Math.max(highestOwnedLevelIndex + 1, 1)
              : 1,
          maxUpgradeLevel: levels.length,
        };
      })
      .sort((a, b) => {
        const weaponDiff =
          getWeaponNameWeight(a.weaponName) - getWeaponNameWeight(b.weaponName);
        if (weaponDiff !== 0) {
          return weaponDiff;
        }

        return a.skinName.localeCompare(b.skinName);
      });
  }, [ownedSkinLevelIds, skinWeaponMap]);

  React.useEffect(() => {
    if (__DEV__ && activeTab === "collection") {
      console.log("[collection] resolved owned skins", {
        ownedIds: ownedSkinLevelIds.length,
        resolvedSkins: ownedCollection.length,
        weaponGroups: orderedCollectionWeapons.length,
      });
    }
  }, [
    activeTab,
    orderedCollectionWeapons.length,
    ownedCollection.length,
    ownedSkinLevelIds.length,
  ]);

  const filteredCollection = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return ownedCollection;
    }

    const query = searchQuery.trim().toLowerCase();
    return ownedCollection.filter((item) =>
      item.skinName.toLowerCase().includes(query) ||
      item.weaponName.toLowerCase().includes(query)
    );
  }, [ownedCollection, searchQuery]);

  const collectionByWeapon = React.useMemo(
    () =>
      filteredCollection.reduce<Record<string, OwnedWeaponCollectionItem[]>>(
        (acc, item) => {
          if (!acc[item.weaponName]) {
            acc[item.weaponName] = [];
          }

          acc[item.weaponName].push(item);
          return acc;
        },
        {}
      ),
    [filteredCollection]
  );

  const orderedCollectionWeapons = React.useMemo(
    () =>
      Object.keys(collectionByWeapon).sort((a, b) => {
        const diff = getWeaponNameWeight(a) - getWeaponNameWeight(b);
        if (diff !== 0) {
          return diff;
        }

        return a.localeCompare(b);
      }),
    [collectionByWeapon]
  );

  React.useEffect(() => {
    setExpandedCollectionWeapons((current) =>
      current.filter((weaponName) => orderedCollectionWeapons.includes(weaponName))
    );
  }, [orderedCollectionWeapons]);

  const toggleCollectionWeapon = React.useCallback((weaponName: string) => {
    setExpandedCollectionWeapons((current) =>
      current.includes(weaponName)
        ? current.filter((value) => value !== weaponName)
        : [...current, weaponName]
    );
  }, []);

  React.useEffect(() => {
    if (
      initialTabParam === "loadout" ||
      initialTabParam === "skins" ||
      initialTabParam === "collection"
    ) {
      setActiveTab(initialTabParam);
    }
  }, [initialTabParam]);

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

  const renderProfileHero = () => (
    <View style={[styles.heroCard, { backgroundColor: palette.accent }]}>
      <View style={styles.heroTopRow}>
        <View style={styles.heroBadge}>
          <Icon name="shield-account-outline" size={16} color={COLORS.PURE_WHITE} />
          <Text style={styles.heroBadgeText}>Loadout profile</Text>
        </View>
        <View style={styles.heroRegionPill}>
          <Text style={styles.heroRegionText}>{regionLabel}</Text>
        </View>
      </View>

      <View style={styles.heroNameRow}>
        <Text style={styles.heroTitle}>{user.name || "Agent"}</Text>
        {user.TagLine ? (
          <View style={styles.heroTagPill}>
            <Text style={styles.heroTagText}>#{user.TagLine}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.heroSubtitle}>Connected Riot account</Text>

      <View style={styles.heroMetaRow}>
        <View style={styles.heroMetaPill}>
          <Icon name="star-circle-outline" size={14} color={COLORS.PURE_WHITE} />
          <Text style={styles.heroMetaText}>
            Level {identityDetails?.level ?? user.progress.level}
          </Text>
        </View>
        <View style={styles.heroMetaPill}>
          <Icon
            name={hasAuth ? "check-decagram-outline" : "alert-circle-outline"}
            size={14}
            color={COLORS.PURE_WHITE}
          />
          <Text style={styles.heroMetaText}>
            {hasAuth ? "Account synced" : "Sign in required"}
          </Text>
        </View>
      </View>

      <View style={styles.heroStatsRow}>
        {profileStats.map((stat) => (
          <View key={stat.key} style={styles.heroStatCard}>
            <View style={styles.heroStatLabelRow}>
              <CurrencyIcon icon={stat.icon} style={styles.heroStatIcon} />
              <Text style={styles.heroStatLabel}>{stat.label}</Text>
            </View>
            <Text style={styles.heroStatValue}>{stat.value}</Text>
          </View>
        ))}
      </View>
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

  const renderWeaponBadges = React.useCallback(
    (weapon: EquippedWeapon) => {
      const tier = getContentTierVisual(
        weapon.contentTierUuid,
        weapon.contentTierName
      );
      const upgradeLabel = formatUpgradeLevel(weapon);

      return (
        <View style={styles.weaponBadgeRow}>
          <View
            style={[
              styles.weaponBadge,
              {
                backgroundColor: tier.badgeBackground,
                borderColor: tier.border,
              },
            ]}
          >
            <View
              style={[
                styles.weaponBadgeDot,
                { backgroundColor: tier.accent },
              ]}
            />
            <Text
              style={[
                styles.weaponBadgeText,
                { color: tier.text },
              ]}
              numberOfLines={1}
            >
              {weapon.contentTierName || tier.label}
            </Text>
          </View>
          {upgradeLabel ? (
            <View
              style={[
                styles.weaponBadge,
                {
                  backgroundColor: tier.badgeBackground,
                  borderColor: tier.border,
                },
              ]}
            >
              <Icon
                name="arrow-up-bold-circle-outline"
                size={12}
                color={tier.text}
              />
              <Text
                style={[
                  styles.weaponBadgeText,
                  { color: tier.text },
                ]}
              >
                {upgradeLabel}
              </Text>
            </View>
          ) : null}
        </View>
      );
    },
    []
  );

  const renderLoadoutWeaponCard = React.useCallback(
    (weapon: EquippedWeapon) => {
      const tier = getContentTierVisual(
        weapon.contentTierUuid,
        weapon.contentTierName
      );

      return (
        <View
          key={weapon.weaponId}
          style={[
            styles.weaponCard,
            styles.syncedWeaponCard,
            { backgroundColor: tier.cardBackground, borderColor: tier.border },
          ]}
        >
          <View style={styles.weaponDetails}>
            <Text
              style={[styles.cardTitle, { color: palette.textPrimary }]}
              numberOfLines={1}
            >
              {weapon.skinName}
            </Text>
            {renderWeaponBadges(weapon)}
          </View>
          <View
            style={[
              styles.weaponImageWrapper,
              styles.syncedWeaponImageWrapper,
              {
                backgroundColor: tier.visualBackground,
                borderColor: tier.border,
              },
            ]}
          >
            <Image
              source={weapon.image ? { uri: weapon.image } : FALLBACK_IMAGE}
              style={styles.weaponImage}
              contentFit="contain"
            />
          </View>
        </View>
      );
    },
    [
      palette.textPrimary,
      renderWeaponBadges,
    ]
  );

  const renderSkinGridCard = React.useCallback(
    (weapon: EquippedWeapon, category: string) => {
      const tier = getContentTierVisual(
        weapon.contentTierUuid,
        weapon.contentTierName
      );

      return (
        <View
          key={`${category}-${weapon.weaponId}`}
          style={[
            styles.skinGridCard,
            styles.syncedGridCard,
            { backgroundColor: tier.cardBackground, borderColor: tier.border },
          ]}
        >
          <View
            style={[
              styles.skinGridVisual,
              styles.syncedGridVisual,
              {
                backgroundColor: tier.visualBackground,
                borderColor: tier.border,
              },
            ]}
          >
            <Image
              source={weapon.image ? { uri: weapon.image } : FALLBACK_IMAGE}
              style={styles.skinGridImage}
              contentFit="contain"
            />
          </View>
          <View style={styles.skinGridDetails}>
            <Text
              style={[styles.skinGridTitle, { color: palette.textPrimary }]}
              numberOfLines={1}
            >
              {weapon.skinName}
            </Text>
            {renderWeaponBadges(weapon)}
          </View>
        </View>
      );
    },
    [palette.textPrimary, renderWeaponBadges]
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

  const renderPageHeader = () => (
    <>
      {renderProfileHero()}
      {renderSegmentedControl()}
    </>
  );

  const renderPageScroll = (
    children: React.ReactNode,
    contentStyle: StyleProp<ViewStyle> = styles.pageScrollContent,
    bodyStyle: StyleProp<ViewStyle> = styles.pageBody
  ) => (
    <ScrollView
      style={styles.pageScroll}
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={palette.accent}
          colors={[palette.accent]}
        />
      }
    >
      {renderPageHeader()}
      <View style={bodyStyle}>{children}</View>
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
    renderPageScroll(
      orderedCategories.map((category) => {
        const weapons = loadoutByCategory[category];
        if (!weapons?.length) return null;

        return (
          <View key={category} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
              {formatCategoryLabel(category)}
            </Text>
            <View style={styles.skinGrid}>
              {weapons.map((weapon) => renderSkinGridCard(weapon, category))}
            </View>
          </View>
        );
      })
    );

  const renderCollectionTab = () =>
    renderPageScroll(
      <>
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

        {orderedCollectionWeapons.length === 0 ? (
          <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
            {t("equip_page.empty")}
          </Text>
        ) : (
          orderedCollectionWeapons.map((weaponName) => {
            const items = collectionByWeapon[weaponName];
            if (!items?.length) {
              return null;
            }

            const isExpanded =
              searchQuery.trim().length > 0 ||
              expandedCollectionWeapons.includes(weaponName);

            return (
              <View key={weaponName} style={styles.collectionSection}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => toggleCollectionWeapon(weaponName)}
                  style={[
                    styles.collectionSectionHeader,
                    {
                      backgroundColor: palette.card,
                      borderColor: palette.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.collectionSectionHeaderLeft}>
                    <Text
                      style={[
                        styles.collectionSectionTitle,
                        { color: palette.textPrimary },
                      ]}
                    >
                      {weaponName}
                    </Text>
                    <View
                      style={[
                        styles.collectionCountPill,
                        {
                          backgroundColor: palette.background,
                          borderColor: palette.cardBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.collectionCountText,
                          { color: palette.textSecondary },
                        ]}
                      >
                        {items.length} {t("equip_page.tabs.skins").toLowerCase()}
                      </Text>
                    </View>
                  </View>
                  <Icon
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={22}
                    color={palette.textSecondary}
                  />
                </TouchableOpacity>

                {isExpanded ? (
                  <View style={styles.collectionGrid}>
                    {items.map((item) => {
                      const tier = getContentTierVisual(
                        item.contentTierUuid,
                        item.contentTierName
                      );

                      return (
                        <View
                          key={item.collectionId}
                          style={[
                            styles.collectionCard,
                            {
                              backgroundColor: tier.cardBackground,
                              borderColor: tier.border,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.collectionVisual,
                              {
                                backgroundColor: tier.visualBackground,
                                borderColor: tier.border,
                              },
                            ]}
                          >
                            <Image
                              source={item.image ? { uri: item.image } : FALLBACK_IMAGE}
                              style={styles.collectionImage}
                              contentFit="contain"
                            />
                          </View>
                          {renderWeaponBadges(item)}
                          <Text
                            style={[
                              styles.collectionSkinName,
                              { color: palette.textPrimary },
                            ]}
                            numberOfLines={2}
                          >
                            {item.skinName}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </>,
      styles.collectionScrollContent
    );

  const renderLoadoutTab = () =>
    renderPageScroll(
      <>
        {renderIdentitySection()}
        {renderSpraySection()}
        {renderWeaponsSection()}
      </>
    );

  const renderStatusScroll = (
    text: string,
    textStyle: StyleProp<TextStyle>
  ) =>
    renderPageScroll(
      <Text style={textStyle}>{text}</Text>,
      styles.pageScrollContent,
      styles.pageStatus
    );

  let content: React.ReactNode = null;

  if (loading) {
    content = renderPageScroll(
      <View style={styles.pageStatus}>
        <ActivityIndicator animating color={palette.accent} />
      </View>,
      styles.pageScrollContent,
      styles.pageStatus
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
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
    borderRadius: RADIUS.card,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroBadgeText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.PURE_WHITE,
  },
  heroRegionPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroRegionText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.PURE_WHITE,
    letterSpacing: 0.6,
  },
  heroNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 18,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: COLORS.PURE_WHITE,
  },
  heroTagPill: {
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  heroTagText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.PURE_WHITE,
    letterSpacing: 0.3,
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "rgba(255,255,255,0.78)",
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  heroMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroMetaText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.PURE_WHITE,
  },
  heroStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 18,
  },
  heroStatCard: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroStatLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroStatIcon: {
    width: 14,
    height: 14,
  },
  heroStatLabel: {
    marginLeft: 6,
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.72)",
  },
  heroStatValue: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.PURE_WHITE,
  },
  pageScroll: {
    flex: 1,
  },
  pageScrollContent: {
    paddingBottom: 140,
  },
  pageBody: {
    paddingHorizontal: 16,
  },
  pageStatus: {
    minHeight: 240,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  segmentContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
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
  },
  identityContainer: {
    flexDirection: "row",
    borderRadius: RADIUS.card,
    overflow: "hidden",
    borderWidth: 1,
  },
  identityImage: {
    width: 150,
    height: 150,
  },
  identityInfo: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  identityTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  identitySubtitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  sprayList: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  sprayCard: {
    width: "46%",
    margin: 6,
    borderRadius: RADIUS.card,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
  },
  sprayImage: {
    width: 96,
    height: 96,
    marginBottom: 12,
  },
  sprayName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  spraySlot: {
    fontSize: 12,
    textAlign: "center",
    opacity: 0.8,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    marginLeft: 4,
  },
  weaponCard: {
    flexDirection: "row",
    marginBottom: 12,
    borderRadius: RADIUS.card,
    padding: 14,
    minHeight: 128,
    borderWidth: 1,
    alignItems: "center",
  },
  syncedWeaponCard: {
    padding: 12,
    minHeight: 112,
    borderRadius: 22,
  },
  weaponDetails: {
    flex: 1,
    marginRight: 12,
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
  },
  weaponBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    marginBottom: 2,
  },
  weaponBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  weaponBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: 6,
  },
  weaponBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  weaponTags: {
    flexDirection: "row",
    marginTop: 4,
    flexWrap: "wrap",
  },
  weaponTag: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    marginRight: 6,
    marginBottom: 4,
    borderWidth: 1,
  },
  weaponTagText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  weaponImageWrapper: {
    width: 116,
    height: 96,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
    overflow: "hidden",
  },
  syncedWeaponImageWrapper: {
    width: 104,
    height: 88,
    borderRadius: 20,
    padding: 8,
  },
  weaponImage: {
    width: "100%",
    height: "100%",
  },
  skinGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  skinGridCard: {
    width: "48%",
    marginBottom: 12,
    borderRadius: RADIUS.card,
    padding: 12,
    borderWidth: 1,
  },
  syncedGridCard: {
    padding: 10,
  },
  skinGridVisual: {
    width: "100%",
    height: 116,
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  syncedGridVisual: {
    height: 100,
    borderRadius: 16,
    padding: 8,
  },
  skinGridImage: {
    width: "100%",
    height: "100%",
  },
  skinGridDetails: {
    marginTop: 12,
  },
  skinGridTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  skinGridSubtitle: {
    fontSize: 12,
  },
  searchBar: {
    marginBottom: 16,
    borderRadius: 20,
    elevation: 0,
    borderWidth: 1,
  },
  collectionScrollContent: {
    paddingBottom: 140,
  },
  collectionSection: {
    marginBottom: 20,
  },
  collectionSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 12,
  },
  collectionSectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  collectionSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  collectionCountPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
  },
  collectionCountText: {
    fontSize: 12,
    fontWeight: "600",
  },
  collectionChevron: {
    marginLeft: 12,
  },
  collectionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  collectionCard: {
    width: "48.2%",
    marginBottom: 12,
    borderRadius: RADIUS.card,
    padding: 14,
    borderWidth: 1,
    minHeight: 230,
  },
  collectionVisual: {
    width: "100%",
    height: 110,
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 12,
  },
  collectionImage: {
    width: "100%",
    height: "100%",
  },
  collectionSkinName: {
    fontSize: 14,
    fontWeight: "700",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 32,
  },
});

export default Profile;
