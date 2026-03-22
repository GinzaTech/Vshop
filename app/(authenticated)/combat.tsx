import React from "react";
import { StyleSheet, View } from "react-native";

import { RoleSelector, AgentGrid } from "~/components/GalleryAgent";
import useCombat from "~/components/Combat";
import ValorantButton from "~/components/ui/ValorantButton";
import { COLORS } from "~/constants/DesignSystem";

const ROLES = [
  {
    id: "Duelist",
    name: "Duelist",
    icon: require("../../assets/images/Duelist.png"),
  },
  {
    id: "Controller",
    name: "Controller",
    icon: require("../../assets/images/Controller.png"),
  },
  {
    id: "Initiator",
    name: "Initiator",
    icon: require("../../assets/images/Initiator.png"),
  },
  {
    id: "Sentinel",
    name: "Sentinel",
    icon: require("../../assets/images/Sentinel.png"),
  },
];

const Combat = () => {
  const {
    filterByRole,
    handleAgentPress,
    handleAgentSelect,
    handleCancel,
    filteredAgents,
    selectedRole,
  } = useCombat();

  return (
    <View style={styles.container}>
      <RoleSelector
        roles={ROLES}
        selectedRole={selectedRole}
        onRoleSelect={filterByRole}
      />
      <AgentGrid agents={filteredAgents} onAgentPress={handleAgentPress} />
      <View style={styles.buttonContainer}>
        <View style={styles.buttonWrapper}>
          <ValorantButton
            title="Cancel"
            variant="secondary"
            onPress={handleCancel}
          />
        </View>
        <View style={styles.buttonWrapper}>
          <ValorantButton title="Lock Agent" onPress={handleAgentSelect} />
        </View>
      </View>
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
  buttonContainer: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  buttonWrapper: {
    flex: 1,
    marginHorizontal: 10,
  },
});

export default Combat;
