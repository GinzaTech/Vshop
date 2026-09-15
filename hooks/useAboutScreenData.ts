import React from "react";

import { useAccountScreenData, type AccountScreenSession } from "~/hooks/useAccountScreenData";
import { getContent, getPlayerInfo, getRiotClientConfig } from "~/utils/valorant-api";
import { getStoredItem } from "~/utils/storage";

export type ToggleOverrides = Record<string, boolean>;
export const ABOUT_TOGGLES_STORAGE_KEY = "about:feature_toggle_overrides";

type AboutData = {
  playerInfo: PlayerInfoResponse | null;
  riotConfig: RiotClientConfigResponse | null;
  content: ContentResponse | null;
  toggleOverrides: ToggleOverrides;
};

const EMPTY_DATA: AboutData = { playerInfo: null, riotConfig: null, content: null, toggleOverrides: {} };

function parseOverrides(raw: string | null): ToggleOverrides {
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
    Object.values(parsed).some((value) => typeof value !== "boolean")) {
    throw new Error("Invalid stored feature toggle overrides");
  }
  return parsed as ToggleOverrides;
}

async function loadAboutData(session: AccountScreenSession) {
  const { accessToken, entitlementsToken, region } = session;
  const results = await Promise.allSettled([
    getPlayerInfo(accessToken),
    getRiotClientConfig(accessToken, entitlementsToken),
    getContent(accessToken, entitlementsToken, region),
    getStoredItem(ABOUT_TOGGLES_STORAGE_KEY).then(parseOverrides),
  ]);
  const [player, config, content, overrides] = results;
  return {
    data: {
      ...(player.status === "fulfilled" && player.value ? { playerInfo: player.value } : {}),
      ...(config.status === "fulfilled" && config.value ? { riotConfig: config.value } : {}),
      ...(content.status === "fulfilled" && content.value ? { content: content.value } : {}),
      ...(overrides.status === "fulfilled" ? { toggleOverrides: overrides.value } : {}),
    },
    errors: results.filter((result) => result.status === "rejected").map((result) => result.reason as unknown),
  };
}

export function useAboutScreenData() {
  const { data, updateData, ...request } = useAccountScreenData(loadAboutData, EMPTY_DATA, "[about] fetch error:");
  const setToggleOverrides = React.useCallback((toggleOverrides: ToggleOverrides) => {
    updateData((previous) => ({ ...previous, toggleOverrides }));
  }, [updateData]);
  return { ...data, ...request, setToggleOverrides };
}
