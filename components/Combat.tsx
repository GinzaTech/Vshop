import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUserStore } from "~/hooks/useUserStore";
import { getAgent } from "~/utils/valorant-assets";
import {
  CurrentGameMatchResponse,
  getCurrentGameMatch,
  getCurrentGamePlayer,
  getParty,
  getPartyPlayer,
  getPreGameMatch,
  getPreGamePlayer,
  lockAgent,
  PartyResponse,
  quitPreGameLobby,
  selectAgent,
  setPartyReady,
} from "~/utils/valorant-api";
import { useCombatStore } from "~/hooks/useCombatStore";

export type CombatSessionSnapshot = {
  state: "idle" | "pregame" | "live";
  matchId: string | null;
  partyId: string | null;
  pregameMatch: LockCharacterResponse | null;
  currentGameMatch: CurrentGameMatchResponse | null;
  party: PartyResponse | null;
};

const EMPTY_SESSION: CombatSessionSnapshot = {
  state: "idle",
  matchId: null,
  partyId: null,
  pregameMatch: null,
  currentGameMatch: null,
  party: null,
};

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const useCombat = () => {
  const { t } = useTranslation();
  const { user } = useUserStore();
  const [agents, setAgents] = useState<ValorantAgent[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<ValorantAgent[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<ValorantAgent | null>(null);
  const { snapshot: sessionSnapshot, loading: sessionLoading, fetchSession } = useCombatStore();
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    const data = getAgent();
    const normalizedAgents = data.agents.map((agent) => ({
      ...agent,
      abilities: agent.abilities || [],
    }));
    setAgents(normalizedAgents);
    setFilteredAgents(normalizedAgents);
  }, []);

  const loadSessionSnapshot = useCallback(async () => {
    return await fetchSession(user);
  }, [fetchSession, user]);

  useEffect(() => {
    void loadSessionSnapshot();
  }, [loadSessionSnapshot]);

  const filterByRole = (role: string | number) => {
    if (typeof role !== "string") return;

    if (role === selectedRole) {
      setSelectedRole(null);
      setFilteredAgents(agents);
    } else {
      setSelectedRole(role);
      const translatedRole = t(role);
      setFilteredAgents(
        agents.filter((agent) => agent.role?.displayName === translatedRole)
      );
    }
  };

  const handleAgentPress = (agent: ValorantAgent) => {
    if (selectedAgent && selectedAgent.uuid === agent.uuid) {
      setSelectedAgent(null);
    } else {
      setSelectedAgent(agent);
    }
  };

  const handleAgentSelect = useCallback(async () => {
    if (!selectedAgent) {
      return false;
    }

    setLocking(true);
    try {
      await selectAgent(
        user.accessToken,
        user.entitlementsToken,
        user.id,
        user.region,
        selectedAgent.uuid
      );
      const result = await lockAgent(
        user.accessToken,
        user.entitlementsToken,
        user.id,
        user.region,
        selectedAgent.uuid
      );

      if (!result) {
        return false;
      }

      let nextSnapshot = await loadSessionSnapshot();

      if (nextSnapshot.state === "idle") {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          await wait(650);
          nextSnapshot = await loadSessionSnapshot();

          if (nextSnapshot.state !== "idle") {
            break;
          }
        }
      }

      return true;
    } catch (error) {
      console.warn("[combat] Failed to lock agent", error);
      return false;
    } finally {
      setLocking(false);
    }
  }, [loadSessionSnapshot, selectedAgent, user]);

  const handleCancel = useCallback(async () => {
    try {
      await quitPreGameLobby(
        user.accessToken,
        user.entitlementsToken,
        user.region,
        user.id
      );
      await loadSessionSnapshot();
    } catch (error) {
      console.warn("[combat] Failed to quit pregame lobby", error);
    }
  }, [loadSessionSnapshot, user]);

  const currentPartyMember = useMemo(
    () =>
      sessionSnapshot.party?.Members?.find((member) => member.Subject === user.id) ||
      null,
    [sessionSnapshot.party?.Members, user.id]
  );

  const togglePartyReadyState = useCallback(async () => {
    if (!sessionSnapshot.partyId) {
      return null;
    }

    try {
      const updatedParty = await setPartyReady(
        user.accessToken,
        user.entitlementsToken,
        user.region,
        sessionSnapshot.partyId,
        user.id,
        !currentPartyMember?.IsReady
      );

      if (updatedParty) {
        // Since session is shared, refreshing the whole snapshot is better to ensure sync
        await fetchSession(user);
      }

      return updatedParty;
    } catch (error) {
      console.warn("[combat] Failed to update party ready state", error);
      return null;
    }
  }, [currentPartyMember?.IsReady, fetchSession, sessionSnapshot.partyId, user]);

  return {
    filterByRole,
    handleAgentPress,
    handleAgentSelect,
    handleCancel,
    filteredAgents,
    selectedRole,
    selectedAgent,
    sessionSnapshot,
    sessionLoading,
    loadSessionSnapshot,
    locking,
    togglePartyReadyState,
    currentPartyMember,
  };
};

export default useCombat;
