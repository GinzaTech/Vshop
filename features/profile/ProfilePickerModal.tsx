import React from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { Modal, Portal, Searchbar } from "react-native-paper";
import { useTranslation } from "react-i18next";

import { CachedImage as Image } from "~/components/CachedImage";
import { COLORS } from "~/constants/DesignSystem";
import { FALLBACK_IMAGE, formatSpraySlot, type EquippedSpray, type EquippedWeapon, type IdentityDetails } from "~/components/GalleryProfile";
import { getContentTierVisual } from "~/utils/content-tier";
import { styles } from "~/features/profile/profile-screen.styles";
import type { EquippedExpression, ExpressionKind, OwnedExpressionOption, OwnedSkinOption, OwnedSprayOption, PickerState } from "~/features/profile/profile-loadout";

export interface ProfilePalette {
  accent: string;
  background: string;
  card: string;
  cardBorder: string;
  chipBackground: string;
  textPrimary: string;
  textSecondary: string;
}

interface ProfilePickerModalProps {
  activeWeaponChroma: { weapon: EquippedWeapon; option: OwnedSkinOption } | null;
  handleDismissPicker: () => void;
  handleEquipExpression: (expression: EquippedExpression, option: OwnedExpressionOption) => void | Promise<void>;
  handleEquipIdentity: (type: "player-card" | "player-title", optionId: string) => void | Promise<void>;
  handleEquipSpray: (spray: EquippedSpray, option: OwnedSprayOption) => void | Promise<void>;
  handleEquipWeapon: (weapon: EquippedWeapon, option: OwnedSkinOption) => void | Promise<void>;
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

export function ProfilePickerModal({
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
                ) : null}
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
                                    backgroundColor: COLORS.SURFACE_MUTED,
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
                                  backgroundColor: COLORS.SURFACE_MUTED,
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
  }
