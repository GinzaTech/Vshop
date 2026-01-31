import React from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from "react-native";
import { useTheme, ActivityIndicator } from "react-native-paper";
import { useUserStore } from "~/hooks/useUserStore";
import { useMatchStore } from "~/hooks/useMatchStore"; // Using the store now
import { COLORS } from "~/constants/DesignSystem";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

export default function MatchHistory() {
    const { colors } = useTheme();
    const user = useUserStore((state) => state.user);
    const router = useRouter();

    // Use global store
    const { matches, loading, fetchMatches } = useMatchStore();
    const [refreshing, setRefreshing] = React.useState(false);

    React.useEffect(() => {
        // Auto-fetch if empty
        if (matches.length === 0) {
            fetchMatches(user);
        }
    }, [user, matches.length]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchMatches(user);
        setRefreshing(false);
    }

    const navigateToDetails = (matchId: string) => {
        router.push(`/match_details/${matchId}`);
    };

    const renderItem = ({ item }: { item: any }) => {
        // Failed fetching state
        if (!item.stats) {
            return (
                <View style={[styles.matchCardContainer, { borderColor: 'rgba(255,255,255,0.1)' }]}>
                    <View style={[styles.matchCardContent, { backgroundColor: 'rgba(20,20,20,0.8)' }]}>
                        <View style={styles.leftSection}>
                            <View style={[styles.agentCircle, { backgroundColor: '#333' }]}>
                                <Text style={{ color: '#555', fontWeight: 'bold' }}>?</Text>
                            </View>
                            <View style={{ marginLeft: 12 }}>
                                <Text style={styles.mapName}>Processing...</Text>
                                <Text style={styles.dateTime}>
                                    {new Date(item.GameStartTime).toLocaleDateString()}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            );
        }

        const isWin = item.stats.won;
        const resultColor = isWin ? '#0fccbf' : '#ff4655'; // Cyan/Green for Win, Red for Loss

        return (
            <TouchableOpacity activeOpacity={0.9} onPress={() => navigateToDetails(item.MatchID)}>
                <View style={[styles.matchCardContainer, { borderColor: resultColor }]}>
                    {/* Map Background */}
                    <Image
                        source={{ uri: item.stats.mapImage }}
                        style={styles.mapBackground}
                        contentFit="cover"
                    />
                    {/* Dark Overlay */}
                    <View style={styles.darkOverlay} />

                    <View style={styles.matchCardContent}>
                        {/* Left: Agent & KDA */}
                        <View style={styles.leftSection}>
                            <Image source={{ uri: item.stats.agentIcon }} style={styles.agentCircle} contentFit="cover" />
                            <View style={{ marginLeft: 12 }}>
                                <Text style={styles.kdaMain}>{item.stats.kills} / <Text style={{ color: '#ff4655' }}>{item.stats.deaths}</Text> / {item.stats.assists}</Text>
                                <Text style={styles.kdaLabel}>KDA</Text>
                            </View>
                        </View>

                        {/* Right: Result & Score */}
                        <View style={styles.rightSection}>
                            <Text style={[styles.resultText, { color: resultColor }]}>
                                {isWin ? "VICTORY" : "DEFEAT"}
                            </Text>
                            <View style={styles.scoreRow}>
                                <Text style={[styles.scoreValue, { color: COLORS.PURE_WHITE }]}>{item.stats.roundsWon}</Text>
                                <Text style={styles.scoreSep}>-</Text>
                                <Text style={[styles.scoreValue, { color: COLORS.PURE_WHITE }]}>{item.stats.roundsLost}</Text>
                            </View>
                            <Text style={styles.mapNameSmall}>{item.stats.mapName} • {new Date(item.GameStartTime).toLocaleDateString()}</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {loading && !refreshing && matches.length === 0 ? (
                <View style={styles.centered}>
                    <ActivityIndicator animating color={COLORS.VALORANT_RED} />
                    <Text style={{ color: 'white', marginTop: 10 }}>Loading Career...</Text>
                </View>
            ) : (
                <FlatList
                    data={matches}
                    keyExtractor={(item) => item.MatchID}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.VALORANT_RED} />
                    }
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No matches found</Text>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    listContent: {
        padding: 16,
        gap: 12,
    },
    matchCardContainer: {
        height: 100,
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        borderLeftWidth: 6,
        backgroundColor: '#1f2326',
    },
    mapBackground: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.6
    },
    darkOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)' // Darken the map for text readability
    },
    matchCardContent: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rightSection: {
        alignItems: 'flex-end',
        justifyContent: 'center'
    },
    agentCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    kdaMain: {
        color: COLORS.PURE_WHITE,
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5
    },
    kdaLabel: {
        color: COLORS.GLASS_WHITE_DIM,
        fontSize: 10,
        marginTop: 2,
        fontWeight: '600'
    },
    resultText: {
        fontSize: 18,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 2
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    scoreValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    scoreSep: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14
    },
    mapName: {
        color: COLORS.PURE_WHITE,
        fontSize: 14,
        fontWeight: 'bold'
    },
    mapNameSmall: {
        color: COLORS.GLASS_WHITE_DIM,
        fontSize: 10,
        marginTop: 4,
        textTransform: 'uppercase'
    },
    dateTime: {
        color: '#888',
        fontSize: 12
    },
    emptyText: {
        color: 'white',
        textAlign: 'center',
        marginTop: 40,
        opacity: 0.5
    }
});
