import {useTranslation} from "react-i18next";
import {useUserStore} from "~/hooks/useUserStore";
import {useEffect, useState} from "react";
import {getAgent} from "~/utils/valorant-assets";
import {lockAgent, quitPreGameLobby} from "~/utils/valorant-api";


const Combat = () => {
    const { t } = useTranslation();
    const { user } = useUserStore();
    const [agents, setAgents] = useState<ValorantAgent[]>([]);
    const [filteredAgents, setFilteredAgents] = useState<ValorantAgent[]>([]);
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const [selectedAgent, setSelectedAgent] = useState<ValorantAgent | null>(null);

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

    const handleAgentSelect = () => {
        if (selectedAgent) {
            lockAgent(user.accessToken, user.entitlementsToken, user.id, user.region, selectedAgent.uuid)
        }
    };

    const handleCancel = () => {
        quitPreGameLobby(user.accessToken, user.entitlementsToken, user.region, user.id)
    };
    return {
        filterByRole,
        handleAgentPress,
        handleAgentSelect,
        handleCancel,
        filteredAgents,
        selectedRole,
        setSelectedAgent,
    }
}

export default Combat;
