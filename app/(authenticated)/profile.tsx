// 📄 app/(authenticated)/profile.tsx — Màn hình Profile chính (trang cá nhân)
// Đây là màn hình phức tạp nhất của app, quản lý:
//   - Thông tin người chơi (hero card, rank, balances).
//   - Loadout vũ khí, skin, spray, flex, player card, player title.
//   - Trang bị (equip) và thay đổi skin/spray/identity.
//   - Collection (bộ sưu tập skin đã sở hữu).
//   - Picker modal để chọn skin/spray/card/title.

import React from "react";
import {
  FlatList,
  InteractionManager,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { ActivityIndicator, Modal, Portal, Searchbar, useTheme } from "react-native-paper";
import { CachedImage as Image } from "~/components/CachedImage";
import { useTranslation } from "react-i18next";
import axios from "axios";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";

import CurrencyIcon from "~/components/CurrencyIcon";
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";
import { useUserStore } from "~/hooks/useUserStore";
import {
  extractOwnedItemIds,
  ownedItems,
  playerLoadout,
  PlayerLoadoutExpression,
  PlayerLoadoutResponse,
  updatePlayerLoadout,
  updatePlayerLoadoutV3,
  updatePlayerLoadoutV3First,
} from "~/utils/valorant-api";
import {
  CompetitiveRankSummary,
  fetchCompetitiveRankSummary,
  getSessionAuthKey,
  hasValidCompetitiveRankCache,
  hasValidProfileLoadoutCache,
  isProfileCacheFresh,
  PROFILE_LOADOUT_CACHE_VERSION,
  PROFILE_RANK_CACHE_VERSION,
} from "~/utils/profile-cache";
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
  OwnedWeaponCollectionItem,
  EquippedSpray,
  IdentityDetails,
  resolveCategory,
  formatSpraySlot,
  WEAPON_NAME_ORDER,
} from "~/components/GalleryProfile";
import { COLORS, RADIUS, GLOBAL_STYLES } from "~/constants/DesignSystem";
import { getContentTierVisual } from "~/utils/content-tier";
import { VItemTypes } from "~/utils/misc";

/**
 * normalizeProfileWeaponCategory — Chuẩn hóa tên category của vũ khí.
 * Dùng để nhóm vũ khí theo loại (Sidearm, SMG, Shotgun, Sniper, Rifle, Heavy, Melee, Other).
 *
 * @param {string | undefined} category - Tên category gốc từ API.
 * @returns {string} Tên category đã chuẩn hóa.
 */
const normalizeProfileWeaponCategory = (category?: string) => {
  const normalized = category?.trim().toLowerCase();

  if (!normalized) return "Other";
  if (normalized.includes("sidearm")) return "Sidearm";
  if (normalized.includes("smg")) return "SMG";
  if (normalized.includes("shotgun")) return "Shotgun";
  if (normalized.includes("sniper")) return "Sniper";
  if (normalized.includes("rifle")) return "Rifle";
  if (normalized.includes("heavy") || normalized.includes("machine gun")) {
    return "Heavy";
  }
  if (normalized.includes("melee") || normalized.includes("knife")) {
    return "Melee";
  }
  if (normalized.includes("other")) return "Other";

  return category?.trim() || "Other";
};

/**
 * formatUpgradeLevel — Format chuỗi hiển thị cấp độ nâng cấp skin.
 * VD: "3/5" (cấp hiện tại / tối đa) hoặc "3" (nếu max === 1).
 *
 * @param {EquippedWeapon} weapon - Vũ khí có upgradeLevel.
 * @returns {string | null} Chuỗi hiển thị hoặc null nếu không có level.
 */
const formatUpgradeLevel = (
    weapon: EquippedWeapon
) => {
  if (!weapon.upgradeLevel) {
    return null;
  }

  if (
      weapon.maxUpgradeLevel &&
      weapon.maxUpgradeLevel > 1
  ) {
    return `${weapon.upgradeLevel}/${weapon.maxUpgradeLevel}`;
  }

  return `${weapon.upgradeLevel}`;
};

/** Props cho CompactProfileSkinCard component. */
interface CompactProfileSkinCardProps {
  weapon: EquippedWeapon;   // Vũ khí cần hiển thị
  width: number;            // Chiều rộng của card
  disabled?: boolean;       // Disable tương tác?
  onPress?: () => void;     // Callback khi nhấn
}

/**
 * CompactProfileSkinCard — Card hiển thị skin vũ khí dạng nhỏ gọn.
 *
 * Memoized với React.memo để tránh re-render không cần thiết.
 *
 * Hiển thị:
 * - Badge tier (màu sắc theo content tier).
 * - Badge upgrade level (nếu có).
 * - Ảnh skin.
 * - Tên vũ khí + tên skin.
 *
 * Nếu có onPress, bọc trong TouchableOpacity. Nếu không, dùng View có accessibility.
 *
 * @returns {JSX.Element} Card skin nhỏ gọn.
 */
const CompactProfileSkinCard = React.memo(function CompactProfileSkinCard({
                                                                            weapon,
                                                                            width,
                                                                            disabled = false,
                                                                            onPress,
                                                                          }: CompactProfileSkinCardProps) {
  const tier = getContentTierVisual(
      weapon.contentTierUuid,
      weapon.contentTierName
  );
  const upgradeLabel = formatUpgradeLevel(weapon);
  const cardStyle = [
    styles.profileSkinCard,
    {
      width,
      borderColor: tier.border,
      opacity: disabled ? 0.72 : 1,
    },
  ];
  const content = (
      <>
        <View
            style={[
              styles.profileSkinVisual,
              {
                backgroundColor: tier.cardBackground,
                borderBottomColor: tier.border,
              },
            ]}
        >
          {/* Badge tier (VD: DELUXE, EXCLUSIVE, ...) */}
          <View
              style={[
                styles.profileSkinTierBadge,
                { backgroundColor: tier.badgeBackground },
              ]}
          >
            <Text
                style={[styles.profileSkinTierText, { color: tier.text }]}
                numberOfLines={1}
            >
              {(weapon.contentTierName || tier.label).toUpperCase()}
            </Text>
          </View>
          {/* Badge upgrade level (VD: 2/4) */}
          {upgradeLabel ? (
              <View style={styles.profileSkinLevelBadge}>
                <Text style={styles.profileSkinLevelText}>{upgradeLabel}</Text>
              </View>
          ) : null}
          <Image
              cacheId={`skin-image:${
                  weapon.chromaId || weapon.skinLevelId || weapon.skinId
              }:display`}
              source={weapon.image ? { uri: weapon.image } : FALLBACK_IMAGE}
              style={styles.profileSkinImage}
              contentFit="contain"
              cachePolicy="memory-disk"
              priority="low"
              recyclingKey={weapon.skinId || weapon.weaponId}
          />
        </View>

        {/* Tên vũ khí + skin */}
        <View style={styles.profileSkinContent}>
          <Text style={styles.profileSkinWeaponName} numberOfLines={1}>
            {weapon.weaponName}
          </Text>
          <Text style={styles.profileSkinName} numberOfLines={2}>
            {weapon.skinName}
          </Text>
        </View>
      </>
  );

  if (onPress) {
    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${weapon.weaponName}, ${weapon.skinName}`}
            activeOpacity={0.86}
            disabled={disabled}
            onPress={onPress}
            style={cardStyle}
        >
          {content}
        </TouchableOpacity>
    );
  }

  return (
      <View
          accessible
          accessibilityLabel={`${weapon.weaponName}, ${weapon.skinName}`}
          style={cardStyle}
      >
        {content}
      </View>
  );
});

/**
 * normalizeWeaponKey — Chuẩn hóa tên vũ khí để so sánh.
 * Loại bỏ dấu, chuyển lowercase, thay ký tự đặc biệt bằng khoảng trắng.
 *
 * @param {string | undefined} value - Tên gốc.
 * @returns {string} Tên đã chuẩn hóa.
 */
const normalizeWeaponKey = (value?: string) =>
    (value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

/**
 * getProfileWeaponOrderIndex — Lấy index sắp xếp của vũ khí dựa trên WEAPON_NAME_ORDER.
 *
 * @param {string | undefined} weaponName - Tên vũ khí.
 * @returns {number} Index trong mảng, hoặc length nếu không tìm thấy.
 */
const getProfileWeaponOrderIndex = (weaponName?: string) => {
  const normalizedWeaponName = normalizeWeaponKey(weaponName);
  const index = WEAPON_NAME_ORDER.findIndex(
      (name) => normalizeWeaponKey(name) === normalizedWeaponName
  );

  return index === -1 ? WEAPON_NAME_ORDER.length : index;
};

/**
 * delay — Promise-based setTimeout.
 *
 * @param {number} ms - Số milliseconds chờ.
 * @returns {Promise<void>} Promise resolve sau ms.
 */
const delay = (ms: number) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });

/**
 * sameOptionalId — So sánh hai optional ID (null/undefined/string).
 * Null và undefined được coi như nhau.
 *
 * @param {string | null | undefined} left
 * @param {string | null | undefined} right
 * @returns {boolean} true nếu giống nhau.
 */
const sameOptionalId = (left?: string | null, right?: string | null) =>
    (left ?? null) === (right ?? null);

/**
 * normalizeVariantLabel — Trích xuất tên variant từ chroma name.
 * Nếu chromaName === skinName, trả về null.
 * Nếu chromaName bắt đầu bằng skinName, trả về phần suffix.
 *
 * @param {string} skinName - Tên skin gốc.
 * @param {string | undefined} chromaName - Tên chroma.
 * @returns {string | null} Tên variant hoặc null.
 */
const normalizeVariantLabel = (skinName: string, chromaName?: string) => {
  if (!chromaName) {
    return null;
  }

  const baseName = skinName.trim();
  const variantName = chromaName.trim();

  if (!variantName || variantName.toLowerCase() === baseName.toLowerCase()) {
    return null;
  }

  if (variantName.toLowerCase().startsWith(baseName.toLowerCase())) {
    const suffix = variantName.slice(baseName.length).replace(/^[-:\s]+/, "");
    return suffix || null;
  }

  return variantName;
};

// ─── Type definitions ──────────────────────────────────────────────────────────
// Các type này định nghĩa cấu trúc dữ liệu cho picker modal và loadout updates.

/** OwnedSkinOption — Một option skin trong picker vũ khí. */
type OwnedSkinOption = {
  id: string;
  skinId: string;
  skinLevelId: string;
  chromaId: string;
  name: string;
  chromaName?: string;
  image?: string;
  contentTierUuid?: string;
  contentTierName?: string;
  upgradeLevel?: number;        // Cấp nâng cấp hiện tại
  maxUpgradeLevel?: number;     // Cấp nâng cấp tối đa
  chromas: {                    // Danh sách chroma (biến thể màu)
    id: string;
    name: string;
    swatch?: string;            // Màu mẫu nhỏ
    image?: string;
    selected: boolean;          // Chroma đang được chọn?
  }[];
  selected: boolean;            // Skin này có đang được trang bị?
};

/** OwnedSprayOption — Một option spray trong picker spray. */
type OwnedSprayOption = {
  id: string;
  sprayId: string;
  sprayLevelId: string | null;
  name: string;
  icon?: string;
  selected: boolean;
};

/** OwnedPlayerCardOption — Một option player card. */
type OwnedPlayerCardOption = {
  id: string;
  name: string;
  image?: string;
  selected: boolean;
};

/** OwnedPlayerTitleOption — Một option player title. */
type OwnedPlayerTitleOption = {
  id: string;
  name: string;
  selected: boolean;
};

/** ExpressionKind — Loại biểu cảm (spray hoặc flex). */
type ExpressionKind = "spray" | "flex";

/** EquippedExpression — Một biểu cảm đã được trang bị. */
type EquippedExpression = {
  slotIndex: number;
  kind: ExpressionKind;
  id: string;
  name: string;
  icon?: string;
};

/** OwnedExpressionOption — Một option biểu cảm trong picker. */
type OwnedExpressionOption = {
  id: string;
  kind: ExpressionKind;
  assetId: string;
  name: string;
  icon?: string;
  selected: boolean;
};

/** PendingLoadoutUpdate — Một bản cập nhật loadout đang chờ xác nhận từ server. */
type PendingLoadoutUpdate = {
  loadout: PlayerLoadoutResponse;
  updatedAt: number;
};

/** PickerState — State của picker modal, phân biệt theo type. */
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
}
    | {
  type: "expression";
  expression: EquippedExpression;
  mode: ExpressionKind;
  options: OwnedExpressionOption[];
}
    | {
  type: "player-card";
  options: OwnedPlayerCardOption[];
}
    | {
  type: "player-title";
  options: OwnedPlayerTitleOption[];
};

/**
 * loadoutsMatch — So sánh hai đối tượng PlayerLoadoutResponse xem có giống nhau không.
 * So sánh: Guns (SkinID, SkinLevelID, ChromaID, CharmID, CharmLevelID),
 * Sprays (SprayID, SprayLevelID), ActiveExpressions (TypeID, AssetID),
 * Identity (PlayerCardID, PlayerTitleID).
 *
 * @param {PlayerLoadoutResponse | null | undefined} left - Loadout thứ nhất.
 * @param {PlayerLoadoutResponse | null | undefined} right - Loadout thứ hai.
 * @returns {boolean} true nếu giống nhau hoàn toàn.
 */
const loadoutsMatch = (
    left?: PlayerLoadoutResponse | null,
    right?: PlayerLoadoutResponse | null
) => {
  if (!left || !right) {
    return false;
  }

  // So sánh Guns
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

  // So sánh Sprays
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

  // So sánh ActiveExpressions
  const leftExpressions = left.ActiveExpressions ?? [];
  const rightExpressions = right.ActiveExpressions ?? [];
  const expressionsEqual =
      leftExpressions.length === rightExpressions.length &&
      leftExpressions.every((expression, index) => {
        const target = rightExpressions[index];

        return (
            target &&
            target.TypeID.toLowerCase() === expression.TypeID.toLowerCase() &&
            sameOptionalId(target.AssetID, expression.AssetID)
        );
      });

  // So sánh Identity (PlayerCardID, PlayerTitleID)
  const identityEqual =
      sameOptionalId(left.Identity?.PlayerCardID, right.Identity?.PlayerCardID) &&
      sameOptionalId(left.Identity?.PlayerTitleID, right.Identity?.PlayerTitleID);

  return gunsEqual && spraysEqual && expressionsEqual && identityEqual;
};

/**
 * Profile — Component chính của màn hình Profile.
 *
 * ─── State & Refs ─────────────────────────────────────────────────────────────
 *
 * Derived values:
 * - viewportWidth: Chiều rộng màn hình hiện tại.
 * - user (useUserStore): Thông tin user (accessToken, balances, progress, ...).
 * - setUser (useUserStore): Cập nhật user state.
 * - setProfileCache (useProfileCacheStore): Cập nhật profile cache.
 * - profileGridColumns: Số cột grid (4 nếu >=700, 2 nếu <350, 3 nếu còn lại).
 * - profileGridCardWidth: Chiều rộng card trong grid collection.
 * - profileSkinRowCardWidth: Chiều rộng card trong row skin (min 128, max 168).
 * - hasAuth: User có đầy đủ auth tokens?
 * - authKey (useMemo): Key định danh session để cache.
 * - cachedProfile (useProfileCacheStore): Profile đã cache theo authKey.
 * - cachedCompetitiveRank: Rank competitive từ cache (nếu còn valid).
 * - cachedLoadoutSnapshot: Loadout snapshot từ cache (nếu còn valid).
 *
 * State:
 * - activeTab: Tab hiện tại ("loadout" | "skins" | "collection").
 * - loading: Đang fetch dữ liệu lần đầu?
 * - refreshing: Đang pull-to-refresh?
 * - error: Lỗi tổng quan (nếu có).
 * - pickerError: Lỗi trong picker modal.
 * - pickerLoading: Picker đang tải options?
 * - updatingLoadout: Đang cập nhật loadout lên server?
 * - rawGuns: Dữ liệu Guns gốc từ API.
 * - rawSprays: Dữ liệu Sprays gốc từ API.
 * - rawActiveExpressions: Dữ liệu ActiveExpressions gốc.
 * - identity: Identity (PlayerCardID, PlayerTitleID, AccountLevel).
 * - loadoutSnapshot: Toàn bộ response loadout hiện tại.
 * - ownedSkinItemIds: Danh sách ID skin đã sở hữu.
 * - ownedSprayItemIds: Danh sách ID spray đã sở hữu.
 * - ownedFlexItemIds: Danh sách ID flex đã sở hữu.
 * - ownedPlayerCardItemIds: Danh sách ID player card đã sở hữu.
 * - ownedPlayerTitleItemIds: Danh sách ID player title đã sở hữu.
 * - competitiveRank: Thông tin rank competitive.
 * - weaponMetadata: Map weapon UUID → metadata (từ valorant-api.com).
 * - searchQuery: Input tìm kiếm trong collection tab.
 * - collectionWeaponFilter: Bộ lọc vũ khí trong collection ("all" hoặc tên).
 * - pickerState: State hiện tại của picker modal (null = đóng).
 * - identityPickerQuery: Input tìm kiếm trong identity picker.
 * - activeWeaponChroma: Chroma panel đang mở cho weapon/skin nào.
 *
 * Refs:
 * - pickerTaskRef: Task InteractionManager cho picker (hủy được).
 * - loadoutSnapshotRef: Luôn giữ loadout mới nhất (dùng trong async).
 * - loadoutMutationVersionRef: Version tăng dần khi mutate loadout.
 * - pendingLoadoutRef: Bản cập nhật loadout đang chờ xác nhận.
 * - initialFetchTaskRef: Task fetch ban đầu.
 * - initialFetchTimeoutRef: Timeout cho fetch ban đầu.
 * - rankRefreshAuthKeyRef: Auth key của lần refresh rank gần nhất.
 * - fetchLoadoutInFlightRef: Đang có fetch loadout đang chạy?
 *
 * @returns {JSX.Element} Màn hình Profile.
 */
function Profile() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: viewportWidth } = useWindowDimensions();
  const user = useUserStore((state) => state.user);
  const setUser = useUserStore((state) => state.setUser);
  const setProfileCache = useProfileCacheStore((state) => state.setProfileCache);
  const profileGridColumns = viewportWidth >= 700 ? 4 : viewportWidth < 350 ? 2 : 3;
  const profileGridCardWidth = Math.floor(
      (viewportWidth - 32 - 8 * (profileGridColumns - 1)) / profileGridColumns
  );
  const profileSkinRowCardWidth = Math.min(
      168,
      Math.max(128, Math.floor(viewportWidth * 0.36))
  );

  const hasAuth = Boolean(
      user.accessToken &&
      user.entitlementsToken &&
      user.region &&
      user.id
  );
  const authKey = React.useMemo(() => getSessionAuthKey(user), [user]);
  const cachedProfile = useProfileCacheStore(
      (state) => state.cacheByAuth[authKey] ?? null
  );
  const cachedCompetitiveRank = hasValidCompetitiveRankCache(cachedProfile)
      ? cachedProfile?.competitiveRank ?? null
      : null;
  const cachedLoadoutSnapshot = hasValidProfileLoadoutCache(cachedProfile)
      ? cachedProfile?.loadoutSnapshot ?? null
      : null;
  const [activeTab, setActiveTab] = React.useState<TabKey>("loadout");
  const [loading, setLoading] = React.useState(!cachedLoadoutSnapshot);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pickerError, setPickerError] = React.useState<string | null>(null);
  const [pickerLoading, setPickerLoading] = React.useState(false);
  const [updatingLoadout, setUpdatingLoadout] = React.useState(false);
  const [rawGuns, setRawGuns] = React.useState<PlayerLoadoutGun[]>(
      cachedLoadoutSnapshot?.Guns ?? []
  );
  const [rawSprays, setRawSprays] = React.useState<PlayerLoadoutSpray[]>(
      cachedLoadoutSnapshot?.Sprays ?? []
  );
  const [rawActiveExpressions, setRawActiveExpressions] = React.useState<
      PlayerLoadoutExpression[]
  >(
      cachedLoadoutSnapshot?.ActiveExpressions ?? []
  );
  const [identity, setIdentity] = React.useState<PlayerLoadoutIdentity | null>(
      cachedLoadoutSnapshot?.Identity ?? null
  );
  const [loadoutSnapshot, setLoadoutSnapshot] =
      React.useState<PlayerLoadoutResponse | null>(cachedLoadoutSnapshot);
  const [ownedSkinItemIds, setOwnedSkinItemIds] = React.useState<string[]>(
      cachedProfile?.ownedSkinItemIds?.length
          ? cachedProfile.ownedSkinItemIds
          : user.ownedSkinIds ?? []
  );
  const [ownedSprayItemIds, setOwnedSprayItemIds] = React.useState<string[]>(
      cachedProfile?.ownedSprayItemIds ?? []
  );
  const [ownedFlexItemIds, setOwnedFlexItemIds] = React.useState<string[]>(
      cachedProfile?.ownedFlexItemIds ?? []
  );
  const [ownedPlayerCardItemIds, setOwnedPlayerCardItemIds] = React.useState<
      string[]
  >(cachedProfile?.ownedPlayerCardItemIds ?? []);
  const [ownedPlayerTitleItemIds, setOwnedPlayerTitleItemIds] = React.useState<
      string[]
  >(cachedProfile?.ownedPlayerTitleItemIds ?? []);
  const [competitiveRank, setCompetitiveRank] =
      React.useState<CompetitiveRankSummary | null>(cachedCompetitiveRank);
  const [weaponMetadata, setWeaponMetadata] = React.useState<WeaponMetadataMap>({});
  const [searchQuery, setSearchQuery] = React.useState("");               // Search trong collection tab
  const [collectionWeaponFilter, setCollectionWeaponFilter] = React.useState("all");
  const [pickerState, setPickerState] = React.useState<PickerState | null>(null);
  const [identityPickerQuery, setIdentityPickerQuery] = React.useState(""); // Search trong identity picker
  const [activeWeaponChroma, setActiveWeaponChroma] = React.useState<{
    weapon: EquippedWeapon;
    option: OwnedSkinOption;
  } | null>(null);
  const pickerTaskRef = React.useRef<ReturnType<
      typeof InteractionManager.runAfterInteractions
  > | null>(null);
  const loadoutSnapshotRef = React.useRef<PlayerLoadoutResponse | null>(
      cachedLoadoutSnapshot
  );
  const loadoutMutationVersionRef = React.useRef(0);          // Tăng sau mỗi mutation
  const pendingLoadoutRef = React.useRef<PendingLoadoutUpdate | null>(null);
  const initialFetchTaskRef = React.useRef<ReturnType<
      typeof InteractionManager.runAfterInteractions
  > | null>(null);
  const initialFetchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
      null
  );
  const rankRefreshAuthKeyRef = React.useRef<string | null>(null);
  const fetchLoadoutInFlightRef = React.useRef(false);

  // ─── Palette màu (tính toán từ theme) ─────────────────────────────────────
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
  const regionLabel = user.region ? user.region.toUpperCase() : "VAL";

  // ─── Double-tap collapse cho stats (VP/RAD/KC) ──────────────────────────
  const [statsExpanded, setStatsExpanded] = React.useState(true);
  const statsAnim = useSharedValue(1);
  const lastRegionTapRef = React.useRef(0);

  const statsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: statsAnim.value,
    maxHeight: interpolate(statsAnim.value, [0, 1], [0, 130]),
    overflow: "hidden" as const,
    marginTop: interpolate(statsAnim.value, [0, 1], [0, 12]),
  }));

  const toggleStats = React.useCallback(() => {
    const now = Date.now();
    if (now - lastRegionTapRef.current < 400) {
      const toValue = statsExpanded ? 0 : 1;
      setStatsExpanded(!statsExpanded);
      statsAnim.value = withTiming(toValue, {
        duration: toValue === 1 ? 520 : 350,
        easing: Easing.out(Easing.cubic),
      });
    }
    lastRegionTapRef.current = now;
  }, [statsAnim, statsExpanded]);

  // ─── profileStats: các thông số hiển thị trong hero card ─────────────────
  const profileStats = React.useMemo(
      () => [
        { key: "vp", label: t("vp"), value: user.balances.vp, icon: "vp" as const },
        { key: "rad", label: t("rad"), value: user.balances.rad, icon: "rad" as const },
        { key: "kc", label: t("kc"), value: user.balances.kc, icon: "kc" as const },
      ],
      [t, user.balances.kc, user.balances.rad, user.balances.vp]
  );

  // ─── tabItems: các tab cho segmented control ──────────────────────────────
  const tabItems = React.useMemo(
      () => [
        { value: "loadout" as const, label: t("equip_page.tabs.loadout") },
        { value: "skins" as const, label: t("equip_page.tabs.skins") },
        { value: "collection" as const, label: t("equip_page.tabs.collection") },
      ],
      [t]
  );

  // ─── categoryLabels: map category → tên đã dịch ──────────────────────────
  const categoryLabels = React.useMemo(
      () =>
          CATEGORY_ORDER.reduce<Record<string, string>>((labels, category) => {
            const translationKey = `equip_page.categories.${category}`;
            const translated = t(translationKey);
            labels[category] = translated !== translationKey ? translated : category;
            return labels;
          }, {}),
      [t]
  );

  /**
   * formatCategoryLabel — Lấy tên hiển thị cho category vũ khí (đã dịch).
   * Nếu không có bản dịch, tự động format camelCase/snake_case thành text thường.
   */
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

  /**
   * syncLoadoutState — Đồng bộ toàn bộ state loadout từ response API.
   * Cập nhật: loadoutSnapshotRef, loadoutSnapshot, rawGuns, rawSprays,
   * rawActiveExpressions, identity.
   */
  const syncLoadoutState = React.useCallback((response: PlayerLoadoutResponse) => {
    loadoutSnapshotRef.current = response;
    setLoadoutSnapshot(response);
    setRawGuns(response.Guns || []);
    setRawSprays(response.Sprays || []);
    setRawActiveExpressions(response.ActiveExpressions || []);
    setIdentity(response.Identity || null);
  }, []);

  // ── Effect: Khôi phục dữ liệu từ cache ────────────────────────────────────
  React.useEffect(() => {
    if (!hasAuth || !cachedLoadoutSnapshot) {
      return;
    }

    // Đồng bộ loadout từ cache vào state
    syncLoadoutState(cachedLoadoutSnapshot);
    // Đồng bộ danh sách sở hữu
    setOwnedSkinItemIds(
        cachedProfile.ownedSkinItemIds?.length
            ? cachedProfile.ownedSkinItemIds
            : user.ownedSkinIds ?? []
    );
    setOwnedSprayItemIds(cachedProfile.ownedSprayItemIds ?? []);
    setOwnedFlexItemIds(cachedProfile.ownedFlexItemIds ?? []);
    setOwnedPlayerCardItemIds(cachedProfile.ownedPlayerCardItemIds ?? []);
    setOwnedPlayerTitleItemIds(cachedProfile.ownedPlayerTitleItemIds ?? []);
    setCompetitiveRank(cachedCompetitiveRank);
    setError(null);
    setLoading(false);
  }, [cachedCompetitiveRank, cachedLoadoutSnapshot, cachedProfile, hasAuth, syncLoadoutState, user.ownedSkinIds]);

  /**
   * fetchLoadoutData — Hàm chính để fetch toàn bộ dữ liệu profile từ API.
   *
   * Quy trình:
   * 1. Gọi playerLoadout() để lấy loadout hiện tại.
   * 2. Đồng bộ loadout ngay (render ngay khi có response).
   * 3. Song song fetch: ownedItems (6 loại) + competitive rank.
   * 4. Xử lý kết quả ownership, cập nhật danh sách sở hữu.
   * 5. Lưu vào profile cache.
   *
   * Có cơ chế optimistic update: nếu có pendingLoadout, ưu tiên hiển thị
   * loadout đã chỉnh sửa thay vì loadout từ server.
   *
   * @param {boolean} [showSpinner=true] - Hiển thị spinner loading?
   */
  const fetchLoadoutData = React.useCallback(
      async (showSpinner = true) => {
        if (!hasAuth) return;
        if (fetchLoadoutInFlightRef.current) return;

        fetchLoadoutInFlightRef.current = true;

        if (showSpinner) {
          setLoading(true);
        }
        setError(null);

        try {
          const mutationVersionAtRequest = loadoutMutationVersionRef.current;
          const response = await playerLoadout(
              user.accessToken,
              user.entitlementsToken,
              user.region,
              user.id
          );

          if (!response) {
            if (loadoutSnapshotRef.current) {
              syncLoadoutState(loadoutSnapshotRef.current);
            }
            setCompetitiveRank(
                competitiveRank ?? cachedCompetitiveRank
            );
            return;
          }

          const resolveLoadoutForDisplay = () => {
            if (
                loadoutMutationVersionRef.current !== mutationVersionAtRequest
            ) {
              return loadoutSnapshotRef.current ?? response;
            }

            const pendingLoadout = pendingLoadoutRef.current;
            if (!pendingLoadout) {
              return response;
            }

            const matchesPending = loadoutsMatch(
                response,
                pendingLoadout.loadout
            );
            const isPendingFresh =
                Date.now() - pendingLoadout.updatedAt < 8000;

            if (matchesPending || !isPendingFresh) {
              pendingLoadoutRef.current = null;
              return response;
            }

            return pendingLoadout.loadout;
          };

          // The loadout can render as soon as v3 responds. Ownership and rank
          // continue loading without holding the Profile screen spinner.
          syncLoadoutState(resolveLoadoutForDisplay());
          if (showSpinner) {
            setLoading(false);
          }

          const [ownershipResults, nextCompetitiveRank] = await Promise.all([
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
              ownedItems(
                  user.accessToken,
                  user.entitlementsToken,
                  user.region,
                  user.id,
                  VItemTypes.Flex
              ),
              ownedItems(
                  user.accessToken,
                  user.entitlementsToken,
                  user.region,
                  user.id,
                  VItemTypes.PlayerCard
              ),
              ownedItems(
                  user.accessToken,
                  user.entitlementsToken,
                  user.region,
                  user.id,
                  VItemTypes.PlayerTitle
              ),
            ]),
            fetchCompetitiveRankSummary(user).catch((err) => {
              if (__DEV__) {
                console.warn("[profile] competitive rank unavailable", err);
              }
              return null;
            }),
          ]);

          const resolvedLoadout = resolveLoadoutForDisplay();
          syncLoadoutState(resolvedLoadout);

          const currentUser = useUserStore.getState().user;
          const nextOwnedSkinIds = new Set<string>(currentUser.ownedSkinIds ?? []);
          const nextOwnedSprayIds = new Set<string>();
          const nextOwnedFlexIds = new Set<string>();
          const nextOwnedPlayerCardIds = new Set<string>();
          const nextOwnedPlayerTitleIds = new Set<string>();

          ownershipResults.forEach((result, index) => {
            if (result.status !== "fulfilled") {
              return;
            }

            let extractedIds: string[] = [];
            try {
              extractedIds = extractOwnedItemIds(result.value);
            } catch {
              extractedIds = [];
            }

            extractedIds.forEach((itemId) => {
              if (index === 2) {
                nextOwnedSprayIds.add(itemId);
                return;
              }
              if (index === 3) {
                nextOwnedFlexIds.add(itemId);
                return;
              }
              if (index === 4) {
                nextOwnedPlayerCardIds.add(itemId);
                return;
              }
              if (index === 5) {
                nextOwnedPlayerTitleIds.add(itemId);
                return;
              }

              nextOwnedSkinIds.add(itemId);
            });
          });

          const nextOwnedSkinList = Array.from(nextOwnedSkinIds);
          const nextOwnedSprayList = Array.from(nextOwnedSprayIds);
          const nextOwnedFlexList = Array.from(nextOwnedFlexIds);
          const nextOwnedPlayerCardList = Array.from(nextOwnedPlayerCardIds);
          const nextOwnedPlayerTitleList = Array.from(nextOwnedPlayerTitleIds);

          setOwnedSkinItemIds(nextOwnedSkinList);
          setOwnedSprayItemIds(nextOwnedSprayList);
          setOwnedFlexItemIds(nextOwnedFlexList);
          setOwnedPlayerCardItemIds(nextOwnedPlayerCardList);
          setOwnedPlayerTitleItemIds(nextOwnedPlayerTitleList);

          if (nextOwnedSkinIds.size > 0) {
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

          const resolvedCompetitiveRank =
              nextCompetitiveRank ?? competitiveRank ?? cachedCompetitiveRank;

          setCompetitiveRank(resolvedCompetitiveRank);
          setProfileCache({
            authKey,
            loadoutSnapshot: resolvedLoadout,
            loadoutCacheVersion: PROFILE_LOADOUT_CACHE_VERSION,
            ownedSkinItemIds: nextOwnedSkinList,
            ownedSprayItemIds: nextOwnedSprayList,
            ownedFlexItemIds: nextOwnedFlexList,
            ownedPlayerCardItemIds: nextOwnedPlayerCardList,
            ownedPlayerTitleItemIds: nextOwnedPlayerTitleList,
            competitiveRank: resolvedCompetitiveRank,
            rankCacheVersion: nextCompetitiveRank
                ? PROFILE_RANK_CACHE_VERSION
                : cachedCompetitiveRank
                    ? cachedProfile?.rankCacheVersion
                    : undefined,
            updatedAt: Date.now(),
          });
        } catch (err) {
          if (__DEV__) {
            console.warn("[profile] fetchLoadoutData failed", err);
          }
        } finally {
          fetchLoadoutInFlightRef.current = false;
          if (showSpinner) {
            setLoading(false);
          }
        }
      },
      [
        authKey,
        cachedCompetitiveRank,
        cachedProfile,
        competitiveRank,
        hasAuth,
        syncLoadoutState,
        setProfileCache,
        setUser,
        user,
      ]
  );

  // ── Effect: Fetch weapon metadata từ valorant-api.com ──────────────────────
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

  // ── Effect cleanup: Hủy các task và timeout khi unmount ─────────────────
  React.useEffect(
      () => () => {
        pickerTaskRef.current?.cancel();
        initialFetchTaskRef.current?.cancel();
        if (initialFetchTimeoutRef.current) {
          clearTimeout(initialFetchTimeoutRef.current);
          initialFetchTimeoutRef.current = null;
        }
      },
      []
  );

  // ── Effect chính: Fetch dữ liệu profile ─────────────────────────────────────
  // Logic:
  // - Nếu không có auth → reset state, hiển thị lỗi.
  // - Nếu cache còn fresh và có loadout cache + rank cache → không fetch.
  // - Nếu cache fresh nhưng thiếu rank → refresh rank (chỉ 1 lần).
  // - Nếu cache stale hoặc không có → fetch đầy đủ sau InteractionManager.
  // - Delay: 120ms nếu có cache, 260ms nếu không (để animation mượt).
  React.useEffect(() => {
    if (!hasAuth) {
      // Reset toàn bộ state khi không có auth
      setLoadoutSnapshot(null);
      setRawGuns([]);
      setRawSprays([]);
      setRawActiveExpressions([]);
      setIdentity(null);
      setOwnedSkinItemIds([]);
      setOwnedSprayItemIds([]);
      setOwnedFlexItemIds([]);
      setOwnedPlayerCardItemIds([]);
      setOwnedPlayerTitleItemIds([]);
      setCompetitiveRank(null);
      setPickerState(null);
      setIdentityPickerQuery("");
      setPickerLoading(false);
      setPickerError(null);
      setError(t("equip_page.missing_auth"));
      setLoading(!cachedLoadoutSnapshot);
      return;
    }

    const hasRankCache = hasValidCompetitiveRankCache(cachedProfile);
    const hasLoadoutCache = Boolean(cachedLoadoutSnapshot);

    if (isProfileCacheFresh(cachedProfile) && hasLoadoutCache) {
      if (hasRankCache) {
        rankRefreshAuthKeyRef.current = null;
        return; // Cache hoàn toàn fresh → không cần fetch
      }

      // Cache fresh nhưng thiếu rank → chỉ refresh rank 1 lần
      if (rankRefreshAuthKeyRef.current === authKey) {
        return;
      }

      rankRefreshAuthKeyRef.current = authKey;
    }

    // Hủy task cũ trước khi tạo mới
    initialFetchTaskRef.current?.cancel();
    if (initialFetchTimeoutRef.current) {
      clearTimeout(initialFetchTimeoutRef.current);
      initialFetchTimeoutRef.current = null;
    }

    initialFetchTaskRef.current = InteractionManager.runAfterInteractions(() => {
      initialFetchTimeoutRef.current = setTimeout(() => {
        initialFetchTimeoutRef.current = null;
        void fetchLoadoutData(!cachedLoadoutSnapshot);
      }, cachedLoadoutSnapshot ? 120 : 260);
    });

    return () => {
      initialFetchTaskRef.current?.cancel();
      initialFetchTaskRef.current = null;
      if (initialFetchTimeoutRef.current) {
        clearTimeout(initialFetchTimeoutRef.current);
        initialFetchTimeoutRef.current = null;
      }
    };
  }, [authKey, cachedLoadoutSnapshot, cachedProfile, fetchLoadoutData, hasAuth, t]);

  // ─── loadoutDetails: Map rawGuns → EquippedWeapon[] với đầy đủ metadata ──
  // Kết hợp dữ liệu từ weaponMetadata và assets để tạo object hiển thị.
  const loadoutDetails = React.useMemo<EquippedWeapon[]>(() => {
    const assets = getAssets();

    return rawGuns.map((gun) => {
      const metadata = weaponMetadata[gun.ID];
      const category = normalizeProfileWeaponCategory(resolveCategory(metadata));

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
            chroma?.displayIcon ||
            level?.displayIcon ||
            skin?.displayIcon ||
            chroma?.fullRender,
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

  // ─── loadoutSorted: Sắp xếp loadout theo category → weapon order → tên ──
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

      const weaponDiff =
          getProfileWeaponOrderIndex(a.weaponName) -
          getProfileWeaponOrderIndex(b.weaponName);
      if (weaponDiff !== 0) return weaponDiff;

      return a.weaponName.localeCompare(b.weaponName);
    });
  }, [loadoutDetails]);

  // ─── loadoutByCategory: Nhóm loadout theo category ─────────────────────────
  const loadoutByCategory = React.useMemo(
      () =>
          loadoutSorted.reduce<Record<string, EquippedWeapon[]>>((groups, weapon) => {
            const category = weapon.category || "Other";
            (groups[category] ??= []).push(weapon);
            return groups;
          }, {}),
      [loadoutSorted]
  );

  // ─── orderedLoadoutCategories: Danh sách category đã sắp xếp ──────────────
  // Categories biết trước (trong CATEGORY_ORDER) + các category lạ.
  const orderedLoadoutCategories = React.useMemo(() => {
    const knownCategories = CATEGORY_ORDER.filter(
        (category) => loadoutByCategory[category]?.length
    );
    const customCategories = Object.keys(loadoutByCategory).filter(
        (category) =>
            !CATEGORY_ORDER.includes(category as (typeof CATEGORY_ORDER)[number])
    );

    return [...knownCategories, ...customCategories];
  }, [loadoutByCategory]);

  // ─── sprayDetails: Map rawSprays → EquippedSpray[] ────────────────────────
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

  // ─── expressionDetails: Map rawActiveExpressions → EquippedExpression[] ──
  const expressionDetails = React.useMemo<EquippedExpression[]>(() => {
    const assets = getAssets();

    return rawActiveExpressions
        .map((expression, slotIndex) => {
          const typeId = expression.TypeID.toLowerCase();

          if (typeId === VItemTypes.Spray.toLowerCase()) {
            const spray = assets.sprays.find(
                (item) =>
                    item.uuid === expression.AssetID ||
                    item.levels.some((level) => level.uuid === expression.AssetID)
            );

            return {
              slotIndex,
              kind: "spray" as const,
              id: expression.AssetID,
              name: spray?.displayName || "Graffiti",
              icon:
                  spray?.fullTransparentIcon ||
                  spray?.displayIcon ||
                  spray?.fullIcon,
            };
          }

          if (typeId === VItemTypes.Flex.toLowerCase()) {
            const flex = assets.flex.find(
                (item) => item.uuid === expression.AssetID
            );

            return {
              slotIndex,
              kind: "flex" as const,
              id: expression.AssetID,
              name: flex?.displayName || "Flex",
              icon: flex?.displayIcon,
            };
          }

          return null;
        })
        .filter(Boolean) as EquippedExpression[];
  }, [rawActiveExpressions]);

  // ─── identityDetails: Thông tin identity đã enrich từ assets ──────────────
  const identityDetails = React.useMemo<IdentityDetails | null>(() => {
    if (!identity) return null;

    const assets = getAssets();
    const card = assets.cards.find((item) => item.uuid === identity.PlayerCardID);
    const title = assets.titles.find((item) => item.uuid === identity.PlayerTitleID);
    const accountLevel =
        identity.AccountLevel > 0 ? identity.AccountLevel : user.progress.level;

    return {
      cardId: identity.PlayerCardID,
      cardArt: card?.displayIcon || card?.largeArt || card?.wideArt,
      cardName: card?.displayName,
      titleName: title?.titleText || title?.displayName,
      level: accountLevel,
      hideLevel: identity.HideAccountLevel,
    };
  }, [identity, user.progress.level]);

  // ─── ownedSkinIdSet/Spray/Flex/Card/Title: Set từ danh sách ID sở hữu ──
  // Dùng để kiểm tra nhanh "có sở hữu item này không?" (O(1)).
  const ownedSkinIdSet = React.useMemo(
      () => new Set(ownedSkinItemIds),
      [ownedSkinItemIds]
  );

  const ownedSprayIdSet = React.useMemo(
      () => new Set(ownedSprayItemIds),
      [ownedSprayItemIds]
  );

  const ownedFlexIdSet = React.useMemo(
      () => new Set(ownedFlexItemIds),
      [ownedFlexItemIds]
  );

  const ownedPlayerCardIdSet = React.useMemo(
      () => new Set(ownedPlayerCardItemIds.map((itemId) => itemId.toLowerCase())),
      [ownedPlayerCardItemIds]
  );

  const ownedPlayerTitleIdSet = React.useMemo(
      () => new Set(ownedPlayerTitleItemIds.map((itemId) => itemId.toLowerCase())),
      [ownedPlayerTitleItemIds]
  );

  const ownedPlayerCardOptions = React.useMemo<OwnedPlayerCardOption[]>(() => {
    const currentCardId = identity?.PlayerCardID?.toLowerCase();
    const options: OwnedPlayerCardOption[] = getAssets()
        .cards.filter(
            (card) =>
                card.uuid.toLowerCase() === currentCardId ||
                ownedPlayerCardIdSet.has(card.uuid.toLowerCase())
        )
        .map((card) => ({
          id: card.uuid,
          name: card.displayName,
          image: card.displayIcon || card.smallArt || card.largeArt,
          selected: card.uuid.toLowerCase() === currentCardId,
        }));

    if (identity?.PlayerCardID && !options.some((option) => option.selected)) {
      options.push({
        id: identity.PlayerCardID,
        name:
            identityDetails?.cardName ||
            t("equip_page.identity.card_fallback"),
        image: identityDetails?.cardArt,
        selected: true,
      });
    }

    return options.sort((left, right) => {
      if (left.selected !== right.selected) {
        return left.selected ? -1 : 1;
      }
      return left.name.localeCompare(right.name, "vi");
    });
  }, [identity?.PlayerCardID, identityDetails, ownedPlayerCardIdSet, t]);

  const ownedPlayerTitleOptions = React.useMemo<OwnedPlayerTitleOption[]>(() => {
    const currentTitleId = identity?.PlayerTitleID?.toLowerCase();
    const options = getAssets()
        .titles.filter(
            (title) =>
                title.uuid.toLowerCase() === currentTitleId ||
                ownedPlayerTitleIdSet.has(title.uuid.toLowerCase())
        )
        .map((title) => ({
          id: title.uuid,
          name:
              title.titleText?.trim() ||
              title.displayName ||
              t("equip_page.identity.title_fallback"),
          selected: title.uuid.toLowerCase() === currentTitleId,
        }));

    if (identity?.PlayerTitleID && !options.some((option) => option.selected)) {
      options.push({
        id: identity.PlayerTitleID,
        name:
            identityDetails?.titleName ||
            t("equip_page.identity.title_fallback"),
        selected: true,
      });
    }

    return options.sort((left, right) => {
      if (left.selected !== right.selected) {
        return left.selected ? -1 : 1;
      }
      return left.name.localeCompare(right.name, "vi");
    });
  }, [identity?.PlayerTitleID, identityDetails, ownedPlayerTitleIdSet, t]);

  const equippedExpressionIdSet = React.useMemo(
      () => new Set(rawActiveExpressions.map((expression) => expression.AssetID)),
      [rawActiveExpressions]
  );

  // ─── skinWeaponMetadata: Map skinUUID → weapon metadata ──────────────────
  // Tra ngược: từ skin UUID tìm weapon cha.
  const skinWeaponMetadata = React.useMemo(() => {
    const map = new Map<string, WeaponMetadata>();

    Object.values(weaponMetadata).forEach((weapon) => {
      weapon.skins?.forEach((skin) => {
        map.set(skin.uuid, weapon);
      });
    });

    return map;
  }, [weaponMetadata]);

  /**
   * buildOwnedSkinOptions — Xây dựng danh sách OwnedSkinOption cho một vũ khí.
   * Lọc các skin mà user sở hữu, kèm chroma options, tier, upgrade level.
   */
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
            .filter(
                (skin, index, list) =>
                    list.findIndex((item) => item.uuid === skin.uuid) === index
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

              const levelIndex = skin.levels.findIndex(
                  (level) => level.uuid === selectedLevel?.uuid
              );
              const tier = getContentTierVisual(skin.contentTierUuid);
              const chromaOptions = skin.chromas
                  .filter(Boolean)
                  .filter(
                      (chroma, index, list) =>
                          list.findIndex((item) => item.uuid === chroma.uuid) === index
                  );
              const previewChroma =
                  chromaOptions.find((chroma) => chroma.uuid === weapon.chromaId) ||
                  chromaOptions[0];

              return {
                id: skin.uuid,
                skinId: skin.uuid,
                skinLevelId: selectedLevel?.uuid || weapon.skinLevelId,
                chromaId: previewChroma?.uuid || weapon.chromaId,
                name: skin.displayName,
                chromaName:
                    normalizeVariantLabel(skin.displayName, previewChroma?.displayName) ||
                    undefined,
                image:
                    previewChroma?.displayIcon ||
                    selectedLevel?.displayIcon ||
                    skin.displayIcon ||
                    previewChroma?.fullRender,
                contentTierUuid: skin.contentTierUuid,
                contentTierName: tier.label,
                upgradeLevel: levelIndex >= 0 ? levelIndex + 1 : undefined,
                maxUpgradeLevel: skin.levels.length || undefined,
                chromas: chromaOptions.map((chroma) => ({
                  id: chroma.uuid,
                  name:
                      normalizeVariantLabel(skin.displayName, chroma.displayName) ||
                      "Default",
                  swatch: chroma.swatch,
                  image: chroma.displayIcon || chroma.fullRender,
                  selected: chroma.uuid === weapon.chromaId,
                })),
                selected:
                    skin.uuid === weapon.skinId &&
                    (selectedLevel?.uuid || weapon.skinLevelId) === weapon.skinLevelId &&
                    (previewChroma?.uuid || weapon.chromaId) === weapon.chromaId,
              };
            })
            .sort((a, b) => {
              const selectedDiff = Number(b.selected) - Number(a.selected);
              if (selectedDiff !== 0) {
                return selectedDiff;
              }

              const nameDiff = a.name.localeCompare(b.name);
              if (nameDiff !== 0) {
                return nameDiff;
              }

              return (a.chromaName || "").localeCompare(b.chromaName || "");
            });

        return options;
      },
      [ownedSkinIdSet, weaponMetadata]
  );

  /**
   * buildOwnedSprayOptions — Xây dựng danh sách OwnedSprayOption.
   */
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

  /**
   * buildOwnedExpressionOptions — Xây dựng danh sách OwnedExpressionOption.
   * Hỗ trợ cả spray và flex.
   */
  const buildOwnedExpressionOptions = React.useCallback(
      (
          expression: EquippedExpression,
          kind: ExpressionKind
      ): OwnedExpressionOption[] => {
        const assets = getAssets();
        const options =
            kind === "spray"
                ? assets.sprays
                    .filter(
                        (spray) =>
                            equippedExpressionIdSet.has(spray.uuid) ||
                            ownedSprayIdSet.has(spray.uuid) ||
                            spray.levels.some(
                                (level) =>
                                    equippedExpressionIdSet.has(level.uuid) ||
                                    ownedSprayIdSet.has(level.uuid)
                            )
                    )
                    .map((spray) => ({
                      id: spray.uuid,
                      kind: "spray" as const,
                      assetId: spray.uuid,
                      name: spray.displayName,
                      icon:
                          spray.fullTransparentIcon ||
                          spray.displayIcon ||
                          spray.fullIcon,
                      selected:
                          expression.kind === "spray" &&
                          spray.uuid === expression.id,
                    }))
                : assets.flex
                    .filter(
                        (flex) =>
                            equippedExpressionIdSet.has(flex.uuid) ||
                            ownedFlexIdSet.has(flex.uuid)
                    )
                    .map((flex) => ({
                      id: flex.uuid,
                      kind: "flex" as const,
                      assetId: flex.uuid,
                      name: flex.displayName,
                      icon: flex.displayIcon,
                      selected:
                          expression.kind === "flex" && flex.uuid === expression.id,
                    }));

        return options.sort((left, right) => {
          const selectedDiff = Number(right.selected) - Number(left.selected);
          return selectedDiff || left.name.localeCompare(right.name);
        });
      },
      [equippedExpressionIdSet, ownedFlexIdSet, ownedSprayIdSet]
  );

  // ─── ownedCollection: Bộ sưu tập skin đã sở hữu ─────────────────────────────
  const ownedCollection = React.useMemo<OwnedWeaponCollectionItem[]>(() => {
    const assets = getAssets();
    const equippedBySkinId = new Map(
        loadoutDetails.map((weapon) => [weapon.skinId, weapon] as const)
    );

    const categoryWeight = (category: string) => {
      const index = CATEGORY_ORDER.indexOf(
          category as (typeof CATEGORY_ORDER)[number]
      );
      return index === -1 ? CATEGORY_ORDER.length : index;
    };

    const ownedSkins = assets.skins
        .filter((skin) => {
          if (!skin.contentTierUuid) {
            return false;
          }

          return (
              ownedSkinIdSet.has(skin.uuid) ||
              skin.levels.some((level) => ownedSkinIdSet.has(level.uuid)) ||
              skin.chromas.some((chroma) => ownedSkinIdSet.has(chroma.uuid))
          );
        })
        .map((skin) => {
          const weapon = skinWeaponMetadata.get(skin.uuid);
          const equippedWeapon = equippedBySkinId.get(skin.uuid);
          const category = normalizeProfileWeaponCategory(resolveCategory(weapon));
          const weaponName = weapon?.displayName || equippedWeapon?.weaponName || "Unknown";
          const ownedLevels = skin.levels.filter((level) =>
              ownedSkinIdSet.has(level.uuid)
          );
          const ownedChromas = skin.chromas.filter((chroma) =>
              ownedSkinIdSet.has(chroma.uuid)
          );
          const selectedLevel =
              ownedLevels[ownedLevels.length - 1] ||
              skin.levels[skin.levels.length - 1] ||
              skin.levels[0];
          const selectedChroma =
              ownedChromas[0] ||
              skin.chromas[0];
          const upgradeLevelIndex = skin.levels.findIndex(
              (level) => level.uuid === selectedLevel?.uuid
          );
          const tierVisual = getContentTierVisual(skin.contentTierUuid);

          return {
            collectionId: skin.uuid,
            weaponId: weapon?.uuid || equippedWeapon?.weaponId || skin.uuid,
            weaponName,
            category,
            skinId: skin.uuid,
            skinLevelId: selectedLevel?.uuid || equippedWeapon?.skinLevelId || "",
            chromaId: selectedChroma?.uuid || equippedWeapon?.chromaId || "",
            charmInstanceId: equippedWeapon?.charmInstanceId,
            charmId: equippedWeapon?.charmId,
            charmLevelId: equippedWeapon?.charmLevelId,
            skinName: skin.displayName,
            skinLevelName: selectedLevel?.displayName,
            chromaName: selectedChroma?.displayName,
            image:
                selectedChroma?.displayIcon ||
                selectedLevel?.displayIcon ||
                skin.displayIcon ||
                selectedChroma?.fullRender,
            buddyName: equippedWeapon?.buddyName,
            buddyIcon: equippedWeapon?.buddyIcon,
            contentTierUuid: skin.contentTierUuid,
            contentTierName: tierVisual.label,
            upgradeLevel:
                upgradeLevelIndex >= 0 ? upgradeLevelIndex + 1 : undefined,
            maxUpgradeLevel: skin.levels.length || undefined,
          };
        })
        .sort((a, b) => {
          const categoryDiff = categoryWeight(a.category) - categoryWeight(b.category);
          if (categoryDiff !== 0) {
            return categoryDiff;
          }

          const weaponDiff =
              getProfileWeaponOrderIndex(a.weaponName) -
              getProfileWeaponOrderIndex(b.weaponName);
          if (weaponDiff !== 0) {
            return weaponDiff;
          }

          const weaponNameDiff = a.weaponName.localeCompare(b.weaponName);
          if (weaponNameDiff !== 0) {
            return weaponNameDiff;
          }

          return a.skinName.localeCompare(b.skinName);
        });

    if (ownedSkins.length > 0) {
      return ownedSkins;
    }

    return loadoutSorted.map((weapon) => ({
      ...weapon,
      collectionId: weapon.skinId || weapon.weaponId,
    }));
  }, [loadoutDetails, loadoutSorted, ownedSkinIdSet, skinWeaponMetadata]);

  // ─── collectionWeaponTabs: Danh sách tab lọc vũ khí trong collection ──────
  const collectionWeaponTabs = React.useMemo(() => {
    const uniqueWeaponNames = Array.from(
        new Set(
            ownedCollection
                .map((item) => item.weaponName)
                .filter((weaponName) => weaponName?.trim().length)
        )
    );

    uniqueWeaponNames.sort((left, right) => {
      const orderDiff =
          getProfileWeaponOrderIndex(left) - getProfileWeaponOrderIndex(right);
      if (orderDiff !== 0) {
        return orderDiff;
      }

      return left.localeCompare(right);
    });

    return ["all", ...uniqueWeaponNames];
  }, [ownedCollection]);

  React.useEffect(() => {
    if (
        collectionWeaponFilter !== "all" &&
        !collectionWeaponTabs.includes(collectionWeaponFilter)
    ) {
      setCollectionWeaponFilter("all");
    }
  }, [collectionWeaponFilter, collectionWeaponTabs]);

  // ─── filteredCollection: Collection đã lọc theo tab weapon + search query ─
  const filteredCollection = React.useMemo(() => {
    const normalizedFilter = normalizeWeaponKey(collectionWeaponFilter);
    const scopedCollection =
        collectionWeaponFilter === "all"
            ? ownedCollection
            : ownedCollection.filter(
                (item) =>
                    normalizeWeaponKey(item.weaponName) === normalizedFilter
            );

    if (!searchQuery.trim()) return scopedCollection;

    const query = searchQuery.trim().toLowerCase();
    return scopedCollection.filter(
        (item) =>
            item.skinName.toLowerCase().includes(query) ||
            item.weaponName.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query)
    );
  }, [collectionWeaponFilter, ownedCollection, searchQuery]);

  /**
   * handleRefresh — Pull-to-refresh: gọi fetchLoadoutData không spinner.
   */
  const handleRefresh = React.useCallback(async () => {
    if (!hasAuth) return;

    setRefreshing(true);
    await fetchLoadoutData(false);
    setRefreshing(false);
  }, [fetchLoadoutData, hasAuth]);

  /**
   * handleDismissPicker — Đóng picker modal và reset state liên quan.
   */
  const handleDismissPicker = React.useCallback(() => {
    if (updatingLoadout) {
      return;
    }

    pickerTaskRef.current?.cancel();
    pickerTaskRef.current = null;
    setPickerLoading(false);
    setActiveWeaponChroma(null);
    setPickerState(null);
    setIdentityPickerQuery("");
    setPickerError(null);
  }, [updatingLoadout]);

  /**
   * handleOpenWeaponPicker — Mở picker chọn skin cho vũ khí.
   * Load options bất đồng bộ qua InteractionManager.
   */
  const handleOpenWeaponPicker = React.useCallback(
      (weapon: EquippedWeapon) => {
        pickerTaskRef.current?.cancel();
        setPickerError(null);
        setPickerLoading(true);
        setActiveWeaponChroma(null);
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

  const handleOpenExpressionPicker = React.useCallback(
      (expression: EquippedExpression, mode: ExpressionKind = expression.kind) => {
        pickerTaskRef.current?.cancel();
        setPickerError(null);
        setPickerLoading(true);
        React.startTransition(() => {
          setPickerState({
            type: "expression",
            expression,
            mode,
            options: [],
          });
        });

        pickerTaskRef.current = InteractionManager.runAfterInteractions(() => {
          const options = buildOwnedExpressionOptions(expression, mode);
          React.startTransition(() => {
            setPickerState({
              type: "expression",
              expression,
              mode,
              options,
            });
          });
          setPickerLoading(false);
          pickerTaskRef.current = null;
        });
      },
      [buildOwnedExpressionOptions]
  );

  const handleOpenIdentityPicker = React.useCallback(
      (type: "player-card" | "player-title") => {
        if (updatingLoadout) {
          return;
        }

        pickerTaskRef.current?.cancel();
        pickerTaskRef.current = null;
        setPickerLoading(false);
        setPickerError(null);
        setActiveWeaponChroma(null);
        setIdentityPickerQuery("");
        setPickerState(
            type === "player-card"
                ? { type: "player-card", options: ownedPlayerCardOptions }
                : { type: "player-title", options: ownedPlayerTitleOptions }
        );
      },
      [ownedPlayerCardOptions, ownedPlayerTitleOptions, updatingLoadout]
  );

  const persistLoadoutCache = React.useCallback(
      (nextLoadout: PlayerLoadoutResponse) => {
        const resolvedRank = competitiveRank ?? cachedCompetitiveRank;

        setProfileCache({
          authKey,
          loadoutSnapshot: nextLoadout,
          loadoutCacheVersion: PROFILE_LOADOUT_CACHE_VERSION,
          ownedSkinItemIds,
          ownedSprayItemIds,
          ownedFlexItemIds,
          ownedPlayerCardItemIds,
          ownedPlayerTitleItemIds,
          competitiveRank: resolvedRank,
          rankCacheVersion: resolvedRank
              ? PROFILE_RANK_CACHE_VERSION
              : cachedProfile?.rankCacheVersion,
          updatedAt: Date.now(),
        });
      },
      [
        authKey,
        cachedCompetitiveRank,
        cachedProfile?.rankCacheVersion,
        competitiveRank,
        ownedFlexItemIds,
        ownedPlayerCardItemIds,
        ownedPlayerTitleItemIds,
        ownedSkinItemIds,
        ownedSprayItemIds,
        setProfileCache,
      ]
  );

  const applyOptimisticLoadout = React.useCallback(
      (nextLoadout: PlayerLoadoutResponse) => {
        const pendingUpdate: PendingLoadoutUpdate = {
          loadout: nextLoadout,
          updatedAt: Date.now(),
        };

        pendingLoadoutRef.current = pendingUpdate;
        loadoutMutationVersionRef.current += 1;
        syncLoadoutState(nextLoadout);
        persistLoadoutCache(nextLoadout);
        return pendingUpdate;
      },
      [persistLoadoutCache, syncLoadoutState]
  );

  const rollbackOptimisticLoadout = React.useCallback(
      (
          previousLoadout: PlayerLoadoutResponse,
          pendingUpdate: PendingLoadoutUpdate
      ) => {
        if (pendingLoadoutRef.current !== pendingUpdate) {
          return;
        }

        pendingLoadoutRef.current = null;
        loadoutMutationVersionRef.current += 1;
        syncLoadoutState(previousLoadout);
        persistLoadoutCache(previousLoadout);
      },
      [persistLoadoutCache, syncLoadoutState]
  );

  const confirmLoadoutUpdate = React.useCallback(
      async (
          expectedLoadout: PlayerLoadoutResponse,
          pendingUpdate: PendingLoadoutUpdate,
          matchesExpected: (
              latest: PlayerLoadoutResponse,
              expected: PlayerLoadoutResponse
          ) => boolean = loadoutsMatch
      ) => {
        await delay(650);

        const latestLoadout = await playerLoadout(
            user.accessToken,
            user.entitlementsToken,
            user.region,
            user.id
        ).catch(() => null);

        if (
            !latestLoadout ||
            pendingLoadoutRef.current !== pendingUpdate
        ) {
          return;
        }

        const matches = matchesExpected(latestLoadout, expectedLoadout);
        if (__DEV__) {
          console.log("[profile] background loadout confirmation", { matches });
        }

        if (!matches) {
          return;
        }

        pendingLoadoutRef.current = null;
        syncLoadoutState(latestLoadout);
        persistLoadoutCache(latestLoadout);
      },
      [
        persistLoadoutCache,
        syncLoadoutState,
        user.accessToken,
        user.entitlementsToken,
        user.id,
        user.region,
      ]
  );

  const handleEquipIdentity = React.useCallback(
      async (type: "player-card" | "player-title", optionId: string) => {
        if (!hasAuth || !loadoutSnapshot || updatingLoadout) {
          return;
        }

        const identityField =
            type === "player-card" ? "PlayerCardID" : "PlayerTitleID";
        const currentLoadout = loadoutSnapshotRef.current ?? loadoutSnapshot;

        if (currentLoadout.Identity?.[identityField] === optionId) {
          setPickerState(null);
          setIdentityPickerQuery("");
          setPickerError(null);
          return;
        }

        const buildNextLoadout = (source: PlayerLoadoutResponse) => ({
          ...source,
          Identity: {
            ...source.Identity,
            [identityField]: optionId,
          },
        });

        const nextLoadout = buildNextLoadout(currentLoadout);
        const pendingUpdate = applyOptimisticLoadout(nextLoadout);
        setUpdatingLoadout(true);
        setPickerError(null);

        try {
          if (__DEV__) {
            console.log("[profile] equip identity request", {
              type,
              optionId,
            });
          }

          const response = await updatePlayerLoadoutV3First(
              user.accessToken,
              user.entitlementsToken,
              user.region,
              user.id,
              nextLoadout
          );
          const putResponse: PlayerLoadoutResponse = {
            ...response,
            Identity: {
              ...response.Identity,
              [identityField]: optionId,
            },
          };

          pendingUpdate.loadout = putResponse;
          pendingUpdate.updatedAt = Date.now();
          if (pendingLoadoutRef.current === pendingUpdate) {
            syncLoadoutState(putResponse);
            persistLoadoutCache(putResponse);
          }
          setPickerState(null);
          setIdentityPickerQuery("");

          void confirmLoadoutUpdate(
              putResponse,
              pendingUpdate,
              (latestLoadout) =>
                  latestLoadout.Identity?.[identityField] === optionId
          );
        } catch (err) {
          if (__DEV__) {
            console.error("[profile] equip identity failed", err);
          }
          rollbackOptimisticLoadout(currentLoadout, pendingUpdate);
          setPickerError(t("equip_page.error_loading"));
        } finally {
          setUpdatingLoadout(false);
        }
      },
      [
        applyOptimisticLoadout,
        confirmLoadoutUpdate,
        hasAuth,
        loadoutSnapshot,
        persistLoadoutCache,
        rollbackOptimisticLoadout,
        syncLoadoutState,
        t,
        updatingLoadout,
        user.accessToken,
        user.entitlementsToken,
        user.id,
        user.region,
      ]
  );

  const handleEquipWeapon = React.useCallback(
      async (weapon: EquippedWeapon, option: OwnedSkinOption) => {
        if (!hasAuth || !loadoutSnapshot || updatingLoadout) {
          return;
        }

        const buildNextLoadout = (source: PlayerLoadoutResponse) => {
          let weaponFound = false;
          const guns = (source.Guns || []).map((gun) => {
            if (gun.ID !== weapon.weaponId) {
              return gun;
            }

            weaponFound = true;
            return {
              ...gun,
              SkinID: option.skinId,
              SkinLevelID: option.skinLevelId,
              ChromaID: option.chromaId,
            };
          });

          return weaponFound ? { ...source, Guns: guns } : null;
        };

        const currentLoadout = loadoutSnapshotRef.current ?? loadoutSnapshot;
        const nextLoadout = buildNextLoadout(currentLoadout);
        if (!nextLoadout) {
          setPickerError(t("equip_page.error_loading"));
          return;
        }

        const pendingUpdate = applyOptimisticLoadout(nextLoadout);
        setUpdatingLoadout(true);
        setPickerError(null);

        try {
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

          const response = await updatePlayerLoadoutV3First(
              user.accessToken,
              user.entitlementsToken,
              user.region,
              user.id,
              nextLoadout
          );
          const putResponse: PlayerLoadoutResponse = {
            ...nextLoadout,
            ...response,
            Guns: (response.Guns?.length ? response.Guns : nextLoadout.Guns).map(
                (gun) =>
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

          pendingUpdate.loadout = putResponse;
          pendingUpdate.updatedAt = Date.now();
          if (pendingLoadoutRef.current === pendingUpdate) {
            syncLoadoutState(putResponse);
            persistLoadoutCache(putResponse);
          }
          setPickerState(null);
          setActiveWeaponChroma(null);

          void confirmLoadoutUpdate(
              putResponse,
              pendingUpdate,
              (latestLoadout) => {
                const latestGun = (latestLoadout.Guns || []).find(
                    (gun) => gun.ID === weapon.weaponId
                );

                return Boolean(
                    latestGun &&
                    latestGun.SkinID === option.skinId &&
                    latestGun.SkinLevelID === option.skinLevelId &&
                    latestGun.ChromaID === option.chromaId
                );
              }
          );
        } catch (err) {
          if (__DEV__) console.error(err);
          rollbackOptimisticLoadout(currentLoadout, pendingUpdate);
          setPickerError(t("equip_page.error_loading"));
        } finally {
          setUpdatingLoadout(false);
        }
      },
      [
        applyOptimisticLoadout,
        confirmLoadoutUpdate,
        hasAuth,
        loadoutSnapshot,
        persistLoadoutCache,
        rollbackOptimisticLoadout,
        syncLoadoutState,
        updatingLoadout,
        user.accessToken,
        user.entitlementsToken,
        user.id,
        user.region,
        t,
      ]
  );

  const handleEquipCollectionSkin = React.useCallback(
      (item: OwnedWeaponCollectionItem) => {
        if (updatingLoadout) {
          return;
        }

        const equippedWeapon = loadoutDetails.find(
            (weapon) => weapon.weaponId === item.weaponId
        );
        if (!equippedWeapon) {
          return;
        }

        const options = buildOwnedSkinOptions(equippedWeapon);
        const option = options.find(
            (candidate) => candidate.skinId === item.skinId
        );

        if (!option || option.selected) {
          handleOpenWeaponPicker(equippedWeapon);
          return;
        }

        setPickerLoading(false);
        setPickerError(null);
        setActiveWeaponChroma(null);
        setPickerState({
          type: "weapon",
          weapon: equippedWeapon,
          options,
        });
        void handleEquipWeapon(equippedWeapon, option);
      },
      [
        buildOwnedSkinOptions,
        handleEquipWeapon,
        handleOpenWeaponPicker,
        loadoutDetails,
        updatingLoadout,
      ]
  );

  const handleEquipSpray = React.useCallback(
      async (spray: EquippedSpray, option: OwnedSprayOption) => {
        if (!hasAuth || !loadoutSnapshot || updatingLoadout) {
          return;
        }

        const currentLoadout = loadoutSnapshotRef.current ?? loadoutSnapshot;
        const nextLoadout: PlayerLoadoutResponse = {
          ...currentLoadout,
          Sprays: (currentLoadout.Sprays || []).map((item) =>
              item.EquipSlotID === spray.slot
                  ? {
                    ...item,
                    SprayID: option.sprayId,
                    SprayLevelID: option.sprayLevelId,
                  }
                  : item
          ),
        };
        const pendingUpdate = applyOptimisticLoadout(nextLoadout);
        setUpdatingLoadout(true);
        setPickerError(null);

        try {
          if (__DEV__) {
            console.log("[profile] equip spray request", {
              slot: spray.slot,
              fromSprayId: spray.id,
              toSprayId: option.sprayId,
              toSprayLevelId: option.sprayLevelId,
            });
          }

          // This path only renders when v3 is unavailable and Riot still
          // returns the legacy Sprays slots.
          const response = await updatePlayerLoadout(
              user.accessToken,
              user.entitlementsToken,
              user.region,
              user.id,
              nextLoadout
          );
          const putResponse: PlayerLoadoutResponse = {
            ...nextLoadout,
            ...response,
            Sprays: (response.Sprays?.length
                    ? response.Sprays
                    : nextLoadout.Sprays
            ).map((item) =>
                item.EquipSlotID === spray.slot
                    ? {
                      ...item,
                      SprayID: option.sprayId,
                      SprayLevelID: option.sprayLevelId,
                    }
                    : item
            ),
          };

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

          pendingUpdate.loadout = putResponse;
          pendingUpdate.updatedAt = Date.now();
          if (pendingLoadoutRef.current === pendingUpdate) {
            syncLoadoutState(putResponse);
            persistLoadoutCache(putResponse);
          }
          setPickerState(null);

          void confirmLoadoutUpdate(
              putResponse,
              pendingUpdate,
              (latestLoadout) =>
                  latestLoadout.Sprays?.some(
                      (item) =>
                          item.EquipSlotID === spray.slot &&
                          item.SprayID === option.sprayId &&
                          sameOptionalId(item.SprayLevelID, option.sprayLevelId)
                  ) ?? false
          );
        } catch (err) {
          if (__DEV__) console.error(err);
          rollbackOptimisticLoadout(currentLoadout, pendingUpdate);
          setPickerError(t("equip_page.error_loading"));
        } finally {
          setUpdatingLoadout(false);
        }
      },
      [
        applyOptimisticLoadout,
        confirmLoadoutUpdate,
        hasAuth,
        loadoutSnapshot,
        persistLoadoutCache,
        rollbackOptimisticLoadout,
        syncLoadoutState,
        updatingLoadout,
        user.accessToken,
        user.entitlementsToken,
        user.id,
        user.region,
        t,
      ]
  );

  const handleEquipExpression = React.useCallback(
      async (
          expression: EquippedExpression,
          option: OwnedExpressionOption
      ) => {
        if (!hasAuth || !loadoutSnapshot || updatingLoadout) {
          return;
        }

        const currentLoadout = loadoutSnapshotRef.current ?? loadoutSnapshot;
        const activeExpressions = currentLoadout.ActiveExpressions ?? [];
        if (!activeExpressions[expression.slotIndex]) {
          setPickerError(t("equip_page.error_loading"));
          return;
        }

        const nextExpressions = [...activeExpressions];
        nextExpressions[expression.slotIndex] = {
          TypeID:
              option.kind === "flex" ? VItemTypes.Flex : VItemTypes.Spray,
          AssetID: option.assetId,
        };
        const nextLoadout: PlayerLoadoutResponse = {
          ...currentLoadout,
          ActiveExpressions: nextExpressions,
        };
        const pendingUpdate = applyOptimisticLoadout(nextLoadout);
        setUpdatingLoadout(true);
        setPickerError(null);

        try {
          if (__DEV__) {
            console.log("[profile] equip expression request", {
              slotIndex: expression.slotIndex,
              fromKind: expression.kind,
              fromAssetId: expression.id,
              toKind: option.kind,
              toAssetId: option.assetId,
            });
          }

          const response = await updatePlayerLoadoutV3(
              user.accessToken,
              user.entitlementsToken,
              user.region,
              user.id,
              nextLoadout
          );
          const responseExpressions = response.ActiveExpressions?.length
              ? [...response.ActiveExpressions]
              : [...nextExpressions];
          responseExpressions[expression.slotIndex] =
              nextExpressions[expression.slotIndex];
          const putResponse: PlayerLoadoutResponse = {
            ...nextLoadout,
            ...response,
            ActiveExpressions: responseExpressions,
          };

          pendingUpdate.loadout = putResponse;
          pendingUpdate.updatedAt = Date.now();
          if (pendingLoadoutRef.current === pendingUpdate) {
            syncLoadoutState(putResponse);
            persistLoadoutCache(putResponse);
          }
          setPickerState(null);

          void confirmLoadoutUpdate(
              putResponse,
              pendingUpdate,
              (latestLoadout) => {
                const latestExpression =
                    latestLoadout.ActiveExpressions?.[expression.slotIndex];
                return Boolean(
                    latestExpression &&
                    latestExpression.TypeID.toLowerCase() ===
                    nextExpressions[expression.slotIndex].TypeID.toLowerCase() &&
                    latestExpression.AssetID === option.assetId
                );
              }
          );
        } catch (err) {
          if (__DEV__) console.error(err);
          rollbackOptimisticLoadout(currentLoadout, pendingUpdate);
          setPickerError(t("equip_page.error_loading"));
        } finally {
          setUpdatingLoadout(false);
        }
      },
      [
        applyOptimisticLoadout,
        confirmLoadoutUpdate,
        hasAuth,
        loadoutSnapshot,
        persistLoadoutCache,
        rollbackOptimisticLoadout,
        syncLoadoutState,
        t,
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
            { backgroundColor: "#11181c" },
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
                      backgroundColor: active ? "#ffffff" : "transparent",
                      marginLeft: index === 0 ? 0 : 8,
                    },
                  ]}
              >
                <Text
                    style={[
                      styles.segmentLabel,
                      {
                        color: active
                            ? "#11181c"
                            : "rgba(255,255,255,0.6)",
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
      <View style={[styles.heroCard, { backgroundColor: "#1a1d24" }]}>
        <View style={styles.heroTopRow}>
          <View style={[styles.heroBadge, { backgroundColor: "rgba(48, 164, 108, 0.15)" }]}>
            <Icon name="shield-account-outline" size={14} color="#30a46c" />
            <Text style={[styles.heroBadgeText, { color: "#30a46c" }]}>{t("profile_page.hero_badge")}</Text>
          </View>
          <Pressable
              onPress={toggleStats}
              style={({ pressed }) => [
                styles.heroRegionPill,
                { backgroundColor: "rgba(255,255,255,0.1)", opacity: pressed ? 0.7 : 1 },
              ]}
          >
            <Icon name="web" size={13} color={COLORS.PURE_WHITE} />
            <Text style={styles.heroRegionText}>{regionLabel}</Text>
          </Pressable>
        </View>

        <View style={styles.heroNameRow}>
          <Text style={styles.heroTitle}>
            {user.name || t("profile_page.agent_fallback")}
          </Text>
          {user.TagLine ? (
              <View style={[styles.heroTagPill, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
                <Text style={styles.heroTagText}>#{user.TagLine}</Text>
              </View>
          ) : null}
        </View>
        <Text style={styles.heroSubtitle}>{t("profile_page.hero_subtitle")}</Text>

        <View style={styles.heroMetaRow}>
          <View style={[styles.heroMetaPill, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
            <Icon name="star-circle-outline" size={13} color="rgba(255,255,255,0.7)" />
            <Text style={[styles.heroMetaText, { color: "rgba(255,255,255,0.7)" }]}>
              {t("profile_page.level", {
                level: identityDetails?.level ?? user.progress.level,
              })}
            </Text>
          </View>
          <View style={[styles.heroMetaPill, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
            <Icon
                name={hasAuth ? "check-decagram-outline" : "alert-circle-outline"}
                size={13}
                color="rgba(255,255,255,0.7)"
            />
            <Text style={[styles.heroMetaText, { color: "rgba(255,255,255,0.7)" }]}>
              {hasAuth
                  ? t("profile_page.account_synced")
                  : t("profile_page.sign_in_required")}
            </Text>
          </View>
        </View>

        <Animated.View style={[styles.heroStatsRow, statsAnimatedStyle]}>
          {profileStats.map((stat) => (
              <View key={stat.key} style={[styles.heroStatCard, { backgroundColor: "rgba(255,255,255,0.06)" }]}>
                <View style={styles.heroStatLabelRow}>
                  <CurrencyIcon icon={stat.icon} style={styles.heroStatIcon} />
                  <Text style={styles.heroStatLabel}>{stat.label}</Text>
                </View>
                <Text style={styles.heroStatValue}>{stat.value}</Text>
              </View>
          ))}
        </Animated.View>

        <View style={styles.heroRankRow}>
          <View style={[styles.heroRankCard, { backgroundColor: "rgba(255,255,255,0.06)" }]}>
            <Text style={styles.heroRankLabel}>{t("profile_page.current_rank")}</Text>
            <View style={styles.heroRankValueRow}>
              {competitiveRank?.currentIcon ? (
                  <Image
                      cacheId={
                        competitiveRank.currentTier
                            ? `rank:${competitiveRank.currentTier}:icon`
                            : undefined
                      }
                      source={{ uri: competitiveRank.currentIcon }}
                      style={styles.heroRankIcon}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                      priority="normal"
                      recyclingKey={competitiveRank.currentIcon}
                  />
              ) : (
                  <Icon
                      name="shield-outline"
                      size={18}
                      color="rgba(255,255,255,0.6)"
                  />
              )}
              <Text style={styles.heroRankValue}>
                {competitiveRank?.currentName || t("profile_page.unrated")}
              </Text>
            </View>
          </View>

          <View style={[styles.heroRankCard, { backgroundColor: "rgba(255,255,255,0.06)" }]}>
            <Text style={styles.heroRankLabel}>{t("profile_page.peak_rank")}</Text>
            <View style={styles.heroRankValueRow}>
              {competitiveRank?.peakIcon ? (
                  <Image
                      cacheId={
                        competitiveRank.peakTier
                            ? `rank:${competitiveRank.peakTier}:icon`
                            : undefined
                      }
                      source={{ uri: competitiveRank.peakIcon }}
                      style={styles.heroRankIcon}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                      priority="normal"
                      recyclingKey={competitiveRank.peakIcon}
                  />
              ) : (
                  <Icon
                      name="shield-half-full"
                      size={18}
                      color="rgba(255,255,255,0.6)"
                  />
              )}
              <Text style={styles.heroRankValue}>
                {competitiveRank?.peakName || t("profile_page.unrated")}
              </Text>
            </View>
          </View>
        </View>
      </View>
  );

  const renderIdentitySection = () => {
    if (!identityDetails) return null;

    return (
        <View style={styles.section}>
          <View
              style={[
                styles.identityContainer,
                GLOBAL_STYLES.shadow,
                { backgroundColor: "#ffffff", borderColor: COLORS.BORDER, borderWidth: 1 },
              ]}
          >
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t("equip_page.identity.card_picker_title", {
                  defaultValue: "Ch\u1ecdn \u1ea3nh \u0111\u1ea1i di\u1ec7n",
                })}
                activeOpacity={0.86}
                disabled={updatingLoadout}
                onPress={() => handleOpenIdentityPicker("player-card")}
                style={styles.identityImageFrame}
            >
              <Image
                  cacheId={`player-card:${identityDetails.cardId}:display-icon`}
                  source={
                    identityDetails.cardArt
                        ? { uri: identityDetails.cardArt }
                        : FALLBACK_IMAGE
                  }
                  style={styles.identityImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  priority="high"
                  recyclingKey={identityDetails.cardArt}
              />
              <View style={styles.identityLevelBadge}>
                <Icon name="star-circle-outline" size={13} color="#ffffff" />
                <Text style={styles.identityLevelText}>
                  {identityDetails.level}
                </Text>
              </View>
              <View style={styles.identityEditBadge}>
                <Icon name="pencil" size={12} color={COLORS.PURE_WHITE} />
              </View>
            </TouchableOpacity>
            <View style={styles.identityInfo}>
              <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.75}
                  disabled={updatingLoadout}
                  onPress={() => handleOpenIdentityPicker("player-card")}
                  style={styles.identityCardNameRow}
              >
                <Text
                    style={[styles.identityTitle, { color: COLORS.TEXT_PRIMARY }]}
                    numberOfLines={2}
                >
                  {identityDetails.cardName ||
                      t("equip_page.identity.card_fallback")}
                </Text>
                <Icon name="pencil-outline" size={16} color={COLORS.TEXT_SECONDARY} />
              </TouchableOpacity>
              <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.75}
                  disabled={updatingLoadout}
                  onPress={() => handleOpenIdentityPicker("player-title")}
                  style={styles.identityTitleAction}
              >
                <View style={styles.identityActionText}>
                  <Text style={styles.identityActionLabel}>
                    {t("equip_page.identity.motto", {
                      defaultValue: "Kh\u1ea9u hi\u1ec7u",
                    })}
                  </Text>
                  <Text
                      style={[styles.identityActionValue, { color: COLORS.TEXT_PRIMARY }]}
                      numberOfLines={2}
                  >
                    {identityDetails.titleName ||
                        t("equip_page.identity.title_fallback")}
                  </Text>
                </View>
                <Icon name="chevron-right" size={18} color={COLORS.TEXT_SECONDARY} />
              </TouchableOpacity>
              <Text style={[styles.identityAccountLevel, { color: COLORS.TEXT_SECONDARY }]}>
                {t("equip_page.identity.account_level", {
                  level: identityDetails.level,
                  defaultValue: "C\u1ea5p t\u00e0i kho\u1ea3n: {{level}}",
                })}
              </Text>
            </View>
          </View>
        </View>
    );
  };

  const renderSpraySection = () => {
    const hasExpressionSlots = expressionDetails.length > 0;
    if (!hasExpressionSlots && sprayDetails.length === 0) return null;

    return (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: COLORS.TEXT_PRIMARY, marginTop: 12 }]}>
            {t("equip_page.expressions.equipped_title", {
              defaultValue: "Graffiti & Flex đã trang bị",
            })}
          </Text>
          <View style={styles.sprayList}>
            {hasExpressionSlots
                ? expressionDetails.map((expression) => (
                    <TouchableOpacity
                        key={`${expression.slotIndex}-${expression.kind}-${expression.id}`}
                        activeOpacity={0.9}
                        disabled={updatingLoadout}
                        onPress={() => handleOpenExpressionPicker(expression)}
                        style={[
                          styles.sprayCard,
                          GLOBAL_STYLES.shadow,
                          {
                            backgroundColor: "#ffffff",
                            borderColor: COLORS.BORDER,
                            borderWidth: 1,
                            opacity: updatingLoadout ? 0.72 : 1,
                          },
                        ]}
                    >
                      <Image
                          cacheId={`${expression.kind}:${expression.id}:display`}
                          source={
                            expression.icon ? { uri: expression.icon } : FALLBACK_IMAGE
                          }
                          style={styles.sprayImage}
                          contentFit="contain"
                          cachePolicy="memory-disk"
                          priority="normal"
                          recyclingKey={expression.icon}
                      />
                      <Text
                          style={[styles.sprayName, { color: COLORS.TEXT_PRIMARY }]}
                      >
                        {expression.kind === "flex"
                            ? t("equip_page.expressions.flex", {
                              defaultValue: "Flex",
                            })
                            : t("equip_page.expressions.graffiti", {
                              defaultValue: "Graffiti",
                            })}
                      </Text>
                      <Text
                          style={[styles.spraySlot, { color: COLORS.TEXT_SECONDARY }]}
                      >
                        {t("equip_page.expressions.slot", {
                          slot: expression.slotIndex + 1,
                          defaultValue: `Vị trí ${expression.slotIndex + 1}`,
                        })}
                      </Text>
                    </TouchableOpacity>
                ))
                : sprayDetails.map((spray) => (
                    <TouchableOpacity
                        key={`${spray.slot}-${spray.id}`}
                        activeOpacity={0.9}
                        disabled={updatingLoadout}
                        onPress={() => handleOpenSprayPicker(spray)}
                        style={[
                          styles.sprayCard,
                          GLOBAL_STYLES.shadow,
                          {
                            backgroundColor: "#ffffff",
                            borderColor: COLORS.BORDER,
                            borderWidth: 1,
                            opacity: updatingLoadout ? 0.72 : 1,
                          },
                        ]}
                    >
                      <Image
                          cacheId={`spray:${spray.id}:display`}
                          source={spray.icon ? { uri: spray.icon } : FALLBACK_IMAGE}
                          style={styles.sprayImage}
                          contentFit="contain"
                          cachePolicy="memory-disk"
                          priority="normal"
                          recyclingKey={spray.icon}
                      />
                      <Text
                          style={[styles.sprayName, { color: COLORS.TEXT_PRIMARY }]}
                      >
                        {t("equip_page.expressions.graffiti", {
                          defaultValue: "Graffiti",
                        })}
                      </Text>
                      <Text
                          style={[styles.spraySlot, { color: COLORS.TEXT_SECONDARY }]}
                      >
                        {formatSpraySlot(spray.slot, t)}
                      </Text>
                    </TouchableOpacity>
                ))}
          </View>
        </View>
    );
  };

  const renderSkinGridCard = React.useCallback(
      (weapon: EquippedWeapon) => (
          <CompactProfileSkinCard
              key={weapon.weaponId}
              weapon={weapon}
              width={profileSkinRowCardWidth}
              disabled={updatingLoadout}
              onPress={() => handleOpenWeaponPicker(weapon)}
          />
      ),
      [handleOpenWeaponPicker, profileSkinRowCardWidth, updatingLoadout]
  );

  const renderPageHeader = () => (
      <>
        <View style={styles.topHeaderRow}>
          <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("equip_page.identity.card_picker_title", {
                defaultValue: "Ch\u1ecdn \u1ea3nh \u0111\u1ea1i di\u1ec7n",
              })}
              activeOpacity={0.82}
              disabled={!identityDetails || updatingLoadout}
              onPress={() => handleOpenIdentityPicker("player-card")}
              style={styles.topAvatarButton}
          >
            <View style={styles.topAvatar}>
              {identityDetails?.cardArt ? (
                  <Image
                      cacheId={`player-card:${identityDetails.cardId}:avatar`}
                      source={{ uri: identityDetails.cardArt }}
                      style={styles.topAvatarImage}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      priority="high"
                      recyclingKey={identityDetails.cardArt}
                  />
              ) : (
                  <Text style={styles.topAvatarText}>
                    {(user.name || "V").slice(0, 1).toUpperCase()}
                  </Text>
              )}
            </View>
            {identityDetails ? (
                <View style={styles.topAvatarEditBadge}>
                  <Icon name="pencil" size={8} color={COLORS.PURE_WHITE} />
                </View>
            ) : null}
          </TouchableOpacity>
          <Text style={styles.topHeaderTitle}>Vshop</Text>
          <View style={styles.topBalancePill}>
            <Text style={styles.topBalanceText}>{user.balances.vp} {t("vp")}</Text>
          </View>
        </View>
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

  const renderSkinsTab = () =>
      renderPageScroll(
          <View style={styles.profileSkinSections}>
            {orderedLoadoutCategories.map((category) => (
                <View key={category} style={styles.profileSkinCategory}>
                  <Text
                      style={[
                        styles.profileSkinCategoryTitle,
                        { color: palette.textPrimary },
                      ]}
                  >
                    {formatCategoryLabel(category)}
                  </Text>
                  <ScrollView
                      horizontal
                      nestedScrollEnabled
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.profileSkinRow}
                  >
                    {loadoutByCategory[category].map(renderSkinGridCard)}
                  </ScrollView>
                </View>
            ))}
          </View>
      );

  const renderCollectionHeader = () => (
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
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.collectionFilterRow}
        >
          {collectionWeaponTabs.map((weaponName) => {
            const active = collectionWeaponFilter === weaponName;
            const label = weaponName === "all" ? t("gallery_page.filters.all") : weaponName;

            return (
                <TouchableOpacity
                    key={weaponName}
                    activeOpacity={0.85}
                    onPress={() => setCollectionWeaponFilter(weaponName)}
                    style={[
                      styles.collectionFilterChip,
                      active && styles.collectionFilterChipActive,
                    ]}
                >
                  <Text
                      style={[
                        styles.collectionFilterChipText,
                        active && styles.collectionFilterChipTextActive,
                      ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
            );
          })}
        </ScrollView>
      </>
  );

  const renderCollectionItem = React.useCallback(
      ({ item }: { item: OwnedWeaponCollectionItem }) => (
          <CompactProfileSkinCard
              weapon={item}
              width={profileGridCardWidth}
              disabled={updatingLoadout}
              onPress={() => handleEquipCollectionSkin(item)}
          />
      ),
      [handleEquipCollectionSkin, profileGridCardWidth, updatingLoadout]
  );

  const renderCollectionEmpty = React.useCallback(
      () => (
          <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
            {t("equip_page.empty")}
          </Text>
      ),
      [palette.textSecondary, t]
  );

  const renderCollectionTab = () => (
      <FlatList
          key={`collection-${profileGridColumns}`}
          style={styles.collectionContainer}
          data={filteredCollection}
          keyExtractor={(item) => item.collectionId}
          numColumns={profileGridColumns}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          contentContainerStyle={styles.collectionList}
          columnWrapperStyle={styles.collectionRow}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderCollectionHeader}
          ListEmptyComponent={renderCollectionEmpty}
          renderItem={renderCollectionItem}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={5}
          updateCellsBatchingPeriod={24}
      />
  );

  const renderLoadoutTab = () =>
      renderPageScroll(
          <>
            {renderIdentitySection()}
            {renderSpraySection()}
          </>
      );

  const renderPickerModal = () => {
    if (!pickerState) {
      return null;
    }

    const pickerBusy = pickerLoading || updatingLoadout;

    let title: string;
    let subtitle: string;

    switch (pickerState.type) {
      case "weapon":
        title = t("equip_page.tabs.skins");
        subtitle = pickerState.weapon.weaponName;
        break;
      case "expression":
        title = t("equip_page.expressions.picker_title", {
          defaultValue: "Ch\u1ecdn Graffiti ho\u1eb7c Flex",
        });
        subtitle = t("equip_page.expressions.slot", {
          slot: pickerState.expression.slotIndex + 1,
          defaultValue: `V\u1ecb tr\u00ed ${pickerState.expression.slotIndex + 1}`,
        });
        break;
      case "player-card":
        title = t("equip_page.identity.card_picker_title", {
          defaultValue: "Ch\u1ecdn \u1ea3nh \u0111\u1ea1i di\u1ec7n",
        });
        subtitle =
            identityDetails?.cardName || t("equip_page.identity.card_fallback");
        break;
      case "player-title":
        title = t("equip_page.identity.title_picker_title", {
          defaultValue: "Ch\u1ecdn kh\u1ea9u hi\u1ec7u",
        });
        subtitle =
            identityDetails?.titleName || t("equip_page.identity.title_fallback");
        break;
      case "spray":
      default:
        title = t("equip_page.sections.sprays");
        subtitle = formatSpraySlot(pickerState.spray.slot, t);
        break;
    }

    const normalizedIdentityQuery = identityPickerQuery.trim().toLowerCase();
    const filteredPlayerCardOptions =
        pickerState.type === "player-card"
            ? pickerState.options.filter(
                (option) =>
                    !normalizedIdentityQuery ||
                    option.name.toLowerCase().includes(normalizedIdentityQuery)
            )
            : [];
    const filteredPlayerTitleOptions =
        pickerState.type === "player-title"
            ? pickerState.options.filter(
                (option) =>
                    !normalizedIdentityQuery ||
                    option.name.toLowerCase().includes(normalizedIdentityQuery)
            )
            : [];

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

              {pickerState.type === "player-card" ||
              pickerState.type === "player-title" ? (
                  <Searchbar
                      placeholder={t("equip_page.identity.search_placeholder", {
                        defaultValue: "T\u00ecm ki\u1ebfm",
                      })}
                      value={identityPickerQuery}
                      onChangeText={setIdentityPickerQuery}
                      style={[
                        styles.identityPickerSearch,
                        {
                          backgroundColor: palette.background,
                          borderColor: palette.cardBorder,
                        },
                      ]}
                      inputStyle={{ color: palette.textPrimary }}
                      iconColor={palette.textSecondary}
                      autoCorrect={false}
                  />
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
                                onLongPress={() =>
                                    !pickerBusy &&
                                    option.chromas.length > 0 &&
                                    setActiveWeaponChroma({
                                      weapon: pickerState.weapon,
                                      option,
                                    })
                                }
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
                                    cacheId={`skin-image:${
                                        option.chromaId || option.skinLevelId || option.id
                                    }:display`}
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
                              {option.chromas.length > 0 ? (
                                  <View style={styles.pickerChipHintRow}>
                                    {option.chromas.slice(0, 3).map((chroma) => (
                                        <View key={chroma.id} style={styles.pickerChipHint}>
                                          <Image
                                              cacheId={`skin-chroma:${chroma.id}:swatch`}
                                              source={
                                                chroma.swatch
                                                    ? { uri: chroma.swatch }
                                                    : chroma.image
                                                        ? { uri: chroma.image }
                                                        : FALLBACK_IMAGE
                                              }
                                              style={styles.pickerChipHintImage}
                                              contentFit="cover"
                                          />
                                        </View>
                                    ))}
                                    {option.chromas.length > 3 ? (
                                        <View style={styles.pickerChipHintMore}>
                                          <Text
                                              style={[
                                                styles.pickerChipHintMoreText,
                                                { color: palette.textPrimary },
                                              ]}
                                          >
                                            +{option.chromas.length - 3}
                                          </Text>
                                        </View>
                                    ) : null}
                                  </View>
                              ) : null}
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
                                            ? t("profile_page.level", { level: `${option.upgradeLevel}/${option.maxUpgradeLevel}` })
                                            : t("profile_page.level", { level: option.upgradeLevel })}
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
                                    {t("equip_page.tabs.skins")}
                                  </Text>
                              ) : null}
                            </TouchableOpacity>
                        );
                      }}
                  />
              ) : pickerState.type === "expression" ? (
                  <>
                    <View
                        style={[
                          styles.expressionPickerTabs,
                          {
                            backgroundColor: palette.chipBackground,
                            borderColor: palette.cardBorder,
                          },
                        ]}
                    >
                      {(["spray", "flex"] as const).map((mode) => {
                        const active = pickerState.mode === mode;

                        return (
                            <TouchableOpacity
                                key={mode}
                                activeOpacity={0.85}
                                disabled={pickerBusy}
                                onPress={() =>
                                    handleOpenExpressionPicker(
                                        pickerState.expression,
                                        mode
                                    )
                                }
                                style={[
                                  styles.expressionPickerTab,
                                  {
                                    backgroundColor: active
                                        ? COLORS.PURE_BLACK
                                        : "transparent",
                                  },
                                ]}
                            >
                              <Text
                                  style={[
                                    styles.expressionPickerTabText,
                                    {
                                      color: active
                                          ? COLORS.PURE_WHITE
                                          : palette.textSecondary,
                                    },
                                  ]}
                              >
                                {mode === "flex"
                                    ? t("equip_page.expressions.flex", {
                                      defaultValue: "Flex",
                                    })
                                    : t("equip_page.expressions.graffiti", {
                                      defaultValue: "Graffiti",
                                    })}
                              </Text>
                            </TouchableOpacity>
                        );
                      })}
                    </View>
                    <FlatList
                        data={pickerState.options}
                        keyExtractor={(option) =>
                            `${pickerState.mode}-${option.id}`
                        }
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
                                  {pickerState.mode === "flex"
                                      ? t("equip_page.expressions.no_flex", {
                                        defaultValue: "Không tìm thấy Flex đã sở hữu.",
                                      })
                                      : t("equip_page.expressions.no_graffiti", {
                                        defaultValue:
                                            "Không tìm thấy Graffiti đã sở hữu.",
                                      })}
                                </Text>
                            )}
                          </View>
                        }
                        renderItem={({ item: option }) => (
                            <TouchableOpacity
                                activeOpacity={0.9}
                                disabled={pickerBusy}
                                onPress={() =>
                                    handleEquipExpression(
                                        pickerState.expression,
                                        option
                                    )
                                }
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
                                    cacheId={`${option.kind}:${option.id}:display`}
                                    source={
                                      option.icon ? { uri: option.icon } : FALLBACK_IMAGE
                                    }
                                    style={styles.pickerOptionImage}
                                    contentFit="contain"
                                    cachePolicy="memory-disk"
                                    transition={90}
                                />
                              </View>
                              {option.selected ? (
                                  <Text
                                      style={[
                                        styles.pickerSelectedText,
                                        { color: palette.accent },
                                      ]}
                                  >
                                    {t("equip_page.expressions.equipped", {
                                      defaultValue: "Đang trang bị",
                                    })}
                                  </Text>
                              ) : null}
                            </TouchableOpacity>
                        )}
                    />
                  </>
              ) : pickerState.type === "player-card" ? (
                  <FlatList
                      data={filteredPlayerCardOptions}
                      keyExtractor={(option) => option.id}
                      numColumns={2}
                      style={styles.pickerList}
                      contentContainerStyle={styles.pickerListContent}
                      columnWrapperStyle={styles.pickerGridRow}
                      showsVerticalScrollIndicator={false}
                      removeClippedSubviews
                      initialNumToRender={10}
                      maxToRenderPerBatch={8}
                      windowSize={7}
                      ListEmptyComponent={
                        <View style={styles.pickerEmptyState}>
                          <Text
                              style={[
                                styles.pickerEmptyText,
                                { color: palette.textSecondary },
                              ]}
                          >
                            {t("equip_page.identity.no_cards", {
                              defaultValue: "Kh\u00f4ng t\u00ecm th\u1ea5y th\u1ebb ng\u01b0\u1eddi ch\u01a1i.",
                            })}
                          </Text>
                        </View>
                      }
                      renderItem={({ item: option }) => (
                          <TouchableOpacity
                              accessibilityRole="button"
                              accessibilityState={{ selected: option.selected }}
                              activeOpacity={0.86}
                              disabled={pickerBusy}
                              onPress={() => handleEquipIdentity("player-card", option.id)}
                              style={[
                                styles.identityPlayerCardOption,
                                {
                                  backgroundColor: palette.background,
                                  borderColor: option.selected
                                      ? palette.accent
                                      : palette.cardBorder,
                                  opacity: pickerBusy ? 0.68 : 1,
                                },
                              ]}
                          >
                            <View
                                style={[
                                  styles.identityPlayerCardVisual,
                                  { backgroundColor: palette.chipBackground },
                                ]}
                            >
                              <Image
                                  cacheId={`player-card:${option.id}:picker`}
                                  source={option.image ? { uri: option.image } : FALLBACK_IMAGE}
                                  style={styles.identityPlayerCardImage}
                                  contentFit="cover"
                                  cachePolicy="memory-disk"
                                  recyclingKey={option.id}
                              />
                              {option.selected ? (
                                  <View
                                      style={[
                                        styles.identityPickerSelectedBadge,
                                        { backgroundColor: palette.accent },
                                      ]}
                                  >
                                    <Icon name="check" size={13} color={COLORS.PURE_WHITE} />
                                  </View>
                              ) : null}
                            </View>
                            <Text
                                style={[
                                  styles.identityPlayerCardName,
                                  { color: palette.textPrimary },
                                ]}
                                numberOfLines={2}
                            >
                              {option.name}
                            </Text>
                          </TouchableOpacity>
                      )}
                  />
              ) : pickerState.type === "player-title" ? (
                  <FlatList
                      data={filteredPlayerTitleOptions}
                      keyExtractor={(option) => option.id}
                      style={styles.pickerList}
                      contentContainerStyle={styles.identityTitleListContent}
                      showsVerticalScrollIndicator={false}
                      removeClippedSubviews
                      initialNumToRender={12}
                      maxToRenderPerBatch={10}
                      windowSize={7}
                      ListEmptyComponent={
                        <View style={styles.pickerEmptyState}>
                          <Text
                              style={[
                                styles.pickerEmptyText,
                                { color: palette.textSecondary },
                              ]}
                          >
                            {t("equip_page.identity.no_titles", {
                              defaultValue: "Kh\u00f4ng t\u00ecm th\u1ea5y kh\u1ea9u hi\u1ec7u.",
                            })}
                          </Text>
                        </View>
                      }
                      renderItem={({ item: option }) => (
                          <TouchableOpacity
                              accessibilityRole="button"
                              accessibilityState={{ selected: option.selected }}
                              activeOpacity={0.78}
                              disabled={pickerBusy}
                              onPress={() => handleEquipIdentity("player-title", option.id)}
                              style={[
                                styles.identityTitleOption,
                                {
                                  backgroundColor: option.selected
                                      ? palette.chipBackground
                                      : palette.card,
                                  borderColor: option.selected
                                      ? palette.accent
                                      : palette.cardBorder,
                                  opacity: pickerBusy ? 0.68 : 1,
                                },
                              ]}
                          >
                            <Text
                                style={[
                                  styles.identityTitleOptionText,
                                  { color: palette.textPrimary },
                                ]}
                                numberOfLines={2}
                            >
                              {option.name}
                            </Text>
                            <Icon
                                name={option.selected ? "check-circle" : "chevron-right"}
                                size={20}
                                color={
                                  option.selected ? palette.accent : palette.textSecondary
                                }
                            />
                          </TouchableOpacity>
                      )}
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
                                  cacheId={`spray:${option.id}:display`}
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
                                  {t("equip_page.sections.sprays")}
                                </Text>
                            ) : null}
                          </TouchableOpacity>
                      )}
                  />
              )}

              {pickerState.type === "weapon" && activeWeaponChroma ? (
                  <View
                      style={[
                        styles.chromaPanel,
                        {
                          backgroundColor: palette.background,
                          borderColor: palette.cardBorder,
                        },
                      ]}
                  >
                    <TouchableOpacity
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="Đóng bảng chọn màu"
                        onPress={() => setActiveWeaponChroma(null)}
                        style={[
                          styles.chromaPanelClose,
                          {
                            backgroundColor: palette.chipBackground,
                            borderColor: palette.cardBorder,
                          },
                        ]}
                    >
                      <Icon name="close" size={16} color={palette.textPrimary} />
                    </TouchableOpacity>
                    <Text
                        style={[styles.chromaPanelTitle, { color: palette.textPrimary }]}
                    >
                      Chọn màu
                    </Text>
                    <Text
                        style={[
                          styles.chromaPanelSubtitle,
                          { color: palette.textSecondary },
                        ]}
                    >
                      {activeWeaponChroma.option.name}
                    </Text>
                    <View style={styles.chromaChipRow}>
                      {activeWeaponChroma.option.chromas.map((chroma) => (
                          <TouchableOpacity
                              key={chroma.id}
                              activeOpacity={0.85}
                              disabled={pickerBusy}
                              onPress={() =>
                                  handleEquipWeapon(activeWeaponChroma.weapon, {
                                    ...activeWeaponChroma.option,
                                    chromaId: chroma.id,
                                    chromaName: chroma.name,
                                    image: chroma.image || activeWeaponChroma.option.image,
                                    selected: chroma.selected,
                                  })
                              }
                              style={[
                                styles.chromaChip,
                                {
                                  backgroundColor: chroma.selected
                                      ? palette.accent
                                      : palette.chipBackground,
                                  borderColor: chroma.selected
                                      ? palette.accent
                                      : palette.cardBorder,
                                  opacity: pickerBusy ? 0.72 : 1,
                                },
                              ]}
                          >
                            <View style={styles.chromaChipPreview}>
                              <Image
                                  cacheId={`skin-chroma:${chroma.id}:swatch`}
                                  source={
                                    chroma.swatch
                                        ? { uri: chroma.swatch }
                                        : chroma.image
                                            ? { uri: chroma.image }
                                            : FALLBACK_IMAGE
                                  }
                                  style={styles.chromaChipPreviewImage}
                                  contentFit="cover"
                              />
                            </View>
                            <Text
                                style={[
                                  styles.chromaChipText,
                                  {
                                    color: chroma.selected
                                        ? COLORS.PURE_WHITE
                                        : palette.textPrimary,
                                  },
                                ]}
                            >
                              {chroma.name}
                            </Text>
                          </TouchableOpacity>
                      ))}
                    </View>
                  </View>
              ) : null}
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
  } else if (
      activeTab !== "loadout" &&
      loadoutSorted.length === 0
  ) {
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

// ─── Styles ────────────────────────────────────────────────────────────────────
// Ghi chú: Các style được đặt tên theo mục đích sử dụng.
// Các style cho picker modal bắt đầu bằng "picker", cho hero card bắt đầu bằng "hero",
// cho collection bắt đầu bằng "collection", cho skin/profile bắt đầu bằng "profileSkin",
// cho identity bắt đầu bằng "identity", cho spray bắt đầu bằng "spray",
// cho chroma panel bắt đầu bằng "chroma", cho segment control bắt đầu bằng "segment".

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  topAvatarButton: {
    width: 42,
    height: 42,
    position: "relative",
  },
  topAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.PURE_BLACK,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  topAvatarImage: {
    width: "100%",
    height: "100%",
  },
  topAvatarEditBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.PURE_BLACK,
    borderWidth: 2,
    borderColor: COLORS.SURFACE,
  },
  topAvatarText: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.PURE_WHITE,
  },
  topHeaderTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
    letterSpacing: -0.5,
  },
  topBalancePill: {
    backgroundColor: COLORS.PURE_BLACK,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  topBalanceText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.PURE_WHITE,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
    gap: 8,
  },
  heroStatCard: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 18,
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
    marginTop: 8,
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.PURE_WHITE,
  },
  heroRankRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 10,
  },
  heroRankCard: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroRankLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.72)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  heroRankValueRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  heroRankIcon: {
    width: 22,
    height: 22,
    marginRight: 6,
  },
  heroRankValue: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.PURE_WHITE,
    flexShrink: 1,
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
  identityPickerSearch: {
    minHeight: 44,
    marginBottom: 12,
    borderRadius: 8,
    elevation: 0,
    borderWidth: 1,
  },
  identityPlayerCardOption: {
    width: "48%",
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    marginBottom: 12,
  },
  identityPlayerCardVisual: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
  },
  identityPlayerCardImage: {
    width: "100%",
    height: "100%",
  },
  identityPickerSelectedBadge: {
    position: "absolute",
    right: 7,
    top: 7,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  identityPlayerCardName: {
    minHeight: 34,
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  identityTitleListContent: {
    paddingBottom: 8,
  },
  identityTitleOption: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  identityTitleOptionText: {
    flex: 1,
    paddingRight: 12,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  expressionPickerTabs: {
    flexDirection: "row",
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    padding: 4,
    marginBottom: 12,
  },
  expressionPickerTab: {
    flex: 1,
    minHeight: 40,
    borderRadius: RADIUS.chip,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  expressionPickerTabText: {
    fontSize: 13,
    fontWeight: "700",
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
  pickerOptionSubtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
  },
  pickerChipHintRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 2,
  },
  pickerChipHint: {
    width: 16,
    height: 16,
    borderRadius: 8,
    overflow: "hidden",
    marginRight: 4,
    borderWidth: 1,
    borderColor: "rgba(23,26,31,0.08)",
  },
  pickerChipHintImage: {
    width: "100%",
    height: "100%",
  },
  pickerChipHintMore: {
    minWidth: 22,
    height: 16,
    paddingHorizontal: 5,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    marginRight: 4,
    borderWidth: 1,
    borderColor: "rgba(23,26,31,0.08)",
  },
  pickerChipHintMoreText: {
    fontSize: 10,
    fontWeight: "700",
  },
  pickerChipHintText: {
    marginLeft: 4,
    fontSize: 10,
    fontWeight: "600",
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
  chromaPanel: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    position: "relative",
  },
  chromaPanelClose: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    zIndex: 1,
  },
  chromaPanelTitle: {
    fontSize: 14,
    fontWeight: "700",
    paddingRight: 34,
  },
  chromaPanelSubtitle: {
    marginTop: 2,
    fontSize: 12,
    paddingRight: 34,
  },
  chromaChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
  },
  chromaChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  chromaChipPreview: {
    width: 18,
    height: 18,
    borderRadius: 9,
    overflow: "hidden",
    marginRight: 8,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  chromaChipPreviewImage: {
    width: "100%",
    height: "100%",
  },
  chromaChipText: {
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
  identityImageFrame: {
    width: 150,
    height: 150,
    position: "relative",
  },
  identityImage: {
    width: "100%",
    height: "100%",
  },
  identityLevelBadge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    minWidth: 48,
    height: 28,
    borderRadius: 999,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(26, 29, 36, 0.86)",
  },
  identityLevelText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 4,
  },
  identityEditBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(26, 29, 36, 0.86)",
  },
  identityInfo: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "center",
  },
  identityCardNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  identityTitle: {
    flex: 1,
    paddingRight: 8,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
  },
  identityTitleAction: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  identityActionText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  identityActionLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 10,
    fontWeight: "700",
  },
  identityActionValue: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
  },
  identityAccountLevel: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "600",
  },
  sprayList: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  sprayCard: {
    width: "48%",
    marginBottom: 12,
    borderRadius: RADIUS.card,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  sprayImage: {
    width: 77,
    height: 77,
    marginBottom: 10,
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
  profileSkinSections: {
    gap: 16,
  },
  profileSkinCategory: {
    gap: 8,
  },
  profileSkinCategoryTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  profileSkinRow: {
    gap: 8,
    paddingRight: 8,
  },
  profileSkinCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    overflow: "hidden",
  },
  profileSkinVisual: {
    aspectRatio: 1.45,
    alignItems: "center",
    borderBottomWidth: 1,
    justifyContent: "center",
    padding: 8,
    position: "relative",
  },
  profileSkinImage: {
    width: "100%",
    height: "100%",
  },
  profileSkinTierBadge: {
    borderRadius: 4,
    left: 6,
    maxWidth: "58%",
    paddingHorizontal: 5,
    paddingVertical: 3,
    position: "absolute",
    top: 6,
    zIndex: 1,
  },
  profileSkinTierText: {
    fontSize: 8,
    fontWeight: "900",
  },
  profileSkinLevelBadge: {
    backgroundColor: COLORS.PURE_BLACK,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
    position: "absolute",
    right: 6,
    top: 6,
    zIndex: 1,
  },
  profileSkinLevelText: {
    color: COLORS.PURE_WHITE,
    fontSize: 8,
    fontWeight: "900",
  },
  profileSkinContent: {
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 8,
  },
  profileSkinWeaponName: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 9,
    fontWeight: "600",
    marginBottom: 2,
  },
  profileSkinName: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 14,
    minHeight: 28,
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
  collectionFilterRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 2,
  },
  collectionFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginRight: 8,
  },
  collectionFilterChipActive: {
    backgroundColor: COLORS.PURE_BLACK,
    borderColor: COLORS.PURE_BLACK,
  },
  collectionFilterChipText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: "700",
  },
  collectionFilterChipTextActive: {
    color: COLORS.PURE_WHITE,
  },
  collectionRow: {
    gap: 8,
    paddingHorizontal: 16,
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

