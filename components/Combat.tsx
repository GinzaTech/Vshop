// ===== Combat.tsx =====
// Hook quản lý toàn bộ logic chọn/lock agent, quản lý party, và trạng thái combat trong game Valorant.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useUserStore } from "~/hooks/useUserStore";
import { getAgent } from "~/utils/valorant-assets";
import {
  lockAgent,
  quitPreGameLobby,
  selectAgent,
  setPartyReady,
} from "~/utils/valorant-api";
import { useCombatStore } from "~/hooks/useCombatStore";

// Hàm tiện ích: tạo Promise delay, dùng để chờ giữa các lần poll snapshot
// ms: số mili-giây cần chờ
const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

// useCombat: Hook chính, quản lý logic combat (chọn agent, lock, party ready, hủy)
// Trả về: object chứa các state, hàm xử lý, và dữ liệu session
const useCombat = () => {
  // Hook dịch thuật i18n
  const { t } = useTranslation();

  // user: thông tin người dùng từ useUserStore (accessToken, entitlementsToken, id, region)
  const user = useUserStore((state) => state.user);

  // agents: danh sách tất cả agent từ dữ liệu game (Valorant API)
  const [agents, setAgents] = useState<ValorantAgent[]>([]);
  // filteredAgents: danh sách agent đã được lọc theo role, khởi tạo = agents
  const [filteredAgents, setFilteredAgents] = useState<ValorantAgent[]>([]);
  // selectedRole: role đang được chọn để lọc (null nếu không lọc)
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  // selectedAgent: agent đang được chọn để lock (null nếu chưa chọn)
  const [selectedAgent, setSelectedAgent] = useState<ValorantAgent | null>(null);
  // sessionSnapshot: snapshot hiện tại của session combat từ useCombatStore
  const sessionSnapshot = useCombatStore((state) => state.snapshot);
  // sessionLoading: trạng thái loading của session từ useCombatStore
  const sessionLoading = useCombatStore((state) => state.loading);
  // fetchSession: hàm fetch session từ useCombatStore
  const fetchSession = useCombatStore((state) => state.fetchSession);
  // locking: trạng thái đang trong quá trình lock agent (true/false)
  const [locking, setLocking] = useState(false);

  // useEffect: Tải danh sách agent khi component mount
  // Gọi getAgent() từ valorant-assets, chuẩn hóa dữ liệu (đảm bảo abilities tồn tại)
  // Lưu vào agents và filteredAgents
  useEffect(() => {
    const data = getAgent();
    const normalizedAgents = data.agents.map((agent) => ({
      ...agent,
      abilities: agent.abilities || [],
    }));
    setAgents(normalizedAgents);
    setFilteredAgents(normalizedAgents);
  }, []);

  // loadSessionSnapshot: Callback async để fetch session snapshot mới nhất
  // Dùng useCallback để tránh tạo hàm mới khi không cần
  // Trả về: Promise với dữ liệu session snapshot
  const loadSessionSnapshot = useCallback(async () => {
    return await fetchSession(user);
  }, [fetchSession, user]);

  // useEffect: Tự động load session snapshot khi loadSessionSnapshot thay đổi
  useEffect(() => {
    void loadSessionSnapshot();
  }, [loadSessionSnapshot]);

  // filterByRole: Hàm lọc danh sách agent theo role
  // role: tên role cần lọc (string), nếu là số thì bỏ qua
  // Nếu role == selectedRole thì bỏ lọc (show all); ngược lại thì lọc theo role
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

  // handleAgentPress: Xử lý khi người dùng chọn/bỏ chọn một agent
  // agent: agent được nhấn
  // Nếu đã chọn agent này rồi thì bỏ chọn; nếu chưa thì chọn agent này
  const handleAgentPress = (agent: ValorantAgent) => {
    if (selectedAgent && selectedAgent.uuid === agent.uuid) {
      setSelectedAgent(null);
    } else {
      setSelectedAgent(agent);
    }
  };

  // handleAgentSelect: Callback async để chọn và lock agent vào game
  // B1: Gọi selectAgent để chọn agent
  // B2: Gọi lockAgent để lock
  // B3: Poll snapshot cho đến khi session không còn idle (tối đa 5 lần, mỗi lần cách 650ms)
  // Trả về: true nếu thành công, false nếu thất bại
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
      if (__DEV__) console.warn("[combat] Failed to lock agent", error);
      return false;
    } finally {
      setLocking(false);
    }
  }, [loadSessionSnapshot, selectedAgent, user]);

  // handleCancel: Callback async để thoát khỏi pregame lobby
  // Gọi quitPreGameLobby, sau đó load lại session snapshot
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
      if (__DEV__) console.warn("[combat] Failed to quit pregame lobby", error);
    }
  }, [loadSessionSnapshot, user]);

  // currentPartyMember: useMemo tính toán member hiện tại trong party
  // Duyệt sessionSnapshot.party.Members tìm member có Subject == user.id
  // Trả về: member object hoặc null nếu không tìm thấy
  const currentPartyMember = useMemo(
    () =>
      sessionSnapshot.party?.Members?.find((member) => member.Subject === user.id) ||
      null,
    [sessionSnapshot.party?.Members, user.id]
  );

  // togglePartyReadyState: Callback async để bật/tắt trạng thái ready của party
  // Gọi setPartyReady với trạng thái ngược lại của IsReady hiện tại
  // Nếu thành công, fetch lại toàn bộ session để đồng bộ
  // Trả về: updatedParty hoặc null nếu thất bại
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
        // Vì session được chia sẻ, load lại toàn bộ snapshot để đồng bộ
        await fetchSession(user);
      }

      return updatedParty;
    } catch (error) {
      if (__DEV__) console.warn("[combat] Failed to update party ready state", error);
      return null;
    }
  }, [currentPartyMember?.IsReady, fetchSession, sessionSnapshot.partyId, user]);

  // Giá trị trả về của hook: các state, hàm xử lý, và dữ liệu cần thiết
  return {
    filterByRole,       // Hàm lọc agent theo role
    handleAgentPress,   // Hàm chọn/bỏ chọn agent
    handleAgentSelect,  // Hàm lock agent vào game
    handleCancel,       // Hàm thoát pregame lobby
    filteredAgents,     // Danh sách agent đã lọc
    selectedRole,       // Role đang được chọn
    selectedAgent,      // Agent đang được chọn
    sessionSnapshot,    // Dữ liệu snapshot session hiện tại
    sessionLoading,     // Trạng thái loading của session
    loadSessionSnapshot,// Hàm load lại session snapshot
    locking,            // Trạng thái đang lock agent
    togglePartyReadyState, // Hàm bật/tắt ready
    currentPartyMember, // Member hiện tại trong party
  };
};

export default useCombat;
