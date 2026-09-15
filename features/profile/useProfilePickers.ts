import React from "react";
import Toast from "react-native-toast-message";
import { runWhenIdle } from "~/utils/idle-task";
import { EquippedWeapon, EquippedSpray } from "~/components/GalleryProfile";
import { type EquippedExpression, type ExpressionKind } from "~/features/profile/profile-loadout";
import type { useProfileState } from "./useProfileState";
import type { useProfileSession } from "./useProfileSession";
import type { useProfilePickerOptions } from "./useProfilePickerOptions";
import type { useProfileLoadoutData } from "./useProfileLoadoutData";

type Props = Pick<ReturnType<typeof useProfileState>,
  "pickerTaskRef" |
  "setPickerLoading" |
  "setActiveWeaponChroma" |
  "setPickerState" |
  "setIdentityPickerQuery" |
  "setPickerError"> &
Pick<ReturnType<typeof useProfileSession>, "t"> &
Pick<ReturnType<typeof useProfilePickerOptions>, "buildOwnedSkinOptions" | "buildOwnedSprayOptions" | "buildOwnedExpressionOptions"> &
Pick<ReturnType<typeof useProfileLoadoutData>, "ownedPlayerCardOptions" | "ownedPlayerTitleOptions">;

export function useProfilePickers({
  pickerTaskRef, setPickerLoading, setActiveWeaponChroma, setPickerState, setIdentityPickerQuery,
  setPickerError, t, buildOwnedSkinOptions, buildOwnedSprayOptions, buildOwnedExpressionOptions,
  ownedPlayerCardOptions, ownedPlayerTitleOptions,
}: Props) {


  /**
   * handleDismissPicker — Đóng picker modal và reset state liên quan.
   */
  const handleDismissPicker = React.useCallback(() => {
    pickerTaskRef.current?.cancel();
    pickerTaskRef.current = null;
    setPickerLoading(false);
    setActiveWeaponChroma(null);
    setPickerState(null);
    setIdentityPickerQuery("");
    setPickerError(null);
  }, [pickerTaskRef, setActiveWeaponChroma, setIdentityPickerQuery, setPickerError, setPickerLoading, setPickerState]);
  // showLoadoutUpdateError: toast lỗi khi equip thất bại (dùng chung các handler equip).
  const showLoadoutUpdateError = React.useCallback(() => {
    Toast.show({
      type: "error",
      text1: t("equip_page.error_loading"),
    });
  }, [t]);

  /**
   * handleOpenWeaponPicker — Mở picker chọn skin cho vũ khí.
   * Load options bất đồng bộ khi JS runtime rảnh.
   */
  const handleOpenWeaponPicker = React.useCallback(
      (weapon: EquippedWeapon) => {
        pickerTaskRef.current?.cancel();
        setPickerError(null);
        setPickerLoading(true);
        setActiveWeaponChroma(null);

        pickerTaskRef.current = runWhenIdle(() => {
          const options = buildOwnedSkinOptions(weapon);
          React.startTransition(() => {
            setPickerState({
              type: "weapon",
              weapon,
              options,
            });
          });
          setPickerLoading(false);
          pickerTaskRef.current = null;
        });
      },
      [buildOwnedSkinOptions, pickerTaskRef, setActiveWeaponChroma, setPickerError, setPickerLoading, setPickerState]
  );
  // handleOpenSprayPicker: mở picker spray; build options khi JS rảnh (runWhenIdle).
  const handleOpenSprayPicker = React.useCallback(
      (spray: EquippedSpray) => {
        pickerTaskRef.current?.cancel();
        setPickerError(null);
        setPickerLoading(true);

        pickerTaskRef.current = runWhenIdle(() => {
          const options = buildOwnedSprayOptions(spray);
          React.startTransition(() => {
            setPickerState({
              type: "spray",
              spray,
              options,
            });
          });
          setPickerLoading(false);
          pickerTaskRef.current = null;
        });
      },
      [buildOwnedSprayOptions, pickerTaskRef, setPickerError, setPickerLoading, setPickerState]
  );
  // handleOpenExpressionPicker: mở picker graffiti/flex theo kind (mặc định kind hiện tại).
  const handleOpenExpressionPicker = React.useCallback(
      (expression: EquippedExpression, mode: ExpressionKind = expression.kind) => {
        pickerTaskRef.current?.cancel();
        setPickerError(null);
        setPickerLoading(true);

        pickerTaskRef.current = runWhenIdle(() => {
          const options = buildOwnedExpressionOptions(expression, mode);
          React.startTransition(() => {
            setPickerState({
              type: "expression",
              expression,
              mode,
              options,
            });
          });
          setPickerLoading(false);
          pickerTaskRef.current = null;
        });
      },
      [buildOwnedExpressionOptions, pickerTaskRef, setPickerError, setPickerLoading, setPickerState]
  );
  // handleOpenIdentityPicker: mở picker player card/title (options đã memo sẵn).
  const handleOpenIdentityPicker = React.useCallback(
      (type: "player-card" | "player-title") => {
        pickerTaskRef.current?.cancel();
        pickerTaskRef.current = null;
        setPickerLoading(false);
        setPickerError(null);
        setActiveWeaponChroma(null);
        setIdentityPickerQuery("");
        setPickerState(
            type === "player-card"
                ? { type: "player-card", options: ownedPlayerCardOptions }
                : { type: "player-title", options: ownedPlayerTitleOptions }
        );
      },
      [ownedPlayerCardOptions, ownedPlayerTitleOptions, pickerTaskRef, setActiveWeaponChroma, setIdentityPickerQuery, setPickerError, setPickerLoading, setPickerState]
  );
  return { handleDismissPicker, showLoadoutUpdateError, handleOpenWeaponPicker, handleOpenSprayPicker, handleOpenExpressionPicker, handleOpenIdentityPicker };
}
