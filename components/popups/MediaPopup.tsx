import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Modal, Portal, Text, useTheme } from "react-native-paper";
import { ResizeMode, Video } from "expo-av";
import { create } from "zustand";
import { CachedImage as Image } from "~/components/CachedImage";

import { COLORS, RADIUS } from "~/constants/DesignSystem";

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
//   - loading (useState<boolean>): true khi media đang load, khởi tạo true
//     Dùng để hiển thị "..." trên tab đang active trong lúc load
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

  return (
    <Portal>
      <Modal
        visible={uris.length > 0}
        onDismiss={hideMediaPopup}
        contentContainerStyle={styles.modalContainer}
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
          {uris.length > 0 &&
            (uris[selectedIndex].endsWith(".png") ||
            uris[selectedIndex].endsWith(".jpg") ? (
              <Image
                cacheId={cacheIds[selectedIndex]}
                style={styles.media}
                contentFit="contain"
                source={{ uri: uris[selectedIndex] }}
                cachePolicy="memory-disk"
                priority="high"
                recyclingKey={uris[selectedIndex]}
                onLoadStart={() => setLoading(true)}
                onLoad={() => setLoading(false)}
              />
            ) : (
              <Video
                source={{ uri: uris[selectedIndex] }}
                style={styles.media}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isMuted={false}
                isLooping
                onLoadStart={() => setLoading(true)}
                onLoad={() => setLoading(false)}
              />
            ))}

          {/*
            ── footer ───────────────────────────────────────────────────────────
            Tiêu đề (tên skin) + thanh tabs chọn media
            Mỗi tab là một nút tròn đánh số thứ tự, active thì nền đen chữ trắng
            */}
          <View style={styles.footer}>
            <Text style={[styles.title, { color: colors.text }]}>{text}</Text>

            <View style={styles.tabs}>
              {uris.map((uri, index) => {
                const active = index === selectedIndex;
                return (
                  <View key={uri} style={styles.tabWrap}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => setSelectedIndex(index)}
                      style={[
                        styles.tabButton,
                        active && styles.tabButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabButtonLabel,
                          active && styles.tabButtonLabelActive,
                        ]}
                      >
                        {active && loading ? "..." : index + 1}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </Portal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // modalContainer: căn giữa modal, padding ngang 16
  modalContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  // sheet: panel chính, full width, bo góc 28, nền SURFACE, border BORDER
  sheet: {
    width: "100%",
    borderRadius: 28,
    backgroundColor: COLORS.SURFACE,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
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
  // media: khung media tỷ lệ 16:9, full width, bo góc card, nền muted
  media: {
    aspectRatio: 16 / 9,
    width: "100%",
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  // footer: khoảng cách phía trên cho footer
  footer: {
    marginTop: 14,
  },
  // title: tiêu đề popup, 18px, bold 700, viết hoa chữ đầu
  title: {
    fontSize: 18,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  // tabs: hàng ngang các tab, flex wrap
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
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
