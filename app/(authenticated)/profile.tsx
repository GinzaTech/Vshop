import React from "react";
import {
  FlatList,
  InteractionManager,
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
import { ActivityIndicator, Modal, Portal, Searchbar, useTheme } from "react-native-paper";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import axios from "axios";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";

import CurrencyIcon from "~/components/CurrencyIcon";
import { useUserStore } from "~/hooks/useUserStore";
import {
  extractOwnedItemIds,
  ownedItems,
  playerLoadout,
  PlayerLoadoutResponse,
  updatePlayerLoadout,
} from "~/utils/valorant-api";
import { getAssets } from "~/utils/valorant-assets";
import {
  CATEGORY_ORDER,
  FALLBACK_IMAGE,
  TabKey,
  PlayerLoadoutGun,
  PlayerLoadoutSpray,
  PlayerLoadoutIdentity,
  WeaponMetadata,
  WeaponMetadataMap,
  EquippedWeapon,
  EquippedSpray,
  IdentityDetails,
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

const normalizeWeaponKey = (value?: string) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const sameOptionalId = (left?: string | null, right?: string | null) =>
  (left ?? null) === (right ?? null);

type OwnedSkinOption = {
  id: string;
  skinId: string;
  skinLevelId: string;
  chromaId: string;
  name: string;
  image?: string;
  contentTierUuid?: string;
  contentTierName?: string;
  upgradeLevel?: number;
  maxUpgradeLevel?: number;
  selected: boolean;
};

type OwnedSprayOption = {
  id: string;
  sprayId: string;
  sprayLevelId: string | null;
  name: string;
  icon?: string;
  selected: boolean;
};

type PickerState =
  | {
      type: "weapon";
      weapon: EquippedWeapon;
      options: OwnedSkinOption[];
    }
  | {
      type: "spray";
      spray: EquippedSpray;
      options: OwnedSprayOption[];
    };

const loadoutsMatch = (
  left?: PlayerLoadoutResponse | null,
  right?: PlayerLoadoutResponse | null
) => {
  if (!left || !right) {
    return false;
  }

  const gunsEqual =
    (left.Guns?.length ?? 0) === (right.Guns?.length ?? 0) &&
    (left.Guns ?? []).every((gun) => {
      const target = (right.Guns ?? []).find((item) => item.ID === gun.ID);
      return (
        target &&
        sameOptionalId(target.SkinID, gun.SkinID) &&
        sameOptionalId(target.SkinLevelID, gun.SkinLevelID) &&
        sameOptionalId(target.ChromaID, gun.ChromaID) &&
        sameOptionalId(target.CharmID, gun.CharmID) &&
        sameOptionalId(target.CharmLevelID, gun.CharmLevelID)
      );
    });

  const spraysEqual =
    (left.Sprays?.length ?? 0) === (right.Sprays?.length ?? 0) &&
    (left.Sprays ?? []).every((spray) => {
      const target = (right.Sprays ?? []).find(
        (item) => item.EquipSlotID === spray.EquipSlotID
      );

      return (
        target &&
        sameOptionalId(target.SprayID, spray.SprayID) &&
        sameOptionalId(target.SprayLevelID, spray.SprayLevelID)
      );
    });

  return gunsEqual && spraysEqual;
};

function Profile() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const setUser = useUserStore((state) => state.setUser);

  const [activeTab, setActiveTab] = React.useState<TabKey>("loadout");
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pickerError, setPickerError] = React.useState<string | null>(null);
  const [pickerLoading, setPickerLoading] = React.useState(false);
  const [updatingLoadout, setUpdatingLoadout] = React.useState(false);
  const [rawGuns, setRawGuns] = React.useState<PlayerLoadoutGun[]>([]);
  const [rawSprays, setRawSprays] = React.useState<PlayerLoadoutSpray[]>([]);
  const [identity, setIdentity] = React.useState<PlayerLoadoutIdentity | null>(null);
  const [loadoutSnapshot, setLoadoutSnapshot] =
    React.useState<PlayerLoadoutResponse | null>(null);
  const [ownedSkinItemIds, setOwnedSkinItemIds] = React.useState<string[]>(
    user.ownedSkinIds ?? []
  );
  const [ownedSprayItemIds, setOwnedSprayItemIds] = React.useState<string[]>([]);
  const [weaponMetadata, setWeaponMetadata] = React.useState<WeaponMetadataMap>({});
  const [searchQuery, setSearchQuery] = React.useState("");
  const [pickerState, setPickerState] = React.useState<PickerState | null>(null);
  const pickerTaskRef = React.useRef<ReturnType<
    typeof InteractionManager.runAfterInteractions
  > | null>(null);
  const pendingLoadoutRef = React.useRef<{
    loadout: PlayerLoadoutResponse;
    updatedAt: number;
  } | null>(null);
  const refreshTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

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

  const syncLoadoutState = React.useCallback((response: PlayerLoadoutResponse) => {
    setLoadoutSnapshot(response);
    setRawGuns(response.Guns || []);
    setRawSprays(response.Sprays || []);
    setIdentity(response.Identity || null);
  }, []);

  const fetchLoadoutData = React.useCallback(
    async (showSpinner = true) => {
      if (!hasAuth) return;

      if (showSpinner) {
        setLoading(true);
      }
      setError(null);

      try {
        const [response, ownershipResults] = await Promise.all([
          playerLoadout(
            user.accessToken,
            user.entitlementsToken,
            user.region,
            user.id
          ) as Promise<PlayerLoadoutResponse>,
          Promise.allSettled([
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
            ownedItems(
              user.accessToken,
              user.entitlementsToken,
              user.region,
              user.id,
              VItemTypes.Spray
            ),
          ]),
        ]);

        const pendingLoadout = pendingLoadoutRef.current;
        if (pendingLoadout) {
          const isFreshEnough =
            Date.now() - pendingLoadout.updatedAt < 8000;
          const matchesPending = loadoutsMatch(response, pendingLoadout.loadout);

          if (!matchesPending && isFreshEnough) {
            if (refreshTimeoutRef.current) {
              clearTimeout(refreshTimeoutRef.current);
            }

            refreshTimeoutRef.current = setTimeout(() => {
              refreshTimeoutRef.current = null;
              void fetchLoadoutData(false);
            }, 1200);
            return;
          }

          if (matchesPending || !isFreshEnough) {
            pendingLoadoutRef.current = null;
          }
        }

        syncLoadoutState(response);

        const nextOwnedSkinIds = new Set<string>(user.ownedSkinIds ?? []);
        const nextOwnedSprayIds = new Set<string>();

        ownershipResults.forEach((result, index) => {
          if (result.status !== "fulfilled") {
            return;
          }

          extractOwnedItemIds(result.value).forEach((itemId) => {
            if (index === 2) {
              nextOwnedSprayIds.add(itemId);
              return;
            }

            nextOwnedSkinIds.add(itemId);
          });
        });

        const nextOwnedSkinList = Array.from(nextOwnedSkinIds);
        const nextOwnedSprayList = Array.from(nextOwnedSprayIds);

        setOwnedSkinItemIds(nextOwnedSkinList);
        setOwnedSprayItemIds(nextOwnedSprayList);

        if (nextOwnedSkinIds.size > 0) {
          const currentUser = useUserStore.getState().user;
          const currentOwnedSkinSet = new Set(currentUser.ownedSkinIds ?? []);
          const ownedSkinListChanged =
            nextOwnedSkinList.length !== currentOwnedSkinSet.size ||
            nextOwnedSkinList.some((itemId) => !currentOwnedSkinSet.has(itemId));

          if (ownedSkinListChanged) {
            setUser({
              ...currentUser,
              ownedSkinIds: nextOwnedSkinList,
            });
          }
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
      syncLoadoutState,
      t,
      user.accessToken,
      user.entitlementsToken,
      user.id,
      user.ownedSkinIds,
      user.region,
      setUser,
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

  React.useEffect(
    () => () => {
      pickerTaskRef.current?.cancel();
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    },
    []
  );

  React.useEffect(() => {
    if (!hasAuth) {
      setLoadoutSnapshot(null);
      setRawGuns([]);
      setRawSprays([]);
      setIdentity(null);
      setOwnedSkinItemIds([]);
      setOwnedSprayItemIds([]);
      setPickerState(null);
      setPickerLoading(false);
      setPickerError(null);
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
      const upgradeLevelIndex = skin?.levels.findIndex(
        (item) => item.uuid === gun.SkinLevelID
      );
      const tierVisual = getContentTierVisual(skin?.contentTierUuid);

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
        skinId: gun.SkinID,
        skinLevelId: gun.SkinLevelID,
        chromaId: gun.ChromaID,
        charmInstanceId: gun.CharmInstanceID,
        charmId: gun.CharmID,
        charmLevelId: gun.CharmLevelID,
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
        maxUpgradeLevel: skin?.levels.length,
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
          sprayLevelId: spray.SprayLevelID,
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

  const ownedSkinIdSet = React.useMemo(
    () => new Set(ownedSkinItemIds),
    [ownedSkinItemIds]
  );

  const ownedSprayIdSet = React.useMemo(
    () => new Set(ownedSprayItemIds),
    [ownedSprayItemIds]
  );

  const buildOwnedSkinOptions = React.useCallback(
    (weapon: EquippedWeapon): OwnedSkinOption[] => {
      const assets = getAssets();
      const metadata = weaponMetadata[weapon.weaponId];
      const weaponSkinIds = new Set((metadata?.skins ?? []).map((skin) => skin.uuid));
      const normalizedWeaponName = normalizeWeaponKey(weapon.weaponName);
      const candidateSkins = assets.skins.filter((skin) => {
        if (weaponSkinIds.size > 0) {
          return weaponSkinIds.has(skin.uuid) || skin.uuid === weapon.skinId;
        }

        if (skin.uuid === weapon.skinId) {
          return true;
        }

        if (!normalizedWeaponName) {
          return false;
        }

        const skinName = normalizeWeaponKey(skin.displayName);
        const levelNames = (skin.levels ?? []).map((level) =>
          normalizeWeaponKey(level.displayName)
        );

        return (
          skinName.includes(normalizedWeaponName) ||
          levelNames.some((levelName) => levelName.includes(normalizedWeaponName))
        );
      });

      const options = candidateSkins
        .filter(
          (skin) =>
            skin.uuid === weapon.skinId ||
            ownedSkinIdSet.has(skin.uuid) ||
            skin.levels.some((level) => ownedSkinIdSet.has(level.uuid)) ||
            skin.chromas.some((chroma) => ownedSkinIdSet.has(chroma.uuid))
        )
        .map((skin) => {
          const currentLevel = skin.levels.find(
            (level) => level.uuid === weapon.skinLevelId
          );
          const ownedLevels = skin.levels.filter((level) =>
            ownedSkinIdSet.has(level.uuid)
          );
          const selectedLevel =
            currentLevel ||
            ownedLevels[ownedLevels.length - 1] ||
            skin.levels[0];

          const currentChroma = skin.chromas.find(
            (chroma) => chroma.uuid === weapon.chromaId
          );
          const ownedChromas = skin.chromas.filter((chroma) =>
            ownedSkinIdSet.has(chroma.uuid)
          );
          const selectedChroma =
            currentChroma ||
            ownedChromas[0] ||
            skin.chromas[0];
          const levelIndex = skin.levels.findIndex(
            (level) => level.uuid === selectedLevel?.uuid
          );
          const tier = getContentTierVisual(skin.contentTierUuid);

          return {
            id: skin.uuid,
            skinId: skin.uuid,
            skinLevelId: selectedLevel?.uuid || weapon.skinLevelId,
            chromaId: selectedChroma?.uuid || weapon.chromaId,
            name: skin.displayName,
            image:
              selectedLevel?.displayIcon ||
              selectedChroma?.displayIcon ||
              skin.displayIcon,
            contentTierUuid: skin.contentTierUuid,
            contentTierName: tier.label,
            upgradeLevel: levelIndex >= 0 ? levelIndex + 1 : undefined,
            maxUpgradeLevel: skin.levels.length || undefined,
            selected:
              skin.uuid === weapon.skinId &&
              (selectedLevel?.uuid || weapon.skinLevelId) === weapon.skinLevelId &&
              (selectedChroma?.uuid || weapon.chromaId) === weapon.chromaId,
          };
        })
        .sort((a, b) => {
          const selectedDiff = Number(b.selected) - Number(a.selected);
          if (selectedDiff !== 0) {
            return selectedDiff;
          }

          return a.name.localeCompare(b.name);
        });

      return options;
    },
    [ownedSkinIdSet, weaponMetadata]
  );

  const buildOwnedSprayOptions = React.useCallback(
    (spray: EquippedSpray): OwnedSprayOption[] => {
      const assets = getAssets();

      return assets.sprays
        .filter(
          (sprayAsset) =>
            sprayAsset.uuid === spray.id ||
            ownedSprayIdSet.has(sprayAsset.uuid) ||
            sprayAsset.levels.some((level) => ownedSprayIdSet.has(level.uuid))
        )
        .map((sprayAsset) => ({
          id: sprayAsset.uuid,
          sprayId: sprayAsset.uuid,
          sprayLevelId: sprayAsset.levels[0]?.uuid ?? null,
          name: sprayAsset.displayName,
          icon:
            sprayAsset.fullTransparentIcon ||
            sprayAsset.displayIcon ||
            sprayAsset.fullIcon,
          selected: sprayAsset.uuid === spray.id,
        }))
        .sort((a, b) => {
          const selectedDiff = Number(b.selected) - Number(a.selected);
          if (selectedDiff !== 0) {
            return selectedDiff;
          }

          return a.name.localeCompare(b.name);
        });
    },
    [ownedSprayIdSet]
  );

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

  const handleDismissPicker = React.useCallback(() => {
    if (updatingLoadout) {
      return;
    }

    pickerTaskRef.current?.cancel();
    pickerTaskRef.current = null;
    setPickerLoading(false);
    setPickerState(null);
    setPickerError(null);
  }, [updatingLoadout]);

  const handleOpenWeaponPicker = React.useCallback(
    (weapon: EquippedWeapon) => {
      pickerTaskRef.current?.cancel();
      setPickerError(null);
      setPickerLoading(true);
      React.startTransition(() => {
        setPickerState({
          type: "weapon",
          weapon,
          options: [],
        });
      });

      pickerTaskRef.current = InteractionManager.runAfterInteractions(() => {
        const options = buildOwnedSkinOptions(weapon);
        React.startTransition(() => {
          setPickerState({
            type: "weapon",
            weapon,
            options,
          });
        });
        setPickerLoading(false);
        pickerTaskRef.current = null;
      });
    },
    [buildOwnedSkinOptions]
  );

  const handleOpenSprayPicker = React.useCallback(
    (spray: EquippedSpray) => {
      pickerTaskRef.current?.cancel();
      setPickerError(null);
      setPickerLoading(true);
      React.startTransition(() => {
        setPickerState({
          type: "spray",
          spray,
          options: [],
        });
      });

      pickerTaskRef.current = InteractionManager.runAfterInteractions(() => {
        const options = buildOwnedSprayOptions(spray);
        React.startTransition(() => {
          setPickerState({
            type: "spray",
            spray,
            options,
          });
        });
        setPickerLoading(false);
        pickerTaskRef.current = null;
      });
    },
    [buildOwnedSprayOptions]
  );

  const confirmLoadoutUpdate = React.useCallback(
    async (expectedLoadout: PlayerLoadoutResponse) => {
      const retryDelays = [350, 800, 1400, 2200];
      let latestLoadout: PlayerLoadoutResponse | null = null;

      for (let attemptIndex = 0; attemptIndex < retryDelays.length; attemptIndex += 1) {
        const retryDelay = retryDelays[attemptIndex];
        await delay(retryDelay);

        latestLoadout = await playerLoadout(
          user.accessToken,
          user.entitlementsToken,
          user.region,
          user.id
        );

        if (__DEV__) {
          console.log("[profile] confirm poll", {
            attempt: attemptIndex + 1,
            delayMs: retryDelay,
            matches: loadoutsMatch(latestLoadout, expectedLoadout),
          });
        }

        if (loadoutsMatch(latestLoadout, expectedLoadout)) {
          pendingLoadoutRef.current = null;
          return {
            confirmed: true,
            loadout: latestLoadout,
          };
        }
      }

      pendingLoadoutRef.current = null;
      return {
        confirmed: false,
        loadout: latestLoadout,
      };
    },
    [user.accessToken, user.entitlementsToken, user.id, user.region]
  );

  const handleEquipWeapon = React.useCallback(
    async (weapon: EquippedWeapon, option: OwnedSkinOption) => {
      if (!hasAuth || !loadoutSnapshot || updatingLoadout) {
        return;
      }

      setUpdatingLoadout(true);
      setPickerError(null);

      const nextLoadout: PlayerLoadoutResponse = {
        ...loadoutSnapshot,
        Guns: (loadoutSnapshot.Guns || []).map((gun) =>
          gun.ID === weapon.weaponId
            ? {
                ...gun,
                SkinID: option.skinId,
                SkinLevelID: option.skinLevelId,
                ChromaID: option.chromaId,
              }
            : gun
        ),
      };

      try {
        pendingLoadoutRef.current = {
          loadout: nextLoadout,
          updatedAt: Date.now(),
        };

        if (__DEV__) {
          console.log("[profile] equip skin request", {
            weaponId: weapon.weaponId,
            weaponName: weapon.weaponName,
            fromSkinId: weapon.skinId,
            toSkinId: option.skinId,
            toSkinLevelId: option.skinLevelId,
            toChromaId: option.chromaId,
          });
        }

        const putResponse = await updatePlayerLoadout(
          user.accessToken,
          user.entitlementsToken,
          user.region,
          user.id,
          nextLoadout
        );

        if (__DEV__) {
          const updatedGun = (putResponse.Guns || []).find(
            (gun) => gun.ID === weapon.weaponId
          );
          console.log("[profile] equip skin put response", {
            weaponId: weapon.weaponId,
            responseSkinId: updatedGun?.SkinID,
            responseSkinLevelId: updatedGun?.SkinLevelID,
            responseChromaId: updatedGun?.ChromaID,
          });
        }

        pendingLoadoutRef.current = {
          loadout: putResponse,
          updatedAt: Date.now(),
        };

        const confirmation = await confirmLoadoutUpdate(putResponse);

        if (confirmation.confirmed && confirmation.loadout) {
          syncLoadoutState(confirmation.loadout);
          setPickerState(null);
        } else {
          if (confirmation.loadout) {
            syncLoadoutState(confirmation.loadout);
          }
          setPickerError("Riot has not confirmed this skin change yet. Try again.");
        }
      } catch (err) {
        if (__DEV__) console.error(err);
        pendingLoadoutRef.current = null;
        setPickerError("Could not equip this skin right now.");
      } finally {
        setUpdatingLoadout(false);
      }
    },
    [
      confirmLoadoutUpdate,
      hasAuth,
      loadoutSnapshot,
      syncLoadoutState,
      updatingLoadout,
      user.accessToken,
      user.entitlementsToken,
      user.id,
      user.region,
    ]
  );

  const handleEquipSpray = React.useCallback(
    async (spray: EquippedSpray, option: OwnedSprayOption) => {
      if (!hasAuth || !loadoutSnapshot || updatingLoadout) {
        return;
      }

      setUpdatingLoadout(true);
      setPickerError(null);

      const nextLoadout: PlayerLoadoutResponse = {
        ...loadoutSnapshot,
        Sprays: (loadoutSnapshot.Sprays || []).map((item) =>
          item.EquipSlotID === spray.slot
            ? {
                ...item,
                SprayID: option.sprayId,
                SprayLevelID: option.sprayLevelId,
              }
            : item
        ),
      };

      try {
        pendingLoadoutRef.current = {
          loadout: nextLoadout,
          updatedAt: Date.now(),
        };

        if (__DEV__) {
          console.log("[profile] equip spray request", {
            slot: spray.slot,
            fromSprayId: spray.id,
            toSprayId: option.sprayId,
            toSprayLevelId: option.sprayLevelId,
          });
        }

        const putResponse = await updatePlayerLoadout(
          user.accessToken,
          user.entitlementsToken,
          user.region,
          user.id,
          nextLoadout
        );

        if (__DEV__) {
          const updatedSpray = (putResponse.Sprays || []).find(
            (item) => item.EquipSlotID === spray.slot
          );
          console.log("[profile] equip spray put response", {
            slot: spray.slot,
            responseSprayId: updatedSpray?.SprayID,
            responseSprayLevelId: updatedSpray?.SprayLevelID,
          });
        }

        pendingLoadoutRef.current = {
          loadout: putResponse,
          updatedAt: Date.now(),
        };

        const confirmation = await confirmLoadoutUpdate(putResponse);

        if (confirmation.confirmed && confirmation.loadout) {
          syncLoadoutState(confirmation.loadout);
          setPickerState(null);
        } else {
          if (confirmation.loadout) {
            syncLoadoutState(confirmation.loadout);
          }
          setPickerError("Riot has not confirmed this spray change yet. Try again.");
        }
      } catch (err) {
        if (__DEV__) console.error(err);
        pendingLoadoutRef.current = null;
        setPickerError("Could not equip this spray right now.");
      } finally {
        setUpdatingLoadout(false);
      }
    },
    [
      confirmLoadoutUpdate,
      hasAuth,
      loadoutSnapshot,
      syncLoadoutState,
      updatingLoadout,
      user.accessToken,
      user.entitlementsToken,
      user.id,
      user.region,
    ]
  );

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
            <TouchableOpacity
              key={`${spray.slot}-${spray.id}`}
              activeOpacity={0.9}
              disabled={updatingLoadout}
              onPress={() => handleOpenSprayPicker(spray)}
              style={[
                styles.sprayCard,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.cardBorder,
                  opacity: updatingLoadout ? 0.72 : 1,
                },
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
            </TouchableOpacity>
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
        <TouchableOpacity
          key={weapon.weaponId}
          activeOpacity={0.92}
          disabled={updatingLoadout}
          onPress={() => handleOpenWeaponPicker(weapon)}
          style={[
            styles.weaponCard,
            styles.syncedWeaponCard,
            {
              backgroundColor: tier.cardBackground,
              borderColor: tier.border,
              opacity: updatingLoadout ? 0.72 : 1,
            },
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
        </TouchableOpacity>
      );
    },
    [
      handleOpenWeaponPicker,
      palette.textPrimary,
      renderWeaponBadges,
      updatingLoadout,
    ]
  );

  const renderSkinGridCard = React.useCallback(
    (weapon: EquippedWeapon, category: string) => {
      const tier = getContentTierVisual(
        weapon.contentTierUuid,
        weapon.contentTierName
      );

      return (
        <TouchableOpacity
          key={`${category}-${weapon.weaponId}`}
          activeOpacity={0.92}
          disabled={updatingLoadout}
          onPress={() => handleOpenWeaponPicker(weapon)}
          style={[
            styles.skinGridCard,
            styles.syncedGridCard,
            {
              backgroundColor: tier.cardBackground,
              borderColor: tier.border,
              opacity: updatingLoadout ? 0.72 : 1,
            },
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
        </TouchableOpacity>
      );
    },
    [handleOpenWeaponPicker, palette.textPrimary, renderWeaponBadges, updatingLoadout]
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

  const renderCollectionTab = () => (
    <FlatList
      style={styles.collectionContainer}
      data={filteredCollection}
      keyExtractor={(item) => item.weaponId}
      numColumns={2}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      contentContainerStyle={styles.collectionList}
      columnWrapperStyle={styles.collectionRow}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          {renderPageHeader()}
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
        </>
      }
      ListEmptyComponent={
        <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
          {t("equip_page.empty")}
        </Text>
      }
      renderItem={({ item }) => {
        const tier = getContentTierVisual(
          item.contentTierUuid,
          item.contentTierName
        );

        return (
          <View
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
      }}
    />
  );

  const renderLoadoutTab = () =>
    renderPageScroll(
      <>
        {renderIdentitySection()}
        {renderSpraySection()}
        {renderWeaponsSection()}
      </>
    );

  const renderPickerModal = () => {
    if (!pickerState) {
      return null;
    }

    const pickerBusy = pickerLoading || updatingLoadout;

    const title =
      pickerState.type === "weapon" ? "Choose an owned skin" : "Choose an owned spray";
    const subtitle =
      pickerState.type === "weapon"
        ? pickerState.weapon.weaponName
        : formatSpraySlot(pickerState.spray.slot, t);

    return (
      <Portal>
        <Modal
          visible
          onDismiss={handleDismissPicker}
          contentContainerStyle={styles.pickerModalContainer}
        >
          <View
            style={[
              styles.pickerSheet,
              { backgroundColor: palette.card, borderColor: palette.cardBorder },
            ]}
          >
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeaderRow}>
              <View style={styles.pickerHeaderText}>
                <Text style={[styles.pickerTitle, { color: palette.textPrimary }]}>
                  {title}
                </Text>
                <Text
                  style={[styles.pickerSubtitle, { color: palette.textSecondary }]}
                >
                  {subtitle}
                </Text>
              </View>
              {pickerBusy ? (
                <ActivityIndicator animating color={palette.accent} />
              ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleDismissPicker}
                  style={[
                    styles.pickerCloseButton,
                    {
                      backgroundColor: palette.chipBackground,
                      borderColor: palette.cardBorder,
                    },
                  ]}
                >
                  <Icon name="close" size={18} color={palette.textPrimary} />
                </TouchableOpacity>
              )}
            </View>

            {pickerError ? (
              <Text style={styles.pickerErrorText}>{pickerError}</Text>
            ) : null}

            {pickerState.type === "weapon" ? (
              <FlatList
                data={pickerState.options}
                keyExtractor={(option) => option.id}
                numColumns={2}
                style={styles.pickerList}
                contentContainerStyle={styles.pickerListContent}
                columnWrapperStyle={styles.pickerGridRow}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews
                initialNumToRender={6}
                maxToRenderPerBatch={6}
                windowSize={5}
                updateCellsBatchingPeriod={16}
                ListEmptyComponent={
                  <View style={styles.pickerEmptyState}>
                    {pickerLoading ? (
                      <ActivityIndicator animating color={palette.accent} />
                    ) : (
                      <Text
                        style={[
                          styles.pickerEmptyText,
                          { color: palette.textSecondary },
                        ]}
                      >
                        No owned skins found for this weapon.
                      </Text>
                    )}
                  </View>
                }
                renderItem={({ item: option }) => {
                  const tier = getContentTierVisual(
                    option.contentTierUuid,
                    option.contentTierName
                  );

                  return (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      disabled={pickerBusy}
                      onPress={() => handleEquipWeapon(pickerState.weapon, option)}
                      style={[
                        styles.pickerOptionCard,
                        {
                          backgroundColor: tier.cardBackground,
                          borderColor: option.selected ? palette.accent : tier.border,
                          opacity: pickerBusy ? 0.72 : 1,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.pickerOptionVisual,
                          {
                            backgroundColor: tier.visualBackground,
                            borderColor: tier.border,
                          },
                        ]}
                      >
                        <Image
                          source={option.image ? { uri: option.image } : FALLBACK_IMAGE}
                          style={styles.pickerOptionImage}
                          contentFit="contain"
                          cachePolicy="memory-disk"
                          transition={90}
                        />
                      </View>
                      <Text
                        style={[
                          styles.pickerOptionTitle,
                          { color: palette.textPrimary },
                        ]}
                        numberOfLines={2}
                      >
                        {option.name}
                      </Text>
                      <View style={styles.pickerOptionMeta}>
                        <View
                          style={[
                            styles.pickerOptionBadge,
                            {
                              backgroundColor: tier.badgeBackground,
                              borderColor: tier.border,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.pickerOptionDot,
                              { backgroundColor: tier.accent },
                            ]}
                          />
                          <Text
                            style={[
                              styles.pickerOptionBadgeText,
                              { color: tier.text },
                            ]}
                          >
                            {option.contentTierName || tier.label}
                          </Text>
                        </View>
                        {option.upgradeLevel ? (
                          <View
                            style={[
                              styles.pickerOptionBadge,
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
                                styles.pickerOptionBadgeText,
                                { color: tier.text },
                              ]}
                            >
                              {option.maxUpgradeLevel && option.maxUpgradeLevel > 1
                                ? `Lv ${option.upgradeLevel}/${option.maxUpgradeLevel}`
                                : `Lv ${option.upgradeLevel}`}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {option.selected ? (
                        <Text
                          style={[
                            styles.pickerSelectedText,
                            { color: palette.accent },
                          ]}
                        >
                          Equipped now
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                }}
              />
            ) : (
              <FlatList
                data={pickerState.options}
                keyExtractor={(option) => option.id}
                numColumns={2}
                style={styles.pickerList}
                contentContainerStyle={styles.pickerListContent}
                columnWrapperStyle={styles.pickerGridRow}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews
                initialNumToRender={6}
                maxToRenderPerBatch={6}
                windowSize={5}
                updateCellsBatchingPeriod={16}
                ListEmptyComponent={
                  <View style={styles.pickerEmptyState}>
                    {pickerLoading ? (
                      <ActivityIndicator animating color={palette.accent} />
                    ) : (
                      <Text
                        style={[
                          styles.pickerEmptyText,
                          { color: palette.textSecondary },
                        ]}
                      >
                        No owned sprays found for this slot.
                      </Text>
                    )}
                  </View>
                }
                renderItem={({ item: option }) => (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={pickerBusy}
                    onPress={() => handleEquipSpray(pickerState.spray, option)}
                    style={[
                      styles.pickerOptionCard,
                      {
                        backgroundColor: palette.background,
                        borderColor: option.selected
                          ? palette.accent
                          : palette.cardBorder,
                        opacity: pickerBusy ? 0.72 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.pickerOptionVisual,
                        {
                          backgroundColor: palette.chipBackground,
                          borderColor: palette.cardBorder,
                        },
                      ]}
                    >
                      <Image
                        source={option.icon ? { uri: option.icon } : FALLBACK_IMAGE}
                        style={styles.pickerOptionImage}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                        transition={90}
                      />
                    </View>
                    <Text
                      style={[
                        styles.pickerOptionTitle,
                        { color: palette.textPrimary },
                      ]}
                      numberOfLines={2}
                    >
                      {option.name}
                    </Text>
                    {option.selected ? (
                      <Text
                        style={[
                          styles.pickerSelectedText,
                          { color: palette.accent },
                        ]}
                      >
                        Equipped now
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </Modal>
      </Portal>
    );
  };

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
      {renderPickerModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
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
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroBadgeText: {
    marginLeft: 8,
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.PURE_WHITE,
  },
  heroRegionPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroRegionText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.PURE_WHITE,
    letterSpacing: 0.6,
  },
  heroNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 12,
  },
  heroTitle: {
    fontSize: 28,
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
    marginTop: 4,
    fontSize: 14,
    color: "rgba(255,255,255,0.78)",
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  heroMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroMetaText: {
    marginLeft: 6,
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.PURE_WHITE,
  },
  heroStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 12,
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
  pickerModalContainer: {
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  pickerSheet: {
    maxHeight: "82%",
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
  },
  pickerHandle: {
    alignSelf: "center",
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: COLORS.BORDER,
    marginBottom: 14,
  },
  pickerHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  pickerHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  pickerSubtitle: {
    marginTop: 4,
    fontSize: 13,
  },
  pickerCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerErrorText: {
    marginBottom: 12,
    color: "#9b3f3f",
    fontSize: 13,
    fontWeight: "600",
  },
  pickerList: {
    minHeight: 240,
  },
  pickerListContent: {
    paddingBottom: 8,
  },
  pickerGridRow: {
    justifyContent: "space-between",
  },
  pickerEmptyState: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  pickerEmptyText: {
    fontSize: 13,
    textAlign: "center",
  },
  pickerOptionCard: {
    width: "48%",
    borderRadius: 22,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  pickerOptionVisual: {
    height: 104,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    marginBottom: 10,
  },
  pickerOptionImage: {
    width: "100%",
    height: "100%",
  },
  pickerOptionTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  pickerOptionMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
  },
  pickerOptionBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  pickerOptionDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: 6,
  },
  pickerOptionBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  pickerSelectedText: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "700",
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
  collectionContainer: {
    flex: 1,
  },
  searchBar: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 20,
    elevation: 0,
    borderWidth: 1,
  },
  collectionList: {
    paddingBottom: 140,
  },
  collectionRow: {
    justifyContent: "space-between",
  },
  collectionCard: {
    flex: 1,
    margin: 6,
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
