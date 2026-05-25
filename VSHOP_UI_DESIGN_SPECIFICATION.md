# Vshop UI/UX & Design System Technical Specification (Comprehensive & AI-Readable)

Welcome to the unified UI/UX and Design System specification file for **Vshop**. This document provides an exhaustive, highly detailed, and technical blueprint of Vshop's user interface, components, layouts, micro-animations, and UX patterns. 

It is structured specifically for **Advanced AI Agents, Large Language Models (LLMs), and development tools (e.g., Google Project IDX, Google Stitch, Figma code converters)** to completely reconstruct, style, and extend the Vshop application without any visual or structural discrepancies.

---

## TABLE OF CONTENTS
1. **Design Philosophy & Visual Language**
2. **Global Tokens & Theme Variables (`Colors.ts` & `DesignSystem.ts`)**
3. **Typography & Spatial Constraints**
4. **Primitive UI Components (`components/ui/`)**
5. **Complex Domain Components (`components/`)**
6. **Detailed Mappings of Content Tiers (`utils/content-tier.ts`)**
7. **Screen-by-Screen Layout & Wireframe Architecture (`app/`)**
8. **UX Patterns, State Hydration, and Micro-interactions**
9. **Cross-Platform Adaptations (Mobile Native vs. React Native Web)**

---

## 1. DESIGN PHILOSOPHY & VISUAL LANGUAGE

Vshop implements a **premium, dark-mode-first, futuristic tactical aesthetic** designed as an elegant gaming companion. It moves away from generic, stark mobile apps by establishing a custom **Glassmorphism** visual language that aligns perfectly with the branding of Riot Games' Valorant.

### Core Aesthetic Pillars:
* **The "Cool Slate" Base**: Built upon muted steel blues and dark slates (`#dce1e8` for screens and `#171a1f` for deep slate blocks) to create a military-industrial tactical atmosphere.
* **Glassmorphism Depth**: Using semi-transparent cards backed by physical blurring layers (`expo-blur` `BlurView` with standard and dark tints) to simulate layered tactical HUDs.
* **Tactile Responsiveness (Haptics)**: Every physical press triggers instant, low-latency haptic pulses (`expo-haptics` Light impact) to simulate pressing mechanical control buttons.
* **Dynamic Rarity Coloration**: Weapon skin showcases automatically extract and bleed the HSL accent colors of their respective Valorant Content Tiers (Select, Deluxe, Premium, Exclusive, Ultra) onto borders, backgrounds, and badges.

---

## 2. GLOBAL TOKENS & THEME VARIABLES

All UI styling parameters are consolidated inside the design system tokens. **Hardcoded values must be avoided** in favor of these constants.

### A. Color Palette (`constants/DesignSystem.ts` & `constants/Colors.ts`)

| Token | Hex/RGBA Value | Design Role / Usage |
| :--- | :--- | :--- |
| `COLORS.BACKGROUND` | `#dce1e8` | The master screen canvas background (Soft light-slate grey). |
| `COLORS.SURFACE` | `#f1f4f8` | Premium light surface card background. |
| `COLORS.SURFACE_MUTED`| `#c6ced8` | Inactive, secondary, or disabled card/button backgrounds. |
| `COLORS.PURE_WHITE` | `#fcfdff` | High-contrast white text, icons, or highlighting elements. |
| `COLORS.PURE_BLACK` | `#171a1f` | Master dark charcoal slate; used for primary text & primary buttons. |
| `COLORS.TEXT_PRIMARY` | `#171a1f` | Default high-contrast readable text. |
| `COLORS.TEXT_SECONDARY`| `#4f5a67` | Subtitle text, secondary labels, and metadata. |
| `COLORS.BORDER` | `rgba(23, 26, 31, 0.14)` | Hairline boundaries separating cards and screen rows. |
| `COLORS.OVERLAY` | `rgba(23, 26, 31, 0.44)` | Dark transparent sheet backing for modal overlays. |
| `COLORS.ACCENT` | `#7b838f` | Default steel-grey accent. |
| `COLORS.ACCENT_DEEP` | `#2f343b` | Deep charcoal slate for container backing. |
| `COLORS.SUCCESS` | `#5f7a6b` | Forest green indicating "Equipped", "Active", or "Locked". |
| `COLORS.WARNING` | `#6e7884` | Steel grey indicator representing warning statuses. |
| `COLORS.VALORANT_DARK_BLUE`| `#4c5560`| Slaty dark background color, primarily for the VP Balance Pill. |
| `COLORS.GLASS_WHITE` | `rgba(241, 244, 248, 0.94)`| Opaque glass backing. |
| `COLORS.GLASS_WHITE_DIM`| `rgba(23, 26, 31, 0.58)`| Dimmed glass backing. |
| `COLORS.GLASS_BORDER` | `rgba(23, 26, 31, 0.14)`| Glass card bounding border. |

### B. Corner Radii (`RADIUS`)
Rounded corners are standard, scaling according to element hierarchies:
* **`RADIUS.screen`**: `32px` — Used for outer screen layouts or extreme-rounded bottom sheets.
* **`RADIUS.card`**: `24px` — Standard for all display panels, weapon skin showcases, and profile sections.
* **`RADIUS.button`**: `22px` — Utilized for tactile action buttons.
* **`RADIUS.chip`**: `999px` — Perfect rounded pill shape for status badges, tags, and small metadata capsules.

### C. Elevation & Shadowing (`GLOBAL_STYLES.shadow`)
* **Web (CSS)**: `boxShadow: "0px 18px 30px rgba(23, 26, 31, 0.16)"`
* **Mobile (iOS/Android Native)**:
  * `shadowColor`: `#171a1f`
  * `shadowOffset`: `{ width: 0, height: 16 }`
  * `shadowOpacity`: `0.16`
  * `shadowRadius`: `28`
  * `elevation`: `10`

---

## 3. TYPOGRAPHY & SPATIAL CONSTRAINTS

Vshop relies on a crisp sans-serif typeface hierarchy (e.g., standard platform font Inter, Outfit, or Roboto). Bold styles dominate the tactical HUD appearance.

### Font Styles:
* **Headers (Screen Title)**: `fontSize: 24`, `fontWeight: "700"`, `color: COLORS.TEXT_PRIMARY`.
* **Subheaders (Section Title)**: `fontSize: 18`, `fontWeight: "700"`, `color: COLORS.TEXT_PRIMARY`.
* **Eyebrows (Over-titles)**: `fontSize: 12`, `fontWeight: "700"`, `color: COLORS.TEXT_SECONDARY`, `textTransform: "uppercase"`, `letterSpacing: 0.5`.
* **Card Titles**: `fontSize: 15`, `fontWeight: "700"`, `lineHeight: 20`, `color: COLORS.TEXT_PRIMARY`.
* **Body / Meta Text**: `fontSize: 13` or `12`, `fontWeight: "600"`, `color: COLORS.TEXT_SECONDARY`.

### Standard Layout Spacing:
* **Screen Padding**: `20` all-around margins.
* **Item Lists Gaps**: Grid elements use `gap: 12` or `gap: 16` spacing.
* **Header Bottom Margin**: Spaced at `18` or `22` to give structural breathing room.

---

## 4. PRIMITIVE UI COMPONENTS

These primitive components in `components/ui/` are the structural blocks forming all screens.

### A. `GlassCard.tsx`
A glassmorphic panel with inner content cushioning.
* **Technical Structure**:
  * Outer `<View>` styled with `GLOBAL_STYLES.glassContainer` (radius `24`, border width `1`, border color `COLORS.BORDER`) and `GLOBAL_STYLES.shadow`.
  * Absolute-positioned `<BlurView>` inside the outer View, with `intensity` set to `18` and `tint` set to `"light"`.
  * Inner content `<View>` with default `padding: 16`.
* **UX Purpose**: Used as the containment block for shop listings, profile graphs, map showcases, and user stats.

### B. `ValorantButton.tsx`
A button incorporating tactile Haptics.
* **Properties**:
  * `title: string` (The label text).
  * `variant: "primary" | "secondary" | "glass"` (Button styling preset).
  * `icon?: React.ReactNode` (Optional leading icon, placed in `marginRight: 8` wrapper).
* **Styles**:
  * **Primary**: Background `COLORS.PURE_BLACK`, Text `COLORS.PURE_WHITE`. For dominant actions.
  * **Secondary**: Background `COLORS.SURFACE_MUTED`, Text `COLORS.TEXT_PRIMARY`, Border `COLORS.BORDER` (width `1`). For backing out or negative actions.
  * **Glass**: Background `rgba(255, 70, 85, 0.1)`, Text `COLORS.PURE_BLACK`. Inner absolute fill uses a `<BlurView intensity={20} tint="dark">`.
* **Behavior**: Triggers `expo-haptics` Light impact on tap.

### C. `InfoPill.tsx`
A flexible status indicator capsule.
* **Structure**: Flex container with `flexDirection: "row"`, `alignItems: "center"`, `borderRadius: 999`, `minHeight: 50`, `paddingHorizontal: 16`, `borderWidth: 1`, `borderColor: COLORS.BORDER`, `gap: 8`.
* **Child Normalization**: Evaluates its children array. Any pure string is wrapped in a `<Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.TEXT_PRIMARY }}>` to maintain style structure while leaving icons or special elements untouched.

### D. `EmptyStateCard.tsx`
Used when no content fits a filter.
* **Design**: Standard `GlassCard` featuring a centered layout, warning icon, a subheader text `fontSize: 16`, `fontWeight: "700"`, and a description paragraph with muted coloring.

### E. `SectionHeader.tsx`
Creates labeled dividers throughout scroll screens.
* **Layout**: Spans full horizontal space with a left-aligned bold title and a right-aligned muted metadata tag (e.g. "4 items").

---

## 5. COMPLEX DOMAIN COMPONENTS

### A. `SkinShowcaseCard.tsx` (Weapon Skin Card)
This is the most feature-rich card in the application, rendering Valorant skin items.

#### 1. Click Interaction Hierarchy (Double Tap Detection)
```
[User Taps Card]
       │
       ├─► Has first tap occurred within 220ms? (Checks previewTimeoutRef)
       │         │
       │         ├─► YES (Double Tap detected):
       │         │     │
       │         │     ├──► Clear previewTimeoutRef
       │         │     ├──► Toggle Wishlist State (Add/Remove)
       │         │     └──► Execute "Light Sweep" Animation
       │         │
       │         └─► NO (First Tap):
       │               │
       │               └──► Start 220ms previewTimeoutRef
       │                      │
       │                      └──► [Timer Expires with no second tap]:
       │                            └──► Launch Media Overlay (Video Preview / Streams)
```

#### 2. Light Sweep Micro-Animation
When a user adds a skin to their Wishlist, a brilliant diagonal beam sweeps across the card:
* **Mechanism**: An absolute-positioned, tilted `<Animated.Value>` panel (rotated at `14deg`, width `92px`) is translated horizontally across the card width using React Native `Animated`.
* **Animation Sequence**:
  ```typescript
  // Opacity increases quickly, sweeps across, and fades out
  Animated.sequence([
    Animated.timing(sweepOpacity, { toValue: 0.95, duration: 120, useNativeDriver: true }),
    Animated.timing(sweepOpacity, { toValue: 0, duration: 360, useNativeDriver: true })
  ]).start();

  Animated.timing(sweepTranslateX, {
    toValue: cardWidth + 120,
    duration: 520,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true
  }).start();
  ```
* **Visual Layer**: The animated block houses a `<BlurView intensity={55} tint="light">` with an additional white-tinted overlay (`rgba(255,255,255,0.14)`).

#### 3. Dynamic Rarity Frame Rendering
The card's border and background are determined by the skin's Valorant Content Tier. The card fetches details from `getContentTierVisual()`:
* **Card Backing**: `backgroundColor` takes `tier.cardBackground`.
* **Image Container**: A `18px` rounded frame (`styles.visualFrame`) takes `tier.visualBackground` and a border color of `tier.border`.
* **Metadata Badges (Tier & Price)**: Pill containers take `tier.badgeBackground` and a small colored dot is rendered on the left reflecting `tier.accent`.

#### 4. Screenshot / Privacy Mode
When `screenshotModeEnabled` is toggled in `useFeatureStore`, the card replaces the weapon's network image with a localized asset placeholder (`noimage.png`), preventing unwanted stream sniping or account recognition.

---

## 6. DETAILED MAPPINGS OF CONTENT TIERS

The app defines specific visual objects for every Valorant Content Tier using their official API UUIDs.

```typescript
export const CONTENT_TIER_VISUALS: Record<string, ContentTierVisual> = {
  // SELECT EDITION (Blue theme)
  "12683d76-48d7-84a3-4e09-6985794f0445": {
    label: "Select",
    accent: "#5A9FE2",
    text: "#214b77",
    border: "rgba(90, 159, 226, 0.34)",
    cardBackground: "rgba(90, 159, 226, 0.10)",
    visualBackground: "rgba(90, 159, 226, 0.18)",
    badgeBackground: "rgba(90, 159, 226, 0.16)",
    overlayBackground: "rgba(33, 75, 119, 0.44)",
  },
  // DELUXE EDITION (Teal/Green theme)
  "0cebb8be-46d7-c12a-d306-e9907bfc5a25": {
    label: "Deluxe",
    accent: "#009587",
    text: "#0d5a54",
    border: "rgba(0, 149, 135, 0.34)",
    cardBackground: "rgba(0, 149, 135, 0.10)",
    visualBackground: "rgba(0, 149, 135, 0.18)",
    badgeBackground: "rgba(0, 149, 135, 0.16)",
    overlayBackground: "rgba(13, 90, 84, 0.44)",
  },
  // PREMIUM EDITION (Magenta theme)
  "60bca009-4182-7998-dee7-b8a2558dc369": {
    label: "Premium",
    accent: "#D1548D",
    text: "#7f2952",
    border: "rgba(209, 84, 141, 0.34)",
    cardBackground: "rgba(209, 84, 141, 0.10)",
    visualBackground: "rgba(209, 84, 141, 0.18)",
    badgeBackground: "rgba(209, 84, 141, 0.16)",
    overlayBackground: "rgba(127, 41, 82, 0.44)",
  },
  // EXCLUSIVE EDITION (Orange theme)
  "e046854e-406c-37f4-6607-19a9ba8426fc": {
    label: "Exclusive",
    accent: "#F5955B",
    text: "#88512a",
    border: "rgba(245, 149, 91, 0.34)",
    cardBackground: "rgba(245, 149, 91, 0.10)",
    visualBackground: "rgba(245, 149, 91, 0.18)",
    badgeBackground: "rgba(245, 149, 91, 0.16)",
    overlayBackground: "rgba(136, 81, 42, 0.46)",
  },
  // ULTRA EDITION (Gold theme)
  "411e4a55-4e59-7757-41f0-86a53f101bb5": {
    label: "Ultra",
    accent: "#FAD663",
    text: "#7c6424",
    border: "rgba(250, 214, 99, 0.36)",
    cardBackground: "rgba(250, 214, 99, 0.12)",
    visualBackground: "rgba(250, 214, 99, 0.22)",
    badgeBackground: "rgba(250, 214, 99, 0.18)",
    overlayBackground: "rgba(124, 100, 36, 0.50)",
  }
};
```

---

## 7. SCREEN-BY-SCREEN LAYOUT & WIREFRAME ARCHITECTURE

### A. Shop Screen (`app/(authenticated)/shop.tsx`)
A scrollable dashboard presenting Valorant store offers.

```
+-------------------------------------------------------------+
|  [Initials Badge]  Hello, Player Name                       | <- PageIntro
|                    Check out your personal rotation today   |
|                                                             |
|  +---------------------------------------+  +------------+  |
|  | [Icon] Search skin by name...         |  | Wish [Icon]|  | <- Search bar & Toggle
|  +---------------------------------------+  +------------+  |
|                                                             |
|   [ All Rotations ]   [ Saved Wishlist ]                    | <- Filter Chips
|                                                             |
|  +-----------------------+   +---------------------------+  |
|  | VP Balance: 2,450 [v] |   | Resets in: 18:24:05 [Icon]|  | <- InfoPill Metrics
|  +-----------------------+   +---------------------------+  |
|                                                             |
|  Store Offers (4 items)                                     | <- SectionHeader
|  +-----------------------+   +---------------------------+  |
|  |                       |   |                           |  |
|  |  Reaver Vandal        |   |  Prime Spectre            |  | <- TwoColumnGrid
|  |  [Select Rarity] [VP] |   |  [Deluxe Rarity] [VP]     |  |
|  +-----------------------+   +---------------------------+  |
+-------------------------------------------------------------+
```

### B. Combat Session Details (`app/(authenticated)/combat_session.tsx`)
Tracks agent select and in-game statuses. Includes color indicators for teams.

#### 1. General Panel
* **Team Ally Block**: Header labeled `t("combat_session_page.your_team")`, bordered with a thick left-colored indicator bar. Players are displayed in horizontal rows with their agent selection on the left and rank icons on the right.
* **Team Enemy Block**: Header labeled `t("combat_session_page.enemy_team")`, featuring a red-highlighted side indicator.

#### 2. Incognito Naming Fallback Logic
The screen handles anonymous profiles (such as streamer modes or Riot API limitations in Live Game):
```typescript
const renderPlayerRow = (player) => {
  const subjectLower = player.subject.toLowerCase();
  
  // Try to lookup user real name from combatStore's cached subjects mapping
  const resolvedName = namesBySubject[subjectLower]; 
  const agent = agents.find((item) => item.uuid === player.agentId);

  // Fallback Name Assignment
  const displayName = resolvedName 
    ? `${resolvedName.gameName}#${resolvedName.tagLine}` 
    : (agent?.displayName || `Player ${player.subject.slice(0, 6)}`);

  // Secondary line detail logic (Avoid duplicating agent name in title and meta)
  const showMetaText = resolvedName || !agent?.displayName;
  const playerMeta = showMetaText 
    ? (agent?.displayName || t("combat_session_page.agent_unselected")) 
    : ""; // Return empty string to prevent visual duplication
}
```

### C. Combat Selection Screen (`app/(authenticated)/combat.tsx`)
Operates live lock-in capabilities when in pre-game agent selection.

* **Top Card**: Houses the active map (Map name, Queue type, and dynamic map preview image card `listViewIcon`).
* **Interactive InfoPill (Details Navigation)**:
  * The party count display indicator (`partySize/partyCapacity`) is wrapped inside a `TouchableOpacity` button:
  ```typescript
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={() => sessionSnapshot.state !== "idle" && router.push("/combat_session" as never)}
  >
    <InfoPill>
      <Icon name="account-group-outline" />
      <Text>{partySize}/{partyCapacity}</Text>
    </InfoPill>
  </TouchableOpacity>
  ```
  * Tapping this pill smoothly opens `/combat_session` for real-time overview during active match states.
* **Role Filters**: Grid of rounded buttons (Duelist, Controller, Initiator, Sentinel) with stylized Valorant role vectors. Selecting one filters the grid below.
* **Footer Button Lock**: Contains a secondary Cancel button and a primary dark Valorant lock button. The text updates dynamically based on selections: `"Lock " + selectedAgent.displayName`.

---

## 8. UX PATTERNS, STATE HYDRATION, AND MICRO-INTERACTIONS

### A. State Hydration (Zustand Stores)
UI screens hydrate their parameters asynchronously from background stores:
* **`useUserStore`**: Holds current login state, balances (Valorant Points, Radianite), and active shop responses.
* **`useWishlistStore`**: Manages favorite skin items and holds their UUID array. Double tapping an item updates this store instantly, triggering the sweep animation on the target card.
* **`useCombatStore`**: Manages real-time match hooks, and caches resolved subject names to prevent constant network lookups.

### B. Micro-interactions
* **Tactile Pressables**: Standard pressables scale down slightly (`activeOpacity: 0.85` or `scale: 0.98`) to feel responsive.
* **Countdown Clock**: The shop timer counts down every second using local React timers. On expiration, it fires a store re-fetch action to update offers automatically.

---

## 9. CROSS-PLATFORM ADAPTATIONS (MOBILE NATIVE vs. WEB)

Vshop is built to look stunning on both Mobile (iOS/Android Native) and React Native Web (browser viewports):

### A. Shadow Handling
Since native systems use Android `elevation` and iOS `shadowOpacity`, and Web uses CSS `boxShadow`, the shadow token is dynamic:
```typescript
const shadowStyle =
  Platform.OS === "web"
    ? { boxShadow: "0px 18px 30px rgba(23, 26, 31, 0.16)" }
    : {
        shadowColor: "#171a1f",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.16,
        shadowRadius: 28,
        elevation: 10,
      };
```

### B. Payment Integrations (`components/providers/`)
Vshop splits payment providers by platform to ensure compliance and support native controls:
* **`StripeProvider.native.tsx`**: Loads `@stripe/stripe-react-native` package for optimized Google Pay and Apple Pay sheets.
* **`StripeProvider.web.tsx`**: Fallback loading standard Stripe.js scripts.
* **`StripeProvider.tsx`**: Standard export dispatcher routing to the proper implementation depending on platform constraints.
