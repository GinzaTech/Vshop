import React from "react";
import { useIsFocused } from "expo-router";
import { AccountSwitcherPopup } from "./AccountSwitcherPopup";

/** Subscribe inside the navigator, before the pure popup's Modal/Portal boundary. */
export function AccountSwitcherPopupHost(props: React.ComponentProps<typeof AccountSwitcherPopup>) {
  const focused = useIsFocused();
  const { visible, onDismiss } = props;
  React.useEffect(() => {
    if (!focused && visible) onDismiss();
  }, [focused, visible, onDismiss]);
  return <AccountSwitcherPopup {...props} visible={visible && focused} />;
}
