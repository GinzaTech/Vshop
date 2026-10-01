import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SPACING } from "~/constants/DesignSystem";
import ValorantButton from "~/components/ui/ValorantButton";
import SkinShowcaseCard from "~/components/SkinShowcaseCard";
import type { EquippedWeapon } from "~/components/GalleryProfile";
import { useProfileState } from "~/features/profile/useProfileState";
import { useProfileMutations } from "~/features/profile/useProfileMutations";
import { ProfilePickerModal } from "~/features/profile/ProfilePickerModal";
import { ProfileExpressionSection } from "~/features/profile/ProfileEquipmentSections";
import type { EquippedExpression, ExpressionKind } from "~/features/profile/profile-loadout";
import type { PlayerLoadoutResponse } from "~/services/riot/api-types";
import type { ProfileWarmCache } from "~/utils/profile-cache";
import { VItemTypes } from "~/utils/misc";
import { createQaLoadout, createUiQaTransport, QA_PREVIEW_CARDS, QA_SKINS, QA_TITLES, QA_USER, QA_WEAPON_ID, QA_WRITE_DELAY_MS, qaSkinName, qaTitleName } from "./ui-qa-data";

const palette = { accent: COLORS.VALORANT_RED, background: COLORS.BACKGROUND, card: COLORS.SURFACE,
  cardBorder: COLORS.BORDER, chipBackground: COLORS.SURFACE_MUTED, textPrimary: COLORS.TEXT_PRIMARY, textSecondary: COLORS.TEXT_SECONDARY };

/** DEV route selects this module; production Metro substitutes ui-qa.production.js. */
export default function LocalUiQaScreen() {
  const [epoch, reset] = React.useReducer((value: number) => value + 1, 0);
  return <LocalQaSession key={epoch} onReset={reset} />;
}

function LocalQaSession({ onReset }: { onReset: () => void }) {
  const { t } = useTranslation(); const insets = useSafeAreaInsets();
  const [transport] = React.useState(createUiQaTransport);
  const [transportStats, setTransportStats] = React.useState(transport.getSnapshot);
  const [error, setError] = React.useState("");
  const [initial] = React.useState(createQaLoadout);
  const cache = React.useMemo<ProfileWarmCache>(() => ({ authKey: "local-ui-qa", loadoutSnapshot: initial, competitiveRank: null,
    ownedSkinItemIds: QA_SKINS.flatMap((skin) => [skin.skinLevelId, skin.chromaId]), ownedSprayItemIds: [], ownedFlexItemIds: [],
    ownedPlayerCardItemIds: [], ownedPlayerTitleItemIds: QA_TITLES.map((title) => title.id), updatedAt: 0 }), [initial]);
  const state = useProfileState({ user: QA_USER, cachedLoadoutSnapshot: initial, cachedProfile: cache, cachedCompetitiveRank: null, isProfileDemo: false });
  const { loadoutSnapshotRef, setLoadoutSnapshot, setRawGuns, setRawSprays, setRawActiveExpressions, setIdentity,
    setPickerState, setActiveWeaponChroma, setIdentityPickerQuery } = state;
  const lifetime = React.useRef(0);
  const viewAlive = React.useRef(true);

  React.useEffect(() => {
    const revision = ++lifetime.current;
    const isCurrentLifetime = () => lifetime.current === revision;
    viewAlive.current = true;
    const unsubscribe = transport.subscribe(() => { if (viewAlive.current) setTransportStats(transport.getSnapshot()); });
    return () => {
      unsubscribe();
      viewAlive.current = false;
      // StrictMode replays setup/cleanup in the same tick. UI detaches now;
      // an actual unmount disposes the isolated transport at the end of this tick.
      void Promise.resolve().then(() => { if (isCurrentLifetime()) transport.dispose(); });
    };
  }, [transport]);
  const syncLoadoutState = React.useCallback((response: PlayerLoadoutResponse) => {
    if (!viewAlive.current) return;
    loadoutSnapshotRef.current = response;
    setLoadoutSnapshot(response); setRawGuns(response.Guns); setRawSprays(response.Sprays);
    setRawActiveExpressions(response.ActiveExpressions ?? []); setIdentity(response.Identity);
  }, [loadoutSnapshotRef, setLoadoutSnapshot, setRawGuns, setRawSprays, setRawActiveExpressions, setIdentity]);
  const dismiss = React.useCallback(() => {
    if (!viewAlive.current) return;
    setPickerState(null); setActiveWeaponChroma(null); setIdentityPickerQuery("");
  }, [setPickerState, setActiveWeaponChroma, setIdentityPickerQuery]);
  const gun = state.rawGuns[0];
  const weapon: EquippedWeapon = { weaponId: QA_WEAPON_ID, weaponName: "QA Vandal", category: "Rifle",
    skinId: gun.SkinID, skinLevelId: gun.SkinLevelID, chromaId: gun.ChromaID, skinName: qaSkinName(gun.SkinID) };
  const skinOptions = QA_SKINS.map((skin) => ({ ...skin, selected: skin.skinId === gun.SkinID,
    chromas: skin.chromas.map((chroma) => ({ ...chroma, selected: chroma.id === gun.ChromaID })) }));
  const openWeapon = () => { if (viewAlive.current) state.setPickerState({ type: "weapon", weapon, options: skinOptions }); };
  const openTitle = () => { if (viewAlive.current) state.setPickerState({ type: "player-title", options: QA_TITLES.map((title) => ({ ...title,
    selected: title.id === state.identity?.PlayerTitleID })) }); };
  const expressions: EquippedExpression[] = state.rawActiveExpressions.map((entry, slotIndex) => ({
    slotIndex, id: entry.AssetID, kind: entry.TypeID === VItemTypes.Flex ? "flex" : "spray", name: `QASlot${slotIndex + 1}` }));
  const openExpression = (expression: EquippedExpression, mode: ExpressionKind = expression.kind) => { if (viewAlive.current) state.setPickerState({
    type: "expression", expression, mode, options: ["A", "B"].map((suffix) => ({ id: `qa-${mode}-${suffix.toLowerCase()}`,
      assetId: `qa-${mode}-${suffix.toLowerCase()}`, kind: mode, name: `QA${mode === "flex" ? "Flex" : "Graffiti"}${suffix}`, selected: false })) }); };
  const actions = useProfileMutations({ ...state, user: QA_USER, hasAuth: true, authKey: cache.authKey, cachedProfile: cache, cachedCompetitiveRank: null,
    t, syncLoadoutState, handleDismissPicker: dismiss, showLoadoutUpdateError: () => setError("Local QA change not confirmed; current failed field rolled back."),
    handleOpenWeaponPicker: openWeapon, loadoutDetails: [weapon], buildOwnedSkinOptions: () => skinOptions,
    setProfileCache: () => { throw new Error("Local QA must not persist account data"); }, loadoutRuntime: transport.runtime });
  const server = transport.getServer();
  const evidence = { ...transportStats, desiredSkin: qaSkinName(gun.SkinID), desiredTitle: qaTitleName(state.identity?.PlayerTitleID ?? ""),
    serverSkin: qaSkinName(server.Guns[0].SkinID), serverTitle: qaTitleName(server.Identity.PlayerTitleID),
    desiredExpressionAssets: state.rawActiveExpressions.map((entry) => entry.AssetID),
    serverExpressionAssets: (server.ActiveExpressions ?? []).map((entry) => entry.AssetID),
    pending: state.updatingLoadout, picker: state.pickerState?.type ?? null, error };
  const json = JSON.stringify(evidence);

  return <ScrollView testID="ui-qa-screen" style={styles.screen}
    contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.sm, paddingBottom: insets.bottom + SPACING.lg }]}>
    <Text accessibilityRole="header" style={styles.heading}>Local QA (no Riot)</Text>
    <Text testID="ui-qa-latency-note" style={styles.note}>Synthetic local ownership. Every write waits {QA_WRITE_DELAY_MS}ms. Public art only; demo prices are not shop data.</Text>
    <View style={styles.row}>
      <View testID="ui-qa-open-weapon" collapsable={false} style={styles.control}><ValorantButton title="QA weapon picker" onPress={openWeapon} /></View>
      <View testID="ui-qa-open-title" collapsable={false} style={styles.control}><ValorantButton title="QA title picker" onPress={openTitle} /></View>
    </View>
    <View style={styles.row}>
      <View testID="ui-qa-fail-next" collapsable={false} style={styles.control}><ValorantButton title="QA fail next write" variant="secondary" onPress={() => { if (viewAlive.current) transport.armFailure(); }} /></View>
      <View testID="ui-qa-reset" collapsable={false} style={styles.control}><ValorantButton title="QA reset local state" variant="secondary" onPress={() => { if (viewAlive.current) onReset(); }} /></View>
    </View>
    <View style={styles.stats}>
      {(["writeCount", "inFlight", "maxInFlight", "serverVersion"] as const).map((field) =>
        <Text key={field} testID={`ui-qa-${field}`} accessibilityLabel={`${field}=${evidence[field]}`} style={styles.stat}>{field}={evidence[field]}</Text>)}
    </View>
    <Text testID="ui-qa-desiredSkin" accessibilityLabel={`desiredSkin=${evidence.desiredSkin}`} style={styles.stat}>desiredSkin={evidence.desiredSkin}</Text>
    <Text testID="ui-qa-desiredTitle" accessibilityLabel={`desiredTitle=${evidence.desiredTitle}`} style={styles.stat}>desiredTitle={evidence.desiredTitle}</Text>
    <Text selectable testID="ui-qa-transport-stats" accessibilityLabel={json} style={styles.evidence}>{json}</Text>
    <Text testID="ui-qa-error" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>
    <View testID="ui-qa-expressions" collapsable={false}>
      <ProfileExpressionSection expressionDetails={expressions} sprayDetails={[]} onOpenExpressionPicker={openExpression} onOpenSprayPicker={() => undefined} t={t} />
    </View>
    <Text style={styles.note}>Native glass previews · synthetic price 1 · preview/wishlist input disabled</Text>
    <View testID="ui-qa-glass-previews" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.previews}>
      {QA_PREVIEW_CARDS.map((item) => <SkinShowcaseCard key={item.uuid} item={item} variant="store" />)}
    </View>
    <ProfilePickerModal {...actions} activeWeaponChroma={state.activeWeaponChroma} setActiveWeaponChroma={state.setActiveWeaponChroma}
      handleDismissPicker={dismiss} handleOpenExpressionPicker={openExpression} identityDetails={null} identityPickerQuery={state.identityPickerQuery}
      setIdentityPickerQuery={state.setIdentityPickerQuery} palette={palette} pickerError={state.pickerError} pickerLoading={state.pickerLoading}
      pickerState={state.pickerState} updatingLoadout={state.updatingLoadout} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.BACKGROUND }, content: { paddingHorizontal: SPACING.md, gap: SPACING.xs },
  heading: { fontSize: 18, fontWeight: "700", color: COLORS.TEXT_PRIMARY }, note: { fontSize: 12, color: COLORS.TEXT_SECONDARY },
  row: { flexDirection: "row", gap: SPACING.xs }, control: { flex: 1, minHeight: 48 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs }, stat: { fontSize: 12, color: COLORS.TEXT_PRIMARY },
  evidence: { fontSize: 10, lineHeight: 12, color: COLORS.TEXT_PRIMARY, backgroundColor: COLORS.SURFACE, borderRadius: RADIUS.sm, padding: SPACING.xs },
  error: { fontSize: 12, color: COLORS.WARNING }, previews: { gap: SPACING.md },
});
