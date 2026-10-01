import React, { useEffect, useRef, useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import GlassCard from "~/components/ui/GlassCard";
import AppIcon from "~/components/ui/AppIcon";
import { COLORS } from "~/constants/DesignSystem";
import { useMotionPreference } from "~/hooks/useMotionPreference";
import type { PartyActions, PartyViewModel } from "./party-types";
import { PARTY_ACCENT, partyStyles as s } from "./party.styles";

/** Synchronous lock closes the gap before the controller's busy prop renders. */
export function usePartyActionGuard(externalBusy: boolean, failureLabel: string) {
  const running = useRef(false);
  const mounted = useRef(true);
  const busyRef = useRef(externalBusy);
  busyRef.current = externalBusy;
  const [pending, setPending] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  async function run(name: string, callback: () => void | Promise<unknown>) {
    if (running.current || busyRef.current) return false;
    running.current = true;
    setPending(name);
    setLocalError(null);
    try {
      const result = await callback();
      if (result === false) {
        if (mounted.current) setLocalError(failureLabel);
        return false;
      }
      return true;
    } catch {
      if (mounted.current) setLocalError(failureLabel);
      return false;
    } finally {
      running.current = false;
      if (mounted.current) setPending(null);
    }
  }
  return { pending, localError, run };
}

type Props = {
  model: PartyViewModel;
  disabled: boolean;
  errorMessage: string | null;
  onQueueChange: PartyActions["onQueueChange"];
  onPrivacyChange: PartyActions["onPrivacyChange"];
};

export default function PartySelectors({ model, disabled, errorMessage, onQueueChange, onPrivacyChange }: Props) {
  const { t } = useTranslation();
  const reduceMotion = useMotionPreference();
  const [selector, setSelector] = useState<"queue" | "privacy" | null>(null);
  const [completed, setCompleted] = useState(false);
  useEffect(() => {
    if (!completed) return;
    if (!errorMessage) setSelector(null);
    setCompleted(false);
  }, [completed, errorMessage]);
  const guard = usePartyActionGuard(disabled, t("party_page.action_failed", { defaultValue: "Action failed. Please try again." }));
  const blocked = disabled || guard.pending !== null || !model.canManage || !model.partyId;
  const queueLabel = model.queueLabel || t("party_page.queue_unavailable", { defaultValue: "Queue unavailable" });
  const privacyLabel = model.privacy === "OPEN"
    ? t("party_page.open", { defaultValue: "Open" })
    : model.privacy === "CLOSED" ? t("party_page.closed", { defaultValue: "Closed" })
      : t("party_page.privacy_unavailable", { defaultValue: "Privacy unavailable" });
  const options = selector === "queue" ? model.queueOptions : [
    { id: "OPEN", label: t("party_page.open", { defaultValue: "Open" }), enabled: true },
    { id: "CLOSED", label: t("party_page.closed", { defaultValue: "Closed" }), enabled: true },
  ];
  const choose = async (id: string, enabled: boolean) => {
    if (blocked || !enabled) return;
    const succeeded = await guard.run("selector", () => selector === "queue"
      ? onQueueChange(id) : onPrivacyChange(id === "OPEN" ? "OPEN" : "CLOSED"));
    if (succeeded) setCompleted(true);
  };
  return (
    <>
      <GlassCard style={s.card} contentStyle={s.flush}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("party_page.queue_control", { defaultValue: "Queue: {{queue}}", queue: queueLabel })}
          accessibilityState={{ disabled: blocked, expanded: selector === "queue" }} disabled={blocked}
          onPress={() => setSelector("queue")} style={[s.settingsRow, blocked && s.disabled]}>
          <AppIcon name="combatSword" size={24} color={COLORS.TEXT_SECONDARY} decorative />
          <Text style={s.settingsLabel}>{t("party_page.queue", { defaultValue: "Queue" })}</Text>
          <Text style={s.settingsValue} numberOfLines={1}>{queueLabel}</Text>
          <AppIcon name="chevronDown" size={24} color={PARTY_ACCENT} decorative />
        </Pressable>
        <View style={s.divider} />
        <Pressable accessibilityRole="button" accessibilityLabel={t("party_page.privacy_control", { defaultValue: "Privacy: {{privacy}}", privacy: privacyLabel })}
          accessibilityState={{ disabled: blocked, expanded: selector === "privacy" }} disabled={blocked}
          onPress={() => setSelector("privacy")} style={[s.settingsRow, blocked && s.disabled]}>
          <AppIcon name="lockAgent" size={24} color={COLORS.TEXT_SECONDARY} decorative />
          <Text style={s.settingsLabel}>{t("party_page.privacy", { defaultValue: "Privacy" })}</Text>
          <Text style={s.settingsValue} numberOfLines={1}>{privacyLabel}</Text>
          <AppIcon name="chevronDown" size={24} color={PARTY_ACCENT} decorative />
        </Pressable>
      </GlassCard>
      {selector && <Modal transparent visible animationType={reduceMotion ? "none" : "fade"} onRequestClose={() => setSelector(null)}>
        <View style={s.backdrop}>
          <View style={s.dialog} accessibilityViewIsModal aria-modal>
            <View style={s.spread}>
              <Text style={[s.title, s.flexible]} accessibilityRole="header">{selector === "queue"
                ? t("party_page.choose_queue", { defaultValue: "Choose queue" })
                : t("party_page.choose_privacy", { defaultValue: "Choose privacy" })}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t("party_page.close_selector", { defaultValue: "Close selector" })}
                onPress={() => setSelector(null)} style={s.iconButton}>
                <AppIcon name="close" size={24} color={COLORS.TEXT_PRIMARY} decorative />
              </Pressable>
            </View>
            {(errorMessage || guard.localError) && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>{errorMessage || guard.localError}</Text>}
            <FlatList data={options} keyExtractor={item => item.id} renderItem={({ item }) => {
              const selected = item.id === (selector === "queue" ? model.queueId : model.privacy);
              const optionDisabled = blocked || !item.enabled;
              return <Pressable accessibilityRole="button" accessibilityLabel={item.label}
                accessibilityState={{ disabled: optionDisabled, selected, busy: guard.pending !== null }} disabled={optionDisabled}
                onPress={() => { void choose(item.id, item.enabled); }} style={[s.option, selected && s.selected, optionDisabled && s.disabled]}>
                <Text style={[s.secondary, s.flexible]} numberOfLines={2}>{item.label}</Text>
                {selected && <AppIcon name="check" size={20} color={PARTY_ACCENT} decorative />}
              </Pressable>;
            }} />
          </View>
        </View>
      </Modal>}
    </>
  );
}
