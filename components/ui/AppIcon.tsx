import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useMemo } from "react";
import type { ReactElement } from "react";
import type { SvgProps } from "react-native-svg";
import { MorphIcon } from "morphicons/react-native";
import {
  resolveAppIcon,
  type AppIconName,
} from "~/components/ui/app-icon-registry";

export type AppIconProps = {
  name: AppIconName;
  size: number;
  color: string;
  strokeWidth?: number;
  label?: string;
  decorative?: boolean;
  testID?: SvgProps["testID"];
};

export default function AppIcon({
  name,
  size,
  color,
  strokeWidth,
  label,
  decorative = false,
  testID,
}: AppIconProps): ReactElement {
  const definition = useMemo(() => resolveAppIcon(name), [name]);

  if (definition.kind === "legacy") {
    return (
      <MaterialCommunityIcons
        name={definition.legacyName}
        size={size}
        color={color}
        importantForAccessibility="no"
        accessibilityElementsHidden
        testID={testID}
      />
    );
  }

  return (
    <MorphIcon
      icon={definition.icon}
      size={size}
      color={color}
      fill={definition.filled ? color : "none"}
      strokeWidth={strokeWidth}
      spring="snappy"
      reducedMotion="user"
      label={decorative ? undefined : label}
      testID={testID}
    />
  );
}
