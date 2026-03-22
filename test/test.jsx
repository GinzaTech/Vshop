import React, { useEffect, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { getAgent } from "~/utils/valorant-assets";

const { width } = Dimensions.get("window");
const BOX_SIZE = width / 5 - 10;

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

export default function Agent() {
  const { t } = useTranslation();
  const [agents, setAgents] = useState([]);
  const [filteredAgents, setFilteredAgents] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);

  useEffect(() => {
    async function fetchAgents() {
      try {
        const data = await getAgent();
        if (data?.agents) {
          setAgents(data.agents);
          setFilteredAgents(data.agents);
        }
      } catch (error) {
        console.error("Error fetching agents:", error);
      }
    }

    fetchAgents();
  }, []);

  const filterByRole = (role) => {
    if (role === selectedRole) {
      setSelectedRole(null);
      setFilteredAgents(agents);
      return;
    }

    setSelectedRole(role);
    setFilteredAgents(
      agents.filter((agent) => agent.role?.displayName === role)
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("agents")}</Text>

      <View style={styles.roleContainer}>
        {ROLES.map((role) => (
          <TouchableOpacity
            key={role.id}
            style={[
              styles.roleButton,
              selectedRole === role.id && styles.selectedRoleButton,
            ]}
            onPress={() => filterByRole(role.id)}
          >
            <Image source={role.icon} style={styles.roleIcon} />
            <Text style={styles.roleText}>{t(role.name)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredAgents}
        keyExtractor={(item) => item.uuid}
        numColumns={5}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.box}>
            <Image source={{ uri: item.displayIcon }} style={styles.icon} />
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    backgroundColor: "#1e1e1e",
    paddingTop: 20,
  },
  title: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
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
});
