// ===== GalleryAgent.tsx =====
// Component thư viện (gallery) hiển thị danh sách các Agent trong Valorant.
// Bao gồm: bộ lọc theo role, lưới agent, và modal chi tiết agent.
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, FlatList, ImageSourcePropType } from "react-native";
import { CachedImage as Image } from "~/components/CachedImage";
import { useTranslation } from "react-i18next";
import { getAgent } from "~/utils/valorant-assets";
import { COLORS } from "~/constants/DesignSystem";
import AppRefreshControl from "~/components/ui/AppRefreshControl";

// Interface Role: định nghĩa một role (vai trò) của agent
// icon: đường dẫn ảnh icon role
// id: định danh role
// name: tên hiển thị của role
interface Role {
    icon: ImageSourcePropType;
    id: string;
    name: string;
}

// Interface AgentGridProps: props cho component AgentGrid
// agents: danh sách agent cần hiển thị
// onAgentPress: callback khi nhấn vào một agent
// selectedAgentId: uuid của agent đang được chọn (null nếu chưa chọn)
interface AgentGridProps {
    agents: ValorantAgent[];
    onAgentPress: (agent: ValorantAgent) => void;
    selectedAgentId?: string | null;
    refreshing?: boolean;
    onRefresh?: () => void;
}

// Interface RoleSelectorProps: props cho component RoleSelector
// roles: danh sách role có sẵn
// selectedRole: role đang được chọn (null nếu không lọc)
// onRoleSelect: callback khi chọn một role
interface RoleSelectorProps {
    roles: Role[];
    selectedRole: string | null;
    onRoleSelect: (roleId: string) => void;
}

// Interface AgentModalProps: props cho component AgentModal (modal chi tiết agent)
// agent: agent cần hiển thị chi tiết
// onClose: callback khi đóng modal
// selectedAbility: ability đang được chọn (null nếu chưa chọn)
// onAbilityPress: callback khi nhấn vào một ability
// sortAbilities: hàm sắp xếp abilities (passive lên trước)
interface AgentModalProps {
    agent: ValorantAgent;
    onClose: () => void;
    selectedAbility: Ability | null;
    onAbilityPress: (ability: Ability) => void;
    sortAbilities: (abilities: Ability[] | undefined) => Ability[];
}

// sortAbilities: Hàm sắp xếp abilities, đưa passive lên đầu danh sách
// abilities: mảng abilities cần sắp xếp (có thể undefined)
// Trả về: mảng Ability[] đã sắp xếp (passive trước, các ability khác sau)
const sortAbilities = (abilities: Ability[] | undefined): Ability[] => {
    if (!abilities) return [];
    const passive = abilities.filter((ability) => ability.slot === "Passive");
    return [...passive, ...abilities.filter((ability) => ability.slot !== "Passive")];
};

// GalleryAgent: Hook chính quản lý state và logic cho thư viện agent
// Trả về: object chứa các state và hàm xử lý
const GalleryAgent = () => {
    // Hook dịch thuật i18n
    const { t } = useTranslation();

    // agents: danh sách tất cả agent từ dữ liệu game
    const [agents, setAgents] = useState<ValorantAgent[]>([]);
    // filteredAgents: danh sách agent đã lọc theo role, khởi tạo = agents
    const [filteredAgents, setFilteredAgents] = useState<ValorantAgent[]>([]);
    // selectedRole: role đang được chọn để lọc (null nếu không lọc)
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    // selectedAgent: agent đang được chọn để xem chi tiết (null nếu chưa chọn)
    const [selectedAgent, setSelectedAgent] = useState<ValorantAgent | null>(null);
    // selectedAbility: ability đang được chọn để xem mô tả (null nếu chưa chọn)
    const [selectedAbility, setSelectedAbility] = useState<Ability | null>(null);
    // showDescription: flag kiểm soát hiển thị phần mô tả agent/ability
    const [showDescription, setShowDescription] = useState<boolean>(false);

    // useEffect: Tải danh sách agent khi component mount
    // Gọi getAgent(), chuẩn hóa dữ liệu, lưu vào agents và filteredAgents
    useEffect(() => {
        async function fetchAgents() {
            try {
                const data = getAgent();
                const normalizedAgents = data.agents.map((agent) => ({
                    ...agent,
                    abilities: agent.abilities || [],
                }));
                setAgents(normalizedAgents);
                setFilteredAgents(normalizedAgents);
            } catch (error) {
                if (__DEV__) console.error("Error fetching agents:", error);
            }
        }

        fetchAgents();
    }, []);

    // filterByRole: Callback lọc agent theo role
    // Dùng useCallback với dependencies [agents, selectedRole, t]
    // Nếu role trùng với selectedRole hiện tại => bỏ lọc (show all)
    // Ngược lại => lọc agents theo role.displayName === translatedRole
    const filterByRole = useCallback((role: string | number) => {
        if (typeof role !== "string") return;
        if (role === selectedRole) {
            setSelectedRole(null);
            setFilteredAgents(agents);
        } else {
            setSelectedRole(role);
            const translatedRole = t(role);
            setFilteredAgents(agents.filter((agent) => agent.role?.displayName === translatedRole));
        }
    }, [agents, selectedRole, t]);

    // handleAgentPress: Callback xử lý khi nhấn vào một agent
    // Dùng useCallback với dependency [selectedAgent]
    // Nếu agent đã được chọn => bỏ chọn (set null, ẩn description, bỏ ability)
    // Nếu chưa chọn => chọn agent đó, hiện description, bỏ ability cũ
    const handleAgentPress = useCallback((agent: ValorantAgent) => {
        if (selectedAgent && selectedAgent.uuid === agent.uuid) {
            setSelectedAgent(null);
            setShowDescription(false);
            setSelectedAbility(null);
        } else {
            setSelectedAgent(agent);
            setShowDescription(true);
            setSelectedAbility(null);
        }
    }, [selectedAgent]);

    // handleCloseModal: Callback đóng modal và reset các state liên quan
    const handleCloseModal = useCallback(() => {
        setSelectedAgent(null);
        setShowDescription(false);
        setSelectedAbility(null);
    }, []);

    return {
        agents,              // Danh sách tất cả agent
        filteredAgents,      // Danh sách agent đã lọc
        selectedRole,        // Role đang được chọn
        selectedAgent,       // Agent đang được chọn
        selectedAbility,     // Ability đang được chọn
        filterByRole,        // Hàm lọc agent
        handleAgentPress,    // Hàm xử lý nhấn agent
        sortAbilities,       // Hàm sắp xếp abilities
        setSelectedAgent,    // Setter cho selectedAgent
        setSelectedAbility,  // Setter cho selectedAbility
        handleCloseModal,    // Hàm đóng modal
        showDescription,     // Flag hiển thị description
    };
};

// RoleSelector: Component hiển thị danh sách các nút role để lọc
// Props: roles (danh sách role), selectedRole (role đang chọn), onRoleSelect (callback)
// Được memo hóa (React.memo) để tránh re-render không cần thiết
// Layout: flex row, các nút role có icon + text, nút được chọn có gạch dưới
export const RoleSelector: React.FC<RoleSelectorProps> = React.memo(({ roles, selectedRole, onRoleSelect }) => (
    <View style={styles.roleContainer}>
        {roles.map((role) => (
            <TouchableOpacity
                key={role.id}
                style={[styles.roleButton, selectedRole === role.id && styles.selectedRoleButton]}
                onPress={() => onRoleSelect(role.id)}
            >
                <Image source={role.icon} style={styles.roleIcon} contentFit="contain" />
                <Text style={styles.roleText}>{role.name}</Text>
            </TouchableOpacity>
        ))}
    </View>
));

// AgentItem: Component hiển thị một agent trong lưới (box)
// Props: item (agent), onPress (callback), selected (boolean - đã chọn hay chưa)
// Được memo hóa (React.memo)
// Layout: box vuông, chứa ảnh displayIcon, nếu selected thì đổi màu nền
const AgentItem = React.memo(({ item, onPress, selected }: { item: ValorantAgent; onPress: (agent: ValorantAgent) => void; selected: boolean }) => (
    <View style={styles.boxWrap}>
        <TouchableOpacity
            style={[styles.box, selected && styles.selectedBox]}
            onPress={() => onPress(item)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={item.displayName}
        >
            <Image
                cacheId={`agent:${item.uuid}:display-icon`}
                source={{ uri: item.displayIcon }}
                style={styles.icon}
                contentFit="contain"
                cachePolicy="memory-disk"
                priority="low"
                recyclingKey={item.uuid}
            />
        </TouchableOpacity>
    </View>
));

// AgentGrid: Component hiển thị lưới agent (FlatList, 5 cột)
// Props: agents (danh sách), onAgentPress (callback), selectedAgentId (uuid agent đang chọn)
// Được memo hóa (React.memo)
// renderItem được useCallback để tối ưu performance
export const AgentGrid: React.FC<AgentGridProps> = React.memo(({ agents, onAgentPress, selectedAgentId, refreshing = false, onRefresh }) => {
    const renderItem = useCallback(({ item }: { item: ValorantAgent }) => (
        <AgentItem
            item={item}
            onPress={onAgentPress}
            selected={item.uuid === selectedAgentId}
        />
    ), [onAgentPress, selectedAgentId]);

    return (
        <FlatList
            data={agents}
            extraData={selectedAgentId}
            keyExtractor={(item) => item.uuid}
            numColumns={5}
            renderItem={renderItem}
            contentContainerStyle={styles.listContainer}
            refreshControl={
                onRefresh ? (
                    <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                ) : undefined
            }
            alwaysBounceVertical={Boolean(onRefresh)}
            showsVerticalScrollIndicator={false}
        />
    );
});

// AgentModal: Component Modal hiển thị chi tiết agent
// Props: agent, onClose, selectedAbility, onAbilityPress, sortAbilities
// Được memo hóa (React.memo)
// Hiển thị: tên agent, ảnh fullPortrait, mô tả, lưới abilities
//   abilities được sắp xếp (passive trước) và có thể nhấn để xem mô tả
// Modal dạng slide, không transparent, full màn hình
export const AgentModal: React.FC<AgentModalProps> = React.memo(({ agent, onClose, selectedAbility, onAbilityPress, sortAbilities, }) => (
    <Modal visible={!!agent} transparent={false} animationType="slide" onRequestClose={onClose}>
        <View style={styles.modalContainer}>
            <ScrollView contentContainerStyle={styles.modalContent}>
                {agent && (
                    <>
                        {/* Tên agent */}
                        <Text style={styles.agentName}>{agent.displayName}</Text>
                        {/* Ảnh full portrait của agent (nếu có) */}
                        {agent.fullPortrait && (
                            <Image
                                cacheId={`agent:${agent.uuid}:full-portrait`}
                                source={{ uri: agent.fullPortrait }}
                                style={styles.agentImage}
                                contentFit="contain"
                                cachePolicy="memory-disk"
                                priority="high"
                                recyclingKey={agent.uuid}
                            />
                        )}
                        {/* Mô tả agent (nếu có) */}
                        {agent.description && (
                            <Text style={styles.agentDescription}>{agent.description}</Text>
                        )}
                        {/* Lưới abilities, đã sắp xếp */}
                        <View style={styles.abilitiesContainer}>
                            {sortAbilities(agent.abilities).map((ability) => (
                                <TouchableOpacity
                                    key={`${ability.slot}-${ability.displayName}`}
                                    style={styles.abilityContainer}
                                    onPress={() => onAbilityPress(ability)}
                                >
                                    <Image
                                        cacheId={`agent:${agent.uuid}:ability:${ability.slot}:icon`}
                                        source={{ uri: ability.displayIcon }}
                                        style={styles.abilityIcon}
                                        contentFit="contain"
                                        cachePolicy="memory-disk"
                                        priority="normal"
                                        recyclingKey={ability.displayName}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </>
                )}
                {/* Panel mô tả ability đang được chọn */}
                {selectedAbility && (
                    <View style={styles.abilityDescriptionContainer}>
                        <Text style={styles.abilityName}>{selectedAbility.displayName}</Text>
                        <Text style={styles.abilityDescription}>{selectedAbility.description}</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    </Modal>
));

// Gán displayName cho các component để dễ debug trong React DevTools
RoleSelector.displayName = "RoleSelector";
AgentItem.displayName = "AgentItem";
AgentGrid.displayName = "AgentGrid";
AgentModal.displayName = "AgentModal";

// StyleSheet: Định nghĩa các style cho GalleryAgent (RoleSelector, AgentGrid, AgentModal)
const styles = StyleSheet.create({
    roleContainer: {
        flexDirection: "row",          // Xếp ngang hàng
        justifyContent: "space-around", // Dàn đều các role button
        marginBottom: 20,
        width: "100%",
    },
    roleButton: {
        alignItems: "center",          // Căn giữa icon + text
        marginHorizontal: 10,
        paddingBottom: 6,
    },
    selectedRoleButton: {
        borderBottomWidth: 2,          // Gạch dưới khi được chọn
        borderBottomColor: COLORS.PURE_BLACK,
    },
    roleIcon: {
        width: 40,
        height: 40,
    },
    roleText: {
        color: COLORS.TEXT_PRIMARY,
        fontSize: 12,
        marginTop: 5,
    },
    listContainer: {
        justifyContent: "center",
        width: "100%",
        paddingBottom: 8,
    },
    boxWrap: {
        width: "20%",                  // 5 cột = 20% mỗi cột
        paddingHorizontal: 4,
        marginBottom: 10,
    },
    box: {
        width: "100%",
        aspectRatio: 1,                // Hình vuông
        backgroundColor: COLORS.SURFACE,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.BORDER,
        alignItems: "center",
        justifyContent: "center",
    },
    selectedBox: {
        backgroundColor: COLORS.SUCCESS, // Nền xanh khi chọn
        borderColor: COLORS.SUCCESS,
    },
    icon: {
        width: "80%",
        height: "80%",
    },

    modalContainer: {
        flex: 1,                       // Full màn hình
        backgroundColor: COLORS.BACKGROUND,
        justifyContent: "center",
        padding: 20,
    },
    modalContent: {
        flexGrow: 1,
        padding: 20,
        alignItems: "center",          // Căn giữa nội dung
        backgroundColor: COLORS.BACKGROUND,
        color: COLORS.TEXT_PRIMARY,
    },
    agentName: {
        fontSize: 30,
        fontWeight: "bold",
        color: COLORS.TEXT_PRIMARY,
        marginBottom: 10,
    },
    agentImage: {
        width: 200,
        height: 200,
        marginBottom: 10,
    },
    agentDescription: {
        fontSize: 16,
        color: COLORS.TEXT_SECONDARY,
        textAlign: "center",
        marginBottom: 20,
    },

    abilitiesContainer: {
        flexDirection: "row",          // Xếp ngang
        flexWrap: "wrap",              // Xuống dòng khi hết chỗ
        justifyContent: "center",
        marginBottom: 20,
        alignItems: "center",
        width: "100%",
        marginHorizontal: 2,
    },
    abilityContainer: {
        alignItems: "center",
        margin: 3,
        width: "18%",                  // ~5 ability mỗi hàng
        flexBasis: "18%",
    },
    abilityIcon: {
        width: 40,
        height: 40,
    },

    abilityDescriptionContainer: {
        marginTop: 10,
        alignItems: "center",
    },
    abilityName: {
        fontSize: 14,
        color: COLORS.TEXT_PRIMARY,
        textAlign: "center",
    },
    abilityDescription: {
        fontSize: 12,
        color: COLORS.TEXT_SECONDARY,
        textAlign: "center",
        marginTop: 5,
    },
});

export default GalleryAgent;

