# VShop Web Phone Viewport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `executing-plans` to implement this plan task-by-task. Every code task uses checkbox tracking and RED → GREEN → refactor gates.

**Trạng thái:** complete — source, Android export và responsive web runtime đã xác minh; authenticated Riot flow không thuộc phạm vi thay đổi

**Goal:** Giữ toàn bộ Expo Web trong viewport điện thoại responsive tối đa 430 px trên PC, đồng thời cung cấp cùng chiều rộng hiệu dụng cho mọi layout calculation.

**Architecture:** `AppViewport` sở hữu visual frame tại root; `useAppWindowDimensions` clamp browser width nhưng giữ native dimensions. Mọi consumer hiện dùng `useWindowDimensions` chuyển sang boundary mới để CSS layout và JavaScript layout đồng ý về cùng một viewport.

**Tech Stack:** Expo SDK 57, React Native 0.86.3, React Native Web 0.21.2, Expo Router, TypeScript strict, Jest 29, pnpm 11.

**Spec:** `markdown/plans/2026-09-25-web-phone-viewport-design.md`

## Global Constraints

- Chỉ dùng `pnpm`; không tạo lockfile khác.
- Portrait `WEB_PHONE_MAX_WIDTH` chính xác là `430` CSS px; combat landscape tối
  đa `932×430`; browser nhỏ hơn dùng kích thước browser.
- Native Android/iOS không clamp hoặc scale dimensions.
- Không dùng CSS transform/zoom/iframe để giả lập điện thoại.
- Không log, đọc hoặc persist fragment/token Riot đang có trong browser.
- Không sửa auth/session/API behavior.
- Giữ toàn bộ thay đổi hiện có không liên quan trong worktree.
- Code mới phải có test và giữ TypeScript strict, zero-warning ESLint.

## Review Focus

1. Browser width đúng `430` không bị làm tròn hoặc giảm bởi border — Task 1.
2. Browser width nhỏ hơn `430`, kể cả `320`, không bị min-width/horizontal overflow — Task 1 và 3.
3. Native dimensions giữ nguyên mọi field — Task 1.
4. Pager/grid/tab bar không còn đọc browser width trực tiếp — Task 2.
5. Root loading overlay và nested navigation không thoát khỏi frame — Task 2 và 3.

---

### Task 1: Define the viewport policy and visual frame

**Files:**
- Create: `components/ui/AppViewport.tsx`
- Create: `__tests__/app-viewport.test.tsx`

**Interfaces:**
- Produces portrait `WEB_PHONE_MAX_WIDTH: 430` and landscape `932×430` constants.
- Produces `getAppViewportDimensions(dimensions, platform, orientation): ScaledSize`.
- Produces `useAppWindowDimensions(): ScaledSize`.
- Produces default `AppViewport({ children })`.

- [x] **Step 1: Write RED tests for web clamp and native parity**

```tsx
expect(getAppViewportDimensions(desktop, "web").width).toBe(430);
expect(getAppViewportDimensions(phone, "web").width).toBe(375);
expect(getAppViewportDimensions(desktop, "android")).toEqual(desktop);
```

Render `AppViewport` with a mocked 1440 px window and assert
`app-viewport-frame` receives width `430`; repeat with `375`.

- [x] **Step 2: Run RED**

```powershell
pnpm exec jest __tests__/app-viewport.test.tsx --runInBand
```

Expected: FAIL because `components/ui/AppViewport.tsx` does not exist.

- [x] **Step 3: Implement minimal immutable policy and component**

```tsx
export const WEB_PHONE_MAX_WIDTH = 430;

export function getAppViewportDimensions(
  dimensions: ScaledSize,
  platform: typeof Platform.OS,
): ScaledSize {
  return {
    ...dimensions,
    width: platform === "web"
      ? Math.min(dimensions.width, WEB_PHONE_MAX_WIDTH)
      : dimensions.width,
  };
}
```

`AppViewport` uses a full-width centered host and a flex frame whose numeric
width comes from `useAppWindowDimensions()`.

- [x] **Step 4: Run GREEN and targeted lint/typecheck**

```powershell
pnpm exec jest __tests__/app-viewport.test.tsx --runInBand
pnpm exec eslint components/ui/AppViewport.tsx __tests__/app-viewport.test.tsx --max-warnings=0
pnpm run typecheck
```

---

### Task 2: Integrate the app-wide viewport boundary

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app/setup.tsx`
- Modify: `app/reauth.tsx`
- Modify: `app/(authenticated)/_layout.tsx`
- Modify: `app/(authenticated)/shop.tsx`
- Modify: `app/(authenticated)/night_market.tsx`
- Modify: `app/(authenticated)/gallery.tsx`
- Modify: `app/(authenticated)/equip.tsx`
- Modify: `components/LoginWebView.tsx`
- Modify: `components/LoginWebView.web.tsx`
- Modify: `components/matches/MatchCard.tsx`
- Modify: `components/match-detail/PlayerPerformanceSummary.tsx`
- Modify: `components/match-detail/ScoreboardTable.tsx`
- Modify: `components/match-detail/RoundTimeline.tsx`
- Modify: `features/profile/useProfileSession.ts`
- Modify: `features/combat/CombatSessionScreen.tsx`
- Test: `__tests__/app-viewport.test.tsx`

**Interfaces:**
- Consumes all Task 1 exports.
- Root renders one `AppViewport` inside `GestureHandlerRootView`.
- All layout consumers import `useAppWindowDimensions`; only
  `components/ui/AppViewport.tsx` may import React Native `useWindowDimensions`.

- [x] **Step 1: Extend RED integration assertions**

Read source files and assert:

```tsx
expect(rootLayout).toMatch(/<AppViewport>/);
expect(directDimensionConsumers).toEqual(["components/ui/AppViewport.tsx"]);
```

- [x] **Step 2: Run RED**

```powershell
pnpm exec jest __tests__/app-viewport.test.tsx --runInBand
```

Expected: FAIL because root and consumers still use the raw window.

- [x] **Step 3: Integrate root and migrate imports without changing formulas**

Wrap the current responder/provider/navigation/loading subtree in
`AppViewport`. Replace only the hook import/call in consumers; preserve all
existing calculations and unrelated dirty-worktree edits.

- [x] **Step 4: Run GREEN and regression tests**

```powershell
pnpm exec jest __tests__/app-viewport.test.tsx __tests__/authenticated-navigation.test.tsx __tests__/profile-motion-cold-transition.test.tsx __tests__/login-webview-web.test.tsx __tests__/match-details-screen.test.tsx --runInBand
pnpm run typecheck
pnpm run lint
```

---

### Task 3: Verify runtime responsiveness and project gates

**Files:**
- Modify: `markdown/plans/2026-09-25-web-phone-viewport.md` to record evidence.

**Interfaces:**
- Consumes completed Task 1–2 implementation.
- Produces browser evidence and final gate status; no production publish.

- [x] **Step 1: Run full source/native gates**

```powershell
pnpm run check
git diff --check
```

- [x] **Step 2: Run Expo Web pentest server without using Riot credentials**

```powershell
pnpm run web:pentest
```

- [x] **Step 3: Verify large desktop browser**

At `1440×900`, open `/profile?demo=1`, `/history?demo=1` and a demo match.
Assert the root frame and Profile tab page are `430 px`; click Profile tabs,
scroll history and switch Scoreboard/Performance.

- [x] **Step 4: Verify small phone browser**

At `375×812`, repeat the demo flow. Assert root frame is `375 px`, root has no
horizontal overflow and the bottom nav remains visible.

- [x] **Step 5: Review diff and update evidence**

```powershell
git diff --stat
git diff --check
git status --short
```

Record PASS/FAIL/NOT VERIFIED honestly. Do not claim Riot-authenticated flow or
real FPS unless directly observed.

## Completion evidence — 2026-09-25

- `pnpm run check`: PASS — TypeScript, zero-warning ESLint, production audit,
  `104/104` Jest suites and `1202/1202` tests.
- Android export: PASS — total `10.19/12.00 MB`; Hermes `7.72/8.00 MB`; largest
  asset `1.25/1.50 MB`.
- Desktop browser `1440×900`: viewport host `1440 px`; app frame exactly
  `430 px`, centered at `x=505`; document `scrollWidth=1440`, no horizontal
  overflow. Profile segmented control `398 px`; bottom nav `333 px`.
- Phone browser `375×812`: host/frame exactly `375 px`; document and body
  `scrollWidth=375`.
- Narrow browser `320×700`: host/frame exactly `320 px`; document and body
  `scrollWidth=320`.
- Combat landscape contract: `1440×900` browser resolves to `932×430` and the
  context delivers the same dimensions to nested consumers. Runtime navigation
  without a valid session redirected to `/reauth`, so authenticated combat
  rendering remains NOT VERIFIED rather than inferred.
- Root error fallback is inside the same phone frame; memoized context value does
  not rerender a memoized consumer on unrelated root updates.
- Runtime flow PASS: Profile tab switching, Match History scroll, opening a demo
  match, Scoreboard/Performance switching, round 25 selection and player
  selection.
- Browser console: no runtime `error`; only the existing web warnings for
  `shadow*`, `expo-notifications`, deprecated `pointerEvents` prop and Animated
  JS fallback.
- Final handoff uses `pnpm run web:pentest`; port `8081` is listening and the
  retained `/profile?demo=1` tab measures `430 px` inside the default
  `1280×720` browser viewport (`x=425`, no document overflow).
- Responsive verification used demo routes and did not read, submit or persist
  Riot callback fragments. Authenticated Riot flow remains outside this UI-only
  change and was not used as proof.

