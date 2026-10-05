import type { ViewStyle } from "react-native";

import { COLORS } from "~/constants/DesignSystem";

/** One material for the three balances and two rank cards in the Profile hero. */
export const PROFILE_METRIC_CARD_STYLE = {
  backgroundColor: COLORS.ON_DARK_BORDER,
  borderColor: COLORS.ON_DARK_BORDER,
  borderWidth: 1,
} satisfies ViewStyle;
