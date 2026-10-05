import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AppIcon, { type AppIconHandle } from "~/components/ui/AppIcon";
import { resolveAppIcon } from "~/components/ui/app-icon-registry";
import { canonicalD } from "morphicons/dom";

const mockWrites: { d: string }[] = [];
jest.mock("react-native-svg", () => {
  const ReactModule = require("react") as typeof React;
  const Path = ReactModule.forwardRef<{ setNativeProps: (props: { d: string }) => void }, { d: string }>((props, ref) => {
    ReactModule.useImperativeHandle(ref, () => ({ setNativeProps: (next: { d: string }) => mockWrites.push(next) }), []);
    return ReactModule.createElement("SvgPath", props);
  });
  return { __esModule: true, Path, default: ({ children }: React.PropsWithChildren) => ReactModule.createElement("SvgRoot", null, children) };
});

it.each([["navStore", "navShop"], ["navNightMarket", "navMore"]] as const)(
  "commits the real driver settled %s -> %s path into React props without remounting",
  (from, to) => {
    jest.useFakeTimers(); mockWrites.splice(0);
    const ref = React.createRef<AppIconHandle>();
    let renderer!: TestRenderer.ReactTestRenderer;
    const render = (name: typeof from | typeof to) => <AppIcon ref={ref} name={name} size={26} color="black" decorative />;
    try {
      act(() => { renderer = TestRenderer.create(render(from)); });
      const initialInstance = renderer.root.findByType(AppIcon);
      act(() => renderer.update(render(to)));
      const target = canonicalD(resolveAppIcon(to).icon);
      act(() => ref.current!.settle());
      expect(mockWrites.at(-1)?.d).toBe(target);
      expect(renderer.root.findByType("SvgPath" as React.ElementType).props.d).toBe(target);
      expect(renderer.root.findByType(AppIcon)).toBe(initialInstance);
      const retained = ref.current!.settle;
      act(() => renderer.unmount());
      const writes = mockWrites.length;
      act(() => retained());
      expect(mockWrites).toHaveLength(writes);
    } finally {
      act(() => renderer?.unmount()); jest.useRealTimers();
    }
  },
);
