import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import {
  ActivityIndicator,
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { captureRef } from "react-native-view-shot";

import { CachedImage } from "~/components/CachedImage";
import {
  WEAPON_NAME_ORDER,
  type OwnedWeaponCollectionItem,
} from "~/components/GalleryProfile";
import { getContentTierVisual } from "~/utils/content-tier";
import type { CompetitiveRankSummary } from "~/utils/profile-cache";

const BASE_WIDTH = 360;
const OUTPUT_WIDTH_PX = 1080;
const GRID_COLUMNS = 6;
const GRID_GAP = 3;
const PAGE_PADDING = 8;
const IMAGE_LOAD_TIMEOUT_MS = 4_000;
const EXPORT_RENDER_BATCH_SIZE = 24;
const EXPORT_RENDER_BATCH_DELAY_MS = 16;
const EXPORTABLE_TIER_KEYS = new Set(["premium", "exclusive", "ultra"]);
const EXPORTABLE_TIER_UUIDS = new Set([
  "60bca009-4182-7998-dee7-b8a2558dc369",
  "e046854e-406c-37f4-6607-19a9ba8426fc",
  "411e4a55-4e59-7757-41f0-86a53f101bb5",
]);
const TIER_SORT_PRIORITY: Record<string, number> = {
  ultra: 0,
  exclusive: 1,
  premium: 2,
};
const WEAPON_SORT_PRIORITY = new Map(
  WEAPON_NAME_ORDER.map((weaponName, index) => [
    weaponName.trim().toLowerCase(),
    index,
  ])
);

type CheckerBalances = {
  vp: number;
  rad: number;
  kc: number;
};

export type CollectionCheckerProfile = {
  gameName: string;
  tagLine?: string;
  region: string;
  level: number;
  avatarUri?: string;
  avatarCacheId?: string;
  rank: CompetitiveRankSummary | null;
  balances: CheckerBalances;
};

type CollectionCheckerExportProps = {
  items: OwnedWeaponCollectionItem[];
  profile: CollectionCheckerProfile;
  disabled?: boolean;
  children: React.ReactNode;
};

type CheckerStyles = ReturnType<typeof createCheckerStyles>;

type MediaLibraryModule = typeof import("expo-media-library");

const getMediaLibrary = (): MediaLibraryModule => {
  if (Platform.OS === "web") {
    throw new Error("Media library is unavailable on web.");
  }

  return require("expo-media-library") as MediaLibraryModule;
};

type CollectionExportContextValue = {
  disabled: boolean;
  exporting: boolean;
  hasExportableItems: boolean;
  onDownload: () => void;
  styles: CheckerStyles;
};

const CollectionExportContext =
  React.createContext<CollectionExportContextValue | null>(null);

const TIER_COLORS: Record<string, string> = {
  ultra: "#d9a934",
  exclusive: "#c77946",
  premium: "#db4f91",
  deluxe: "#37c3a1",
  select: "#4d95d8",
  standard: "#777284",
};

const formatGeneratedAt = (timestamp: number) => {
  const date = new Date(timestamp);
  const pad = (value: number) => value.toString().padStart(2, "0");

  return `${pad(date.getHours())}:${pad(date.getMinutes())} - ${pad(
    date.getDate()
  )}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);

const getTierKey = (item: OwnedWeaponCollectionItem) =>
  getContentTierVisual(item.contentTierUuid, item.contentTierName)
    .label
    .trim()
    .toLowerCase();

const isExportableTier = (item: OwnedWeaponCollectionItem) => {
  const tierUuid = item.contentTierUuid?.trim().toLowerCase();

  if (tierUuid) {
    return EXPORTABLE_TIER_UUIDS.has(tierUuid);
  }

  return EXPORTABLE_TIER_KEYS.has(getTierKey(item));
};

const compareExportItems = (
  left: OwnedWeaponCollectionItem,
  right: OwnedWeaponCollectionItem
) => {
  const leftWeaponName = left.weaponName.trim().toLowerCase();
  const rightWeaponName = right.weaponName.trim().toLowerCase();
  const leftWeaponOrder =
    WEAPON_SORT_PRIORITY.get(leftWeaponName) ?? WEAPON_NAME_ORDER.length;
  const rightWeaponOrder =
    WEAPON_SORT_PRIORITY.get(rightWeaponName) ?? WEAPON_NAME_ORDER.length;

  if (leftWeaponOrder !== rightWeaponOrder) {
    return leftWeaponOrder - rightWeaponOrder;
  }

  if (leftWeaponName !== rightWeaponName) {
    return leftWeaponName.localeCompare(rightWeaponName);
  }

  const tierOrder =
    (TIER_SORT_PRIORITY[getTierKey(left)] ?? Number.MAX_SAFE_INTEGER) -
    (TIER_SORT_PRIORITY[getTierKey(right)] ?? Number.MAX_SAFE_INTEGER);

  if (tierOrder !== 0) {
    return tierOrder;
  }

  return left.skinName.localeCompare(right.skinName);
};

function CheckerImage({
  cacheId,
  uri,
  style,
  contentFit = "contain",
  onReady,
  readyKey = cacheId,
}: {
  cacheId: string;
  uri: string;
  style: React.ComponentProps<typeof CachedImage>["style"];
  contentFit?: "contain" | "cover";
  onReady: (key: string) => void;
  readyKey?: string;
}) {
  const handleReady = React.useCallback(
    () => onReady(readyKey),
    [onReady, readyKey]
  );

  return (
    <CachedImage
      cacheId={cacheId}
      source={{ uri }}
      style={style}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      priority="normal"
      recyclingKey={cacheId}
      onError={handleReady}
      onLoadEnd={handleReady}
    />
  );
}

function BrandMark({ styles }: { styles: CheckerStyles }) {
  return (
    <View style={styles.brandMark}>
      <Text style={styles.brandMarkText}>V</Text>
    </View>
  );
}

function CheckerHeader({
  profile,
  styles,
  onImageReady,
}: {
  profile: CollectionCheckerProfile;
  styles: CheckerStyles;
  onImageReady: (key: string) => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.accentLine} />
      {profile.avatarUri ? (
        <CheckerImage
          cacheId={
            profile.avatarCacheId ||
            `collection-avatar:${profile.avatarUri}`
          }
          readyKey="header-art"
          uri={profile.avatarUri}
          style={styles.headerArt}
          contentFit="cover"
          onReady={onImageReady}
        />
      ) : null}
      <View style={styles.headerArtShade} />
      <View style={styles.brandRow}>
        <BrandMark styles={styles} />
        <View>
          <Text style={styles.brandEyebrow}>VSHOP.APP</Text>
          <Text style={styles.brandTitle}>COLLECTION</Text>
          <Text style={styles.brandMeta}>VALORANT   ·   SKIN   ·   COLLECTION</Text>
        </View>
      </View>
    </View>
  );
}

function CheckerProfile({
  profile,
  generatedAt,
  styles,
  onImageReady,
}: {
  profile: CollectionCheckerProfile;
  generatedAt: number;
  styles: CheckerStyles;
  onImageReady: (key: string) => void;
}) {
  const riotId = `${profile.gameName || "VALORANT"}${
    profile.tagLine ? `#${profile.tagLine}` : ""
  }`;

  return (
    <View style={styles.profilePanel}>
      <View style={styles.panelAccent} />
      <View style={styles.avatarFrame}>
        {profile.avatarUri ? (
          <CheckerImage
            cacheId={
              profile.avatarCacheId ||
              `collection-avatar:${profile.avatarUri}`
            }
            readyKey="profile-avatar"
            uri={profile.avatarUri}
            style={styles.avatar}
            contentFit="cover"
            onReady={onImageReady}
          />
        ) : (
          <Text style={styles.avatarFallback}>
            {(profile.gameName || "V").slice(0, 1).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.profileCopy}>
        <Text style={styles.profileLabel}>RIOT ID</Text>
        <Text style={styles.profileName} numberOfLines={1}>
          {riotId}
        </Text>
        <Text style={styles.profileMeta} numberOfLines={1}>
          REGION {profile.region || "VAL"}     CẬP NHẬT{" "}
          {formatGeneratedAt(generatedAt)}
        </Text>
      </View>
      <View style={styles.levelBlock}>
        <Text style={styles.levelLabel}>LEVEL</Text>
        <Text style={styles.levelValue}>{profile.level}</Text>
        <View style={styles.levelUnderline} />
      </View>
    </View>
  );
}

function StatCell({
  label,
  value,
  color,
  wide,
  styles,
}: {
  label: string;
  value: string | number;
  color?: string;
  wide?: boolean;
  styles: CheckerStyles;
}) {
  return (
    <View style={[styles.statCell, wide && styles.statCellWide]}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.statValue, color ? { color } : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function CheckerSummary({
  profile,
  items,
  styles,
  onImageReady,
}: {
  profile: CollectionCheckerProfile;
  items: OwnedWeaponCollectionItem[];
  styles: CheckerStyles;
  onImageReady: (key: string) => void;
}) {
  const tierCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      ultra: 0,
      exclusive: 0,
      premium: 0,
      deluxe: 0,
      select: 0,
    };

    items.forEach((item) => {
      const tier = getTierKey(item);
      if (tier in counts) counts[tier] += 1;
    });

    return counts;
  }, [items]);

  return (
    <View style={styles.summaryPanel}>
      <View style={styles.rankBlock}>
        {profile.rank?.currentIcon ? (
          <CheckerImage
            cacheId={
              profile.rank.currentTier
                ? `rank:${profile.rank.currentTier}:icon`
                : `rank:${profile.rank.currentIcon}:icon`
            }
            readyKey="current-rank"
            uri={profile.rank.currentIcon}
            style={styles.rankIcon}
            onReady={onImageReady}
          />
        ) : (
          <Icon name="shield-outline" size={styles.rankIcon.width} color="#9fa6b4" />
        )}
        <View style={styles.rankCopy}>
          <Text style={styles.rankSeason}>CURRENT RANK</Text>
          <Text style={styles.rankName} numberOfLines={1}>
            {profile.rank?.currentName || "UNRATED"}
          </Text>
          <Text style={styles.rankPeak} numberOfLines={1}>
            PEAK {profile.rank?.peakName || "UNRATED"}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCell
          label="SKINS"
          value={items.length}
          wide
          styles={styles}
        />
        {(["ultra", "exclusive", "premium", "deluxe", "select"] as const).map(
          (tier) => (
            <StatCell
              key={tier}
              label={tier.slice(0, 1).toUpperCase()}
              value={tierCounts[tier]}
              color={TIER_COLORS[tier]}
              styles={styles}
            />
          )
        )}
        <StatCell
          label="VP"
          value={formatNumber(profile.balances.vp)}
          color="#e94c9c"
          wide
          styles={styles}
        />
        <StatCell
          label="RP"
          value={formatNumber(profile.balances.rad)}
          color="#4fd9bf"
          wide
          styles={styles}
        />
        <StatCell
          label="KC"
          value={formatNumber(profile.balances.kc)}
          color="#38d8c0"
          wide
          styles={styles}
        />
      </View>
    </View>
  );
}

function PromoCard({ styles }: { styles: CheckerStyles }) {
  return (
    <View style={[styles.skinCard, styles.promoCard]}>
      <BrandMark styles={styles} />
      <Text style={styles.promoTitle}>MY SKINS</Text>
      <Text style={styles.promoAt}>TẠI</Text>
      <Text style={styles.promoBrand}>Vshop</Text>
    </View>
  );
}

function CheckerSkinCard({
  item,
  styles,
  onImageReady,
}: {
  item: OwnedWeaponCollectionItem;
  styles: CheckerStyles;
  onImageReady: (key: string) => void;
}) {
  const tier = getTierKey(item);
  const tierColor = TIER_COLORS[tier] || TIER_COLORS.standard;

  return (
    <View style={[styles.skinCard, { borderColor: tierColor }]}>
      <View style={[styles.skinTierLine, { backgroundColor: tierColor }]} />
      <Text style={[styles.skinBadge, { color: tierColor }]}>VSHOP</Text>
      {item.image ? (
        <CheckerImage
          cacheId={`skin-image:${
            item.chromaId || item.skinLevelId || item.skinId
          }:display`}
          readyKey={`skin-${item.collectionId}`}
          uri={item.image}
          style={styles.skinImage}
          onReady={onImageReady}
        />
      ) : (
        <Icon
          name="pistol"
          size={styles.skinFallback.width}
          color="#777284"
          style={styles.skinFallback}
        />
      )}
      <View style={styles.skinFooter}>
        <View style={[styles.rarityDot, { borderColor: tierColor }]} />
        <Text
          style={[styles.skinName, { color: tierColor }]}
          numberOfLines={1}
        >
          {item.skinName}
        </Text>
      </View>
    </View>
  );
}

function CheckerSheet({
  items,
  profile,
  generatedAt,
  logicalWidth,
  styles,
  onImageReady,
  onLayoutReady,
  exportRef,
}: {
  items: OwnedWeaponCollectionItem[];
  profile: CollectionCheckerProfile;
  generatedAt: number;
  logicalWidth: number;
  styles: CheckerStyles;
  onImageReady: (key: string) => void;
  onLayoutReady: () => void;
  exportRef: React.RefObject<View | null>;
}) {
  return (
    <View
      ref={exportRef}
      collapsable={false}
      renderToHardwareTextureAndroid
      pointerEvents="none"
      onLayout={onLayoutReady}
      style={[
        styles.sheet,
        {
          left: -(logicalWidth + 32),
          width: logicalWidth,
        },
      ]}
    >
      <CheckerHeader
        profile={profile}
        styles={styles}
        onImageReady={onImageReady}
      />
      <CheckerProfile
        profile={profile}
        generatedAt={generatedAt}
        styles={styles}
        onImageReady={onImageReady}
      />
      <CheckerSummary
        profile={profile}
        items={items}
        styles={styles}
        onImageReady={onImageReady}
      />
      <View style={styles.grid}>
        <PromoCard styles={styles} />
        {items.map((item) => (
          <CheckerSkinCard
            key={item.collectionId}
            item={item}
            styles={styles}
            onImageReady={onImageReady}
          />
        ))}
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerPrimary}>VSHOP.APP</Text>
        <Text style={styles.footerDot}>·</Text>
        <Text style={styles.footerSecondary}>Vshop</Text>
        <Text style={styles.footerDot}>·</Text>
        <Text style={styles.footerMeta}>PREMIUM SKIN COLLECTION</Text>
      </View>
    </View>
  );
}

export function CollectionCheckerExportProvider({
  items,
  profile,
  disabled = false,
  children,
}: CollectionCheckerExportProps) {
  const exportRef = React.useRef<View>(null);
  const loadedImageKeysRef = React.useRef(new Set<string>());
  const captureStartedRef = React.useRef(false);
  const pixelRatio = PixelRatio.get();
  const logicalWidth = OUTPUT_WIDTH_PX / pixelRatio;
  const scale = logicalWidth / BASE_WIDTH;
  const styles = React.useMemo(() => createCheckerStyles(scale), [scale]);
  const [exporting, setExporting] = React.useState(false);
  const [sheetMounted, setSheetMounted] = React.useState(false);
  const [layoutReady, setLayoutReady] = React.useState(false);
  const [readyImageCount, setReadyImageCount] = React.useState(0);
  const [imageWaitExpired, setImageWaitExpired] = React.useState(false);
  const [generatedAt, setGeneratedAt] = React.useState(Date.now());
  const [exportItems, setExportItems] = React.useState<
    OwnedWeaponCollectionItem[]
  >([]);
  const [exportProfile, setExportProfile] =
    React.useState<CollectionCheckerProfile | null>(null);
  const [renderedItemCount, setRenderedItemCount] = React.useState(0);

  const eligibleItems = React.useMemo(
    () => items.filter(isExportableTier).sort(compareExportItems),
    [items]
  );
  const renderedItems = React.useMemo(
    () => exportItems.slice(0, renderedItemCount),
    [exportItems, renderedItemCount]
  );
  const allItemsRendered =
    exportItems.length > 0 && renderedItemCount >= exportItems.length;
  const expectedImageCount =
    exportItems.reduce((count, item) => count + (item.image ? 1 : 0), 0) +
    (exportProfile?.avatarUri ? 2 : 0) +
    (exportProfile?.rank?.currentIcon ? 1 : 0);
  const imagesReady =
    expectedImageCount === 0 || readyImageCount >= expectedImageCount;
  const exportReady =
    sheetMounted &&
    allItemsRendered &&
    layoutReady &&
    (imagesReady || imageWaitExpired);

  const markImageReady = React.useCallback((key: string) => {
    if (loadedImageKeysRef.current.has(key)) return;
    loadedImageKeysRef.current.add(key);
    setReadyImageCount(loadedImageKeysRef.current.size);
  }, []);

  React.useEffect(() => {
    if (!sheetMounted || allItemsRendered) return;

    const timeout = setTimeout(() => {
      setRenderedItemCount((count) =>
        Math.min(count + EXPORT_RENDER_BATCH_SIZE, exportItems.length)
      );
    }, EXPORT_RENDER_BATCH_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [allItemsRendered, exportItems.length, sheetMounted]);

  React.useEffect(() => {
    if (!sheetMounted || !allItemsRendered || imagesReady) return;

    const timeout = setTimeout(
      () => setImageWaitExpired(true),
      IMAGE_LOAD_TIMEOUT_MS
    );
    return () => clearTimeout(timeout);
  }, [allItemsRendered, imagesReady, sheetMounted]);

  const finishExport = React.useCallback(() => {
    setSheetMounted(false);
    setExporting(false);
    setLayoutReady(false);
    setImageWaitExpired(false);
    setExportItems([]);
    setExportProfile(null);
    setRenderedItemCount(0);
  }, []);

  const saveCheckerImage = React.useCallback(async () => {
    try {
      const MediaLibrary = getMediaLibrary();

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      if (!exportRef.current) {
        throw new Error("Không thể dựng ảnh bộ sưu tập.");
      }

      const uri = await captureRef(exportRef, {
        format: "jpg",
        quality: 0.92,
        result: "tmpfile",
      });

      await MediaLibrary.Asset.create(uri);
      Toast.show({
        type: "success",
        text1: "Đã lưu ảnh bộ sưu tập",
        text2: "Ảnh bộ sưu tập đã được lưu vào Thư viện.",
      });
    } catch (error) {
      if (__DEV__) {
        console.warn("[profile] collection checker export failed", error);
      }
      Toast.show({
        type: "error",
        text1: "Không thể lưu ảnh",
        text2:
          error instanceof Error
            ? error.message
            : "Vui lòng thử lại sau.",
      });
    } finally {
      finishExport();
    }
  }, [finishExport]);

  React.useEffect(() => {
    if (!exportReady || captureStartedRef.current) return;
    captureStartedRef.current = true;
    void saveCheckerImage();
  }, [exportReady, saveCheckerImage]);

  const handleDownload = React.useCallback(async () => {
    if (disabled || exporting || eligibleItems.length === 0) return;

    if (Platform.OS === "web") {
      Toast.show({
        type: "error",
        text1: "Chưa hỗ trợ trên web",
        text2: "Hãy tải ảnh từ ứng dụng Android hoặc iOS.",
      });
      return;
    }

    setExporting(true);

    try {
      const MediaLibrary = getMediaLibrary();
      const currentPermission = await MediaLibrary.getPermissionsAsync(
        true,
        ["photo"]
      );
      const permission = currentPermission.granted
        ? currentPermission
        : await MediaLibrary.requestPermissionsAsync(true, ["photo"]);

      if (!permission.granted) {
        throw new Error("Cần quyền lưu ảnh vào Thư viện.");
      }

      Toast.show({
        type: "info",
        text1: "Đang tạo ảnh bộ sưu tập",
        text2: `${eligibleItems.length}/${items.length} skin hiếm trở lên.`,
      });

      loadedImageKeysRef.current.clear();
      captureStartedRef.current = false;
      setReadyImageCount(0);
      setLayoutReady(false);
      setImageWaitExpired(false);
      setGeneratedAt(Date.now());
      setExportItems(eligibleItems);
      setExportProfile(profile);
      setRenderedItemCount(
        Math.min(EXPORT_RENDER_BATCH_SIZE, eligibleItems.length)
      );
      setSheetMounted(true);
    } catch (error) {
      if (__DEV__) {
        console.warn("[profile] media permission unavailable", error);
      }
      setExporting(false);
      Toast.show({
        type: "error",
        text1: "Không thể tải ảnh",
        text2:
          error instanceof Error
            ? error.message
            : "Vui lòng kiểm tra quyền Thư viện.",
      });
    }
  }, [disabled, eligibleItems, exporting, items.length, profile]);

  const contextValue = React.useMemo<CollectionExportContextValue>(
    () => ({
      disabled,
      exporting,
      hasExportableItems: eligibleItems.length > 0,
      onDownload: () => {
        void handleDownload();
      },
      styles,
    }),
    [disabled, eligibleItems.length, exporting, handleDownload, styles]
  );

  return (
    <CollectionExportContext.Provider value={contextValue}>
      {children}
      {sheetMounted && exportProfile ? (
        <CheckerSheet
          items={renderedItems}
          profile={exportProfile}
          generatedAt={generatedAt}
          logicalWidth={logicalWidth}
          styles={styles}
          onImageReady={markImageReady}
          onLayoutReady={() => setLayoutReady(true)}
          exportRef={exportRef}
        />
      ) : null}
    </CollectionExportContext.Provider>
  );
}

export function CollectionCheckerExport() {
  const exportContext = React.useContext(CollectionExportContext);

  if (!exportContext) {
    return null;
  }

  const {
    disabled,
    exporting,
    hasExportableItems,
    onDownload,
    styles,
  } = exportContext;
  const buttonDisabled = disabled || exporting || !hasExportableItems;

  return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tải ảnh bộ sưu tập skin hiếm trở lên"
        accessibilityState={{ disabled: buttonDisabled }}
        disabled={buttonDisabled}
        onPress={onDownload}
        style={({ pressed }) => [
          styles.downloadButton,
          pressed && styles.downloadButtonPressed,
          (disabled || !hasExportableItems) && styles.downloadButtonDisabled,
        ]}
      >
        {exporting ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Icon name="download" size={22} color="#ffffff" />
        )}
      </Pressable>
  );
}

function createCheckerStyles(scale: number) {
  const s = (value: number) => value * scale;
  const gridWidth = s(BASE_WIDTH - PAGE_PADDING * 2);
  const cardWidth =
    (gridWidth - s(GRID_GAP * (GRID_COLUMNS - 1))) / GRID_COLUMNS;
  const cardHeight = cardWidth / 1.42;

  return StyleSheet.create({
    downloadButton: {
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "stretch",
      aspectRatio: 1,
      minWidth: 52,
      borderRadius: 20,
      backgroundColor: "#0f171b",
      borderWidth: 1,
      borderColor: "#0f171b",
    },
    downloadButtonPressed: {
      opacity: 0.72,
      transform: [{ scale: 0.97 }],
    },
    downloadButtonDisabled: {
      opacity: 0.42,
    },
    sheet: {
      position: "absolute",
      top: 0,
      padding: s(PAGE_PADDING),
      gap: s(3),
      backgroundColor: "#08090d",
    },
    header: {
      height: s(44),
      overflow: "hidden",
      position: "relative",
      justifyContent: "center",
      backgroundColor: "#141824",
      borderWidth: s(0.35),
      borderColor: "rgba(115, 91, 165, 0.16)",
    },
    accentLine: {
      position: "absolute",
      left: 0,
      top: s(2),
      bottom: s(2),
      width: s(1.2),
      zIndex: 4,
      backgroundColor: "#31e6d0",
    },
    headerArt: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      width: "47%",
      height: "100%",
      opacity: 0.75,
    },
    headerArtShade: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      width: "54%",
      backgroundColor: "rgba(20, 24, 36, 0.48)",
    },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: s(8),
      paddingLeft: s(13),
      zIndex: 5,
    },
    brandMark: {
      width: s(20),
      height: s(20),
      alignItems: "center",
      justifyContent: "center",
      transform: [{ rotate: "45deg" }],
      borderWidth: s(1.2),
      borderColor: "#ff4655",
      backgroundColor: "rgba(255, 70, 85, 0.08)",
    },
    brandMarkText: {
      color: "#ff4655",
      fontSize: s(13),
      lineHeight: s(15),
      fontWeight: "900",
      transform: [{ rotate: "-45deg" }],
    },
    brandEyebrow: {
      color: "#35dcc7",
      fontSize: s(4.5),
      fontWeight: "800",
      letterSpacing: s(0.3),
    },
    brandTitle: {
      color: "#f8faff",
      fontSize: s(15),
      lineHeight: s(15),
      fontWeight: "900",
      letterSpacing: s(0.2),
    },
    brandMeta: {
      marginTop: s(1),
      color: "#9fa6b4",
      fontSize: s(2.8),
      letterSpacing: s(0.35),
    },
    profilePanel: {
      height: s(31),
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: s(6),
      backgroundColor: "#151120",
      borderWidth: s(0.35),
      borderColor: "rgba(120, 80, 180, 0.16)",
    },
    panelAccent: {
      position: "absolute",
      left: 0,
      top: s(2),
      bottom: s(2),
      width: s(1.2),
      backgroundColor: "#31e6d0",
    },
    avatarFrame: {
      width: s(23),
      height: s(23),
      alignItems: "center",
      justifyContent: "center",
      padding: s(1),
      borderRadius: s(2.4),
      borderWidth: s(0.6),
      borderColor: "#31e6d0",
      backgroundColor: "#241d35",
    },
    avatar: {
      width: "100%",
      height: "100%",
      borderRadius: s(1.6),
    },
    avatarFallback: {
      color: "#f8faff",
      fontSize: s(9),
      fontWeight: "900",
    },
    profileCopy: {
      flex: 1,
      marginLeft: s(5),
      minWidth: 0,
    },
    profileLabel: {
      color: "#31e6d0",
      fontSize: s(2.8),
      fontWeight: "800",
      letterSpacing: s(0.4),
    },
    profileName: {
      color: "#f7f8fc",
      fontSize: s(8.4),
      lineHeight: s(9),
      fontWeight: "900",
    },
    profileMeta: {
      marginTop: s(1),
      color: "#a7a1b3",
      fontSize: s(2.7),
      letterSpacing: s(0.15),
    },
    levelBlock: {
      width: s(34),
      alignItems: "center",
    },
    levelLabel: {
      color: "#afa9b8",
      fontSize: s(2.8),
      letterSpacing: s(0.3),
    },
    levelValue: {
      color: "#f6f7fb",
      fontSize: s(10),
      lineHeight: s(11),
      fontWeight: "900",
    },
    levelUnderline: {
      width: s(18),
      height: s(1),
      marginTop: s(0.5),
      backgroundColor: "#31e6d0",
    },
    summaryPanel: {
      height: s(27),
      flexDirection: "row",
      alignItems: "stretch",
      gap: s(2),
      padding: s(2),
      backgroundColor: "#14111e",
      borderWidth: s(0.35),
      borderColor: "rgba(115, 91, 165, 0.16)",
    },
    rankBlock: {
      width: s(105),
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: s(4),
      borderRightWidth: s(0.35),
      borderRightColor: "rgba(115, 91, 165, 0.22)",
    },
    rankIcon: {
      width: s(20),
      height: s(20),
    },
    rankCopy: {
      flex: 1,
      marginLeft: s(4),
      minWidth: 0,
    },
    rankSeason: {
      color: "#817c91",
      fontSize: s(2.5),
      fontWeight: "700",
      letterSpacing: s(0.25),
    },
    rankName: {
      color: "#f4f2fa",
      fontSize: s(6.2),
      lineHeight: s(7),
      fontWeight: "900",
      textTransform: "uppercase",
    },
    rankPeak: {
      color: "#8f899c",
      fontSize: s(2.4),
      textTransform: "uppercase",
    },
    statsRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "stretch",
      gap: s(1),
    },
    statCell: {
      flex: 0.65,
      minWidth: 0,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: s(1.5),
      borderWidth: s(0.3),
      borderColor: "rgba(108, 82, 170, 0.16)",
      backgroundColor: "#19162a",
      paddingHorizontal: s(0.5),
    },
    statCellWide: {
      flex: 1.2,
    },
    statLabel: {
      color: "#817c91",
      fontSize: s(2.1),
      fontWeight: "700",
    },
    statValue: {
      color: "#f4f2fa",
      fontSize: s(4),
      lineHeight: s(5),
      fontWeight: "900",
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: s(GRID_GAP),
      rowGap: s(GRID_GAP),
    },
    skinCard: {
      width: cardWidth,
      height: cardHeight,
      position: "relative",
      overflow: "hidden",
      borderRadius: s(1.5),
      borderWidth: s(0.45),
      backgroundColor: "#151421",
    },
    promoCard: {
      alignItems: "center",
      justifyContent: "center",
      borderColor: "#6f31d8",
      backgroundColor: "#170b10",
    },
    promoTitle: {
      marginTop: s(2),
      color: "#ffffff",
      fontSize: s(5.8),
      lineHeight: s(6),
      fontWeight: "900",
      fontStyle: "italic",
    },
    promoAt: {
      color: "#c0a8ad",
      fontSize: s(2.4),
    },
    promoBrand: {
      color: "#e64155",
      fontSize: s(3.6),
      fontWeight: "900",
    },
    skinTierLine: {
      position: "absolute",
      left: 0,
      top: 0,
      width: "100%",
      height: s(0.55),
      zIndex: 3,
    },
    skinBadge: {
      position: "absolute",
      right: s(1.5),
      top: s(1.2),
      zIndex: 4,
      paddingHorizontal: s(1),
      paddingVertical: s(0.3),
      borderRadius: s(0.6),
      overflow: "hidden",
      backgroundColor: "rgba(22, 17, 37, 0.78)",
      fontSize: s(1.8),
      fontWeight: "800",
    },
    skinImage: {
      position: "absolute",
      left: s(3),
      right: s(3),
      top: s(4),
      width: cardWidth - s(6),
      height: cardHeight - s(11),
    },
    skinFallback: {
      position: "absolute",
      left: (cardWidth - s(13)) / 2,
      top: (cardHeight - s(13)) / 2 - s(2),
      width: s(13),
      height: s(13),
    },
    skinFooter: {
      position: "absolute",
      left: s(2),
      right: s(2),
      bottom: s(1.5),
      flexDirection: "row",
      alignItems: "center",
      gap: s(1.3),
    },
    rarityDot: {
      width: s(2.7),
      height: s(2.7),
      flexShrink: 0,
      borderRadius: s(1.4),
      borderWidth: s(0.5),
    },
    skinName: {
      flex: 1,
      minWidth: 0,
      fontSize: s(3.1),
      lineHeight: s(3.8),
      fontWeight: "800",
    },
    footer: {
      height: s(13),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: s(5),
      borderWidth: s(0.35),
      borderColor: "rgba(88, 70, 130, 0.16)",
      backgroundColor: "#11121c",
    },
    footerPrimary: {
      color: "#31e6d0",
      fontSize: s(3),
      fontWeight: "900",
      letterSpacing: s(0.2),
    },
    footerSecondary: {
      color: "#d94d91",
      fontSize: s(2.6),
      fontWeight: "800",
    },
    footerMeta: {
      color: "#aaa5b4",
      fontSize: s(2.6),
      fontWeight: "700",
      letterSpacing: s(0.2),
    },
    footerDot: {
      color: "#777284",
      fontSize: s(3),
    },
  });
}
