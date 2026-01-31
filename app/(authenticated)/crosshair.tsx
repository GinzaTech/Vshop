import React, { useState, useMemo } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, Dimensions } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "react-native-paper";
import GlassCard from "~/components/ui/GlassCard";
import { COLORS } from "~/constants/DesignSystem";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { Image } from "expo-image";

// --- Mock Data with Render Styles ---
type CrosshairType = 'cross' | 'dot' | 'box' | 'circle';

interface CrosshairData {
    name: string;
    team: string;
    code: string;
    tags: string[];
    category: 'Pro' | 'Content' | 'Fun';
    style: {
        type: CrosshairType;
        color: string;
        thickness?: number;
        gap?: number;
        outline?: boolean;
    }
}

const CROSSHAIR_DB: CrosshairData[] = [
    { name: "TenZ", team: "SEN", category: 'Pro', code: "0;s;1;P;c;5;h;0;m;1;0l;4;0o;2;0a;1;0f;0;1b;0;S;c;4;o;1", tags: ["Cyan", "Standard"], style: { type: 'cross', color: '#00FFFF', thickness: 2, gap: 2 } },
    { name: "Yay", team: "BLD", category: 'Pro', code: "0;P;h;0;f;0;0l;4;0o;0;0a;1;0f;0;1b;0", tags: ["White", "Cross"], style: { type: 'cross', color: '#FFFFFF', thickness: 2, gap: 0 } },
    { name: "ScreaM", team: "KC", category: 'Pro', code: "0;P;c;5;o;1;d;1;z;3;f;0;0t;6;0l;0;0a;1;0f;0;1b;0", tags: ["Cyan", "Dot"], style: { type: 'dot', color: '#00FFFF', thickness: 4 } },
    { name: "Boaster", team: "FNC", category: 'Pro', code: "0;s;1;P;c;1;o;1;d;1;0l;0;0o;2;0a;1;0f;0;1t;0;1l;0;1o;0;1a;0;S;c;1;o;1", tags: ["Green", "Box"], style: { type: 'box', color: '#00FF00', thickness: 2 } },
    { name: "Demon1", team: "NRG", category: 'Pro', code: "0;s;1;P;o;1;d;1;m;1;0b;0;1b;0", tags: ["White", "Dot"], style: { type: 'dot', color: '#FFFFFF', thickness: 3 } },
    { name: "Aspas", team: "LEV", category: 'Pro', code: "0;P;c;5;o;1;d;1;z;3;f;0;0b;0;1b;0", tags: ["Cyan", "Small"], style: { type: 'cross', color: '#00FFFF', thickness: 1, gap: 0 } },
    { name: "Grim", team: "CONTENT", category: 'Content', code: "0;p;0;s;1;P;c;5;u;000000FF;h;0;f;0;0l;4;0v;4;0g;1;0o;2;0a;1;0f;0;1b;0", tags: ["Grim Wall", "Line"], style: { type: 'cross', color: '#FF0000', thickness: 1, gap: 4 } },
    { name: "Smiley", team: "FUN", category: 'Fun', code: "0;P;c;8;u;FF0000FF;h;0;d;1;b;1;z;3;0t;10;0l;2;0v;0;0g;1;0o;4;0a;1;0f;0;1t;1;1l;0;1v;4;1g;1;1o;0;1a;1;1m;0;1f;0", tags: ["Troll", "Face"], style: { type: 'circle', color: '#FFA500' } }
];

// --- Components ---

// Simplified Render Component
const CrosshairRender = ({ style }: { style: CrosshairData['style'] }) => {
    const { type, color, thickness = 2, gap = 2, outline } = style;

    // Base styles
    const tickStyle = { backgroundColor: color, position: 'absolute' as const };
    const center = { justifyContent: 'center' as const, alignItems: 'center' as const, width: 40, height: 40 };

    if (type === 'dot') {
        return (
            <View style={center}>
                <View style={{ width: thickness * 2, height: thickness * 2, borderRadius: thickness, backgroundColor: color }} />
            </View>
        );
    }

    if (type === 'box') {
        return (
            <View style={center}>
                <View style={{ width: 10, height: 10, borderWidth: thickness, borderColor: color, backgroundColor: 'transparent' }} />
            </View>
        )
    }

    if (type === 'circle') {
        return (
            <View style={center}>
                <View style={{ width: 20, height: 20, borderWidth: 2, borderColor: color, borderRadius: 10 }} />
                <View style={{ width: 4, height: 4, backgroundColor: color, borderRadius: 2, position: 'absolute' }} />
            </View>
        )
    }

    // Default Cross
    // Vertical
    // Horizontal
    const length = 10;
    const offset = gap + length / 2;

    return (
        <View style={center}>
            {/* Top */}
            <View style={[tickStyle, { width: thickness, height: length, top: 20 - offset - length / 2 }]} />
            {/* Bottom */}
            <View style={[tickStyle, { width: thickness, height: length, bottom: 20 - offset - length / 2 }]} />
            {/* Left */}
            <View style={[tickStyle, { height: thickness, width: length, left: 20 - offset - length / 2 }]} />
            {/* Right */}
            <View style={[tickStyle, { height: thickness, width: length, right: 20 - offset - length / 2 }]} />
        </View>
    );
};

export default function CrosshairDatabase() {
    const { colors } = useTheme();

    const [selected, setSelected] = useState<CrosshairData>(CROSSHAIR_DB[0]);
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState<string>("All");
    const [copiedName, setCopiedName] = useState<string | null>(null);

    const handlePress = async (item: CrosshairData) => {
        if (selected.name === item.name) {
            // Already selected -> Copy
            await Clipboard.setStringAsync(item.code);
            setCopiedName(item.name);
            setTimeout(() => setCopiedName(null), 2000);
        } else {
            // Select for preview
            setSelected(item);
        }
    };

    const filteredData = useMemo(() => {
        return CROSSHAIR_DB.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
                item.team.toLowerCase().includes(search.toLowerCase());
            const matchesCategory = activeCategory === "All" || item.category === activeCategory;
            return matchesSearch && matchesCategory;
        });
    }, [search, activeCategory]);

    const categories = ["All", "Pro", "Content", "Fun"];

    const renderItem = ({ item }: { item: CrosshairData }) => {
        const isSelected = selected.name === item.name;
        const isCopied = copiedName === item.name;

        return (
            <TouchableOpacity
                style={styles.cardContainer}
                activeOpacity={0.8}
                onPress={() => handlePress(item)}
            >
                <GlassCard style={[styles.card, isSelected && styles.cardSelected]}>
                    <View style={styles.cardTop}>
                        <Text style={styles.cardName}>{item.name}</Text>
                        <Text style={[styles.cardTeam, { color: isSelected ? COLORS.VALORANT_RED : COLORS.GLASS_WHITE_DIM }]}>{item.team}</Text>
                    </View>

                    <View style={styles.miniPreview}>
                        <CrosshairRender style={{ ...item.style, color: isSelected ? item.style.color : '#555' }} />
                    </View>

                    {isCopied ? (
                        <View style={styles.copiedBadge}>
                            <Text style={styles.copiedText}>COPIED</Text>
                        </View>
                    ) : (
                        <View style={styles.cardFooter}>
                            <Icon name="crosshairs" size={14} color={COLORS.GLASS_WHITE_DIM} />
                        </View>
                    )}
                </GlassCard>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>

            {/* --- header: Live Preview --- */}
            <View style={styles.previewHeader}>
                {/* Map Background Removed */}
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
                <View style={styles.previewContent}>
                    <View style={styles.crosshairTarget}>
                        <CrosshairRender style={selected.style} />
                    </View>
                    <View style={styles.previewInfo}>
                        <Text style={styles.previewName}>{selected.name}</Text>
                        <Text style={styles.previewTeam}>{selected.team} • {selected.category}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.bodyContent}>
                {/* --- Tool Bar: Search & Categories --- */}
                <View style={styles.toolbar}>
                    <View style={styles.searchBar}>
                        <Icon name="magnify" size={20} color={COLORS.GLASS_WHITE_DIM} />
                        <TextInput
                            style={styles.input}
                            placeholder="Search player or team..."
                            placeholderTextColor="#666"
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                    <View style={styles.tabs}>
                        {categories.map(cat => (
                            <TouchableOpacity
                                key={cat}
                                onPress={() => setActiveCategory(cat)}
                                style={[styles.tab, activeCategory === cat && styles.tabActive]}
                            >
                                <Text style={[styles.tabText, activeCategory === cat && styles.tabTextActive]}>{cat}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* --- Grid List --- */}
                <FlatList
                    data={filteredData}
                    keyExtractor={(item) => item.name}
                    renderItem={renderItem}
                    numColumns={2}
                    columnWrapperStyle={styles.columnWrapper}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    previewHeader: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        position: 'relative'
    },
    previewContent: {
        alignItems: 'center',
        gap: 12
    },
    crosshairTarget: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    previewInfo: {
        alignItems: 'center'
    },
    previewName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
        textTransform: 'uppercase',
        letterSpacing: 2
    },
    previewTeam: {
        color: COLORS.VALORANT_RED,
        fontWeight: 'bold',
        fontSize: 14,
        marginTop: 2
    },
    bodyContent: {
        flex: 1,
    },
    toolbar: {
        padding: 16,
        paddingBottom: 8
    },
    searchBar: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 12
    },
    input: {
        marginLeft: 10,
        color: 'white',
        flex: 1,
        fontSize: 14
    },
    tabs: {
        flexDirection: 'row',
        gap: 10
    },
    tab: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'transparent'
    },
    tabActive: {
        backgroundColor: 'rgba(255, 70, 85, 0.1)', // Red tint
        borderColor: COLORS.VALORANT_RED
    },
    tabText: {
        color: COLORS.GLASS_WHITE_DIM,
        fontSize: 12,
        fontWeight: '600'
    },
    tabTextActive: {
        color: 'white'
    },
    listContainer: {
        padding: 16,
        paddingTop: 8,
    },
    columnWrapper: {
        justifyContent: 'space-between'
    },
    cardContainer: {
        width: '48%',
        marginBottom: 12
    },
    card: {
        padding: 12,
        borderRadius: 10,
        height: 110,
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'transparent'
    },
    cardSelected: {
        borderColor: 'rgba(255,255,255,0.5)',
        backgroundColor: 'rgba(255,255,255,0.08)'
    },
    cardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    cardName: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 15
    },
    cardTeam: {
        fontSize: 10,
        fontWeight: 'bold'
    },
    miniPreview: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        marginVertical: 4
    },
    cardFooter: {
        alignItems: 'flex-end'
    },
    copiedBadge: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        backgroundColor: COLORS.VALORANT_RED,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4
    },
    copiedText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold'
    }
});
