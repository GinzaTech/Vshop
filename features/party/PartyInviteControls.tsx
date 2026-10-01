import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GlassCard from "~/components/ui/GlassCard";
import { useAppWindowDimensions } from "~/components/ui/AppViewport";
import ValorantButton from "~/components/ui/ValorantButton";
import AppIcon from "~/components/ui/AppIcon";
import { COLORS, SPACING } from "~/constants/DesignSystem";
import { useMotionPreference } from "~/hooks/useMotionPreference";
import type { PartyActions, PartyViewModel } from "./party-types";
import type { usePartyActionGuard } from "./PartySelectors";
import { PARTY_ACCENT, partyStyles as s } from "./party.styles";

type Form = "join" | "invite";
type Props = {
  model: PartyViewModel;
  actions: PartyActions;
  disabled: boolean;
  pending: string | null;
  errorMessage: string | null;
  run: ReturnType<typeof usePartyActionGuard>["run"];
  onModalChange: (visible: boolean) => void;
};

/** Local form lifecycle only; transport and native Share belong to the controller. */
export default function PartyInviteControls(props: Props) {
  const { model, actions, disabled, pending, errorMessage, run, onModalChange } = props;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useMotionPreference();
  const { width, fontScale } = useAppWindowDimensions();
  const [form, setForm] = useState<Form | null>(null);
  const [value, setValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const input = useRef<TextInput>(null);
  const epoch = useRef(0);
  const focused = useRef(true);
  const latest = useRef(props);
  latest.current = props;
  const close = useCallback(() => {
    epoch.current += 1;
    Keyboard.dismiss();
    setForm(null); setValue(""); setValidationError(null);
    onModalChange(false);
  }, [onModalChange]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; close(); };
  }, [close]));
  useEffect(() => { close(); }, [model.partyId, close]);
  const canInvite = !!model.partyId && model.canManage && !model.isQueueing;
  useEffect(() => {
    if ((form === "join" && !model.canJoinParty) || (form === "invite" && !canInvite)) close();
  }, [model.canJoinParty, canInvite, form, close]);
  const open = (kind: Form) => {
    const current = latest.current;
    if (!focused.current || current.disabled || (kind === "join" ? !current.model.canJoinParty
      : !current.model.partyId || !current.model.canManage || current.model.isQueueing)) return;
    epoch.current += 1;
    setValue(""); setValidationError(null); setForm(kind); onModalChange(true);
  };
  const formEpoch = epoch.current;
  const formParty = model.partyId;
  const submit = async () => {
    const current = latest.current;
    if (!form || !focused.current || formEpoch !== epoch.current || formParty !== current.model.partyId || current.disabled) return;
    if (form === "join" ? !current.model.canJoinParty : !current.model.partyId || !current.model.canManage || current.model.isQueueing) return;
    const trimmed = value.trim();
    const hasControlCharacters = Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
    const valid = !hasControlCharacters && (form === "join" ? /^[A-Za-z0-9_-]{1,64}$/.test(trimmed)
      : /^[^#\r\n]+#[^#\s]+$/.test(trimmed) && trimmed.length <= 128);
    if (!valid) {
      setValidationError(form === "join"
        ? t("party_page.invalid_code", { defaultValue: "Enter a party code without spaces." })
        : t("party_page.invalid_riot_id", { defaultValue: "Enter a Riot ID as Name#Tag." }));
      input.current?.focus();
      return;
    }
    setValidationError(null);
    Keyboard.dismiss();
    const succeeded = await run(form === "join" ? "join" : "invite", () => form === "join"
      ? current.actions.onJoinCode(trimmed) : current.actions.onInviteByName(trimmed));
    if (succeeded && focused.current && formEpoch === epoch.current && formParty === latest.current.model.partyId
      && !latest.current.errorMessage) close();
  };
  const formBlocked = disabled || (form === "join" ? !model.canJoinParty : !canInvite);
  const fieldLabel = form === "join" ? t("party_page.code", { defaultValue: "Party code" })
    : t("party_page.riot_id", { defaultValue: "Riot ID (Name#Tag)" });
  const formTitle = form === "join" ? t("party_page.join_code", { defaultValue: "Join by code" })
    : t("party_page.invite_by_name", { defaultValue: "Invite by Riot ID" });
  const displayError = validationError || errorMessage;
  const generateControl = <Pressable accessible accessibilityRole="button" accessibilityLabel={t("party_page.generate", { defaultValue: "Generate" })}
    disabled={disabled || !model.partyId || !model.canManage || pending === "code"}
    accessibilityState={{ disabled: disabled || !model.partyId || !model.canManage || pending === "code", busy: pending === "code" }}
    style={({ pressed }) => [s.codeGenerate, model.code ? s.codeGenerateQuiet : s.codeGeneratePrimary,
      (disabled || !model.partyId || !model.canManage || pressed) && s.disabled]}
    onPress={() => { if (!disabled && model.partyId && model.canManage) void run("code", actions.onGenerateCode); }}>
    {pending === "code" && <ActivityIndicator color={model.code ? PARTY_ACCENT : COLORS.PURE_WHITE} />}
    <Text style={[model.code ? s.accentText : s.primaryText, s.codeGenerateText]} maxFontSizeMultiplier={2}>{t("party_page.generate", { defaultValue: "Generate" })}</Text>
  </Pressable>;
  return <>
    <View accessibilityElementsHidden={!!form} importantForAccessibility={form ? "no-hide-descendants" : "auto"}>
      <GlassCard style={[s.card, s.codePanel]} contentStyle={s.codePanelContent}>
        <View style={s.codeHeader} testID="party-code-header">
          <View style={s.codeHeaderLabel} testID="party-code-header-label">
            <AppIcon name="connected" size={18} color={COLORS.TEXT_SECONDARY} decorative />
            <Text style={s.title} accessibilityRole="header" maxFontSizeMultiplier={2}>{t("party_page.code", { defaultValue: "Party code" })}</Text>
          </View>
          {!!model.code && generateControl}
        </View>
        <View style={s.codeValueRow} testID="party-code-value-row">
          {model.code ? <ScrollView horizontal style={s.codeScroller} contentContainerStyle={s.codeScrollContent}>
            <Text style={s.codeValue} selectable maxFontSizeMultiplier={2}>{model.code}</Text>
          </ScrollView> : <Text style={[s.secondary, s.flexible]} maxFontSizeMultiplier={2}>{t("party_page.no_code", { defaultValue: "No code yet" })}</Text>}
          {!model.code && generateControl}
          {!!model.code && <View style={s.codeTools} testID="party-code-tools">
            {(["copy", "share"] as const).map(kind => {
              const busy = pending === (kind === "copy" ? "code" : "share");
              const blocked = disabled || busy;
              return <Pressable key={kind} accessible accessibilityRole="button"
                accessibilityLabel={t(`party_page.${kind}`, { defaultValue: kind === "copy" ? "Copy" : "Share" })}
                accessibilityState={{ disabled: blocked, busy }} disabled={blocked}
                style={({ pressed }) => [s.codeIconButton, (blocked || pressed) && s.disabled]}
                onPress={() => { if (!disabled && model.code) void run(kind === "copy" ? "code" : "share", kind === "copy" ? actions.onCopyCode : actions.onShareCode); }}>
                {busy ? <ActivityIndicator color={COLORS.TEXT_PRIMARY} /> : <AppIcon name={kind} size={20} color={COLORS.TEXT_PRIMARY} decorative />}
              </Pressable>;
            })}
          </View>}
        </View>
        <View style={s.divider} testID="party-code-divider" accessible={false} />
        <View style={[s.codeFormActions, (width < 360 || fontScale > 1.3) && s.codeFormActionsStacked]} testID="party-code-form-actions">
          {(["join", "invite"] as const).map(kind => {
            const blocked = disabled || (kind === "join" ? !model.canJoinParty : !canInvite);
            const label = kind === "join" ? t("party_page.join_code", { defaultValue: "Join by code" })
              : t("party_page.invite_by_name", { defaultValue: "Invite by Riot ID" });
            return <Pressable key={kind} accessible accessibilityRole="button" accessibilityLabel={label}
              accessibilityState={{ disabled: blocked }} disabled={blocked} onPress={() => open(kind)}
              style={({ pressed }) => [s.codeFormAction, (blocked || pressed) && s.disabled]}>
              <Text style={s.codeActionText} maxFontSizeMultiplier={2}>{label}</Text>
            </Pressable>;
          })}
        </View>
      </GlassCard>
    </View>
    {form && <Modal transparent visible animationType={reduceMotion ? "none" : "fade"} onRequestClose={close}
      onShow={() => input.current?.focus()}>
      <KeyboardAvoidingView style={s.formKeyboard} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={[s.backdrop, { paddingBottom: insets.bottom + SPACING.sm, paddingTop: insets.top + SPACING.sm }]}>
          <View style={s.dialog} accessibilityViewIsModal aria-modal>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.formContent}>
              <Text style={s.sectionTitle} accessibilityRole="header">{formTitle}</Text>
              <Text style={s.title} nativeID="party-invite-field-label">{fieldLabel}</Text>
              <TextInput ref={input} value={value} onChangeText={next => { setValue(next); setValidationError(null); }}
                style={s.formInput} accessibilityLabel={fieldLabel} accessibilityLabelledBy="party-invite-field-label"
                accessibilityHint={form === "invite" ? "Name#Tag" : fieldLabel} accessibilityState={{ disabled: formBlocked }}
                placeholder={form === "invite" ? "Name#Tag" : fieldLabel} placeholderTextColor={COLORS.TEXT_SECONDARY}
                editable={!formBlocked} autoCapitalize="none" autoCorrect={false} maxLength={form === "join" ? 64 : 128} maxFontSizeMultiplier={2}
                returnKeyType="done" onSubmitEditing={() => { void submit(); }} />
              {!!displayError && <Text style={s.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{displayError}</Text>}
              <ValorantButton title={form === "join" ? t("party_page.join_party", { defaultValue: "Join party" })
                : t("party_page.send_invite", { defaultValue: "Send invite" })} variant="glass"
                disabled={formBlocked} loading={pending === (form === "join" ? "join" : "invite")}
                onPress={() => { void submit(); }} style={s.primary} textStyle={s.smallPrimaryText} />
              <ValorantButton title={t("party_page.close_invite_form", { defaultValue: "Close invite form" })} variant="secondary"
                onPress={close} style={s.compactButton} textStyle={s.secondary} />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>}
  </>;
}
