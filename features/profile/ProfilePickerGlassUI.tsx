import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { CachedImage as Image } from "~/components/CachedImage";
import { FALLBACK_IMAGE } from "~/components/GalleryProfile";
import AppIcon from "~/components/ui/AppIcon";
import { RADIUS, SPACING } from "~/constants/DesignSystem";
import { useTranslation } from "~/hooks/useAppTranslation";
import type { ContentTierVisual } from "~/utils/content-tier";
import type { OwnedSkinOption } from "./profile-loadout";
import { styles } from "./profile-screen.styles";

/** Skin badges and chroma hints retain all values without owning callbacks. */
export function ProfilePickerSkinMetadata({ option, tier, textColor }: {
  option: OwnedSkinOption; tier: ContentTierVisual; textColor: string;
}) {
  const { t } = useTranslation();
  const badgeStyle = [styles.pickerOptionBadge, pickerGlassStyles.badge,
    { backgroundColor: tier.badgeBackground, borderColor: tier.border }];
  const badgeTextStyle = [styles.pickerOptionBadgeText, { color: tier.text, flexShrink: 1, fontSize: 11, lineHeight: 14 }];
  return <>
    {option.chromas.length > 0 ? (
      <View style={[styles.pickerChipHintRow, pickerGlassStyles.hints]}>
        {option.chromas.slice(0, 3).map((chroma) => (
          <View key={chroma.id} style={styles.pickerChipHint}>
            <Image cacheId={`skin-chroma:${chroma.id}:swatch`}
              source={chroma.swatch ? { uri: chroma.swatch } : chroma.image ? { uri: chroma.image } : FALLBACK_IMAGE}
              style={styles.pickerChipHintImage} contentFit="cover" />
          </View>
        ))}
        {option.chromas.length > 3 ? (
          <View style={styles.pickerChipHintMore}>
            <Text style={[styles.pickerChipHintMoreText, { color: textColor, fontSize: 11 }]}>
              +{option.chromas.length - 3}
            </Text>
          </View>
        ) : null}
      </View>
    ) : null}
    <View style={[styles.pickerOptionMeta, pickerGlassStyles.metadata]}>
      <View style={badgeStyle}>
        <View style={[styles.pickerOptionDot, { backgroundColor: tier.accent }]} />
        <Text style={badgeTextStyle}>{option.contentTierName || tier.label}</Text>
      </View>
      {option.upgradeLevel ? (
        <View style={badgeStyle}>
          <AppIcon decorative name="chevronUp" size={12} color={tier.text} />
          <Text style={badgeTextStyle}>
            {option.maxUpgradeLevel && option.maxUpgradeLevel > 1
              ? t("profile_page.level", { level: `${option.upgradeLevel}/${option.maxUpgradeLevel}` })
              : t("profile_page.level", { level: option.upgradeLevel })}
          </Text>
        </View>
      ) : null}
    </View>
  </>;
}

/** Picker-local overrides; the shared Profile styles remain owned by the parent. */
export const pickerGlassStyles = StyleSheet.create({
  viewport: { overflow: "hidden", borderRadius: RADIUS.screen },
  sheet: { flex: 1, maxHeight: "100%" },
  list: { flex: 1, minHeight: 48 },
  option: { minHeight: 48, padding: SPACING.xs, marginBottom: SPACING.xs, borderRadius: RADIUS.card },
  visual: { padding: SPACING.xxs, marginBottom: SPACING.xxs, borderRadius: RADIUS.md },
  name: { fontSize: 13, lineHeight: 17, minHeight: 34 },
  cardName: { fontSize: 13, lineHeight: 17, marginTop: SPACING.xxs },
  hints: { marginTop: SPACING.xxs, flexWrap: "wrap", rowGap: SPACING.xxs },
  metadata: { marginTop: SPACING.xxs },
  badge: { maxWidth: "100%", paddingHorizontal: SPACING.xxs, paddingVertical: 3, marginRight: SPACING.xxs, marginBottom: SPACING.xxs },
  title: { minHeight: 48, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  target: { minHeight: 48 },
  chromaText: { flexShrink: 1 },
  chromaChip: { minHeight: 48, maxWidth: "100%", flexShrink: 1 },
  chromaHeading: { paddingRight: 58 },
});
