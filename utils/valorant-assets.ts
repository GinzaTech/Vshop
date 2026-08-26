// Import axios để gọi API Valorant (valorant-api.com)
import {
  getValorantApiData,
  getValorantApiDataOrNull,
} from "~/services/valorant/public-api";
// Import hàm lấy ngôn ngữ hiện tại từ localization
import { getVAPILang } from "./localization";
// Import expo-file-system để đọc/ghi file cache
import * as FileSystem from "expo-file-system/legacy";
// Import hàm lấy network profile và mapWithConcurrency (chạy đồng thời có giới hạn)
import { getNetworkProfile, mapWithConcurrency } from "./network";

export type ValorantMapAsset = {
  uuid?: string;
  displayName?: string;
  mapUrl?: string;
  listViewIcon?: string;
  splash?: string;
  displayIcon?: string;
};

export type CompetitiveTierAsset = {
  tier?: number;
  tierName?: string;
  smallIcon?: string;
  largeIcon?: string;
};

export type CompetitiveTierSet = {
  uuid?: string;
  tiers?: CompetitiveTierAsset[];
};

// Thiết lập timeout mặc định cho axios: 15 giây

// Kiểu dữ liệu lưu trữ toàn bộ assets của Valorant (vũ khí, skin, buddy, spray, card, title, map, ...)
type StoredAssets = {
  riotClientVersion?: string;     // Phiên bản Riot client hiện tại
  language?: string;              // Ngôn ngữ của assets
  skins: ValorantSkin[];          // Danh sách skin vũ khí
  weapons: ValorantWeapon[];      // Danh sách vũ khí
  buddies: ValorantBuddyAccessory[];  // Danh sách buddy (vật phẩm treo vũ khí)
  sprays: ValorantSprayAccessory[];   // Danh sách spray (hình xăm)
  flex: ValorantFlexAccessory[];      // Danh sách flex (vật phẩm khoe)
  cards: ValorantCardAccessory[];     // Danh sách thẻ người chơi
  titles: ValorantTitleAccessory[];   // Danh sách title (danh hiệu)
  maps: ValorantMapAsset[];
  competitiveTiers: CompetitiveTierSet[];
};

// Kiểu dữ liệu lưu trữ thông tin các agent (nhân vật) Valorant
type ValorantAgents = {
  riotClientVersion?: string;     // Phiên bản Riot client
  language?: string;              // Ngôn ngữ
  agents: ValorantAgent[];        // Danh sách agent
};

// Biến toàn cục lưu trữ assets đã load
let assets: StoredAssets = {
  skins: [],
  weapons: [],
  buddies: [],
  sprays: [],
  flex: [],
  cards: [],
  titles: [],
  maps: [],
  competitiveTiers: [],
};

// Biến toàn cục lưu trữ thông tin agent đã load
let agentsInfo: ValorantAgents = {
  agents: [],
};

// Đường dẫn file cache assets và agents
const FILE_LOCATION = FileSystem.cacheDirectory + "/valorant_assets.json";
const AGENT_LOCATION = FileSystem.cacheDirectory + "/valorant_agent.json";
// Thời gian sống (TTL) của cache: 24 giờ (tính bằng milliseconds)
const ASSET_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Biến cache phiên bản Riot client (giúp tránh gọi API liên tục)
let versionValue: string | null = null;
// Promise đang thực thi để lấy version (tránh request trùng lặp)
let versionInFlight: Promise<string> | null = null;
// Promise đang thực thi để load assets (tránh load đồng thời)
let assetsLoadInFlight: Promise<void> | null = null;
// Promise đang thực thi để load agents (tránh load đồng thời)
let agentsLoadInFlight: Promise<void> | null = null;
// Biến theo dõi nguồn dữ liệu cho assetLookups (để biết khi nào cần rebuild)
let lookupSource: StoredAssets | null = null;
// Cache các lookup map (skinById, buddyById, ...) được xây dựng từ assets
let assetLookups: ReturnType<typeof buildAssetLookups> | null = null;
// Cache dữ liệu bundle (mỗi key = "language|bundleId")
// Giới hạn tối đa để tránh memory leak
const BUNDLE_CACHE_MAX_SIZE = 100;
const bundleCache = new Map<string, ValorantBundle>();
// Map các request bundle đang thực thi (để deduplicate request)
const bundleRequests = new Map<string, Promise<ValorantBundle | null>>();

// Hàm kiểm tra assets có đủ dữ liệu core (skin, map, competitive tier) không
// Parameters:
//   - value: StoredAssets cần kiểm tra
// Returns: true nếu có skins, maps và competitiveTiers
const hasUsableCoreAssets = (value: StoredAssets) =>
  value.skins?.length > 0 &&
  value.maps?.length > 0 &&
  value.competitiveTiers?.length > 0;

// Hàm kiểm tra assets có đủ dữ liệu đầy đủ (core + flex + weapons) không
// Parameters:
//   - value: StoredAssets cần kiểm tra
// Returns: true nếu có đủ dữ liệu
const hasUsableAssets = (value: StoredAssets) =>
  hasUsableCoreAssets(value) &&
  value.flex?.length > 0 &&
  value.weapons?.length > 0;

// Hàm kiểm tra file cache còn "tươi" không (chưa hết hạn TTL)
// Parameters:
//   - modificationTime: thời gian sửa đổi file (từ FileSystem.getInfoAsync)
// Returns: true nếu file còn trong thời hạn cache
const isFreshCache = (modificationTime?: number) =>
  Boolean(
    modificationTime &&
      Date.now() - modificationTime * 1000 < ASSET_CACHE_TTL_MS
  );

// Hàm đọc file cache từ disk, parse JSON và trả về kiểu T
// Parameters:
//   - location: đường dẫn file cache
// Returns: dữ liệu đã parse hoặc null nếu lỗi/file không tồn tại
async function readCacheFile<T>(location: string): Promise<T | null> {
  try {
    const info = await FileSystem.getInfoAsync(location);
    if (!info.exists) {
      return null;
    }

    return JSON.parse(await FileSystem.readAsStringAsync(location)) as T;
  } catch {
    return null;
  }
}

// Hàm xây dựng các lookup map từ dữ liệu assets
// Tạo map tìm kiếm nhanh: skinByAnyId (theo uuid/level uuid/chroma uuid), buddyByAnyId, sprayById, flexById, cardById, titleById
// Returns: object chứa các Map lookup
function buildAssetLookups() {
  const skinByAnyId = new Map<string, ValorantSkin>();
  const buddyByAnyId = new Map<string, ValorantBuddyAccessory>();

  // Index skin: mỗi skin, level và chroma đều map về cùng object skin
  assets.skins.forEach((skin) => {
    skinByAnyId.set(skin.uuid, skin);
    skin.levels?.forEach((level) => skinByAnyId.set(level.uuid, skin));
    skin.chromas?.forEach((chroma) => skinByAnyId.set(chroma.uuid, skin));
  });

  // Index buddy: mỗi buddy và level của nó map về cùng object buddy
  assets.buddies.forEach((buddy) => {
    buddyByAnyId.set(buddy.uuid, buddy);
    buddy.levels?.forEach((level) => buddyByAnyId.set(level.uuid, buddy));
  });

  return {
    skinByAnyId,              // Map skin UUID -> ValorantSkin
    buddyByAnyId,             // Map buddy UUID -> ValorantBuddyAccessory
    sprayById: new Map(assets.sprays.map((item) => [item.uuid, item])),     // Map spray UUID -> spray
    flexById: new Map(assets.flex.map((item) => [item.uuid, item])),        // Map flex UUID -> flex
    cardById: new Map(assets.cards.map((item) => [item.uuid, item])),       // Map card UUID -> card
    titleById: new Map(assets.titles.map((item) => [item.uuid, item])),     // Map title UUID -> title
  };
}

// Export hàm lấy toàn bộ assets đã load (StoredAssets)
export function getAssets() {
  return assets;
}

// Export hàm lấy thông tin các agent đã load (ValorantAgents)
export function getAgent() {
  return agentsInfo;
}

// Export hàm lấy các lookup map (cache, tự động rebuild khi assets thay đổi)
// Returns: object chứa skinByAnyId, buddyByAnyId, sprayById, flexById, cardById, titleById
export function getAssetLookups() {
  if (!assetLookups || lookupSource !== assets) {
    lookupSource = assets;
    assetLookups = buildAssetLookups();
  }

  return assetLookups;
}

// Hàm nội bộ: load assets từ cache hoặc từ API Valorant
// Kiểm tra cache > kiểm tra version > fetch từ API nếu cần > lưu cache
// Không nhận tham số, không trả về (async void)
async function loadAssetsInternal() {
  // Đọc cache từ file
  const info = await FileSystem.getInfoAsync(FILE_LOCATION);
  const cachedAssets = info.exists
    ? await readCacheFile<StoredAssets>(FILE_LOCATION)
    : null;
  // Đảm bảo các trường flex và weapons không undefined
  const storedAssets = cachedAssets
    ? {
        ...cachedAssets,
        flex: cachedAssets.flex ?? [],
        weapons: cachedAssets.weapons ?? [],
      }
    : null;

  const language = getVAPILang();
  const canUseStoredAssets =
    storedAssets?.language === language && hasUsableCoreAssets(storedAssets);

  if (canUseStoredAssets) {
    // Dùng cache nếu có thể
    assets = storedAssets;
    versionValue = storedAssets.riotClientVersion || versionValue;

    // Nếu cache đầy đủ và còn tươi (chưa hết TTL) thì không cần fetch
    if (
      hasUsableAssets(storedAssets) &&
      isFreshCache(info.exists ? info.modificationTime : undefined)
    ) {
      return;
    }

    // Kiểm tra version: nếu version không thay đổi thì dùng cache
    const currentVersion = await fetchVersion(true).catch(() => null);
    if (
      hasUsableAssets(storedAssets) &&
      (!currentVersion || currentVersion === storedAssets.riotClientVersion)
    ) {
      return;
    }
  }

  // Cache không dùng được: fetch tất cả dữ liệu từ API
  try {
    const currentVersion = await fetchVersion();
    const network = await getNetworkProfile();
    // Danh sách các task fetch cần thực thi
    const tasks: (() => Promise<unknown>)[] = [
      () => fetchSkins(language),
      () => fetchWeapons(language),
      () => fetchBuddies(language),
      () => fetchSprays(language),
      () => fetchFlex(language),
      () => fetchPlayerCards(language),
      () => fetchPlayerTitles(language),
      () => fetchMaps(language),
      () => fetchCompetitiveTiers(language),
    ];
    // Chạy các task song song với concurrency giới hạn
    const [
      skins,
      weapons,
      buddies,
      sprays,
      flex,
      cards,
      titles,
      maps,
      competitiveTiers,
    ] =
      await mapWithConcurrency(
        tasks,
        network.requestConcurrency,
        (task) => task()
      );

    // Tạo object assets mới
    const nextAssets: StoredAssets = {
      riotClientVersion: currentVersion,
      language,
      skins: skins as ValorantSkin[],
      weapons: weapons as ValorantWeapon[],
      buddies: buddies as ValorantBuddyAccessory[],
      sprays: sprays as ValorantSprayAccessory[],
      flex: flex as ValorantFlexAccessory[],
      cards: cards as ValorantCardAccessory[],
      titles: titles as ValorantTitleAccessory[],
      maps: maps as ValorantMapAsset[],
      competitiveTiers: competitiveTiers as CompetitiveTierSet[],
    };

    // Ghi cache ra file
    await FileSystem.writeAsStringAsync(
      FILE_LOCATION,
      JSON.stringify(nextAssets)
    );
    assets = nextAssets;
  } catch (error) {
    // Nếu có lỗi nhưng có thể dùng cache cũ thì giữ lại
    if (!canUseStoredAssets) throw error;
    if (__DEV__) {
      console.warn("[assets] Using stale metadata cache", error);
    }
  }
}

// Export hàm load assets (public): kiểm tra ngôn ngữ, tránh load trùng
// Returns: Promise<void> của loadAssetsInternal
export async function loadAssets() {
  const language = getVAPILang();
  // Nếu đã load cùng ngôn ngữ và đủ dữ liệu thì bỏ qua
  if (assets.language === language && hasUsableAssets(assets)) {
    return;
  }

  // Chỉ cho phép một lần load duy nhất tại một thời điểm
  if (!assetsLoadInFlight) {
    assetsLoadInFlight = loadAssetsInternal().finally(() => {
      assetsLoadInFlight = null;
    });
  }

  return assetsLoadInFlight;
}

// Hàm nội bộ: load thông tin agent từ cache hoặc từ API
async function loadAgentInternal() {
  const info = await FileSystem.getInfoAsync(AGENT_LOCATION);
  const storedAgent = info.exists
    ? await readCacheFile<ValorantAgents>(AGENT_LOCATION)
    : null;
  const language = getVAPILang();
  const canUseStoredAgents =
    storedAgent?.language === language && storedAgent.agents?.length > 0;

  if (canUseStoredAgents) {
    agentsInfo = storedAgent;
    versionValue = storedAgent.riotClientVersion || versionValue;

    // Nếu cache còn tươi thì dùng
    if (isFreshCache(info.exists ? info.modificationTime : undefined)) {
      return;
    }

    // Kiểm tra version
    const currentVersion = await fetchVersion(true).catch(() => null);
    if (!currentVersion || currentVersion === storedAgent.riotClientVersion) {
      return;
    }
  }

  // Fetch từ API
  try {
    const nextAgents: ValorantAgents = {
      riotClientVersion: await fetchVersion(),
      language,
      agents: await fetchAgent(language),
    };
    await FileSystem.writeAsStringAsync(
      AGENT_LOCATION,
      JSON.stringify(nextAgents)
    );
    agentsInfo = nextAgents;
  } catch (error) {
    if (!canUseStoredAgents) throw error;
    if (__DEV__) {
      console.warn("[assets] Using stale agent cache", error);
    }
  }
}

// Export hàm load agent (public): kiểm tra ngôn ngữ, tránh load trùng
// Returns: Promise<void>
export async function loadAgent() {
  const language = getVAPILang();
  if (agentsInfo.language === language && agentsInfo.agents.length > 0) {
    return;
  }

  if (!agentsLoadInFlight) {
    agentsLoadInFlight = loadAgentInternal().finally(() => {
      agentsLoadInFlight = null;
    });
  }

  return agentsLoadInFlight;
}

// Export hàm lấy phiên bản Riot client từ valorant-api.com/v1/version
// Parameters:
//   - force: nếu true, bỏ qua cache versionValue và gọi API mới
// Returns: Promise<string> chuỗi phiên bản (vd: "release-13.00-shipping-32-4990475")
export async function fetchVersion(force = false) {
  if (!force && versionValue) {
    return versionValue;           // Trả về cache nếu có
  }

  if (!versionInFlight) {
    versionInFlight = getValorantApiData<{ riotClientVersion: string }>(
      "version",
    )
      .then((version) => {
        versionValue = version.riotClientVersion;
        return versionValue as string;
      })
      .finally(() => {
        versionInFlight = null;
      });
  }

  return versionInFlight;
}

// Export hàm fetch danh sách skin vũ khí từ API
// Parameters:
//   - language: ngôn ngữ (mặc định từ getVAPILang())
// Returns: Promise<ValorantSkin[]>
export async function fetchSkins(language?: string) {
  return getValorantApiData<ValorantSkin[]>("weapons/skins", {
    language: language ?? getVAPILang(),
  });
}

// Export hàm fetch danh sách buddy (vật phẩm treo vũ khí) từ API
// Parameters:
//   - language: ngôn ngữ
// Returns: Promise<ValorantBuddyAccessory[]>
export async function fetchBuddies(language?: string) {
  return getValorantApiData<ValorantBuddyAccessory[]>("buddies", {
    language: language ?? getVAPILang(),
  });
}

// Export hàm fetch danh sách spray từ API
// Parameters:
//   - language: ngôn ngữ
// Returns: Promise<ValorantSprayAccessory[]>
export async function fetchSprays(language?: string) {
  return getValorantApiData<ValorantSprayAccessory[]>("sprays", {
    language: language ?? getVAPILang(),
  });
}

// Export hàm fetch danh sách vũ khí từ API
// Parameters:
//   - language: ngôn ngữ
// Returns: Promise<ValorantWeapon[]>
export async function fetchWeapons(language?: string) {
  return getValorantApiData<ValorantWeapon[]>("weapons", {
    language: language ?? getVAPILang(),
  });
}

// Export hàm fetch danh sách flex (vật phẩm khoe) từ API
// Parameters:
//   - language: ngôn ngữ
// Returns: Promise<ValorantFlexAccessory[]>
export async function fetchFlex(language?: string) {
  return getValorantApiData<ValorantFlexAccessory[]>("flex", {
    language: language ?? getVAPILang(),
  });
}

// Export hàm fetch danh sách thẻ người chơi từ API
// Parameters:
//   - language: ngôn ngữ
// Returns: Promise<ValorantCardAccessory[]>
export async function fetchPlayerCards(language?: string) {
  return getValorantApiData<ValorantCardAccessory[]>("playercards", {
    language: language ?? getVAPILang(),
  });
}

// Export hàm fetch danh sách title (danh hiệu) từ API
// Parameters:
//   - language: ngôn ngữ
// Returns: Promise<ValorantTitleAccessory[]>
export async function fetchPlayerTitles(language?: string) {
  return getValorantApiData<ValorantTitleAccessory[]>("playertitles", {
    language: language ?? getVAPILang(),
  });
}

// Export hàm fetch danh sách bản đồ từ API
// Parameters:
//   - language: ngôn ngữ
// Returns: map metadata
export async function fetchMaps(language?: string) {
  return getValorantApiData<ValorantMapAsset[]>("maps", {
    language: language ?? getVAPILang(),
  });
}

// Export hàm fetch danh sách competitive tiers từ API
// Parameters:
//   - language: ngôn ngữ
// Returns: competitive tier sets
export async function fetchCompetitiveTiers(language?: string) {
  return getValorantApiData<CompetitiveTierSet[]>("competitivetiers", {
    language: language ?? getVAPILang(),
  });
}

// Export hàm fetch thông tin bundle (gói) từ API theo bundleId
// Bao gồm cache và deduplicate request trùng lặp
// Parameters:
//   - bundleId: UUID của bundle
//   - language: ngôn ngữ (mặc định getVAPILang())
// Returns: Promise<ValorantBundle | null>
export async function fetchBundle(bundleId: string, language?: string) {
  const requestLanguage = language ?? getVAPILang();
  const key = `${requestLanguage}|${bundleId}`;
  // Kiểm tra cache
  if (bundleCache.has(key)) {
    return bundleCache.get(key) ?? null;
  }

  // Kiểm tra request đang thực thi
  const pending = bundleRequests.get(key);
  if (pending) {
    return pending;
  }

  const request = getValorantApiDataOrNull<ValorantBundle>(
    `bundles/${encodeURIComponent(bundleId)}`,
    { language: requestLanguage },
  )
    .then((bundle) => {
      // Riot's storefront can expose a new bundle before valorant-api.com has
      // ingested the latest patch. Do not cache that temporary 404, otherwise
      // this app session could never pick up the metadata after upstream syncs.
      if (bundle == null) {
        return null;
      }

      if (bundleCache.size >= BUNDLE_CACHE_MAX_SIZE) {
        const firstKey = bundleCache.keys().next().value;
        if (firstKey !== undefined) bundleCache.delete(firstKey);
      }
      bundleCache.set(key, bundle);
      return bundle;
    })
    .finally(() => {
      bundleRequests.delete(key);     // Dọn dẹp request
    });

  bundleRequests.set(key, request);
  return request;
}

// Export hàm fetch danh sách agent từ API
// Parameters:
//   - language: ngôn ngữ
// Returns: Promise<ValorantAgent[]>
export async function fetchAgent(language?: string) {
  return getValorantApiData<ValorantAgent[]>("agents", {
    language: language ?? getVAPILang(),
  });
}
