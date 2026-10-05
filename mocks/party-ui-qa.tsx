import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SPACING, TYPOGRAPHY } from "~/constants/DesignSystem";
import ValorantButton from "~/components/ui/ValorantButton";
import PartyTeamPanel from "~/features/party/PartyTeamPanel";
import type { PartyMemberView } from "~/features/party/party-types";
import { getAssets } from "~/utils/valorant-assets";

type PublicAssets = Pick<ReturnType<typeof getAssets>, "cards" | "competitiveTiers">;
const names = [
  "Người chơi mẫu Nguyễn Thị Ánh Dương tên rất dài",
  "東京の長いプレイヤー名測試隊員一號",
  "QA Đồng đội",
  "繁體中文測試玩家與很長的名稱",
  "QA Chưa biết hạng",
] as const;
const previewTiers = [3, 9, 18, 27] as const;
const publicArt = (url: string | undefined) => url?.startsWith("https://media.valorant-api.com/") ? url : undefined;

function createMembers(assets: PublicAssets, selfReady: boolean): PartyMemberView[] {
  const ranks = (assets.competitiveTiers.at(-1)?.tiers ?? []).flatMap(tier => {
    const icon = publicArt(tier.smallIcon) ?? publicArt(tier.largeIcon);
    return tier.tier != null && tier.tier > 2 && tier.tierName?.trim() && icon
      ? [{ tier: tier.tier, name: tier.tierName, icon }] : [];
  });
  return names.map((name, index) => {
    // Four cached known ranks plus an intentional unknown; no invented art.
    const rank = index < previewTiers.length
      ? ranks.find(tier => tier.tier === previewTiers[index]) ?? ranks[index % ranks.length] : undefined;
    const card = assets.cards[index % assets.cards.length];
    return {
      id: `qa-team-${index + 1}`, name, tag: `QA${index + 1}`,
      avatarUrl: publicArt(card?.smallArt) ?? publicArt(card?.displayIcon),
      level: 20 + index * 35, pingMs: 15 + index * 12,
      rankIconUrl: rank?.icon, rankName: rank?.name, rr: rank ? index * 21 : undefined,
      ready: index === 0 ? selfReady : index % 2 === 1, isSelf: index === 0, isLeader: index === 0,
    };
  });
}

/** Reached only through the DEV QA module, replaced wholesale by Metro in release. */
export default function PartyUiQaScreen() {
  const insets = useSafeAreaInsets();
  const [assets] = React.useState(getAssets);
  const [selfReady, setSelfReady] = React.useState(false);
  const [disabled, setDisabled] = React.useState(false);
  const [empty, setEmpty] = React.useState(false);
  const members = createMembers(assets, selfReady);
  const onReady = (ready: boolean) => { if (!disabled && !empty) setSelfReady(ready); };
  return <View testID="party-qa-screen" collapsable={false} style={styles.screen}>
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, {
      paddingTop: insets.top + SPACING.sm, paddingBottom: insets.bottom + SPACING.lg,
    }]}>
      <Text accessibilityRole="header" style={styles.heading}>QA · TEAM MẪU — không phải phòng thật</Text>
      <View testID="party-qa-disable" collapsable={false}>
        <ValorantButton variant="secondary" title={disabled ? "QA · Mở nút sẵn sàng" : "QA · Khóa nút sẵn sàng"}
          onPress={() => setDisabled(value => !value)} />
      </View>
      <View testID="party-qa-empty" collapsable={false}>
        <ValorantButton variant="secondary" title={empty ? "QA · Hiện 5 thành viên mẫu" : "QA · Hiện đội trống"}
          onPress={() => setEmpty(value => !value)} />
      </View>
      <PartyTeamPanel members={empty ? [] : members} disabled={disabled} busy={false} onReady={onReady} />
      {members.filter(member => member.rankIconUrl).length < 4 && <Text style={styles.note}>
        Cache ảnh hạng public chưa đủ; các ô thiếu dùng biểu tượng chưa biết.
      </Text>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  content: { paddingHorizontal: SPACING.md, gap: SPACING.sm },
  heading: { fontSize: TYPOGRAPHY.titleSmall, fontWeight: "700", color: COLORS.TEXT_PRIMARY },
  note: { fontSize: TYPOGRAPHY.caption, color: COLORS.TEXT_SECONDARY },
});
