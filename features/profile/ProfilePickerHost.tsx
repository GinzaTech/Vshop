import type { ReactNode } from "react";
import { Modal, Platform } from "react-native";
import { Portal } from "react-native-paper";

/** Native dialog isolation, with unchanged Paper contents and web Portal. */
export function ProfilePickerHost({ children, onDismiss, onShow }: {
  children: ReactNode; onDismiss: () => void; onShow: () => void;
}) {
  return <Portal>{Platform.OS === "web" ? children : (
    <Modal visible transparent animationType="none" onRequestClose={onDismiss} onShow={onShow}>
      {children}
    </Modal>
  )}</Portal>;
}
