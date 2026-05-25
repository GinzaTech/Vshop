import React from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { AgentGrid, AgentModal } from "~/components/GalleryAgent";
import useAgentGallery from "~/components/GalleryAgent";
import { COLORS } from "~/constants/DesignSystem";

const Agent = () => {
  const { t } = useTranslation();
  const { filteredAgents, selectedRole, selectedAgent, selectedAbility, filterByRole,
    handleAgentPress, sortAbilities, setSelectedAgent, setSelectedAbility } = useAgentGallery();

  const ROLES = [
    { id: "Duelist", name: "Duelist", icon: require("../../assets/images/Duelist.png") },
    { id: "Controller", name: "Controller", icon: require("../../assets/images/Controller.png") },
    { id: "Initiator", name: "Initiator", icon: require("../../assets/images/Initiator.png") },
    { id: "Sentinel", name: "Sentinel", icon: require("../../assets/images/Sentinel.png") },
  ];

  return (
      <View style={styles.container}>
        <View style={styles.roleSelectorWrap}>
          {ROLES.map((role) => (
            <TouchableOpacity
              key={role.id}
              style={[styles.roleBtn, selectedRole === role.id && styles.roleBtnSelected]}
              onPress={() => filterByRole(role.id)}
            >
              <Image source={role.icon} style={styles.roleIcon} />
              <Text style={[styles.roleLabel, selectedRole === role.id && styles.roleLabelSelected]}>
                {role.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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
  roleSelectorWrap: {
    backgroundColor: "#000000",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
    marginBottom: 14,
    width: "90%",
  },
  roleBtn: {
    alignItems: "center",
  },
  roleBtnSelected: {
    borderBottomWidth: 2,
    borderBottomColor: "#ffffff",
  },
  roleIcon: {
    width: 28,
    height: 28,
    resizeMode: "contain",
  },
  roleLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    marginTop: 4,
  },
  roleLabelSelected: {
    color: "#ffffff",
  },
});

export default Agent;
