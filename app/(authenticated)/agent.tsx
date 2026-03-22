import React from "react";
import { View, StyleSheet } from "react-native";
import { RoleSelector, AgentGrid, AgentModal } from "~/components/GalleryAgent";
import useAgentGallery from "~/components/GalleryAgent";
import { COLORS } from "~/constants/DesignSystem";

const ROLES = [
  { id: "Duelist", name: "Duelist", icon: require("../../assets/images/Duelist.png") },
  { id: "Controller", name: "Controller", icon: require("../../assets/images/Controller.png") },
  { id: "Initiator", name: "Initiator", icon: require("../../assets/images/Initiator.png") },
  { id: "Sentinel", name: "Sentinel", icon: require("../../assets/images/Sentinel.png") },
];

const Agent = () => {
  const { filteredAgents, selectedRole, selectedAgent, selectedAbility, filterByRole,
    handleAgentPress, sortAbilities, setSelectedAgent, setSelectedAbility } = useAgentGallery();

  return (
      <View style={styles.container}>
        <RoleSelector
            roles={ROLES}
            selectedRole={selectedRole}
            onRoleSelect={filterByRole}
        />
        <AgentGrid agents={filteredAgents} onAgentPress={handleAgentPress} />
        {selectedAgent && (
            <AgentModal
                agent={selectedAgent}
                onClose={() => setSelectedAgent(null)}
                selectedAbility={selectedAbility}
                onAbilityPress={(ability: React.SetStateAction<Ability | null>) =>
                    setSelectedAbility(selectedAbility === ability ? null : ability)
                }
                sortAbilities={sortAbilities}
            />
        )}
      </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    backgroundColor: COLORS.BACKGROUND,
    paddingTop: 20,
  },
});

export default Agent;
