import React from "react";

import { useAccountScreenData, type AccountScreenSession } from "~/hooks/useAccountScreenData";
import { getContent, getPlayerInfo, getRiotClientConfig } from "~/utils/valorant-api";
import { getStoredItem } from "~/utils/storage";
import { isCurrentRiotScreenSession } from "~/hooks/useRiotScreenSession";

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
  const editRevision = React.useRef(0);
  const load = React.useCallback(async (session: AccountScreenSession) => {
    const revision = editRevision.current;
    const result = await loadAboutData(session);
    const { toggleOverrides, ...remoteData } = result.data;
    // A refresh may read storage before a local toggle is saved. Its Riot data
    // is still useful, but that override snapshot no longer owns the choice.
    return {
      ...result,
      data: revision === editRevision.current
        ? { ...remoteData, ...(toggleOverrides ? { toggleOverrides } : {}) }
        : remoteData,
    };
  }, []);
  const { data, updateData, ...request } = useAccountScreenData(load, EMPTY_DATA, "[about] fetch error:");
  const activeUpdate = React.useRef<typeof updateData | null>(null);
  React.useEffect(() => {
    activeUpdate.current = updateData;
    return () => { activeUpdate.current = null; };
  }, [updateData]);
  const setToggleOverrides = React.useCallback((toggleOverrides: ToggleOverrides) => {
    if (activeUpdate.current !== updateData || !isCurrentRiotScreenSession(request.session)) return;
    editRevision.current += 1;
    updateData((previous) => ({ ...previous, toggleOverrides }));
  }, [request.session, updateData]);
  return { ...data, ...request, setToggleOverrides };
}
