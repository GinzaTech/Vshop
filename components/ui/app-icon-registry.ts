import {
  ArrowLeft,
  ArrowRight,
  BatteryWarning,
  Calendar,
  ChartBar,
  ChartLine,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  CircleHelp,
  CircleUserRound,
  CircleX,
  Clock,
  Copy,
  DatabaseX,
  Download,
  Globe,
  Grid3X3,
  Heart,
  Images,
  Info,
  Languages,
  LoaderCircle,
  Map,
  Menu,
  MoonStar,
  Package,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Settings,
  Share2,
  ShoppingBag,
  Target,
  Timer,
  User,
  Users,
  X,
} from "lucide";
import type { AppIconDefinition } from "~/components/ui/app-icon-types";

export const APP_ICON_REGISTRY = {
  unknown: { kind: "morph", icon: CircleHelp },
  menu: { kind: "morph", icon: Menu },
  close: { kind: "morph", icon: X },
  search: { kind: "morph", icon: Search },
  back: { kind: "morph", icon: ArrowLeft },
  forward: { kind: "morph", icon: ArrowRight },
  chevronLeft: { kind: "morph", icon: ChevronLeft },
  chevronRight: { kind: "morph", icon: ChevronRight },
  chevronUp: { kind: "morph", icon: ChevronUp },
  chevronDown: { kind: "morph", icon: ChevronDown },
  refresh: { kind: "morph", icon: RefreshCw },
  loading: { kind: "morph", icon: LoaderCircle },
  check: { kind: "morph", icon: Check },
  success: { kind: "morph", icon: CircleCheck },
  error: { kind: "morph", icon: CircleX },
  info: { kind: "morph", icon: Info },
  account: { kind: "morph", icon: User },
  accountGroup: { kind: "morph", icon: Users },
  settings: { kind: "morph", icon: Settings },
  shop: { kind: "morph", icon: ShoppingBag },
  grid: { kind: "morph", icon: Grid3X3 },
  heart: { kind: "morph", icon: Heart },
  heartFilled: { kind: "morph", icon: Heart, filled: true },
  calendar: { kind: "morph", icon: Calendar },
  clock: { kind: "morph", icon: Clock },
  share: { kind: "morph", icon: Share2 },
  copy: { kind: "morph", icon: Copy },
  send: { kind: "morph", icon: Send },
  download: { kind: "morph", icon: Download },
  edit: { kind: "morph", icon: Pencil },
  globe: { kind: "morph", icon: Globe },
  map: { kind: "morph", icon: Map },
  target: { kind: "morph", icon: Target },
  chartLine: { kind: "morph", icon: ChartLine },
  chartBar: { kind: "morph", icon: ChartBar },
  databaseOff: { kind: "morph", icon: DatabaseX },
  navStore: { kind: "morph", icon: Package },
  navShop: { kind: "morph", icon: ShoppingBag },
  navProfile: { kind: "morph", icon: CircleUserRound },
  navNightMarket: { kind: "morph", icon: MoonStar },
  navMore: { kind: "morph", icon: Grid3X3 },
  language: { kind: "morph", icon: Languages },
  batteryWarning: { kind: "morph", icon: BatteryWarning },
  bundle: { kind: "morph", icon: Package },
  timer: { kind: "morph", icon: Timer },
  update: { kind: "morph", icon: Download },
  updateChecking: { kind: "morph", icon: LoaderCircle },
  imageGrid: { kind: "morph", icon: Images },
  shield: { kind: "legacy", legacyName: "shield-account-outline" },
  weaponPistol: { kind: "legacy", legacyName: "pistol" },
  combatSword: { kind: "legacy", legacyName: "sword-cross" },
} as const satisfies Record<string, AppIconDefinition>;

export type AppIconName = keyof typeof APP_ICON_REGISTRY;

export function resolveAppIconName(value: unknown): AppIconName {
  if (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(APP_ICON_REGISTRY, value)
  ) {
    return value as AppIconName;
  }

  return "unknown";
}

export function resolveAppIcon(name: AppIconName): AppIconDefinition {
  return APP_ICON_REGISTRY[resolveAppIconName(name)];
}
