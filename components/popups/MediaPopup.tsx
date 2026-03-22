import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Modal, Portal, Text, useTheme } from "react-native-paper";
import { ResizeMode, Video } from "expo-av";
import { create } from "zustand";
import { Image } from "expo-image";

import { COLORS, RADIUS } from "~/constants/DesignSystem";

interface IStore {
  uris: string[];
  text: string;
  selectedIndex: number;
  showMediaPopup: (uris: string[], text: string) => void;
  hideMediaPopup: () => void;
  setSelectedIndex: (index: number) => void;
}

export const useMediaPopupStore = create<IStore>((set) => ({
  uris: [],
  text: "",
  selectedIndex: 0,
  showMediaPopup: (uris: string[], text: string) =>
    set({ uris, text, selectedIndex: 0 }),
  hideMediaPopup: () => set({ uris: [], text: "" }),
  setSelectedIndex: (index: number) => set({ selectedIndex: index }),
}));

function MediaPopup() {
  const { uris, text, selectedIndex, setSelectedIndex, hideMediaPopup } =
    useMediaPopupStore();
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();

  return (
    <Portal>
      <Modal
        visible={uris.length > 0}
        onDismiss={hideMediaPopup}
        contentContainerStyle={styles.modalContainer}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {uris.length > 0 &&
            (uris[selectedIndex].endsWith(".png") ||
            uris[selectedIndex].endsWith(".jpg") ? (
              <Image
                style={styles.media}
                contentFit="contain"
                source={{ uri: uris[selectedIndex] }}
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

          <View style={styles.footer}>
            <Text style={[styles.title, { color: colors.text }]}>{text}</Text>

            <View style={styles.tabs}>
              {uris.map((_uri, index) => {
                const active = index === selectedIndex;
                return (
                  <View key={index} style={styles.tabWrap}>
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

const styles = StyleSheet.create({
  modalContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  sheet: {
    width: "100%",
    borderRadius: 28,
    backgroundColor: COLORS.SURFACE,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  handle: {
    alignSelf: "center",
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: COLORS.BORDER,
    marginBottom: 14,
  },
  media: {
    aspectRatio: 16 / 9,
    width: "100%",
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  footer: {
    marginTop: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
  },
  tabWrap: {
    marginRight: 8,
    marginBottom: 8,
  },
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
  tabButtonActive: {
    backgroundColor: COLORS.PURE_BLACK,
    borderColor: COLORS.PURE_BLACK,
  },
  tabButtonLabel: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "700",
  },
  tabButtonLabelActive: {
    color: COLORS.PURE_WHITE,
  },
});

export default MediaPopup;
