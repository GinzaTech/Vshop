import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet } from "react-native";
import { CachedImage } from "~/components/CachedImage";
import { COLORS } from "~/constants/DesignSystem";
import { MoreGlassWallpaper } from "~/components/ui/more-glass/MoreGlassWallpaper";
import { buildMoreGlassSceneUniforms } from "~/components/ui/more-glass/more-glass-scene-model";
import { MORE_GLASS_SCENE_SHADER } from "~/components/ui/more-glass/more-glass-scene-shader";

jest.mock("~/components/CachedImage", () => ({ CachedImage: "CachedImage" }));

it.each([undefined, 112, "https://example.invalid/old-pattern.png"])("uses a plain gray page without a wallpaper image for source %s", (source) => {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<MoreGlassWallpaper source={source} />); });
  expect(renderer.root.findAllByType(CachedImage)).toHaveLength(0);
  const background = renderer.root.findByProps({ testID: "more-neutral-background" });
  expect(StyleSheet.flatten(background.props.style)).toMatchObject({ backgroundColor: COLORS.BACKGROUND });
  expect(background.props.pointerEvents).toBe("none");
  act(() => renderer.unmount());
});

it("uses the same gray base inside the native shader instead of repainting a white page", () => {
  expect(COLORS.BACKGROUND).toBe(COLORS.SURFACE_MUTED);
  const uniforms = buildMoreGlassSceneUniforms(390, 844, []);
  expect(uniforms).toMatchObject({ pageColor: [236 / 255, 238 / 255, 240 / 255] });
  expect(MORE_GLASS_SCENE_SHADER).toContain("uniform float3 pageColor;");
  expect(MORE_GLASS_SCENE_SHADER).toContain("return mix(pageColor, pageBacking, wallpaperStrength);");
});
