import { forwardRef, useEffect, useImperativeHandle, useMemo, useReducer, useRef } from "react";
import type { ReactElement } from "react";
import type { SvgProps } from "react-native-svg";
import {
  MorphIcon,
  type MorphHandle,
  type SpringPreset,
} from "morphicons/react-native";
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
  spring?: SpringPreset;
};

export type AppIconHandle = {
  settle: () => void;
};

const AppIcon = forwardRef<AppIconHandle, AppIconProps>(function AppIcon({
    name,
    size,
    color,
    strokeWidth,
    label,
    decorative = false,
    testID,
    spring = "snappy",
  }, ref): ReactElement {
  const definition = useMemo(() => resolveAppIcon(name), [name]);
  const morphRef = useRef<MorphHandle>(null);
  const alive = useRef(true);
  const [, commitSettledPaint] = useReducer((revision: number) => revision + 1, 0);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useImperativeHandle(
    ref,
    () => ({
      settle: () => {
        if (!alive.current) return;
        morphRef.current?.set(definition.icon);
        // MorphIcon keeps its live path in a ref. Commit that final path as
        // React SVG props too, so later native invalidations cannot paint the
        // old declared shape. Re-render this glyph; preserve its mounted driver.
        commitSettledPaint();
      },
    }),
    [definition.icon],
  );

  return (
    <MorphIcon
      ref={morphRef}
      icon={definition.icon}
      size={size}
      color={color}
      fill={definition.filled ? color : "none"}
      strokeWidth={strokeWidth}
      spring={spring}
      reducedMotion="user"
      label={decorative ? undefined : label}
      testID={testID}
    />
  );
});

export default AppIcon;
