# VShop

<a href="https://github.com/GinzaTech/Vshop/releases/latest">
  <img alt="GitHub release" src="https://img.shields.io/github/v/release/GinzaTech/Vshop?color=%23fa4454&logo=github&logoColor=white">
</a>
<a href="https://github.com/GinzaTech/Vshop/releases/latest">
  <img alt="APK Download" src="https://img.shields.io/github/downloads/GinzaTech/Vshop/latest/total?label=APK%20Downloads&color=%23fa4454&logo=android&logoColor=white">
</a>
<a href="https://hosted.weblate.org/engage/vshop/">
  <img src="https://hosted.weblate.org/widget/vshop/mobile/multi-red.svg" alt="Translation status" />
</a>

A third-party companion app for **Valorant** — browse the daily store, check match history, view your profile loadout, track competitive rank, chat with friends, and more.

---

## Table of Contents

- [English](#english)
  - [Features](#features)
  - [Tech Stack](#tech-stack)
  - [Architecture](#architecture)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Development](#development)
  - [Build](#build)
  - [Credits](#credits)
- [Tiếng Việt](#tiếng-việt)
  - [Tính năng](#tính-năng)
  - [Công nghệ](#công-nghệ)
  - [Kiến trúc](#kiến-trúc)
  - [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
  - [Cài đặt](#cài-đặt)
  - [Phát triển](#phát-triển)
  - [Build](#build-1)
  - [Ghi công](#ghi-công)

---

# English

## Features

| Category | Features |
|---|---|
| **Store** | Daily shop (4 skins), Night Market, Bundles, Accessory shop, Item upgrades |
| **Profile** | Loadout editor (skins, sprays, cards, titles), Collection browser, Competitive rank |
| **Match History** | 30 matches cached, daily summaries (K/D, ADR, ACS), match details with scoreboard + economy chart + round timeline |
| **Combat** | Live session info (pregame/live), party management, agent select, real-time match board |
| **Social** | Friends list with presence, 1:1 DM via Riot XMPP, party chat |
| **Reference** | Skin gallery, equipment browser, agent database, crosshair codes, leaderboard |
| **Performance** | Offline-first MMKV cache, delta sync, gzip compression, adaptive TTL on 4G |
| **UX** | Animated loading screen, skeleton shimmer, press-scale cards, sliding tab indicator, screen transitions |

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React Native 0.74.5 + Expo SDK 51 |
| **Routing** | Expo Router (file-based) |
| **State** | Zustand 4.5.5 + persist middleware |
| **Storage** | MMKV (sync, ultra-fast) + AsyncStorage fallback |
| **Animations** | react-native-reanimated 3.10, moti 0.30 |
| **UI** | react-native-paper, custom glassmorphism design system |
| **i18n** | react-i18next (18 languages) |
| **Network** | axios with gzip, keep-alive, request dedup |
| **Images** | expo-image (memory-disk cache) |
| **Auth** | Riot RSO OAuth2 (WebView) |
| **Chat** | XMPP over TCP socket (react-native-tcp-socket) |
| **Payments** | Stripe (native) |
| **Analytics** | Plausible, Sentry (native) |
| **OTA Updates** | expo-updates |

## Architecture

```
App Launch
  |
  +-> Loading Screen (animated)
  |     |
  |     +-> Wave 1: RiotClientConfig (feature flags, chat config)
  |     +-> Wave 2 (parallel):
  |           +-> buildAuthenticatedUser (entitlements, shop, balances, progress)
  |           +-> fetchMatches (30 matches + hydrate details)
  |           +-> fetchProfileWarmCache (loadout, owned items, rank)
  |     |
  |     +-> Diff vs cache -> update only changed data -> Enter app
  |
  +-> UI reads from Zustand stores (persisted via MMKV)
  +-> Background: delta sync (only fetch NEW matches, TTL-gated)
```

**Data flow:** API -> diff -> cache (MMKV) -> UI reads from cache

## Prerequisites

### 1. ADB (Android Debug Bridge)
- Download [platform-tools](https://dl.google.com/android/repository/platform-tools-latest-windows.zip)
- Extract to `C:\platform-tools`
- Add to system PATH:
  - System Properties > Environment Variables > Path > Edit > New > `C:\platform-tools`
- Verify: `adb devices` should list your connected device

### 2. JDK 17
- [Download JDK 17](https://www.oracle.com/java/technologies/javase-jdk17-downloads.html)
- Set `JAVA_HOME` environment variable
- Add JDK `bin` to PATH
- Verify: `java -version`

### 3. Android Studio
- [Download Android Studio](https://developer.android.com/studio)
- Install Android SDK (API 34+)
- Set `ANDROID_HOME` environment variable

### 4. Node.js
- [Download Node.js v22+](https://nodejs.org/)
- Verify: `node -v` and `npm -v`

### 5. Expo CLI
```bash
npm install -g eas-cli
expo login
```

## Installation

```bash
# Clone the repository
git clone https://github.com/GinzaTech/Vshop.git
cd Vshop

# Install dependencies
npm install
```

## Development

```bash
# Start Metro bundler
npm start

# Run on Android device/emulator
npm run android

# Clear Metro cache (if needed)
npx expo start --clear
```

### Demo Mode (Match UI)

Match History and Match Details can be previewed with mock data in dev builds:

```text
/history?demo=1
/match_details/mock-match-001?demo=1
```

### Project Structure

```
app/                    # Expo Router screens
  (authenticated)/      # Tab navigator + all authenticated screens
  _layout.tsx           # Root layout (providers, bootstrap)
components/             # Reusable UI components
  ui/                   # Design system primitives (GlassCard, ValorantButton, etc.)
  matches/              # Match-related components
  match-detail/         # Match detail screen components
hooks/                  # Zustand stores (user, match, profile, wishlist, combat)
utils/                  # Business logic, API layer, caching, sync
constants/              # Design tokens, hardcoded data
types/                  # TypeScript type definitions
assets/                 # Images, i18n translations
```

## Build

### Development Build
```bash
eas build --profile development --platform android
```

### Production Build
```bash
eas build --platform android
```

Install via QR code or APK from the Expo dashboard.

## Credits

- **Author**: [vascYT](https://github.com/GinzaTech)
- [Unofficial Valorant API documentation](https://github.com/techchrism/valorant-api-docs)
- [In-game assets](https://valorant-api.com)
- All [translators](https://hosted.weblate.org/projects/vshop/mobile/) and contributors

---

# Tiếng Việt

## Tính năng

| Danh mục | Tính năng |
|---|---|
| **Cửa hàng** | Shop hàng ngày (4 skin), Night Market, Bundle, Shop phụ kiện, Nâng cấp skin |
| **Profile** | Chỉnh loadout (skin, spray, card, title), Bộ sưu tập, Rank competitive |
| **Lịch sử đấu** | Cache 30 trận, tóm tắt theo ngày (K/D, ADR, ACS), chi tiết trận (bảng điểm, biểu đồ kinh tế, timeline) |
| **Combat** | Thông tin phiên realtime (pregame/live), quản lý party, chọn agent, bảng trận đấu trực tiếp |
| **Xã hội** | Danh sách bạn bè, nhắn tin 1-1 qua XMPP, chat party |
| **Tham khảo** | Thư viện skin, trình duyệt trang bị, database agent, mã crosshair, bảng xếp hạng |
| **Hiệu năng** | Cache MMKV offline-first, delta sync, nén gzip, TTL thích ứng trên 4G |
| **Trải nghiệm** | Màn hình loading animation, skeleton shimmer, hiệu ứng bấm card, thanh tab trượt, chuyển màn hình mượt |

## Công nghệ

| Lớp | Công nghệ |
|---|---|
| **Framework** | React Native 0.74.5 + Expo SDK 51 |
| **Routing** | Expo Router (file-based) |
| **State** | Zustand 4.5.5 + persist middleware |
| **Storage** | MMKV (đồng bộ, siêu nhanh) + AsyncStorage fallback |
| **Animation** | react-native-reanimated 3.10, moti 0.30 |
| **UI** | react-native-paper, design system glassmorphism tùy chỉnh |
| **Đa ngôn ngữ** | react-i18next (18 ngôn ngữ) |
| **Mạng** | axios với gzip, keep-alive, chống request trùng |
| **Ảnh** | expo-image (cache memory-disk) |
| **Xác thực** | Riot RSO OAuth2 (WebView) |
| **Chat** | XMPP qua TCP socket (react-native-tcp-socket) |
| **Thanh toán** | Stripe (native) |
| **Phân tích** | Plausible, Sentry (native) |
| **OTA** | expo-updates |

## Kiến trúc

```
Mở app
  |
  +-> Màn hình Loading (animation)
  |     |
  |     +-> Wave 1: RiotClientConfig (feature flags, chat config)
  |     +-> Wave 2 (song song):
  |           +-> buildAuthenticatedUser (entitlements, shop, balances, progress)
  |           +-> fetchMatches (30 trận + hydrate chi tiết)
  |           +-> fetchProfileWarmCache (loadout, item sở hữu, rank)
  |     |
  |     +-> So sánh (diff) với cache -> chỉ update dữ liệu thay đổi -> Vào app
  |
  +-> UI đọc từ Zustand stores (lưu bằng MMKV)
  +-> Nền: delta sync (chỉ lấy trận mới, theo TTL)
```

**Luồng dữ liệu:** API -> diff -> cache (MMKV) -> UI đọc từ cache

## Yêu cầu hệ thống

### 1. ADB (Android Debug Bridge)
- Tải [platform-tools](https://dl.google.com/android/repository/platform-tools-latest-windows.zip)
- Giải nén vào `C:\platform-tools`
- Thêm vào PATH:
  - System Properties > Environment Variables > Path > Edit > New > `C:\platform-tools`
- Kiểm tra: `adb devices` phải hiện thiết bị đã kết nối

### 2. JDK 17
- [Tải JDK 17](https://www.oracle.com/java/technologies/javase-jdk17-downloads.html)
- Đặt biến `JAVA_HOME`
- Thêm JDK `bin` vào PATH
- Kiểm tra: `java -version`

### 3. Android Studio
- [Tải Android Studio](https://developer.android.com/studio)
- Cài Android SDK (API 34+)
- Đặt biến `ANDROID_HOME`

### 4. Node.js
- [Tải Node.js v22+](https://nodejs.org/)
- Kiểm tra: `node -v` và `npm -v`

### 5. Expo CLI
```bash
npm install -g eas-cli
expo login
```

## Cài đặt

```bash
# Clone dự án
git clone https://github.com/GinzaTech/Vshop.git
cd Vshop

# Cài dependencies
npm install
```

## Phát triển

```bash
# Khởi động Metro bundler
npm start

# Chạy trên thiết bị/máy ảo Android
npm run android

# Xóa cache Metro (khi cần)
npx expo start --clear
```

### Chế độ Demo (UI Lịch sử đấu)

Có thể xem trước Lịch sử đấu và Chi tiết trận bằng mock data trong bản dev:

```text
/history?demo=1
/match_details/mock-match-001?demo=1
```

### Cấu trúc dự án

```
app/                    # Màn hình Expo Router
  (authenticated)/      # Tab navigator + tất cả màn hình đã đăng nhập
  _layout.tsx           # Layout gốc (providers, bootstrap)
components/             # Component UI tái sử dụng
  ui/                   # Primitives design system (GlassCard, ValorantButton, ...)
  matches/              # Component liên quan trận đấu
  match-detail/         # Component màn hình chi tiết trận
hooks/                  # Zustand stores (user, match, profile, wishlist, combat)
utils/                  # Logic, API layer, cache, sync
constants/              # Design tokens, dữ liệu cố định
types/                  # Định nghĩa kiểu TypeScript
assets/                 # Ảnh, bản dịch i18n
```

## Build

### Build Development
```bash
eas build --profile development --platform android
```

### Build Production
```bash
eas build --platform android
```

Cài qua QR code hoặc file APK từ dashboard Expo.

## Ghi công

- **Tác giả**: [vascYT](https://github.com/GinzaTech)
- [Tài liệu API Valorant không chính thức](https://github.com/techchrism/valorant-api-docs)
- [Asset trong game](https://valorant-api.com)
- Tất cả [người dịch](https://hosted.weblate.org/projects/vshop/mobile/) và người đóng góp

---

## Translations

Translations are available on [Weblate](https://hosted.weblate.org/projects/vshop/mobile/).

## License

MIT License - see [LICENSE](LICENSE) for details.
