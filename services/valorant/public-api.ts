import { publicHttpClient } from "~/services/http/clients";

const VALORANT_API_BASE_URL = "https://valorant-api.com/v1";

type ValorantApiEnvelope<T> = {
  status: number;
  data: T;
};

export type PublicContractDefinition = {
  uuid: string;
  displayName: string;
  displayIcon?: string | null;
  content?: { relationType?: string; relationUuid?: string };
};

export type PublicWeaponMetadata = {
  uuid: string;
  displayName: string;
  category: string;
  displayIcon?: string | null;
  shopData?: { categoryText?: string | null } | null;
};

export const getValorantApiData = async <T>(
  path: string,
  params?: Record<string, string>,
) => {
  const response = await publicHttpClient.get<ValorantApiEnvelope<T>>(
    `${VALORANT_API_BASE_URL}/${path}`,
    { params },
  );
  return response.data.data;
};

export const getValorantApiDataOrNull = async <T>(
  path: string,
  params?: Record<string, string>,
) => {
  const response = await publicHttpClient.get<ValorantApiEnvelope<T>>(
    `${VALORANT_API_BASE_URL}/${path}`,
    { params, validateStatus: () => true },
  );
  return response.status === 200 ? response.data.data : null;
};

export const getPublicContracts = (language: string) =>
  getValorantApiData<PublicContractDefinition[]>("contracts", { language });

export const getPublicWeapons = (language?: string) =>
  getValorantApiData<PublicWeaponMetadata[]>(
    "weapons",
    language ? { language } : undefined,
  );

export const getPublicSkinLevel = (skinLevelId: string, language?: string) =>
  getValorantApiData<ValorantSkinLevel>(
    `weapons/skinlevels/${encodeURIComponent(skinLevelId)}`,
    language ? { language } : undefined,
  );
