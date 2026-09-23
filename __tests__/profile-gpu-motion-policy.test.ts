import fs from "node:fs";
import path from "node:path";

const readSource = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("GPU-friendly profile motion policy", () => {
  it("does not animate the hero layout height during the profile mode morph", () => {
    const source = readSource("features/profile/ProfileHeroCard.tsx");

    expect(source).not.toMatch(
      /height:\s*interpolate\(\s*pageModeProgress\.value/
    );
  });

  it("keeps the measured hero height current after locale or async content changes", () => {
    const source = readSource("features/profile/ProfileHeroCard.tsx");

    expect(source).not.toContain("hasMeasuredHeroRef");
    expect(source).toMatch(
      /setHeroLayoutHeight\(\(current\)\s*=>\s*\n?\s*Math\.abs\(current - measuredHeight\)/
    );
  });

  it("splits rank surfaces with transforms instead of animated layout and borders", () => {
    const source = readSource("components/profile/RankSplitGroup.tsx");

    expect(source).not.toMatch(/gap:\s*interpolate\(/);
    expect(source).not.toMatch(/borderWidth:\s*interpolate\(/);
    expect(source).toContain("translateX");
  });

  it("does not keep large dashboard panels permanently rasterized", () => {
    const source = readSource("components/profile/PlayerInfoView.tsx");

    expect(source).not.toContain("renderToHardwareTextureAndroid");
    expect(source).not.toContain("shouldRasterizeIOS");
  });

  it("draws chart lines through the shared GPU canvas instead of rotated views", () => {
    const economy = readSource("components/match-detail/EconomyChart.tsx");
    const activity = readSource("components/profile/PlayerStatsActivity.tsx");

    expect(economy).toContain("GpuLineChartCanvas");
    expect(economy).not.toContain("lineStyle(");
    expect(activity).toContain("GpuLineChartCanvas");
    expect(activity).not.toContain("lineStyle(");
  });

  it("updates swap text once and leaves the visual transition on the UI thread", () => {
    const source = readSource("components/profile/TypewriterSwapText.tsx");

    expect(source).not.toContain("setTimeout(");
    expect(source).toContain("useAnimatedStyle");
  });

  it("does not stack per-label reveal animations on top of the hero mode morph", () => {
    const swapSource = readSource("components/profile/TypewriterSwapText.tsx");
    const heroSource = readSource("features/profile/ProfileHeroCard.tsx");
    const rankSource = readSource("components/profile/RankSplitGroup.tsx");

    expect(swapSource).toContain("animate = true");
    expect(swapSource).toContain("!animate || reduceMotionEnabled");
    expect(heroSource).toContain("animate={!profileModeTransitioning}");
    expect(heroSource).toContain("animateText={!profileModeTransitioning}");
    expect(rankSource).toContain("animateText: boolean");
    expect(rankSource).toContain("animate={animateText}");
  });

  it("crossfades the two hero surfaces without animating hidden stat subtrees", () => {
    const motionSource = readSource("features/profile/useProfileMotion.ts");
    const heroSource = readSource("features/profile/ProfileHeroCard.tsx");
    const rankSource = readSource("components/profile/RankSplitGroup.tsx");

    expect(motionSource).not.toMatch(
      /heroModeProgress\.value\s*=\s*withTiming/
    );
    expect(motionSource).not.toMatch(
      /rankSplitProgress\.value\s*=\s*withTiming/
    );
    expect(heroSource).toContain("const visibleStat = balanceStat");
    expect(rankSource).toContain('if (contentMode === "rank")');
    expect(rankSource).toContain("styles.staticRankContent");
  });

  it("does not interpolate full-screen profile backgrounds every frame", () => {
    const motionSource = readSource("features/profile/useProfileMotion.ts");
    const screenSource = readSource("features/profile/ProfileScreen.tsx");

    expect(motionSource).not.toContain("profileBodyBackgroundAnimatedStyle");
    expect(motionSource).not.toContain("profilePageBackgroundAnimatedStyle");
    expect(screenSource).toMatch(
      /isPlayerInfoMode\s*\?\s*PROFILE_INFO_COLORS\.background\s*:\s*COLORS\.PURE_WHITE/
    );
  });

  it("uses the shared standard duration instead of a delayed 420ms morph", () => {
    const source = readSource("features/profile/useProfileMotion.ts");

    expect(source).toContain(
      "const PROFILE_MODE_MORPH_DURATION_MS = MOTION_TIMING.standard.duration"
    );
    expect(source).not.toContain("PROFILE_MODE_MORPH_DURATION_MS = 420");
  });


  it("releases nested taps when the manual profile-content pan never activates", () => {
    const source = readSource(
      "features/profile/useProfileCollapsibleHeader.ts"
    );

    expect(source).toContain("contentPanActivated");
    expect(source).toMatch(
      /\.onTouchesUp\(\([^)]*stateManager[^)]*\)\s*=>\s*\{[^}]*stateManager\.fail\(\)/s
    );
    expect(source).toMatch(
      /\.onTouchesCancelled\(\([^)]*stateManager[^)]*\)\s*=>\s*\{[^}]*stateManager\.fail\(\)/s
    );
    expect(source).not.toContain(".onTouchesCancel(");
  });

  it("disables the parent content pan while the interactive stats dashboard is visible", () => {
    const pagerSource = readSource("features/profile/useProfilePager.ts");
    const gestureSource = readSource(
      "features/profile/useProfileCollapsibleHeader.ts"
    );
    const screenSource = readSource("features/profile/ProfileScreen.tsx");
    const dashboardSource = readSource("components/profile/PlayerInfoView.tsx");

    expect(pagerSource).toContain("contentPanEnabled: !isPlayerInfoMode");
    expect(gestureSource).toContain("contentPanEnabled: boolean");
    expect(gestureSource).toContain(".enabled(contentPanEnabled)");
    expect(screenSource).toMatch(
      /<Animated\.View\s+pointerEvents="box-none"\s+onLayout=\{handleHeaderLayout\}/
    );
    expect(screenSource).not.toContain(
      "contentPanGesture={profileContentPanGesture}"
    );
    expect(dashboardSource).not.toContain("contentPanGesture");
    expect(dashboardSource).not.toContain("Gesture.Native()");
  });

});
