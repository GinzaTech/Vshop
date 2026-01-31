import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useTheme, ActivityIndicator } from "react-native-paper";
import { useUserStore } from "~/hooks/useUserStore";
import { matchDetails } from "~/utils/valorant-api";
import { getAssets, getAgent } from "~/utils/valorant-assets";
import GlassCard from "~/components/ui/GlassCard";
import { COLORS } from "~/constants/DesignSystem";
import { Image } from "expo-image";

export default function MatchDetailsScreen() {
    const { id } = useLocalSearchParams();
    const { colors } = useTheme();
    const user = useUserStore((state) => state.user);

    const [details, setDetails] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchDetails = async () => {
            if (!user.accessToken || !user.entitlementsToken || !user.region || !id) return;

            try {
                const data = await matchDetails(
                    user.accessToken,
                    user.entitlementsToken,
                    user.region,
                    id as string
                );
                setDetails(data);
            } catch (error) {
                console.error("Error fetching details:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [id, user]);

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator animating color={COLORS.VALORANT_RED} size="large" />
            </View>
        )
    }

    if (!details) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: 'white' }}>Failed to load match details.</Text>
            </View>
        )
    }

    // Process data
    const assets = getAssets();
    const agents = getAgent().agents;
    const mapInfo = assets.maps ? assets.maps.find((m: any) => m.mapUrl === details.matchInfo?.mapId) : null;

    // Teams
    const teams = details.teams || [];
    const blueTeam = teams.find((t: any) => t.teamId === 'Blue');
    const redTeam = teams.find((t: any) => t.teamId === 'Red');

    // Players
    const players = details.players || [];
    const bluePlayers = players.filter((p: any) => p.teamId === 'Blue');
    const redPlayers = players.filter((p: any) => p.teamId === 'Red');

    const renderPlayerRow = (player: any) => {
        const agent = agents.find((a: any) => a.uuid === player.characterId);
        const isMe = player.subject === user.id;

        return (
            <View key={player.subject} style={[styles.playerRow, isMe && styles.highlightRow]}>
                <View style={styles.agentInfo}>
                    <Image source={{ uri: agent?.displayIcon }} style={styles.agentIconSmall} />
                    <Text style={[styles.playerName, isMe && { color: COLORS.VALORANT_RED }]} numberOfLines={1}>
                        {player.gameName}
                    </Text>
                </View>
                <View style={styles.stats}>
                    <Text style={styles.kda}>{player.stats?.kills} / {player.stats?.deaths} / {player.stats?.assists}</Text>
                    <Text style={styles.score}>{player.stats?.score}</Text>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ title: 'Match Details', headerStyle: { backgroundColor: colors.background }, headerTintColor: 'white' }} />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header / Map Info */}
                <View style={styles.header}>
                    <Image
                        source={{ uri: mapInfo?.splash }}
                        style={StyleSheet.absoluteFillObject}
                        contentFit="cover"
                        blurRadius={3}
                    />
                    <View style={styles.overlay} />
                    <View style={styles.headerContent}>
                        <Text style={styles.mapTitle}>{mapInfo?.displayName || 'Unknown Map'}</Text>
                        <Text style={styles.matchMode}>{details.matchInfo?.queueID || 'Standard'}</Text>
                        <View style={styles.scoreBoard}>
                            <Text style={[styles.bigScore, { color: '#0fccbf' }]}>{blueTeam?.roundsWon ?? 0}</Text>
                            <Text style={styles.vs}>VS</Text>
                            <Text style={[styles.bigScore, { color: '#ff4655' }]}>{redTeam?.roundsWon ?? 0}</Text>
                        </View>
                    </View>
                </View>

                {/* Blue Team */}
                <GlassCard style={[styles.teamCard, { borderColor: '#0fccbf', borderTopWidth: 4 }]}>
                    <View style={[styles.teamHeader, { backgroundColor: 'rgba(15, 204, 191, 0.2)' }]}>
                        <Text style={styles.teamTitle}>BLUE TEAM</Text>
                        <Text style={styles.teamResult}>{blueTeam?.won ? "VICTORY" : blueTeam?.roundsWon > redTeam?.roundsWon ? "VICTORY" : "DEFEAT"}</Text>
                    </View>
                    {bluePlayers.map(renderPlayerRow)}
                </GlassCard>

                {/* Red Team */}
                <GlassCard style={[styles.teamCard, { borderColor: '#ff4655', borderTopWidth: 4 }]}>
                    <View style={[styles.teamHeader, { backgroundColor: 'rgba(255, 70, 85, 0.2)' }]}>
                        <Text style={styles.teamTitle}>RED TEAM</Text>
                        <Text style={styles.teamResult}>{redTeam?.won ? "VICTORY" : redTeam?.roundsWon > blueTeam?.roundsWon ? "VICTORY" : "DEFEAT"}</Text>
                    </View>
                    {redPlayers.map(renderPlayerRow)}
                </GlassCard>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 30
    },
    header: {
        height: 180,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        position: 'relative'
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    headerContent: {
        alignItems: 'center',
        zIndex: 1
    },
    mapTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
        textTransform: 'uppercase',
        letterSpacing: 2
    },
    matchMode: {
        color: '#ddd',
        fontSize: 14,
        marginTop: 4,
        textTransform: 'uppercase'
    },
    scoreBoard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        gap: 16
    },
    bigScore: {
        fontSize: 48,
        fontWeight: '900',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4
    },
    vs: {
        color: 'white',
        opacity: 0.6,
        fontSize: 16,
        fontWeight: 'bold'
    },
    teamCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 0,
        overflow: 'hidden'
    },
    teamHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 12,
        paddingHorizontal: 16
    },
    teamTitle: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
        letterSpacing: 1
    },
    teamResult: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
        opacity: 0.9
    },
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)'
    },
    highlightRow: {
        backgroundColor: 'rgba(255, 215, 0, 0.1)'
    },
    agentInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    agentIconSmall: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10
    },
    playerName: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600'
    },
    stats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16
    },
    kda: {
        color: '#ddd',
        fontSize: 13,
        width: 80,
        textAlign: 'right',
        fontFamily: 'monospace'
    },
    score: {
        color: 'white',
        fontSize: 13,
        fontWeight: 'bold',
        width: 40,
        textAlign: 'right'
    }
});
