import axios from "axios";
import { getVAPILang } from "./localization";
import * as FileSystem from "expo-file-system";

type StoredAssets = {
  riotClientVersion?: string;
  language?: string;
  skins: ValorantSkin[];
  buddies: ValorantBuddyAccessory[];
  sprays: ValorantSprayAccessory[];
  cards: ValorantCardAccessory[];
  titles: ValorantTitleAccessory[];
  maps: any[]; // Use any or define ValorantMap type if possible, but any is faster for now
};

type ValorantAgents = {
  riotClientVersion?: string;
  language?: string;
  agents: ValorantAgent[];
};

let assets: StoredAssets = {
  skins: [],
  buddies: [],
  sprays: [],
  cards: [],
  titles: [],
  maps: [],
};

let agentsInfo: ValorantAgents = {
  agents: [],
};
const version = fetchVersion();
const FILE_LOCATION = FileSystem.cacheDirectory + "/valorant_assets.json";
const AGENT_LOCATION = FileSystem.cacheDirectory + "/valorant_agent.json";

export function getAssets() {
  return assets;
}

export function getAgent() {
  return agentsInfo;
}

export async function loadAssets() {
  const { exists } = await FileSystem.getInfoAsync(FILE_LOCATION);

  const language = getVAPILang();

  if (exists) {
    const storedAssets = await FileSystem.readAsStringAsync(FILE_LOCATION);
    const storedAssetsJson: StoredAssets = JSON.parse(storedAssets);

    if (
      storedAssetsJson.riotClientVersion === await version &&
      storedAssetsJson.language === language &&
      storedAssetsJson.maps &&
      storedAssetsJson.maps.length > 0
    ) {
      assets = storedAssetsJson;
      return;
    }
  }

  assets.riotClientVersion = await version;
  assets.language = language;
  assets.skins = await fetchSkins(language);
  assets.buddies = await fetchBuddies(language);
  assets.sprays = await fetchSprays(language);
  assets.cards = await fetchPlayerCards(language);
  assets.titles = await fetchPlayerTitles(language);
  assets.maps = await fetchMaps(language);

  await FileSystem.writeAsStringAsync(FILE_LOCATION, JSON.stringify(assets));
}

export async function loadAgent() {
  const { exists: agentExists } = await FileSystem.getInfoAsync(AGENT_LOCATION);
  const language = getVAPILang();

  if (agentExists) {
    const storedAgentData = await FileSystem.readAsStringAsync(AGENT_LOCATION);
    const storedAgentJson: ValorantAgents = JSON.parse(storedAgentData);

    if (
      storedAgentJson.riotClientVersion === await version &&
      storedAgentJson.language === language
    ) {
      agentsInfo = storedAgentJson;
      return;
    }
  }
  agentsInfo.riotClientVersion = await version;
  agentsInfo.language = language;
  agentsInfo.agents = await fetchAgent(language);
}

export async function fetchVersion() {
  const res = await axios.request({
    url: "https://valorant-api.com/v1/version",
    method: "GET",
  });

  return res.data.data.riotClientVersion;
}

export async function fetchSkins(language?: string) {
  const res = await axios.request<{ data: ValorantSkin[] }>({
    url: `https://valorant-api.com/v1/weapons/skins?language=${language ?? getVAPILang()
      }`,
    method: "GET",
  });

  return res.data.data;
}

export async function fetchBuddies(language?: string) {
  const res = await axios.request<{ data: ValorantBuddyAccessory[] }>({
    url: `https://valorant-api.com/v1/buddies?language=${language ?? getVAPILang()
      }`,
    method: "GET",
  });

  return res.data.data;
}

export async function fetchSprays(language?: string) {
  const res = await axios.request<{ data: ValorantSprayAccessory[] }>({
    url: `https://valorant-api.com/v1/sprays?language=${language ?? getVAPILang()
      }`,
    method: "GET",
  });

  return res.data.data;
}

export async function fetchPlayerCards(language?: string) {
  const res = await axios.request<{ data: ValorantCardAccessory[] }>({
    url: `https://valorant-api.com/v1/playercards?language=${language ?? getVAPILang()
      }`,
    method: "GET",
  });

  return res.data.data;
}

export async function fetchPlayerTitles(language?: string) {
  const res = await axios.request<{ data: ValorantTitleAccessory[] }>({
    url: `https://valorant-api.com/v1/playertitles?language=${language ?? getVAPILang()
      }`,
    method: "GET",
  });

  return res.data.data;
}

export async function fetchMaps(language?: string) {
  const res = await axios.request<{ data: any[] }>({
    url: `https://valorant-api.com/v1/maps?language=${language ?? getVAPILang()
      }`,
    method: "GET",
  });

  return res.data.data;
}

export async function fetchBundle(bundleId: string, language?: string) {
  const res = await axios.request<{ data: ValorantBundle }>({
    url: `https://valorant-api.com/v1/bundles/${bundleId}?language=${language ?? getVAPILang()
      }`,
    method: "GET",
    validateStatus: () => true,
  });

  return res.status === 200 ? res.data.data : null;
}

export async function fetchAgent(language?: string) {
  const res = await axios.get<{ data: ValorantAgent[] }>(`https://valorant-api.com/v1/agents?language=${language ?? getVAPILang()}`);
  return res.data.data;
}
