// ===== Import các thư viện và hook =====
import React from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import { CachedImage as Image } from "~/components/CachedImage";
import { AgentGrid, AgentModal } from "~/components/GalleryAgent";
import useAgentGallery from "~/components/GalleryAgent";
import { COLORS } from "~/constants/DesignSystem";
import { useAsyncRefresh } from "~/hooks/useAsyncRefresh";
import { fullBackgroundSync } from "~/utils/app-sync";

// Component chính: Agent - hiển thị danh sách các Agent theo vai trò (role)
// Cho phép lọc agent theo role, chọn agent và xem chi tiết kỹ năng
const Agent = () => {
  // Lấy dữ liệu và hàm từ custom hook useAgentGallery
  // filteredAgents: danh sách agent đã được lọc theo role
  // selectedRole: role đang được chọn (string hoặc null)
  // selectedAgent: agent đang được chọn (object hoặc null)
  // selectedAbility: kỹ năng đang được chọn (object hoặc null)
  // filterByRole(roleId): hàm lọc agent theo role
  // handleAgentPress(agent): hàm xử lý khi nhấn vào một agent
  // sortAbilities: hàm sắp xếp danh sách kỹ năng
  // setSelectedAgent: hàm set agent được chọn
  // setSelectedAbility: hàm set kỹ năng được chọn
  const { filteredAgents, selectedRole, selectedAgent, selectedAbility, filterByRole,
    handleAgentPress, sortAbilities, setSelectedAgent, setSelectedAbility } = useAgentGallery();
  const refreshApp = React.useCallback(() => fullBackgroundSync(true), []);
  const { refreshing, onRefresh } = useAsyncRefresh(refreshApp);

  // Mảng ROLES: định nghĩa 4 vai trò trong game (Duelist, Controller, Initiator, Sentinel)
  // Mỗi role có id, name và icon (ảnh local)
  const ROLES = [
    { id: "Duelist", name: "Duelist", icon: require("../../assets/images/Duelist.png") },
    { id: "Controller", name: "Controller", icon: require("../../assets/images/Controller.png") },
    { id: "Initiator", name: "Initiator", icon: require("../../assets/images/Initiator.png") },
    { id: "Sentinel", name: "Sentinel", icon: require("../../assets/images/Sentinel.png") },
  ];

  return (
      // Container chính: căn giữa, nền tối, paddingTop 20
      <View style={styles.container}>
        {/* Thanh chọn role: nền đen, bo góc 12, hiển thị 4 nút role */}
        <View style={styles.roleSelectorWrap}>
          {ROLES.map((role) => (
            // Mỗi nút role: TouchableOpacity, khi chọn sẽ có gạch chân trắng
            <TouchableOpacity
              key={role.id}
              style={[styles.roleBtn, selectedRole === role.id && styles.roleBtnSelected]}
              onPress={() => filterByRole(role.id)}
            >
              {/* Icon của role */}
              <Image source={role.icon} style={styles.roleIcon} contentFit="contain" />
              {/* Tên role, nếu được chọn thì màu trắng, không thì mờ */}
              <Text style={[styles.roleLabel, selectedRole === role.id && styles.roleLabelSelected]}>
                {role.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Lưới hiển thị các agent đã lọc */}
        <AgentGrid
          agents={filteredAgents}
          onAgentPress={handleAgentPress}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
        {/* Modal chi tiết agent: chỉ hiển thị khi có agent được chọn */}
        {selectedAgent && (
            <AgentModal
                agent={selectedAgent}
                onClose={() => setSelectedAgent(null)}
                selectedAbility={selectedAbility}
                // onAbilityPress: toggle chọn kỹ năng (nếu đã chọn thì bỏ chọn)
                onAbilityPress={(ability: React.SetStateAction<Ability | null>) =>
                    setSelectedAbility(selectedAbility === ability ? null : ability)
                }
                sortAbilities={sortAbilities}
            />
        )}
      </View>
  );
};

// ===== StyleSheet định nghĩa giao diện =====
const styles = StyleSheet.create({
  // Container chính: chiếm toàn bộ không gian, nền tối, canh giữa
  container: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    backgroundColor: COLORS.BACKGROUND,
    paddingTop: 20,
  },
  // Wrapper chứa các nút chọn role: nền đen, bo góc, dạng hàng ngang
  roleSelectorWrap: {
    backgroundColor: "#000000",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
    marginBottom: 14,
    width: "90%",
  },
  // Mỗi nút role: căn giữa nội dung theo chiều dọc
  roleBtn: {
    alignItems: "center",
  },
  // Nút role khi được chọn: có gạch chân màu trắng phía dưới
  roleBtnSelected: {
    borderBottomWidth: 2,
    borderBottomColor: "#ffffff",
  },
  // Icon của role: kích thước 28x28, giữ tỉ lệ
  roleIcon: {
    width: 28,
    height: 28,
  },
  // Label của role: màu trắng mờ 50%, cỡ chữ 11
  roleLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    marginTop: 4,
  },
  // Label khi được chọn: màu trắng đậm
  roleLabelSelected: {
    color: "#ffffff",
  },
});

export default Agent;
