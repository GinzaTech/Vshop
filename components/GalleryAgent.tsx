import React, { useEffect, useState } from "react";
import {View, Text, Image, TouchableOpacity, StyleSheet, Modal, ScrollView, FlatList, Dimensions, ImageSourcePropType} from "react-native";
import Animated from "react-native-reanimated";
import {FadeIn, FadeOut} from "react-native-reanimated";
import {useTranslation} from "react-i18next";
import {getAgent} from "~/utils/valorant-assets";

const {width} = Dimensions.get("window");
const BOX_SIZE = width / 5 - 10;

interface Role {
    icon: ImageSourcePropType;
    id: string;
    name: string;
}

interface AgentGridProps {
    agents: ValorantAgent[];
    onAgentPress: (agent: ValorantAgent) => void;
}
interface RoleSelectorProps {
    roles: Role[];
    selectedRole: string | null;
    onRoleSelect: (roleId: string) => void;
}
interface AgentModalProps {
    agent: ValorantAgent;
    onClose: () => void;
    selectedAbility: Ability | null;
    onAbilityPress: (ability: Ability) => void;
    sortAbilities: (abilities: Ability[]) => Ability[];
}

const GalleryAgent = () => {
    const {t} = useTranslation();

    const [agents, setAgents] = useState<ValorantAgent[]>([]);
    const [filteredAgents, setFilteredAgents] = useState<ValorantAgent[]>([]);
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const [selectedAgent, setSelectedAgent] = useState<ValorantAgent | null>(null);
    const [selectedAbility, setSelectedAbility] = useState<Ability | null>(null);
    const [showDescription, setShowDescription] = useState<boolean>(false);

    useEffect(() => {
        async function fetchAgents() {
            try {
                const data = getAgent();
                const normalizedAgents = data.agents.map((agent) => ({
                    ...agent,
                    abilities: agent.abilities || [],
                }));
                setAgents(normalizedAgents);
            } catch (error) {
                console.error("Error fetching agents:", error);
            }
        }

        fetchAgents();
    }, []);

    const filterByRole = (role: string | number) => {
        if (typeof role !== "string") return;
        if (role === selectedRole) {
            setSelectedRole(null);
            setFilteredAgents(agents);
        } else {
            setSelectedRole(role);
            const translatedRole = t(role);
            setFilteredAgents(agents.filter((agent) => agent.role?.displayName === translatedRole));
        }
    };

    const handleAgentPress = (agent: ValorantAgent) => {
        if (selectedAgent && selectedAgent.uuid === agent.uuid) {
            setSelectedAgent(null);
            setShowDescription(false);
            setSelectedAbility(null);
        } else {
            setSelectedAgent(agent);
            setShowDescription(true);
            setSelectedAbility(null);
        }
    };

    const sortAbilities = (abilities: Ability[] | undefined): Ability[] => {
        if (!abilities) return [];
        const passive = abilities.filter((ability) => ability.slot === "Passive");
        return [...passive, ...abilities.filter((ability) => ability.slot !== "Passive")];
    };
    return {
        agents,
        filteredAgents,
        selectedRole,
        selectedAgent,
        selectedAbility,
        filterByRole,
        handleAgentPress,
        sortAbilities,
        setSelectedAgent,
        setSelectedAbility,
    };
};

export const RoleSelector: React.FC<RoleSelectorProps> = ({ roles, selectedRole, onRoleSelect }) => (
    <View style={styles.roleContainer}>
        {roles.map((role) => (
            <TouchableOpacity
                key={role.id}
                style={[styles.roleButton, selectedRole === role.id && styles.selectedRoleButton]}
                onPress={() => onRoleSelect(role.id)}
            >
                <Image source={role.icon} style={styles.roleIcon} />
                <Text style={styles.roleText}>{role.name}</Text>
            </TouchableOpacity>
        ))}
    </View>
);
export const AgentGrid: React.FC<AgentGridProps> = ({ agents, onAgentPress }) => (
    <FlatList
        data={agents}
        keyExtractor={(item) => item.uuid}
        numColumns={5}
        renderItem={({ item }) => (
            <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(400)} style={styles.box}>
                <TouchableOpacity style={styles.box} onPress={() => onAgentPress(item)}>
                    <Image source={{ uri: item.displayIcon }} style={styles.icon} />
                </TouchableOpacity>
            </Animated.View>
        )}
        contentContainerStyle={styles.listContainer}
    />
);
export const AgentModal: React.FC<AgentModalProps> = ({ agent, onClose, selectedAbility, onAbilityPress, sortAbilities,}) => (
    <Modal visible={!!agent} transparent={false} animationType="slide" onRequestClose={onClose}>
        <View style={styles.modalContainer}>
            <ScrollView contentContainerStyle={styles.modalContent}>
                {agent && (
                    <>
                        <Text style={styles.agentName}>{agent.displayName}</Text>
                        {agent.fullPortrait && (
                            <Image source={{ uri: agent.fullPortrait }} style={styles.agentImage} />
                        )}
                        {agent.description && (
                            <Text style={styles.agentDescription}>{agent.description}</Text>
                        )}
                        <View style={styles.abilitiesContainer}>
                            {sortAbilities(agent.abilities).map((ability, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.abilityContainer}
                                    onPress={() => onAbilityPress(ability)}
                                >
                                    <Image source={{ uri: ability.displayIcon }} style={styles.abilityIcon} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </>
                )}
                {selectedAbility && (
                    <View style={styles.abilityDescriptionContainer}>
                        <Text style={styles.abilityName}>{selectedAbility.displayName}</Text>
                        <Text style={styles.abilityDescription}>{selectedAbility.description}</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    </Modal>
);
const styles = StyleSheet.create({
    roleContainer: {
        flexDirection: "row",
        justifyContent: "space-around",
        marginBottom: 20,
        width: "100%",
    },
    roleButton: {
        alignItems: "center",
        marginHorizontal: 10,
    },
    selectedRoleButton: {
        borderBottomWidth: 2,
        borderBottomColor: "#ff4655",
    },
    roleIcon: {
        width: 40,
        height: 40,
        resizeMode: "contain",
    },
    roleText: {
        color: "#fff",
        fontSize: 12,
        marginTop: 5,
    },
    listContainer: {
        justifyContent: "center",
    },
    box: {
        width: BOX_SIZE,
        height: BOX_SIZE,
        margin: 5,
        backgroundColor: "#2e2e2e",
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    icon: {
        width: "80%",
        height: "80%",
        resizeMode: "contain",
    },

    modalContainer: {
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
        padding: 20,
    },
    modalContent: {
        flex: 1,
        padding: 20,
        alignItems: "center",
        backgroundColor: "#000",
        color: "#fff",
    },
    agentName: {
        fontSize: 30,
        fontWeight: "bold",
        color: "#fff",
        marginBottom: 10,
    },
    agentImage: {
        width: 200,
        height: 200,
        resizeMode: "contain",
        marginBottom: 10,
    },
    agentDescription: {
        fontSize: 16,
        color: "#fff",
        textAlign: "center",
        marginBottom: 20,
    },

    abilitiesContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        marginBottom: 20,
        alignItems: "center",
        width: "100%",
        marginHorizontal: 2, 
    },
    abilityContainer: {
        alignItems: "center",
        margin: 3,  
        width: "18%",  
        flexBasis: "18%", 
    },
    abilityIcon: {
        width: 40,  
        height: 40, 
        resizeMode: "contain",
    },

    abilityDescriptionContainer: {
        marginTop: 10,
        alignItems: "center",
    },
    abilityName: {
        fontSize: 14,
        color: "#fff",
        textAlign: "center",
    },
    abilityDescription: {
        fontSize: 12,
        color: "#fff",
        textAlign: "center",
        marginTop: 5,
    },
});

export default GalleryAgent;
