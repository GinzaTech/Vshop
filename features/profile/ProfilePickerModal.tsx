// ===== ProfilePickerModal.tsx – Modal chọn skin/spray/flex/card/title =====
// Presentational component: nhận toàn bộ options + callbacks equip từ
// ProfileScreen. Hiển thị 5 nhánh theo pickerState.type (weapon/expression/
// player-card/player-title/spray) và panel chọn chroma (long-press skin).

import React from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";
import { useAppWindowDimensions } from "~/components/ui/AppViewport";
import { Modal, Searchbar } from "react-native-paper";
import { PaperClearIcon, PaperSearchIcon } from "~/components/ui/PaperIcon";
import { useTranslation } from "~/hooks/useAppTranslation";

import { CachedImage as Image } from "~/components/CachedImage";
import AppIcon from "~/components/ui/AppIcon";
import ContentCardTouchable from "~/components/ui/ContentCardTouchable";
import { ProfilePickerSkinMetadata, pickerGlassStyles } from "./ProfilePickerGlassUI";
import { getProfilePickerGeometry } from "./profile-picker-geometry";
import { COLORS } from "~/constants/DesignSystem";
import { FALLBACK_IMAGE, formatSpraySlot, type EquippedSpray, type EquippedWeapon, type IdentityDetails } from "~/components/GalleryProfile";
import { getContentTierVisual } from "~/utils/content-tier";
import { styles } from "~/features/profile/profile-screen.styles";
import { usePickerModalFocus } from "~/features/profile/usePickerModalFocus";
import { ProfilePickerHost } from "~/features/profile/ProfilePickerHost";
import { ProfilePickerOptionBusy } from "~/features/profile/ProfilePickerOptionBusy";
import type { EquippedExpression, ExpressionKind, OwnedExpressionOption, OwnedSkinOption, OwnedSprayOption, PickerState } from "~/features/profile/profile-loadout";

/** ProfilePalette – Bộ màu truyền vào từ ProfileScreen (đã tính theo theme). */
export interface ProfilePalette {
  accent: string;
  background: string;
  card: string;
  cardBorder: string;
  chipBackground: string;
  textPrimary: string;
  textSecondary: string;
}

/**
 * ProfilePickerModalProps – Props của modal picker.
 * @param {object | null} activeWeaponChroma - Panel chọn chroma đang mở (weapon only).
 * @param {Function} handleDismissPicker - Đóng modal + reset state picker.
 * @param {Function} handleEquipExpression - Equip graffiti/flex đã chọn.
 * @param {Function} handleEquipIdentity - Equip player card/title đã chọn.
 * @param {Function} handleEquipSpray - Equip spray đã chọn (legacy path).
 * @param {Function} handleEquipWeapon - Equip skin/chroma cho vũ khí.
 * @param {Function} handleOpenExpressionPicker - Đổi tab graffiti/flex trong picker.
 * @param {IdentityDetails | null} identityDetails - Dữ liệu identity (subtitle picker).
 * @param {string} identityPickerQuery - Từ khóa tìm card/title.
 * @param {ProfilePalette} palette - Màu hiển thị.
 * @param {string | null} pickerError - Lỗi equip đang hiển thị trong modal.
 * @param {boolean} pickerLoading - Đang build options?
 * @param {PickerState | null} pickerState - Trạng thái picker (null = đóng).
 * @param {Function} setActiveWeaponChroma - Mở/đóng panel chroma.
 * @param {Function} setIdentityPickerQuery - Set từ khóa tìm kiếm.
 * @param {boolean} updatingLoadout - Đang có mutation loadout chạy?
 */
interface ProfilePickerModalProps {
  testID?: string;
  activeWeaponChroma: { weapon: EquippedWeapon; option: OwnedSkinOption } | null;
  handleDismissPicker: () => void;
  handleEquipExpression: (expression: EquippedExpression, option: OwnedExpressionOption) => void | Promise<unknown>;
  handleEquipIdentity: (type: "player-card" | "player-title", optionId: string) => void | Promise<unknown>;
  handleEquipSpray: (spray: EquippedSpray, option: OwnedSprayOption) => void | Promise<unknown>;
  handleEquipWeapon: (weapon: EquippedWeapon, option: OwnedSkinOption) => void | Promise<unknown>;
  handleOpenExpressionPicker: (expression: EquippedExpression, mode?: ExpressionKind) => void;
  identityDetails: IdentityDetails | null;
  identityPickerQuery: string;
  palette: ProfilePalette;
  pickerError: string | null;
  pickerLoading: boolean;
  pickerState: PickerState | null;
  setActiveWeaponChroma: React.Dispatch<React.SetStateAction<{ weapon: EquippedWeapon; option: OwnedSkinOption } | null>>;
  setIdentityPickerQuery: React.Dispatch<React.SetStateAction<string>>;
  updatingLoadout: boolean;
}

/**
 * ProfilePickerModal – Modal bottom-sheet chọn item để trang bị.
 * Tính tiêu đề/subtitle theo pickerState.type, lọc options card/title theo
 * từ khóa, render FlatList grid/list tương ứng và xử lý trạng thái busy.
 * @returns {JSX.Element | null} Modal content (Portal) hoặc null khi pickerState null.
 */
export function ProfilePickerModal({
  testID,
  activeWeaponChroma,
  handleDismissPicker,
  handleEquipExpression,
  handleEquipIdentity,
  handleEquipSpray,
  handleEquipWeapon,
  handleOpenExpressionPicker,
  identityDetails,
  identityPickerQuery,
  palette,
  pickerError,
  pickerLoading,
  pickerState,
  setActiveWeaponChroma,
  setIdentityPickerQuery,
  updatingLoadout,
}: ProfilePickerModalProps) {
    const { t } = useTranslation();
    const geometry = getProfilePickerGeometry(useAppWindowDimensions(), pickerState?.type);
    const { closeButtonRef, sheetRef, handleNativeShow } = usePickerModalFocus(Boolean(pickerState), handleDismissPicker);

  // pickerState null → picker đang đóng, không render gì cả.
  if (!pickerState) {
      return null;
    }

    // Option loading gates selection; background saving is informational.
    const pickerBusy = pickerLoading;

    // Tiêu đề/subtitle của sheet thay đổi theo loại picker.
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

    // Lọc options card/title theo từ khóa tìm kiếm (không phân biệt hoa thường).
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

    const content = (
          <Modal
              visible
              onDismiss={handleDismissPicker}
              contentContainerStyle={styles.pickerModalContainer}
          >
            <View style={[pickerGlassStyles.viewport, { height: geometry.viewportHeight }]}>
            <View
                ref={sheetRef}
                testID={testID}
                accessibilityViewIsModal
                style={[
                  styles.pickerSheet,
                  { backgroundColor: palette.card, borderColor: palette.cardBorder },
                  pickerGlassStyles.sheet,
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
                {pickerLoading || updatingLoadout ? (
                    <ActivityIndicator animating color={palette.accent} />
                ) : null}
                <TouchableOpacity
                    ref={closeButtonRef}
                    accessibilityLabel={t("common.close", { defaultValue: "Đóng" })}
                    accessibilityRole="button"
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
                  <AppIcon
                    color={palette.textPrimary}
                    decorative
                    name="close"
                    size={18}
                  />
                </TouchableOpacity>
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
                        pickerGlassStyles.target,
                        {
                          backgroundColor: palette.background,
                          borderColor: palette.cardBorder,
                        },
                      ]}
                      inputStyle={{ color: palette.textPrimary }}
                      iconColor={palette.textSecondary}
                      icon={PaperSearchIcon}
                      clearIcon={PaperClearIcon}
                      autoCorrect={false}
                  />
              ) : null}

              {/* Nhánh 1: picker skin vũ khí — grid responsive, long-press mở panel chroma */}
              {pickerState.type === "weapon" ? (
                  <FlatList
                      data={pickerState.options}
                      keyExtractor={(option) => option.id}
                      key={`${pickerState.type}-${geometry.columns}`}
                      numColumns={geometry.columns}
                      style={[styles.pickerList, pickerGlassStyles.list]}
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
                            <ContentCardTouchable
                                accessibilityRole="button"
                                accessibilityLabel={option.name}
                                accessibilityState={{ selected: option.selected, disabled: pickerBusy }}
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
                                  pickerGlassStyles.option,
                                  { width: geometry.cardWidth },
                                  {
                                    backgroundColor: tier.cardBackground,
                                    borderColor: option.selected ? palette.accent : tier.border,
                                  },
                                ]}
                            >
                              <View
                                  style={[
                                    styles.pickerOptionVisual,
                                    pickerGlassStyles.visual,
                                    { height: geometry.artHeight },
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
                                    transition={0}
                                />
                              </View>
                              <Text
                                  style={[
                                    styles.pickerOptionTitle,
                                  pickerGlassStyles.name,
                                    { color: palette.textPrimary },
                                  ]}

                              >
                                {option.name}
                              </Text>
                              <ProfilePickerSkinMetadata option={option} tier={tier} textColor={palette.textPrimary} />
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
                              <ProfilePickerOptionBusy busy={pickerBusy} color={palette.accent} />
                            </ContentCardTouchable>
                        );
                      }}
                  />
              ) : pickerState.type === "expression" ? (
                  // Nhánh 2: picker graffiti/flex — tab đổi kind + grid responsive
                  <>
                    <View
                        accessibilityRole="tablist"
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
                                accessibilityRole="tab"
                                accessibilityState={{ selected: active }}
                                activeOpacity={0.85}
                                onPress={() =>
                                    handleOpenExpressionPicker(
                                        pickerState.expression,
                                        mode
                                    )
                                }
                                style={[
                                  styles.expressionPickerTab,
                                  pickerGlassStyles.target,
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
                        key={`${pickerState.type}-${geometry.columns}`}
                      numColumns={geometry.columns}
                        style={[styles.pickerList, pickerGlassStyles.list]}
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
                            <ContentCardTouchable
                                accessibilityRole="button"
                                accessibilityLabel={option.name}
                                accessibilityState={{ selected: option.selected, disabled: pickerBusy }}
                                disabled={pickerBusy}
                                onPress={() =>
                                    handleEquipExpression(
                                        pickerState.expression,
                                        option
                                    )
                                }
                                style={[
                                  styles.pickerOptionCard,
                                  pickerGlassStyles.option,
                                  { width: geometry.cardWidth, minHeight: geometry.optionMinHeight, paddingVertical: geometry.optionPaddingVertical },
                                  {
                                    backgroundColor: COLORS.SURFACE_MUTED,
                                    borderColor: option.selected
                                        ? palette.accent
                                        : palette.cardBorder,
                                  },
                                ]}
                            >
                              <View
                                  style={[
                                    styles.pickerOptionVisual,
                                    pickerGlassStyles.visual,
                                    { height: geometry.artHeight },
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
                                    transition={0}
                                />
                              </View>
                              <Text style={[styles.pickerOptionTitle, pickerGlassStyles.name, { color: palette.textPrimary }]}>
                                {option.name}
                              </Text>
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
                              <ProfilePickerOptionBusy busy={pickerBusy} color={palette.accent} />
                            </ContentCardTouchable>
                        )}
                    />
                  </>
              ) : pickerState.type === "player-card" ? (
                  // Nhánh 3: picker player card — grid ảnh vuông + badge selected
                  <FlatList
                      data={filteredPlayerCardOptions}
                      keyExtractor={(option) => option.id}
                      key={`${pickerState.type}-${geometry.columns}`}
                      numColumns={geometry.columns}
                      style={[styles.pickerList, pickerGlassStyles.list]}
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
                          <ContentCardTouchable
                              accessibilityRole="button"
                              accessibilityState={{ selected: option.selected, disabled: pickerBusy }}
                              disabled={pickerBusy}
                              onPress={() => handleEquipIdentity("player-card", option.id)}
                              style={[
                                styles.identityPlayerCardOption,
                                pickerGlassStyles.option,
                                { width: geometry.cardWidth },
                                {
                                  backgroundColor: palette.background,
                                  borderColor: option.selected
                                      ? palette.accent
                                      : palette.cardBorder,
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
                                    <AppIcon
                                      color={COLORS.PURE_WHITE}
                                      decorative
                                      name="selected"
                                      size={13}
                                    />
                                  </View>
                              ) : null}
                            </View>
                            <Text
                                style={[
                                  styles.identityPlayerCardName,
                                  pickerGlassStyles.cardName,
                                  { color: palette.textPrimary },
                                ]}

                            >
                              {option.name}
                            </Text>
                            <ProfilePickerOptionBusy busy={pickerBusy} color={palette.accent} />
                          </ContentCardTouchable>
                      )}
                  />
              ) : pickerState.type === "player-title" ? (
                  // Nhánh 4: picker player title — list đơn giản + icon selected
                  <FlatList
                      data={filteredPlayerTitleOptions}
                      keyExtractor={(option) => option.id}
                      style={[styles.pickerList, pickerGlassStyles.list]}
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
                          <View style={{ marginBottom: 8, borderRadius: styles.identityTitleOption.borderRadius }}>
                          <TouchableOpacity
                              accessibilityRole="button"
                              accessibilityState={{ selected: option.selected, disabled: pickerBusy }}
                              activeOpacity={0.78}
                              disabled={pickerBusy}
                              onPress={() => handleEquipIdentity("player-title", option.id)}
                              style={[
                                styles.identityTitleOption,
                                pickerGlassStyles.title,
                                {
                                  backgroundColor: option.selected ? palette.chipBackground : palette.card,
                                  marginBottom: 0,
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

                            >
                              {option.name}
                            </Text>
                            <AppIcon
                                decorative
                                name={option.selected ? "selected" : "unselected"}
                                size={20}
                                color={
                                  option.selected ? palette.accent : palette.textSecondary
                                }
                            />
                          </TouchableOpacity>
                          </View>
                      )}
                  />
              ) : (
                  // Nhánh 5 (mặc định): picker spray — grid responsive
                  <FlatList
                      data={pickerState.options}
                      keyExtractor={(option) => option.id}
                      key={`${pickerState.type}-${geometry.columns}`}
                      numColumns={geometry.columns}
                      style={[styles.pickerList, pickerGlassStyles.list]}
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
                          <ContentCardTouchable
                              accessibilityRole="button"
                              accessibilityLabel={option.name}
                              accessibilityState={{ selected: option.selected, disabled: pickerBusy }}
                              disabled={pickerBusy}
                              onPress={() => handleEquipSpray(pickerState.spray, option)}
                              style={[
                                styles.pickerOptionCard,
                                pickerGlassStyles.option,
                                { width: geometry.cardWidth, minHeight: geometry.optionMinHeight, paddingVertical: geometry.optionPaddingVertical },
                                {
                                  backgroundColor: COLORS.SURFACE_MUTED,
                                  borderColor: option.selected
                                      ? palette.accent
                                      : palette.cardBorder,
                                },
                              ]}
                          >
                            <View
                                style={[
                                  styles.pickerOptionVisual,
                                    pickerGlassStyles.visual,
                                    { height: geometry.artHeight },
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
                                  transition={0}
                              />
                            </View>
                            <Text
                                style={[
                                  styles.pickerOptionTitle,
                                  pickerGlassStyles.name,
                                  { color: palette.textPrimary },
                                ]}

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
                            <ProfilePickerOptionBusy busy={pickerBusy} color={palette.accent} />
                          </ContentCardTouchable>
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
                      <AppIcon
                        color={palette.textPrimary}
                        decorative
                        name="close"
                        size={16}
                      />
                    </TouchableOpacity>
                    <Text
                        style={[styles.chromaPanelTitle, pickerGlassStyles.chromaHeading, { color: palette.textPrimary }]}
                    >
                      Chọn màu
                    </Text>
                    <Text
                        style={[
                          styles.chromaPanelSubtitle,
                          pickerGlassStyles.chromaHeading,
                          { color: palette.textSecondary },
                        ]}
                    >
                      {activeWeaponChroma.option.name}
                    </Text>
                    <View style={styles.chromaChipRow}>
                      {activeWeaponChroma.option.chromas.map((chroma) => (
                          <TouchableOpacity
                              key={chroma.id}
                              accessibilityRole="button"
                              accessibilityLabel={chroma.name}
                              accessibilityState={{ selected: chroma.selected, disabled: pickerBusy }}
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
                                pickerGlassStyles.chromaChip,
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
                                  pickerGlassStyles.chromaText,
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
            </View>
          </Modal>
    );
    return <ProfilePickerHost onDismiss={handleDismissPicker} onShow={handleNativeShow}>{content}</ProfilePickerHost>;
  }
