// ===== AppIcon.web.tsx =====
// Bản web của AppIcon: morphicons đổi path SVG qua shim
// `setNativeProps({ d })` — trên react-native-web shim này là no-op
// (WebShape chỉ merge `props.style`), nên icon sau lần render đầu bị
// "đóng băng" khi `name` đổi (tab indicator, heart wishlist, chevron...).
// Giải pháp web: remount SVG khi identity icon màu đổi — mất hiệu ứng
// morph (web không morph nổi tiếng) nhưng đảm bảo icon phản ánh đúng state.
import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
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
  // Giữ nguyên handle API cho caller (tab bar gọi settle() khi repair)
  useImperativeHandle(
    ref,
    () => ({
      settle: () => morphRef.current?.set(definition.icon),
    }),
    [definition.icon],
  );

  // key = tên icon + màu + fill: đổi iconstate → remount SVG mới thay vì
  // phụ thuộc setNativeProps (no-op trên web).
  return (
    <MorphIcon
      key={`${name}|${color}|${definition.filled ? 1 : 0}`}
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
