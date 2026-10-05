import React from "react";
import { Switch, Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import UiQaRoute from "~/app/ui-qa";
import LocalUiQaScreen from "~/mocks/ui-qa";
import PartyTeamPanel from "~/features/party/PartyTeamPanel";
import { CachedImage } from "~/components/CachedImage";
import type { CompetitiveTierAsset } from "~/utils/valorant-assets";

const mockForbidden = jest.fn(() => { throw new Error("Team QA must not mount profile/session or write account/cache data"); });
const mockTiers: CompetitiveTierAsset[] = [3, 9, 18, 27].map(tier => ({ tier,
  tierName: `Cached rank ${tier}`, smallIcon: `https://media.valorant-api.com/competitivetiers/cached/${tier}/smallicon.png` }));
const mockCachedAssets = { competitiveTiers: [{ tiers: [{ tier: 3, tierName: "Old rank", smallIcon: "https://media.valorant-api.com/old.png" }] },
  { tiers: mockTiers }], cards: [{ uuid: "cached-card", smallArt: "https://media.valorant-api.com/playercards/cached/smallart.png" }] };
let mockAssets: { competitiveTiers: { tiers: CompetitiveTierAsset[] }[]; cards: { uuid: string; smallArt: string }[] } = mockCachedAssets;
const mockGetAssets = jest.fn(() => mockAssets);
let mockParams: { demo?: string | string[]; team?: string; startup?: string; recovery?: string; phase?: string } = { demo: "1", team: "1" };
const devGlobal = globalThis as typeof globalThis & { __DEV__: boolean };

jest.mock("expo-router", () => ({ useLocalSearchParams: () => mockParams, Redirect: "Redirect", Stack: { Screen: "QaStackScreen" } }));
jest.mock("~/utils/valorant-assets", () => ({ getAssets: () => mockGetAssets(), loadAssets: () => mockForbidden() }));
jest.mock("~/features/profile/useProfileState", () => ({ useProfileState: () => mockForbidden() }));
jest.mock("~/features/profile/useProfileMutations", () => ({ useProfileMutations: () => mockForbidden() }));
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: () => mockForbidden() }));
jest.mock("~/hooks/useRiotScreenSession", () => ({ useRiotScreenSession: () => mockForbidden() }));
jest.mock("~/features/party/usePartyController", () => ({ usePartyController: () => mockForbidden() }));
jest.mock("~/mocks/ui-qa-data", () => ({ createUiQaTransport: () => mockForbidden(), createQaLoadout: () => mockForbidden(),
  QA_PREVIEW_CARDS: [], QA_SKINS: [], QA_TITLES: [], QA_USER: {}, QA_WEAPON_ID: "qa", QA_WRITE_DELAY_MS: 1 }));
jest.mock("~/features/profile/ProfilePickerModal", () => ({ ProfilePickerModal: "ProfilePickerModal" }));
jest.mock("~/features/profile/ProfileEquipmentSections", () => ({ ProfileExpressionSection: "ProfileExpressionSection" }));
jest.mock("~/components/SkinShowcaseCard", () => ({ __esModule: true, default: "SkinShowcaseCard" }));
jest.mock("~/components/LoadingScreen", () => ({ __esModule: true, default: "LoadingScreen" }));
jest.mock("~/components/ui/RecoveryUpdateActions", () => ({ RecoveryUpdateActionsView: "RecoveryUpdateActionsView" }));
jest.mock("~/utils/misc", () => ({ VItemTypes: {} }));
jest.mock("~/components/CachedImage", () => ({ CachedImage: "CachedImage" }));
jest.mock("~/components/ui/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("~/components/ui/GlassCard", () => ({ __esModule: true, default: "GlassCard" }));
jest.mock("~/components/ui/ValorantButton", () => {
  const ReactModule = require("react") as typeof React;
  const { Pressable, Text: Label } = require("react-native") as typeof import("react-native");
  return { __esModule: true, default: ({ title, onPress }: { title: string; onPress: () => void }) =>
    ReactModule.createElement(Pressable, { onPress, accessibilityRole: "button", accessibilityLabel: title },
      ReactModule.createElement(Label, null, title)) };
});
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 8, bottom: 16, left: 0, right: 0 }) }));
jest.mock("~/hooks/useAppTranslation", () => ({ useTranslation: () => ({
  t: (_key: string, options: { defaultValue: string; [key: string]: unknown }) =>
    options.defaultValue.replace(/{{(\w+)}}/g, (_: string, name: string) => String(options[name])) }) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("expo/metro-config", () => ({ getDefaultConfig: () => ({ resolver: {} }) }));

let renderer: TestRenderer.ReactTestRenderer | undefined;
const originalDev = __DEV__;
const root = () => renderer!.root;
const panel = () => root().findByType(PartyTeamPanel);
const mount = (element: React.ReactElement = <LocalUiQaScreen teamPreview />) => {
  act(() => { renderer = TestRenderer.create(element); });
};
const press = (id: string) => act(() => root().findByProps({ testID: id })
  .find(node => node.props.accessibilityRole === "button" && typeof node.props.onPress === "function").props.onPress());
const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

beforeEach(() => {
  jest.clearAllMocks(); mockAssets = mockCachedAssets; devGlobal.__DEV__ = true; mockParams = { demo: "1", team: "1" };
});
afterEach(() => {
  act(() => renderer?.unmount()); renderer = undefined; devGlobal.__DEV__ = originalDev;
  expect(mockForbidden).not.toHaveBeenCalled();
});

describe("isolated Team QA route and physical controls", () => {
  it("routes demo=1&team=1 to the actual Team panel before mounting a profile session", () => {
    mount(<UiQaRoute />);
    expect(root().findByType(LocalUiQaScreen).props.teamPreview).toBe(true);
    expect(root().findByProps({ testID: "party-qa-screen" })).toBeDefined();
    expect(panel().props.members).toHaveLength(5);
  });
  it.each([undefined, "0", "true"])("enables Team only for team=1 (team=%s)", team => {
    // Startup is an existing isolated branch, allowing a valid non-Team mount.
    mockParams = { demo: "1", team, startup: "1" }; mount(<UiQaRoute />);
    expect(root().findByType(LocalUiQaScreen).props.teamPreview).toBe(false);
    expect(root().findAllByProps({ testID: "party-qa-screen" })).toHaveLength(0);
    expect(root().findByProps({ testID: "startup-preview-screen" })).toBeDefined();
  });
  it.each([[false, "1"], [true, undefined], [true, "0"], [true, ["0", "1"]]] as const)(
    "keeps the DEV/demo guard (dev=%s demo=%s)", (dev, demo) => {
      devGlobal.__DEV__ = dev; mockParams = { demo: typeof demo === "object" ? [...demo] : demo, team: "1" };
      mount(<UiQaRoute />);
      expect(renderer!.toJSON()).toMatchObject({ type: "Redirect", props: { href: "/" } });
      expect(mockGetAssets).not.toHaveBeenCalled();
    });
  it("labels synthetic data visibly and renders five actual member rows with long VI/CJK names", () => {
    mount();
    expect(root().findAllByType(Text).some(node => node.props.children === "QA · TEAM MẪU — không phải phòng thật")).toBe(true);
    const members = panel().props.members as import("~/features/party/party-types").PartyMemberView[];
    expect(members).toHaveLength(5);
    expect(new Set(members.map(member => member.id)).size).toBe(5);
    expect(members.some(member => member.name.length > 30 && /[ăâêôơưđ]/i.test(member.name))).toBe(true);
    expect(members.some(member => /[\u3040-\u30ff\u4e00-\u9fff]/.test(member.name))).toBe(true);
    for (const member of members) expect(root().findByProps({ testID: `party-member-${member.id}` })).toBeDefined();
    expect(root().findAllByType(Switch)).toHaveLength(1);
  });
  it("reads cached public rank art once, renders four known slots and one unknown without changing cache", () => {
    const before = JSON.stringify(mockAssets); mount();
    const members = panel().props.members as import("~/features/party/party-types").PartyMemberView[];
    const known = members.filter(member => member.rankIconUrl);
    expect(known).toHaveLength(4);
    expect(known.map(member => member.rankIconUrl)).toEqual(mockTiers.map(tier => tier.smallIcon));
    expect(known.map(member => member.rankName)).toEqual(mockTiers.map(tier => tier.tierName));
    const unknown = members.find(member => !member.rankIconUrl)!;
    expect(unknown.rankName).toBeUndefined(); expect(unknown.rr).toBeUndefined();
    expect(root().findByProps({ testID: `party-rank-${unknown.id}` }).props.accessibilityLabel).toBe("Rank unavailable");
    expect(root().findAllByType(CachedImage).filter(node => known.some(member => member.rankIconUrl === node.props.source.uri))).toHaveLength(4);
    expect(mockGetAssets).toHaveBeenCalledTimes(1); expect(JSON.stringify(mockAssets)).toBe(before);
  });
  it("changes only self ready state through the actual switch and restores it on re-entry", () => {
    mount(); const before = panel().props.members;
    expect(root().findByType(Switch).props.value).toBe(false);
    act(() => root().findByType(Switch).props.onValueChange(true));
    expect(root().findByType(Switch).props.value).toBe(true);
    expect(panel().props.members.filter((member: { isSelf: boolean }) => !member.isSelf)).toEqual(before.filter((member: { isSelf: boolean }) => !member.isSelf));
    act(() => root().findByType(Switch).props.onValueChange(false));
    expect(root().findByType(Switch).props.value).toBe(false);
    act(() => root().findByType(Switch).props.onValueChange(true));
    act(() => renderer!.unmount()); mount();
    expect(root().findByType(Switch).props.value).toBe(false);
  });
  it("toggles disabled locally, guards the panel callback, and unlocks again", () => {
    mount(); press("party-qa-disable");
    expect(root().findByProps({ testID: "party-qa-disable" }).findByProps({ accessibilityRole: "button" }).props.accessibilityLabel).toBe("QA · Mở nút sẵn sàng");
    expect(panel().props.disabled).toBe(true); expect(panel().props.busy).toBe(false);
    expect(root().findByType(Switch).props.accessibilityState).toMatchObject({ checked: false, disabled: true, busy: false });
    act(() => panel().props.onReady(true));
    expect(root().findByType(Switch).props.value).toBe(false);
    press("party-qa-disable");
    expect(root().findByProps({ testID: "party-qa-disable" }).findByProps({ accessibilityRole: "button" }).props.accessibilityLabel).toBe("QA · Khóa nút sẵn sàng");
    expect(root().findByType(Switch).props.disabled).toBe(false);
    act(() => root().findByType(Switch).props.onValueChange(true));
    expect(root().findByType(Switch).props.value).toBe(true);
  });
  it("toggles the actual empty panel and restores five members plus local ready state", () => {
    mount(); act(() => root().findByType(Switch).props.onValueChange(true));
    press("party-qa-empty"); expect(panel().props.members).toEqual([]);
    expect(root().findByProps({ testID: "party-qa-empty" }).findByProps({ accessibilityRole: "button" }).props.accessibilityLabel).toBe("QA · Hiện 5 thành viên mẫu");
    act(() => panel().props.onReady(false));
    expect(root().findAllByType(Switch)).toHaveLength(0);
    expect(panel().findAllByType(Text).some(node => node.props.children === "Members unavailable")).toBe(true);
    press("party-qa-empty"); expect(panel().props.members).toHaveLength(5);
    expect(root().findByType(Switch).props.value).toBe(true);
    expect(mockGetAssets).toHaveBeenCalledTimes(1);
  });
  it("keeps startup/recovery precedence when both preview flags are passed", () => {
    mount(<LocalUiQaScreen startupPreview recoveryPreview startupPhase="data" teamPreview />);
    expect(root().findByProps({ testID: "startup-preview-screen" })).toBeDefined();
    expect(root().findAllByType(PartyTeamPanel)).toHaveLength(0); expect(mockGetAssets).not.toHaveBeenCalled();
  });
  it("does not invent rank icons or fetch missing public cache", () => {
    mockAssets = { competitiveTiers: [], cards: [] }; mount();
    expect(panel().props.members).toHaveLength(5);
    expect(panel().props.members.every((member: { rankIconUrl?: string }) => !member.rankIconUrl)).toBe(true);
    expect(mockGetAssets).toHaveBeenCalledTimes(1);
  });
  it("rejects non-public cache URLs and uses cached largeIcon when smallIcon is absent", () => {
    mockAssets = { cards: [], competitiveTiers: [{ tiers: [
      { tier: 3, tierName: "Private URL", smallIcon: "https://riot.example/private.png" },
      { tier: 9, tierName: "Cached large", largeIcon: "https://media.valorant-api.com/large.png" },
    ] }] }; mount();
    expect(panel().props.members.filter((member: { rankIconUrl?: string }) => member.rankIconUrl)
      .every((member: { rankIconUrl: string }) => member.rankIconUrl === "https://media.valorant-api.com/large.png")).toBe(true);
    expect(root().findAllByType(CachedImage).some(node => node.props.source.uri === "https://riot.example/private.png")).toBe(false);
  });
  it("ignores unranked, missing-label and missing-art entries rather than fabricating known slots", () => {
    mockAssets = { cards: [], competitiveTiers: [{ tiers: [
      { tier: 0, tierName: "Unranked", smallIcon: "https://media.valorant-api.com/unranked.png" },
      { tierName: "No tier", smallIcon: "https://media.valorant-api.com/no-tier.png" },
      { tier: 3, smallIcon: "https://media.valorant-api.com/no-label.png" },
      { tier: 9, tierName: "No art" },
    ] }] }; mount();
    expect(panel().props.members).toHaveLength(5);
    expect(root().findAllByType(CachedImage)).toHaveLength(0);
    expect(root().findAllByType(Text).some(node => String(node.props.children).includes("Cache ảnh hạng public chưa đủ"))).toBe(true);
  });
});

describe("Team fixture source and production isolation", () => {
  it("imports only the readonly asset getter and never real party/session/storage/network actions", () => {
    const fixture = source("mocks/party-ui-qa.tsx");
    expect(fixture).toMatch(/import\s*\{\s*getAssets\s*\}\s*from\s*["']~\/utils\/valorant-assets["']/);
    expect(fixture).toContain("PartyTeamPanel");
    expect(fixture).not.toMatch(/usePartyController|useProfile|useUserStore|useRiot|valorant-api["']|services\/|fetch\(|axios|loadAssets|AsyncStorage|setState\(|setItem|FileSystem|useEffect/);
    const qa = source("mocks/ui-qa.tsx");
    expect(qa.indexOf("if (teamPreview)")).toBeLessThan(qa.indexOf("return <LocalQaSession"));
  });
  it("keeps the production substitution fixture-free with no direct route import of the Team fixture", () => {
    const route = source("app/ui-qa.tsx");
    expect(route).not.toMatch(/party-ui-qa|PartyTeamPanel/);
    expect(route).toContain('from "~/mocks/ui-qa"');
    const config = require("../metro.config") as { resolver: { resolveRequest: (context: { dev: boolean; resolveRequest: jest.Mock }, name: string, platform: string) => unknown } };
    const context = { dev: false, resolveRequest: jest.fn() };
    config.resolver.resolveRequest(context, "~/mocks/ui-qa", "android");
    expect(context.resolveRequest).toHaveBeenCalledWith(context, join(process.cwd(), "mocks/ui-qa.production.js"), "android");
    expect(source("mocks/ui-qa.production.js")).not.toMatch(/require\(|import |party-ui-qa/);
  });
});
