import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Modal, Portal, Text, useTheme } from "react-native-paper";
import { useVideoPlayer, VideoView } from "expo-video";
import { useTranslation } from "react-i18next";
import { create } from "zustand";
import { CachedImage as Image } from "~/components/CachedImage";
import AppIcon from "~/components/ui/AppIcon";

import { COLORS, RADIUS, SHADOWS, SPACING } from "~/constants/DesignSystem";

/**
 * MediaVideoProps – Props của MediaVideo.
 *
 * @param onLoad – Callback gọi khi video render frame đầu tiên (tắt spinner).
 * @param uri – URL video cần phát.
 */
interface MediaVideoProps {
  onLoad: () => void;
  uri: string;
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
function MediaVideo({ onLoad, uri }: MediaVideoProps) {
  const player = useVideoPlayer(uri, (nextPlayer) => {
    nextPlayer.loop = true;
    nextPlayer.muted = false;
    nextPlayer.play();
  });

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
  showMediaPopup: (entries: MediaPopupEntry[], text: string) => void;
  hideMediaPopup: () => void;
  setSelectedIndex: (index: number) => void;
}

export const useMediaPopupStore = create<IStore>((set) => ({
  entries: [],
  text: "",
  selectedIndex: 0,
  showMediaPopup: (entries, text) => set({ entries, text, selectedIndex: 0 }),
  hideMediaPopup: () => set({ entries: [], text: "", selectedIndex: 0 }),
  setSelectedIndex: (index: number) => set({ selectedIndex: index }),
}));

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
  const setSelectedIndex = useMediaPopupStore(
    (state) => state.setSelectedIndex
  );
  const hideMediaPopup = useMediaPopupStore((state) => state.hideMediaPopup);
  // loading: hiển thị overlay spinner trong khung media khi đang tải
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const { colors } = useTheme();
  // activeEntry: media đang được chọn theo selectedIndex
  const activeEntry = entries[selectedIndex];
  // sections: nhóm entries theo "level"/"chroma", chỉ giữ nhóm có item
  const sections = useMemo(
    () =>
      (["level", "chroma"] as const)
        .map((group) => ({
          group,
          label: t(group === "level" ? "levels" : "chromas"),
          items: entries
            .map((entry, index) => ({ entry, index }))
            .filter(({ entry }) => entry.group === group),
        }))
        .filter((section) => section.items.length > 0),
    [entries, t],
  );

  // Effect: đổi media hoặc popup mở lại → bật lại overlay loading
  useEffect(() => {
    setLoading(true);
  }, [entries, selectedIndex]);

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
        onDismiss={hideMediaPopup}
        overlayAccessibilityLabel={t("common.close")}
        style={styles.modal}
        contentContainerStyle={styles.modalContainer}
        theme={{ colors: { backdrop: COLORS.MODAL_BACKDROP } }}
      >
        <View
          accessibilityViewIsModal
          testID="media-popup-dialog"
          style={styles.sheet}
        >
          {/* Media được render theo loại tường minh từ dữ liệu skin. */}
          <View style={styles.mediaFrame}>
            {activeEntry &&
              (activeEntry.kind === "image" ? (
                <Image
                  cacheId={activeEntry.cacheId}
                  style={styles.mediaFill}
                  contentFit="contain"
                  source={{ uri: activeEntry.uri }}
                  cachePolicy="memory-disk"
                  priority="high"
                  recyclingKey={activeEntry.uri}
                  onLoadStart={() => setLoading(true)}
                  onLoad={() => setLoading(false)}
                  onError={() => setLoading(false)}
                />
              ) : (
                <MediaVideo
                  uri={activeEntry.uri}
                  onLoad={() => setLoading(false)}
                />
              ))}
            {loading ? (
              <View pointerEvents="none" style={styles.loadingOverlay}>
                <ActivityIndicator color={COLORS.ACCENT_DEEP} />
              </View>
            ) : null}
          </View>

          {/*
            ── footer ───────────────────────────────────────────────────────────
            Tiêu đề (tên skin) + thanh tabs chọn media
            Mỗi tab là một nút tròn đánh số thứ tự, active thì nền đen chữ trắng
            */}
          <View style={styles.footer}>
            <View style={styles.titleRow}>
              <Text
                numberOfLines={2}
                style={[styles.title, { color: colors.onSurface }]}
              >
                {text}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close media viewer"
                hitSlop={8}
                onPress={hideMediaPopup}
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

            <View style={styles.sections}>
              {sections.map((section) => (
                <View key={section.group} style={styles.section}>
                  <Text style={styles.sectionLabel}>{section.label}</Text>
                  <ScrollView
                    accessibilityRole="tablist"
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    testID={`media-tablist-${section.group}`}
                    contentContainerStyle={styles.tabs}
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
                            onPress={() => setSelectedIndex(index)}
                            style={({ pressed }) => [
                              styles.tabButton,
                              active && styles.tabButtonActive,
                              pressed && styles.tabButtonPressed,
                            ]}
                          >
                            <Text
                              style={[
                                styles.tabButtonLabel,
                                active && styles.tabButtonLabelActive,
                              ]}
                            >
                              {sectionIndex + 1}
                            </Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              ))}
            </View>
          </View>
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
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.SURFACE,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    ...SHADOWS.lg,
  },
  mediaFrame: {
    aspectRatio: 16 / 9,
    width: "100%",
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.SURFACE_MUTED,
    overflow: "hidden",
  },
  mediaFill: {
    ...StyleSheet.absoluteFill,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236, 238, 240, 0.76)",
  },
  // footer: khoảng cách phía trên cho footer
  footer: {
    marginTop: 14,
  },
  titleRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  // title: tiêu đề popup, 18px, bold 700, viết hoa chữ đầu
  title: {
    fontSize: 18,
    fontWeight: "700",
    textTransform: "capitalize",
    flex: 1,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.chip,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  sections: {
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  section: {
    gap: SPACING.xs,
  },
  sectionLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  // tabs: hàng ngang các tab của từng nhóm
  tabs: {
    paddingRight: SPACING.md,
  },
  // tabWrap: wrapper từng tab, margin phải và dưới
  tabWrap: {
    marginRight: 8,
    marginBottom: 8,
  },
  // tabButton: nút tab dạng chip, touch target tối thiểu 44 x 44 dp
  tabButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  // tabButtonActive: nền đen, border đen khi active
  tabButtonActive: {
    backgroundColor: COLORS.PURE_BLACK,
    borderColor: COLORS.PURE_BLACK,
  },
  tabButtonPressed: {
    opacity: 0.72,
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
});

export default MediaPopup;
