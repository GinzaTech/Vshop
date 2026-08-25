import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Modal, Portal, Text, useTheme } from "react-native-paper";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useVideoPlayer, VideoView } from "expo-video";
import { create } from "zustand";
import { CachedImage as Image } from "~/components/CachedImage";

import { COLORS, RADIUS, SHADOWS, SPACING } from "~/constants/DesignSystem";

interface MediaVideoProps {
  onLoad: () => void;
  uri: string;
}

const IMAGE_URI_PATTERN = /\.(?:png|jpe?g|webp|avif)(?:[?#].*)?$/i;

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
//   - cacheIds: string[] – danh sách cacheId cho từng media (dùng cho CachedImage)
//     Khởi tạo: []
//   - uris: string[] – danh sách URI của các media cần hiển thị
//     Khởi tạo: []
//   - text: string – tiêu đề popup (tên skin)
//     Khởi tạo: ""
//   - selectedIndex: number – index của media đang được chọn
//     Khởi tạo: 0
//
// Actions:
//   - showMediaPopup(uris, text, cacheIds?): mở popup, reset selectedIndex về 0
//   - hideMediaPopup(): đóng popup, reset cacheIds, uris, text về rỗng
//   - setSelectedIndex(index): chuyển đến media khác

interface IStore {
  cacheIds: string[];
  uris: string[];
  text: string;
  selectedIndex: number;
  showMediaPopup: (uris: string[], text: string, cacheIds?: string[]) => void;
  hideMediaPopup: () => void;
  setSelectedIndex: (index: number) => void;
}

export const useMediaPopupStore = create<IStore>((set) => ({
  cacheIds: [],
  uris: [],
  text: "",
  selectedIndex: 0,
  showMediaPopup: (uris: string[], text: string, cacheIds: string[] = []) =>
    set({ cacheIds, uris, text, selectedIndex: 0 }),
  hideMediaPopup: () => set({ cacheIds: [], uris: [], text: "" }),
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
//   - Nếu URI kết thúc bằng .png/.jpg => dùng CachedImage
//   - Nếu không (video) => dùng Video từ expo-av (auto play, loop, unmuted)
//   - Thanh tabs dưới footer cho phép chuyển giữa các media

function MediaPopup() {
  const cacheIds = useMediaPopupStore((state) => state.cacheIds);
  const uris = useMediaPopupStore((state) => state.uris);
  const text = useMediaPopupStore((state) => state.text);
  const selectedIndex = useMediaPopupStore((state) => state.selectedIndex);
  const setSelectedIndex = useMediaPopupStore(
    (state) => state.setSelectedIndex
  );
  const hideMediaPopup = useMediaPopupStore((state) => state.hideMediaPopup);
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();
  const activeUri = uris[selectedIndex];

  useEffect(() => {
    setLoading(true);
  }, [selectedIndex, uris]);

  return (
    <Portal>
      <Modal
        visible={uris.length > 0}
        onDismiss={hideMediaPopup}
        style={styles.modal}
        contentContainerStyle={styles.modalContainer}
        theme={{ colors: { backdrop: COLORS.MODAL_BACKDROP } }}
      >
        {/*
          ── sheet ──────────────────────────────────────────────────────────────
          Panel chính của popup, bo góc 28, nền SURFACE, border BORDER
          */}
        <View style={styles.sheet}>
          {/*
            handle: thanh kéo nhỏ ở trên cùng (UI giống bottom sheet)
            */}
          <View style={styles.handle} />

          {/*
            Media: hiển thị ảnh (CachedImage) nếu .png/.jpg
            hoặc video (expo-av Video) nếu không phải ảnh
            Video: shouldPlay, isLooping, isMuted=false, resizeMode CONTAIN
            */}
          <View style={styles.mediaFrame}>
            {activeUri &&
              (IMAGE_URI_PATTERN.test(activeUri) ? (
                <Image
                  cacheId={cacheIds[selectedIndex]}
                  style={styles.mediaFill}
                  contentFit="contain"
                  source={{ uri: activeUri }}
                  cachePolicy="memory-disk"
                  priority="high"
                  recyclingKey={activeUri}
                  transition={140}
                  onLoadStart={() => setLoading(true)}
                  onLoad={() => setLoading(false)}
                  onError={() => setLoading(false)}
                />
              ) : (
                <MediaVideo
                  uri={activeUri}
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
                <Icon name="close" size={22} color={COLORS.TEXT_PRIMARY} />
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabs}
            >
              {uris.map((uri, index) => {
                const active = index === selectedIndex;
                return (
                  <View key={uri} style={styles.tabWrap}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Media ${index + 1}`}
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
                        {index + 1}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Portal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  modal: {
    justifyContent: "flex-end",
  },
  // modalContainer: căn giữa modal, padding ngang 16
  modalContainer: {
    alignItems: "center",
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  // sheet: panel chính, full width, bo góc 28, nền SURFACE, border BORDER
  sheet: {
    width: "100%",
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    backgroundColor: COLORS.SURFACE,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    ...SHADOWS.lg,
  },
  // handle: thanh kéo (drag handle) dạng hình chữ nhật bo tròn, căn giữa
  handle: {
    alignSelf: "center",
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: COLORS.BORDER,
    marginBottom: 14,
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
  // tabs: hàng ngang các tab, flex wrap
  tabs: {
    marginTop: 12,
    paddingRight: SPACING.md,
  },
  // tabWrap: wrapper từng tab, margin phải và dưới
  tabWrap: {
    marginRight: 8,
    marginBottom: 8,
  },
  // tabButton: nút tab dạng chip, minWidth 44, minHeight 40, bo góc chip
  tabButton: {
    minWidth: 44,
    minHeight: 40,
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
