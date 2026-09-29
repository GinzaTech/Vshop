# White Bundle Detail Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the existing VShop Bundles screen into a white, reference-aligned bundle detail card with real pricing data and a horizontally scrollable item preview.

**Architecture:** Keep the existing route → store → parsed storefront flow. Extend the parsed bundle/item model with optional original prices, render each bundle as one self-contained light card, and replace the dark modal grid with an inline horizontal `FlatList`; no new dependencies or network requests are introduced.

**Tech Stack:** Expo SDK 57, React Native, TypeScript strict, Jest/jest-expo, `CachedImage`, VShop design tokens.

**Spec:** User-approved bounded design derived from `C:\Users\kona\Downloads\champions-2026-ui-spec.md` and `IMG_3552.png`. The direct user requirement overrides the reference document: screen/card/item backgrounds stay white or light gray; no black UI background is allowed.

**Trạng thái:** active — người dùng duyệt bằng tin nhắn `triển khai đi`

## Global Constraints

- The page canvas and bundle content surfaces use `COLORS.SURFACE`; item cards use `COLORS.BACKGROUND`/`COLORS.SURFACE_MUTED`. Black/dark colors are allowed only inside upstream artwork pixels and primary text.
- Preserve `PageIntro`, VP balance, pull-to-refresh, cached images, safe-area bottom padding and Android clipping.
- Remove the dark bundle-detail modal because all bundle items become visible inline.
- Use a horizontal `FlatList`, no wrapping, no arrow controls, and expose a partial next card without causing whole-page horizontal overflow.
- Use only real Riot storefront values. Show an old struck price only when `originalPrice > price`; do not invent ownership or green check badges.
- Keep weapon/melee images `contain`; accessory artwork remains contained and may use a square visual frame.
- Use VShop tokens; do not copy the reference document's dark raw hex palette into components.
- No new dependency, gradient, glass/blur, glow, black badge, sale badge or purchase button.
- Interactive controls retain 44 dp minimum targets. Horizontal list children expose concise accessibility summaries; decorative currency/art icons remain hidden from screen readers.
- Existing unrelated dirty files `components/ui/AppRefreshControl.web.tsx` and `components/ui/AppViewport.tsx` are protected and never staged.

## Review Focus

- A long localized bundle name must shrink/wrap without colliding with the fixed price column.
- Missing hero/item images must retain reserved layout space and use the existing fallback asset.
- No-discount pricing must render one current price, not duplicate identical old/current rows.
- Empty or one-item bundles must render without a broken carousel or page-level horizontal overflow.
- Nested horizontal swipes must remain usable inside the vertical Bundles `ScrollView`, with TalkBack reading each item once.

---

### Task 1: Preserve real bundle pricing and formatting

**Files:**
- Modify: `types/App.d.ts`
- Modify: `services/riot/storefront-parser.ts`
- Modify: `components/Countdown.tsx`
- Create: `utils/bundle-display.ts`
- Create: `__tests__/bundle-display.test.ts`
- Modify: `__tests__/storefront-parser.test.ts`

**Interfaces:**
- Produces `originalPrice?: number` on `BundleShopItem`, `SkinShopItem` and `AccessoryShopItem`.
- Produces `formatVp(value: number): string` and `formatBundleCountdown(timestamp: number, now?: number): string`.
- `Countdown` accepts `format="bundle"` without changing existing default/compact output.

- [ ] **Step 1: Write RED pricing/formatter tests**

```ts
expect(formatVp(6640)).toBe("6.640");
expect(formatVp(0)).toBe("0");
expect(formatBundleCountdown(now + (((21 * 24 + 6) * 60 + 4) * 60 + 27) * 1000, now))
  .toBe("21d 06:04:27");
expect(formatBundleCountdown(now - 1, now)).toBe("Ended");
```

Extend the storefront fixture with one bundle whose `TotalBaseCost` is `6640`, `TotalDiscountedCost` is `5310`, item `BasePrice` is `2675`, and item `DiscountedPrice` is `1766`. Assert the parsed bundle and item retain both values.

- [ ] **Step 2: Run RED**

Run: `pnpm exec jest __tests__/bundle-display.test.ts __tests__/storefront-parser.test.ts --runInBand`

Expected: formatter module/fields are missing.

- [ ] **Step 3: Implement the minimal immutable data mapping**

```ts
export function formatVp(value: number) {
  return Math.max(0, Math.trunc(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
```

Map `BasePrice` to `originalPrice`, `DiscountedPrice` to `price`, `TotalBaseCost[VP]` to bundle `originalPrice`, and `TotalDiscountedCost[VP]` to bundle `price`; retain current fallbacks when total maps are absent.

- [ ] **Step 4: Run GREEN and targeted lint**

Run:
- `pnpm exec jest __tests__/bundle-display.test.ts __tests__/storefront-parser.test.ts --runInBand`
- `pnpm exec eslint types/App.d.ts services/riot/storefront-parser.ts components/Countdown.tsx utils/bundle-display.ts __tests__/bundle-display.test.ts __tests__/storefront-parser.test.ts --max-warnings=0`

Expected: PASS.

### Task 2: Build the white bundle card and horizontal item preview

**Files:**
- Modify: `components/BundleImage.tsx`
- Modify: `components/BundleItem.tsx`
- Create: `__tests__/bundle-card.test.tsx`

**Interfaces:**
- `BundleImage` consumes `{ bundle, remainingSecs }`; it no longer requires `onPress`.
- `BundleItem` consumes `{ item, width }` and renders a compact non-interactive list item summary.

- [ ] **Step 1: Write RED component tests**

Render a Champions bundle and assert:

```ts
expect(screen.getByText("Champions 2026")).toBeTruthy();
expect(screen.getByText("6.640")).toBeTruthy();
expect(screen.getByText("2.675")).toBeTruthy();
expect(screen.getByText("1.766")).toBeTruthy();
expect(screen.getByTestId("bundle-item-carousel").props.horizontal).toBe(true);
expect(StyleSheet.flatten(screen.getByTestId("bundle-card").props.style).backgroundColor)
  .toBe(COLORS.SURFACE);
```

Add cases for no discount, long names, missing image fallback, one item and item accessibility label.

- [ ] **Step 2: Run RED**

Run: `pnpm exec jest __tests__/bundle-card.test.tsx --runInBand`

Expected: the carousel/test IDs/new prop contract do not exist.

- [ ] **Step 3: Implement reference hierarchy with light tokens**

Render:

```text
hero artwork
title + bundle price
timer + item count
estimate copy
horizontal FlatList of compact item cards
```

Use `useWindowDimensions()` only to derive a stable card width clamped to the compact/tablet range. Keep `renderItem`, `keyExtractor` and `getItemLayout` stable; set `accessible={false}` on the `FlatList` so list-item summaries remain individually reachable.

- [ ] **Step 4: Run GREEN and targeted lint**

Run:
- `pnpm exec jest __tests__/bundle-card.test.tsx --runInBand`
- `pnpm exec eslint components/BundleImage.tsx components/BundleItem.tsx __tests__/bundle-card.test.tsx --max-warnings=0`

Expected: PASS.

### Task 3: Integrate the inline card, translations and device verification

**Files:**
- Modify: `app/(authenticated)/bundles.tsx`
- Modify: `assets/i18n/en.json`
- Modify: `assets/i18n/vi.json`
- Create: `__tests__/bundle-screen-boundary.test.ts`
- Modify: `CHANGELOG.md`
- Modify: `markdown/plans/README.md`
- Modify: `markdown/plans/2026-09-30-white-bundle-detail-card.md`

**Interfaces:**
- Bundles route maps store bundles directly to `BundleImage` and contains no `Modal`, `BlurView`, `Portal`, `TwoColumnGrid` or selected-bundle state.

- [ ] **Step 1: Write RED screen-boundary tests**

Read the route source and assert the dark modal imports/state are absent, `BundleImage` receives `bundle` and `remainingSecs`, screen/balance surfaces use the light design tokens, and the two new translation keys exist in English/Vietnamese.

- [ ] **Step 2: Run RED**

Run: `pnpm exec jest __tests__/bundle-screen-boundary.test.ts --runInBand`

Expected: the route still contains the modal flow and translations are missing.

- [ ] **Step 3: Remove the modal path and finish light-screen integration**

Add `bundles_page.ends_in` and `bundles_page.estimate` in English/Vietnamese. Preserve all existing empty/refresh behavior. Update changelog as a UI-only Bundle change; no version/native release change.

- [ ] **Step 4: Run targeted tests and full gates**

Run:
- `pnpm exec jest __tests__/bundle-display.test.ts __tests__/storefront-parser.test.ts __tests__/bundle-card.test.tsx __tests__/bundle-screen-boundary.test.ts --runInBand`
- `pnpm run check`
- `git diff --check`

Expected: PASS.

- [ ] **Step 5: Verify on device `45218ba`**

With Metro already running, reload the dev client, open Bundles, capture after screenshot, and verify:

- white canvas and white/light cards;
- no black UI surface/badge/modal;
- Champions hero not distorted;
- title/price/meta hierarchy matches the reference;
- horizontal swipe works and exposes a partial next card;
- vertical page scrolling remains responsive;
- long text and item images stay within bounds;
- TalkBack/UI hierarchy contains bundle/item summaries once.

Record source/build/device outcomes separately and mark any unobserved interaction `NOT VERIFIED`.

## Completion Audit

- [ ] Direct white-background instruction overrides every dark-background statement in the external reference.
- [ ] Parser uses real base/discounted prices and never fabricates ownership.
- [ ] Bundle/item/card backgrounds contain no black/dark UI color.
- [ ] Carousel is horizontal, non-wrapping and contained within the card.
- [ ] Targeted tests and `pnpm run check` PASS.
- [ ] Device screenshot and horizontal/vertical interaction evidence captured on `45218ba`.
- [ ] Existing unrelated dirty files remain untouched and unstaged.
