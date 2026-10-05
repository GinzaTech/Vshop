import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Modal, Portal, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { useTranslation } from "~/hooks/useAppTranslation";
import { create } from "zustand";
import { CachedImage as Image } from "~/components/CachedImage";
import AppIcon from "~/components/ui/AppIcon";
import { useAppWindowDimensions } from "~/components/ui/AppViewport";
import { getContentTierVisual } from "~/utils/content-tier";
import { getPublicContentTierIconUri } from "~/services/valorant/public-api";

import { COLORS, RADIUS, SHADOWS, SKIN_PREVIEW_MATERIAL, SPACING } from "~/constants/DesignSystem";

/**
 * MediaVideoProps – Props của MediaVideo.
 *
 * @param onLoad – Callback gọi khi video render frame đầu tiên (tắt spinner).
 * @param uri – URL video cần phát.
 */
interface MediaVideoProps {
  onLoad: () => void;
  onError: () => void;
  uri: string;
}

function ContentTierIcon({ uuid, color }: { uuid: string; color: string }) {
  const uri = getPublicContentTierIconUri(uuid);
  const [failed, setFailed] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  return uri && !failed ? <Image testID="media-preview-tier-icon" cacheId={`content-tier:${uuid}:display`}
    source={{ uri }} contentFit="contain" cachePolicy="memory-disk" priority="high" recyclingKey={uri}
    transition={0} style={styles.tierIcon} accessible={false} accessibilityElementsHidden
    onError={() => { if (alive.current) setFailed(true); }} />
    : <AppIcon name="skin" size={24} color={color} decorative />;
}

export type MediaPopupGroup = "level" | "chroma";

/**
 * MediaPopupEntry – Một mục media trong popup viewer.
 *
 * @property cacheId – Cache key ổn định cho ảnh/video.
 * @property group – Nhóm media: "level" (cấp) hoặc "chroma" (màu).
 * @property kind – Loại media: "image" hoặc "video".
 * @property label – Nhãn hiển thị (tên level/chroma) cho accessibility.
 * @property uri – URL nguồn media.
 */
export interface MediaPopupEntry {
  cacheId: string;
  group: MediaPopupGroup;
  kind: "image" | "video";
  label: string;
  uri: string;
  imageUri?: string;
  imageCacheId?: string;
  videoUri?: string;
  swatchUri?: string;
  contentTierUuid?: string;
  levelNumber?: number;
}

/**
 * MediaVideo – Trình phát video expo-video trong popup.
 * Player cấu hình: loop vô hạn, bật tiếng, tự play ngay khi tạo.
 *
 * @param onLoad – Callback khi frame đầu render xong (qua onFirstFrameRender).
 * @param uri – URL video cần phát.
 * @returns VideoView full khung, không native controls.
 *
 * Side effects: tạo video player (tự play, loop); player được giải phóng
 * tự động bởi useVideoPlayer khi unmount.
 */
function MediaVideo({ onLoad, onError, uri }: MediaVideoProps) {
  const player = useVideoPlayer(uri, (nextPlayer) => {
    nextPlayer.loop = true;
    nextPlayer.muted = false;
    nextPlayer.play();
  });
  useEffect(() => {
    const subscription = player.addListener("statusChange", ({ status }) => {
      if (status === "error") onError();
    });
    if (player.status === "error") onError();
    return () => subscription.remove();
  }, [onError, player]);

  return (
    <VideoView
      contentFit="contain"
      nativeControls={false}
      onFirstFrameRender={onLoad}
      player={player}
      style={styles.mediaFill}
    />
  );
}

// ─── Zustand Store: useMediaPopupStore ─────────────────────────────────────────
// Quản lý trạng thái của popup media (hiển thị ảnh/video skin).
//
// State:
//   - entries: MediaPopupEntry[] – media kèm loại, nhóm và cache key
//   - text: string – tiêu đề popup (tên skin)
//     Khởi tạo: ""
//   - selectedIndex: number – index của media đang được chọn
//     Khởi tạo: 0
//
// Actions:
//   - showMediaPopup(entries, text): mở popup, reset selectedIndex về 0
//   - hideMediaPopup(): đóng popup và reset nội dung
//   - setSelectedIndex(index): chuyển đến media khác

interface IStore {
  entries: MediaPopupEntry[];
  text: string;
  selectedIndex: number;
  revision: number;
  videoMode: boolean;
  setVideoMode: (enabled: boolean) => void;
  showMediaPopup: (entries: MediaPopupEntry[], text: string) => void;
  hideMediaPopup: () => void;
  setSelectedIndex: (index: number) => void;
}

export const useMediaPopupStore = create<IStore>((set) => ({
  entries: [],
  text: "",
  selectedIndex: 0,
  revision: 0,
  videoMode: false,
  setVideoMode: (enabled) => set(state => {
    const current = state.entries[state.selectedIndex];
    const available = current?.videoUri || (current?.kind === "video" ? current.uri : undefined);
    if (typeof enabled !== "boolean" || enabled === state.videoMode || (enabled && !available)) return state;
    return { videoMode: enabled, revision: state.revision + 1 };
  }),
  showMediaPopup: (entries, text) => set((state) => ({
    entries: entries.map(entry => ({ ...entry })), text, selectedIndex: 0,
    videoMode: false, revision: state.revision + 1,
  })),
  hideMediaPopup: () => set((state) => ({ entries: [], text: "", selectedIndex: 0, videoMode: false, revision: state.revision + 1 })),
  setSelectedIndex: (index: number) => set((state) => (
    Number.isInteger(index) && index >= 0 && index < state.entries.length && (index !== state.selectedIndex || state.videoMode)
      ? { selectedIndex: index, videoMode: false, revision: state.revision + 1 } : state
  )),
}));

/** One preview lifetime per selection; an old decoder cannot finish a new load. */
function MediaFrame({ entry, backgroundColor }: { entry: MediaPopupEntry; backgroundColor: string }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const alive = useRef(true);
  const { t } = useTranslation();
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const onLoad = useCallback(() => { if (alive.current) { setLoading(false); setFailed(false); } }, []);
  const onError = useCallback(() => {
    if (alive.current) { setLoading(false); setFailed(true); }
  }, []);
  return (
    <View testID="media-preview-frame" style={[styles.mediaFrame, { backgroundColor }]}>
      {entry.kind === "image" ? (
        <Image testID="media-preview-artwork" cacheId={entry.cacheId} style={styles.mediaFill} contentFit="contain" transition={0}
          source={entry.uri ? { uri: entry.uri } : require("~/assets/images/noimage.png")} cachePolicy="memory-disk" priority="high" recyclingKey={entry.uri}
          onLoadStart={() => { if (alive.current) setLoading(true); }} onLoad={onLoad} onError={onError} />
      ) : <MediaVideo uri={entry.uri} onLoad={onLoad} onError={onError} />}
      {loading ? <View pointerEvents="none" style={styles.loadingOverlay}><ActivityIndicator color={COLORS.ACCENT_DEEP} /></View> : null}
      {failed ? <Text testID="media-popup-error" accessibilityLiveRegion="polite" style={styles.mediaError}>
        {t("common.media_load_failed", { defaultValue: "Could not load preview. Select another item to retry." })}
      </Text> : null}
    </View>
  );
}

// ─── MediaPopup ────────────────────────────────────────────────────────────────
// Component popup xem media (ảnh/video) của skin.
// Sử dụng react-native-paper Portal + Modal.
//
// Local state:
//   - loading (useState<boolean>): điều khiển overlay nhỏ trong media frame
//
// Hook:
//   - colors (useTheme): theme màu từ react-native-paper
//
// Logic hiển thị:
//   - Loại media được truyền tường minh để URL CDN không cần có phần mở rộng
//   - Video dùng expo-video (auto play, loop, unmuted)
//   - Hai nhóm Cấp/Màu có selector riêng bên dưới khung media

/**
 * MediaPopup – Popup viewer ảnh/video skin (memo không cần, export default).
 * Render Portal + Modal chỉ khi entries khác rỗng (Portal mount lazily để
 * tránh nằm dưới modal của màn khác trên Android). Ảnh dùng CachedImage,
 * video dùng MediaVideo; overlay spinner hiển thị trong lúc load media.
 *
 * @returns Portal chứa Modal viewer, hoặc null khi không có media.
 *
 * Side effects: video player trong MediaVideo; effect reset loading=true khi
 * entries/selectedIndex đổi. Không có timer/subscription riêng.
 */
function MediaPopup() {
  const entries = useMediaPopupStore((state) => state.entries);
  const text = useMediaPopupStore((state) => state.text);
  const selectedIndex = useMediaPopupStore((state) => state.selectedIndex);
  const revision = useMediaPopupStore((state) => state.revision);
  const videoMode = useMediaPopupStore(state => state.videoMode);
  const setVideoMode = useMediaPopupStore(state => state.setVideoMode);
  const setSelectedIndex = useMediaPopupStore(
    (state) => state.setSelectedIndex
  );
  const hideMediaPopup = useMediaPopupStore((state) => state.hideMediaPopup);
  // loading: hiển thị overlay spinner trong khung media khi đang tải
  const { t } = useTranslation();
  const { height } = useAppWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxHeight = Math.max(
    48,
    Math.min(height * 0.88, height - insets.top - insets.bottom - SPACING.xxl),
  );
  // activeEntry: media đang được chọn theo selectedIndex
  const activeEntry = entries[selectedIndex];
  const tier = getContentTierVisual(activeEntry?.contentTierUuid);
  const videoUri = activeEntry?.videoUri || (activeEntry?.kind === "video" ? activeEntry.uri : undefined);
  const richPreview = entries.some(entry => entry.imageUri || entry.videoUri || entry.swatchUri);
  const displayedEntry = useMemo(() => {
    if (!activeEntry) return undefined;
    if (videoMode && videoUri) return { ...activeEntry, kind: "video" as const, uri: videoUri };
    if (activeEntry.imageUri) return { ...activeEntry, kind: "image" as const, uri: activeEntry.imageUri, cacheId: activeEntry.imageCacheId ?? activeEntry.cacheId };
    if (richPreview) return { ...activeEntry, kind: "image" as const, uri: "" };
    return activeEntry;
  }, [activeEntry, videoMode, videoUri, richPreview]);
  // Each opening owns a unique entries snapshot. Queued old controls cannot
  // select or close a newer skin, even if the same input array is reopened.
  const ownsViewer = useCallback(() => useMediaPopupStore.getState().entries === entries, [entries]);
  const dismiss = useCallback(() => { if (ownsViewer()) hideMediaPopup(); }, [hideMediaPopup, ownsViewer]);
  // sections: nhóm entries theo "level"/"chroma", chỉ giữ nhóm có item
  const sections = useMemo(
    () =>
      (["level", "chroma"] as const)
        .map((group) => ({
          group,
          label: t(group === "level" ? "levels" : "skin_preview.variants", { defaultValue: "Variants" }),
          items: entries
            .map((entry, index) => ({ entry, index }))
            .filter(({ entry }) => entry.group === group),
        }))
        .filter((section) => section.items.length > 0),
    [entries, t],
  );


  // Mount the Portal only while the viewer is open. Screens such as Bundles
  // register their own Portal lazily, so keeping this Portal mounted from app
  // startup can leave it underneath a screen modal on Android.
  if (entries.length === 0) {
    return null;
  }

  return (
    <Portal>
      <Modal
        visible
        onDismiss={dismiss}
        overlayAccessibilityLabel={t("common.close")}
        style={styles.modal}
        contentContainerStyle={[styles.modalContainer, { maxHeight }]}
        theme={{ colors: { backdrop: SKIN_PREVIEW_MATERIAL.backdrop } }}
      >
        <View
          accessibilityViewIsModal
          testID="media-popup-dialog"
          style={[styles.sheet, { maxHeight }]}
        >
            <View testID="media-preview-header" style={styles.titleRow}>
              {activeEntry?.contentTierUuid ? <ContentTierIcon key={activeEntry.contentTierUuid} uuid={activeEntry.contentTierUuid} color={tier.accent} /> : null}
              <Text
                numberOfLines={2}
                adjustsFontSizeToFit minimumFontScale={0.85}
                style={styles.title}
              >
                {text}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close media viewer"
                hitSlop={8}
                onPress={dismiss}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.closeButtonPressed,
                ]}
              >
                <AppIcon
                  name="close"
                  size={22}
                  color={COLORS.TEXT_PRIMARY}
                  decorative
                />
              </Pressable>
            </View>
          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, SPACING.md) }} showsVerticalScrollIndicator={false}>
            <View style={styles.mediaHero}>
            {displayedEntry ? <MediaFrame key={revision} entry={displayedEntry} backgroundColor={activeEntry?.contentTierUuid ? tier.cardBackground : COLORS.SURFACE_MUTED} /> : null}
              {richPreview && activeEntry && videoUri ? <Pressable testID="media-video-toggle" accessibilityRole="button"
                accessibilityLabel={`${t(videoMode ? "skin_preview.image" : "skin_preview.video", { defaultValue: videoMode ? "Image" : "Video" })}, ${activeEntry.label}`}
                accessibilityState={{ selected: videoMode }}
                onPress={() => { if (ownsViewer()) setVideoMode(!videoMode); }}
                style={({ pressed }) => [styles.videoToggle, pressed && styles.tabButtonPressed]}>
                <AppIcon name={videoMode ? "imageGrid" : "mediaPlay"} size={18} color={COLORS.TEXT_PRIMARY} decorative />
                <Text style={styles.videoToggleLabel}>{t(videoMode ? "skin_preview.image" : "skin_preview.video", { defaultValue: videoMode ? "Image" : "Video" })}</Text>
              </Pressable> : null}
            </View>
            <View style={styles.sections}>
              {sections.map((section) => (
                <View key={section.group} style={styles.section}>
                  <Text style={styles.sectionLabel}>{section.label}</Text>
                  <ScrollView
                    accessibilityRole="tablist"
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    testID={`media-tablist-${section.group}`}
                    contentContainerStyle={[styles.tabs, section.group === "level" && styles.levelRail]}
                  >
                    {section.items.map(({ entry, index }, sectionIndex) => {
                      const active = index === selectedIndex;
                      return (
                        <View key={entry.cacheId} style={styles.tabWrap}>
                          <Pressable
                            testID={`media-tab-${section.group}-${sectionIndex}`}
                            accessibilityRole="tab"
                            accessibilityLabel={`${section.label} ${sectionIndex + 1}: ${entry.label}`}
                            accessibilityState={{ selected: active }}
                            onPress={() => { if (ownsViewer()) setSelectedIndex(index); }}
                            style={({ pressed }) => [
                              styles.tabButton,
                              section.group === "chroma" && styles.swatchButton,
                              active && (section.group === "level" ? styles.tabButtonActive : styles.swatchButtonActive),
                              pressed && styles.tabButtonPressed,
                            ]}
                          >
                            {section.group === "chroma" && entry.swatchUri ? <Image testID={`media-variant-swatch-${sectionIndex}`}
                              cacheId={`${entry.cacheId}:swatch`} source={{ uri: entry.swatchUri }} contentFit="cover"
                              recyclingKey={entry.swatchUri} style={styles.swatchImage} cachePolicy="memory-disk" transition={0} /> : <Text
                              style={[
                                styles.tabButtonLabel,
                                active && styles.tabButtonLabelActive,
                              ]}
                            >
                              {section.group === "level" ? `${t("level")} ${entry.levelNumber ?? sectionIndex + 1}` : sectionIndex + 1}
                            </Text>}
                          </Pressable>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </Portal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  modal: {
    justifyContent: "center",
  },
  // modalContainer: căn giữa modal, padding ngang 16
  modalContainer: {
    alignItems: "center",
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: SPACING.md,
  },
  // sheet: panel chính, full width, bo góc 28, nền SURFACE, border BORDER
  sheet: {
    width: "100%",
    borderRadius: RADIUS.screen,
    backgroundColor: SKIN_PREVIEW_MATERIAL.surface,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    shadowOpacity: 0,
    elevation: 0,
  },
  mediaFrame: {
    aspectRatio: 16 / 9,
    width: "100%",
    borderRadius: RADIUS.card,
    backgroundColor: SKIN_PREVIEW_MATERIAL.frameFallback,
    overflow: "hidden",
  },
  mediaFill: {
    ...StyleSheet.absoluteFill,
  },
  mediaError: {
    margin: SPACING.md,
    color: COLORS.TEXT_PRIMARY,
    backgroundColor: COLORS.SURFACE,
    padding: SPACING.sm,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236, 238, 240, 0.76)",
  },
  body: { flexShrink: 1 },
  mediaHero: { position: "relative" },
  titleRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  tierIcon: { width: 24, height: 24 },
  // title: tiêu đề popup, 18px, bold 700, viết hoa chữ đầu
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
    minWidth: 0,
    paddingEnd: SPACING.xxs,
    flex: 1,
  },
  closeButton: {
    width: 48,
    height: 48,
    flexShrink: 0,
    borderRadius: RADIUS.chip,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  sections: {
    gap: SPACING.xl,
    marginTop: SPACING.xl,
  },
  section: {
    gap: SPACING.xs,
  },
  sectionLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 16,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  // tabs: hàng ngang các tab của từng nhóm
  tabs: {
    paddingRight: SPACING.xxs,
    gap: SPACING.xs,
  },
  // tabWrap: wrapper từng tab, margin phải và dưới
  tabWrap: { flexShrink: 0 },
  // tabButton: nút tab dạng chip, touch target tối thiểu 44 x 44 dp
  tabButton: {
    minWidth: 78,
    minHeight: 48,
    borderRadius: RADIUS.chip,
    paddingHorizontal: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  // tabButtonActive: nền đen, border đen khi active
  tabButtonActive: {
    backgroundColor: SKIN_PREVIEW_MATERIAL.activeLevel,
  },
  tabButtonPressed: {
    opacity: 0.85,
  },
  // tabButtonLabel: text tab, primary, bold 700
  tabButtonLabel: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "700",
  },
  // tabButtonLabelActive: text tab khi active, màu trắng
  tabButtonLabelActive: {
    color: COLORS.PURE_WHITE,
  },
  levelRail: { backgroundColor: COLORS.SURFACE_MUTED, borderRadius: RADIUS.chip, padding: SPACING.xxs },
  swatchButton: { width: 56, height: 56, minWidth: 56, borderRadius: RADIUS.md, paddingHorizontal: 0, overflow: "hidden", borderWidth: 1, borderColor: COLORS.BORDER_STRONG },
  swatchButtonActive: { borderWidth: 2, borderColor: SKIN_PREVIEW_MATERIAL.activeLevel },
  swatchImage: { width: "100%", height: "100%" },
  videoToggle: { position: "absolute", bottom: SPACING.sm, right: SPACING.sm, minHeight: 48, minWidth: 100,
    borderRadius: RADIUS.chip, paddingHorizontal: SPACING.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.xs,
    backgroundColor: COLORS.GLASS_WHITE, borderWidth: 1, borderColor: COLORS.PURE_WHITE, ...SHADOWS.xs },
  videoToggleLabel: { color: COLORS.TEXT_PRIMARY, fontSize: 14, fontWeight: "700" },
});

export default MediaPopup;
