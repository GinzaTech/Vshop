import React from "react";
import { GestureDetector } from "react-native-gesture-handler";
import { FlatList, Platform, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import Animated from "react-native-reanimated";
import { ActivityIndicator, Searchbar } from "react-native-paper";
import { CachedImage as Image } from "~/components/CachedImage";
import PlayerInfoView from "~/components/profile/PlayerInfoView";
import { CollectionCheckerExport, CollectionCheckerExportProvider } from "~/components/profile/CollectionCheckerExport";
import AppIcon from "~/components/ui/AppIcon";
import { TabKey, EquippedWeapon, OwnedWeaponCollectionItem } from "~/components/GalleryProfile";
import { COLORS } from "~/constants/DesignSystem";
import { styles } from "~/features/profile/profile-screen.styles";
import { CompactProfileSkinCard } from "~/features/profile/CompactProfileSkinCard";
import { ProfilePickerModal } from "~/features/profile/ProfilePickerModal";
import { ProfileSegmentedControl } from "~/features/profile/ProfileSegmentedControl";
import {
  getProfileContentBottomPadding,
  PROFILE_INFO_COLORS,
} from "~/features/profile/profile-visual-policy";
import { ProfileHeroCard } from "~/features/profile/ProfileHeroCard";
import { PROFILE_STICKY_SEGMENT_HEIGHT } from "~/features/profile/useProfileCollapsibleHeader";
import { ProfileExpressionSection, ProfileIdentitySection } from "~/features/profile/ProfileEquipmentSections";
import { PROFILE_TAB_KEYS } from "~/features/profile/profile-loadout";
import { useProfileSession } from "./useProfileSession";
import { useProfileState } from "./useProfileState";
import { useProfileMotion } from "./useProfileMotion";
import { useProfileHeroData } from "./useProfileHeroData";
import { useProfileFetch } from "./useProfileFetch";
import { useProfileLoadoutData } from "./useProfileLoadoutData";
import { useProfilePickerOptions } from "./useProfilePickerOptions";
import { useProfileCollection } from "./useProfileCollection";
import { useProfilePickers } from "./useProfilePickers";
import { useProfilePager } from "./useProfilePager";
import { useProfileMutations } from "./useProfileMutations";
type ProfileListRow =
    | { key: "identity"; kind: "identity" }
    | { key: "expressions"; kind: "expressions" }
    | { key: string; kind: "skin-category"; category: string }
    | {
      key: string;
      kind: "collection-row";
      items: OwnedWeaponCollectionItem[];
    }
    | { key: string; kind: "loading" }
    | {
      key: string;
      kind: "message";
      message: string;
      tone: "error" | "empty";
    };

function Profile() {
  const {
    insets, colors, t, viewportWidth, isProfileDemo, user, setUser, matchHistoryLoading,
    seasonStatsLoading, fetchMatches, fetchSeasonStats, setProfileCache, profileGridColumns,
    profileGridCardWidth, profileSkinRowCardWidth, hasAuth, authKey, cachedProfile, cachedCompetitiveRank,
    cachedLoadoutSnapshot, dashboardMatches, dashboardSeasonStats, dashboardSeasonStatsById,
    dashboardSeasonMatchesById, dashboardSeasonOptions,
  } = useProfileSession();
  const {
    loading, setLoading, refreshing, setRefreshing, statsRefreshing, setStatsRefreshing, error, setError,
    pickerError, setPickerError, pickerLoading, setPickerLoading, updatingLoadout, setUpdatingLoadout,
    rawGuns, setRawGuns, rawSprays, setRawSprays, rawActiveExpressions, setRawActiveExpressions, identity,
    setIdentity, loadoutSnapshot, setLoadoutSnapshot, ownedSkinItemIds, setOwnedSkinItemIds,
    ownedSprayItemIds, setOwnedSprayItemIds, ownedFlexItemIds, setOwnedFlexItemIds, ownedPlayerCardItemIds,
    setOwnedPlayerCardItemIds, ownedPlayerTitleItemIds, setOwnedPlayerTitleItemIds, competitiveRank,
    setCompetitiveRank, weaponMetadata, setWeaponMetadata, searchQuery, setSearchQuery,
    collectionWeaponFilter, setCollectionWeaponFilter, pickerState, setPickerState, identityPickerQuery,
    setIdentityPickerQuery, activeWeaponChroma, setActiveWeaponChroma, pickerTaskRef, loadoutSnapshotRef,
    loadoutMutationVersionRef, pendingLoadoutRef, initialFetchTaskRef, initialFetchTimeoutRef,
    rankRefreshAuthKeyRef, fetchLoadoutInFlightRef, sessionUserRef, competitiveRankRef,
    cachedCompetitiveRankRef,
  } = useProfileState({
    cachedLoadoutSnapshot, cachedProfile, user, isProfileDemo, cachedCompetitiveRank,
  });
  const {
    activeTab, setActiveTab, reduceMotionEnabled, profileNavContentMode,
    statsDashboardMounted, profilePagerRef, skinWhitespacePagerOriginRef, handleSegmentContainerLayout,
    handlePagerScroll, segmentIndicatorAnimatedStyle, profileSegmentLayerAnimatedStyle,
    statsSegmentLayerAnimatedStyle, loadoutSegmentLabelAnimatedStyle, skinsSegmentLabelAnimatedStyle,
    collectionSegmentLabelAnimatedStyle, isPlayerInfoMode, profileModeTransitioning,
    profileModeInteractionLockedRef, profileModeInteractionTimerRef, rankSplitContentMode,
    heroModeProgress, rankSplitProgress, statsVisibilityProgress, pageModeProgress,
    statsTabProgress,
    profileExpandedHeroHeight, dashboardPreloadTaskRef, legacyContentAnimatedStyle,
    statsDashboardLayerAnimatedStyle, profileSegmentPositionAnimatedStyle,
    profileHeaderTitleAnimatedStyle,
    profileBalancePillAnimatedStyle, handleRegionPress,
    toggleHeroMode, handleStatsDashboardTabChange,
  } = useProfileMotion({
    viewportWidth, hasAuth, fetchMatches, user,
  });
  const {
    palette, regionLabel, profileStats, actRankSummaryStats, tabItems,
    formatCategoryLabel,
  } = useProfileHeroData({
    colors, user, t, dashboardSeasonStats, competitiveRank,
  });
  const {
    syncLoadoutState, handleRefresh, handleStatsRefresh, handleSeasonChange,
  } = useProfileFetch({
    loadoutSnapshotRef, setLoadoutSnapshot, setRawGuns, setRawSprays, setRawActiveExpressions, setIdentity,
    hasAuth, cachedLoadoutSnapshot, setOwnedSkinItemIds, cachedProfile, user, setOwnedSprayItemIds,
    setOwnedFlexItemIds, setOwnedPlayerCardItemIds, setOwnedPlayerTitleItemIds, setCompetitiveRank,
    cachedCompetitiveRank, setError, setLoading, sessionUserRef, fetchLoadoutInFlightRef,
    loadoutMutationVersionRef, competitiveRankRef, cachedCompetitiveRankRef, pendingLoadoutRef, setUser,
    setProfileCache, setWeaponMetadata, isProfileDemo, setPickerState, setIdentityPickerQuery,
    setPickerLoading, setPickerError, t, rankRefreshAuthKeyRef, authKey, initialFetchTaskRef,
    initialFetchTimeoutRef, setRefreshing, setStatsRefreshing, fetchMatches, fetchSeasonStats,
  });
  const {
    loadoutDetails, loadoutSorted, loadoutByCategory, orderedLoadoutCategories, sprayDetails,
    expressionDetails, identityDetails, collectionCheckerProfile, ownedSkinIdSet, ownedSprayIdSet,
    ownedFlexIdSet, ownedPlayerCardOptions, ownedPlayerTitleOptions, equippedExpressionIdSet,
    skinWeaponMetadata,
  } = useProfileLoadoutData({
    rawGuns, weaponMetadata, t, rawSprays, rawActiveExpressions, identity, user, regionLabel,
    competitiveRank, ownedSkinItemIds, ownedSprayItemIds, ownedFlexItemIds, ownedPlayerCardItemIds,
    ownedPlayerTitleItemIds,
  });
  const {
    buildOwnedSkinOptions, buildOwnedSprayOptions, buildOwnedExpressionOptions,
  } = useProfilePickerOptions({
    weaponMetadata, ownedSkinIdSet, ownedSprayIdSet, equippedExpressionIdSet, ownedFlexIdSet,
  });
  const {
    ownedCollection, collectionWeaponTabs, profileListRowsByTab,
  } = useProfileCollection({
    loadoutDetails, ownedSkinIdSet, skinWeaponMetadata, loadoutSorted, collectionWeaponFilter,
    setCollectionWeaponFilter, searchQuery, loading, error, t, orderedLoadoutCategories,
    profileGridColumns,
  });
  const {
    handleDismissPicker, showLoadoutUpdateError, handleOpenWeaponPicker, handleOpenSprayPicker,
    handleOpenExpressionPicker, handleOpenIdentityPicker,
  } = useProfilePickers({
    pickerTaskRef, setPickerLoading, setActiveWeaponChroma, setPickerState, setIdentityPickerQuery,
    setPickerError, t, buildOwnedSkinOptions, buildOwnedSprayOptions, buildOwnedExpressionOptions,
    ownedPlayerCardOptions, ownedPlayerTitleOptions,
  });
  const {
    handleTabChange, setPagerGestureEnabled, collapsibleBodyAnimatedStyle, profileContentPanGesture,
    handleProfileContentScroll, handleHeaderLayout, collapsibleHeaderAnimatedStyle,
    collapsibleHeaderHeight, profileHeaderPanGesture, skinWhitespacePagerPanResponder,
    handlePagerMomentumEnd,
  } = useProfilePager({
    handleDismissPicker, profilePagerRef, viewportWidth, reduceMotionEnabled, setActiveTab,
    profileExpandedHeroHeight, pageModeProgress, activeTab, isPlayerInfoMode,
    skinWhitespacePagerOriginRef,
  });
  const {
    handleEquipIdentity, handleEquipWeapon, handleEquipCollectionSkin, handleEquipSpray,
    handleEquipExpression,
  } = useProfileMutations({
    competitiveRank, cachedCompetitiveRank, setProfileCache, authKey, ownedSkinItemIds, ownedSprayItemIds,
    ownedFlexItemIds, ownedPlayerCardItemIds, ownedPlayerTitleItemIds, cachedProfile, pendingLoadoutRef,
    loadoutMutationVersionRef, syncLoadoutState, user, hasAuth, loadoutSnapshot, updatingLoadout,
    loadoutSnapshotRef, setPickerState, setIdentityPickerQuery, setPickerError, setUpdatingLoadout,
    handleDismissPicker, showLoadoutUpdateError, t, loadoutDetails, handleOpenWeaponPicker,
    buildOwnedSkinOptions, setPickerLoading, setActiveWeaponChroma,
  });


  // ── Effect cleanup: Hủy các task và timeout khi unmount ─────────────────
  React.useEffect(
      () => () => {
        pickerTaskRef.current?.cancel();
        initialFetchTaskRef.current?.cancel();
        if (initialFetchTimeoutRef.current) {
          clearTimeout(initialFetchTimeoutRef.current);
          initialFetchTimeoutRef.current = null;
        }
        dashboardPreloadTaskRef.current?.cancel();
        dashboardPreloadTaskRef.current = null;
        if (profileModeInteractionTimerRef.current) {
          clearTimeout(profileModeInteractionTimerRef.current);
          profileModeInteractionTimerRef.current = null;
        }
        profileModeInteractionLockedRef.current = false;
      },
      [dashboardPreloadTaskRef, initialFetchTaskRef, initialFetchTimeoutRef, pickerTaskRef, profileModeInteractionLockedRef, profileModeInteractionTimerRef]
  );
  // renderIdentitySection: bọc ProfileIdentitySection cho row 'identity'.
  const renderIdentitySection = () => (
      <ProfileIdentitySection
          identityDetails={identityDetails}
          onOpenIdentityPicker={handleOpenIdentityPicker}
          t={t}
      />
  );
  // renderSpraySection: bọc ProfileExpressionSection cho row 'expressions'.
  const renderSpraySection = () => (
      <ProfileExpressionSection
          expressionDetails={expressionDetails}
          onOpenExpressionPicker={handleOpenExpressionPicker}
          onOpenSprayPicker={handleOpenSprayPicker}
          sprayDetails={sprayDetails}
          t={t}
      />
  );
  // renderSkinGridCard: card skin tab skins (CompactProfileSkinCard, memo).
  const renderSkinGridCard = React.useCallback(
      (weapon: EquippedWeapon) => (
          <CompactProfileSkinCard
              key={weapon.weaponId}
              weapon={weapon}
              width={profileSkinRowCardWidth}
              onPress={() => handleOpenWeaponPicker(weapon)}
          />
      ),
      [handleOpenWeaponPicker, profileSkinRowCardWidth]
  );
  // renderSkinListItem: adapter renderItem của FlatList ngang → renderSkinGridCard.
  const renderSkinListItem = React.useCallback(
      ({ item }: { item: EquippedWeapon }) => renderSkinGridCard(item),
      [renderSkinGridCard]
  );
  // renderPageHeader: top bar + hero + segment, bọc pan gesture thu gọn header.
  const renderPageHeader = () => (
      <GestureDetector gesture={profileHeaderPanGesture}>
        <Animated.View
            pointerEvents="box-none"
            onLayout={handleHeaderLayout}
            style={[styles.profilePageHeader, collapsibleHeaderAnimatedStyle]}
        >
        <View style={styles.topHeaderRow}>
          <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("equip_page.identity.card_picker_title", {
                defaultValue: "Ch\u1ecdn \u1ea3nh \u0111\u1ea1i di\u1ec7n",
              })}
              activeOpacity={0.82}
              disabled={!identityDetails}
              onPress={() => handleOpenIdentityPicker("player-card")}
              style={styles.topAvatarButton}
          >
            <Animated.View style={styles.topAvatar}>
              {identityDetails?.cardArt ? (
                  <Image
                      cacheId={`player-card:${identityDetails.cardId}:avatar`}
                      source={{ uri: identityDetails.cardArt }}
                      style={styles.topAvatarImage}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      priority="high"
                      recyclingKey={identityDetails.cardArt}
                  />
              ) : (
                  <Text style={styles.topAvatarText}>
                    {(user.name || "V").slice(0, 1).toUpperCase()}
                  </Text>
              )}
            </Animated.View>
            {identityDetails ? (
                <View style={styles.topAvatarEditBadge}>
                  <AppIcon
                    color={COLORS.PURE_WHITE}
                    decorative
                    name="edit"
                    size={8}
                  />
                </View>
            ) : null}
          </TouchableOpacity>
          <Animated.Text
            style={[styles.topHeaderTitle, profileHeaderTitleAnimatedStyle]}
          >
            Vshop
          </Animated.Text>
          <Animated.View
            style={[styles.topBalancePill, profileBalancePillAnimatedStyle]}
          >
            <Text style={styles.topBalanceText}>{user.balances.vp} {t("vp")}</Text>
          </Animated.View>
        </View>
        <ProfileHeroCard
            accountLevel={identityDetails?.level ?? user.progress.level}
            actRankSummaryStats={actRankSummaryStats}
            competitiveRank={competitiveRank}
            expandedHeroHeight={profileExpandedHeroHeight}
            hasAuth={hasAuth || isProfileDemo}
            heroModeProgress={heroModeProgress}
            identityDetails={identityDetails}
            isPlayerInfoMode={isPlayerInfoMode}
            name={user.name || t("profile_page.agent_fallback")}
            onRegionPress={handleRegionPress}
            onToggleMode={toggleHeroMode}
            pageModeProgress={pageModeProgress}
            profileModeTransitioning={profileModeTransitioning}
            profileStats={profileStats}
            rankSplitContentMode={rankSplitContentMode}
            rankSplitProgress={rankSplitProgress}
            regionLabel={regionLabel}
            statsVisibilityProgress={statsVisibilityProgress}
            synced={Boolean(
              dashboardSeasonStats || dashboardMatches.length > 0
            )}
            tagLine={user.TagLine}
        />
        <Animated.View style={profileSegmentPositionAnimatedStyle}>
          <ProfileSegmentedControl
            activeTab={activeTab}
            collectionSegmentLabelAnimatedStyle={collectionSegmentLabelAnimatedStyle}
            handleSegmentContainerLayout={handleSegmentContainerLayout}
            handleStatsDashboardTabChange={handleStatsDashboardTabChange}
            handleTabChange={handleTabChange}
            loadoutSegmentLabelAnimatedStyle={loadoutSegmentLabelAnimatedStyle}
            profileNavContentMode={profileNavContentMode}
            profileSegmentLayerAnimatedStyle={profileSegmentLayerAnimatedStyle}
            segmentIndicatorAnimatedStyle={segmentIndicatorAnimatedStyle}
            skinsSegmentLabelAnimatedStyle={skinsSegmentLabelAnimatedStyle}
            statsSegmentLayerAnimatedStyle={statsSegmentLayerAnimatedStyle}
            tabItems={tabItems}
          />
        </Animated.View>
        </Animated.View>
      </GestureDetector>
  );
  // renderCollectionControls: searchbar + chip lọc vũ khí (chỉ ở tab collection).
  const renderCollectionControls = () => (
      <>
        <View style={styles.collectionSearchRow}>
          <Searchbar
              placeholder={t("equip_page.search_placeholder")}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[
                styles.searchBar,
                { backgroundColor: palette.card, borderColor: palette.cardBorder },
              ]}
              inputStyle={{ color: palette.textPrimary }}
              iconColor={palette.textSecondary}
          />
          <CollectionCheckerExport />
        </View>
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.collectionFilterRow}
            onTouchStart={() => setPagerGestureEnabled(false)}
            onTouchEnd={() => setPagerGestureEnabled(true)}
            onTouchCancel={() => setPagerGestureEnabled(true)}
        >
          {collectionWeaponTabs.map((weaponName) => {
            const active = collectionWeaponFilter === weaponName;
            const label = weaponName === "all" ? t("gallery_page.filters.all") : weaponName;

            return (
                <TouchableOpacity
                    key={weaponName}
                    activeOpacity={0.85}
                    onPress={() => setCollectionWeaponFilter(weaponName)}
                    style={[
                      styles.collectionFilterChip,
                      active && styles.collectionFilterChipActive,
                    ]}
                >
                  <Text
                      style={[
                        styles.collectionFilterChipText,
                        active && styles.collectionFilterChipTextActive,
                      ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
            );
          })}
        </ScrollView>
      </>
  );
  // renderCollectionCard: card collection → equip nhanh hoặc mở picker.
  const renderCollectionCard = React.useCallback(
      (item: OwnedWeaponCollectionItem) => (
          <CompactProfileSkinCard
              key={item.collectionId}
              weapon={item}
              width={profileGridCardWidth}
              onPress={() => handleEquipCollectionSkin(item)}
          />
      ),
      [handleEquipCollectionSkin, profileGridCardWidth]
  );
  // renderProfileListRow: theo row kind → loading/message/identity/skins/collection.
  const renderProfileListRow = ({ item }: { item: ProfileListRow }) => {
    switch (item.kind) {
      case "loading":
        return (
            <View style={styles.pageStatus}>
              <ActivityIndicator animating color={palette.accent} />
            </View>
        );
      case "message":
        return (
            <View style={styles.pageStatus}>
              <Text
                  style={[
                    item.tone === "error" ? styles.errorText : styles.emptyText,
                    { color: palette.textSecondary },
                  ]}
              >
                {item.message}
              </Text>
            </View>
        );
      case "identity":
        return (
            <View style={styles.pageBody}>
              {renderIdentitySection()}
            </View>
        );
      case "expressions":
        return <View style={styles.pageBody}>{renderSpraySection()}</View>;
      case "skin-category": {
        const categoryWeapons = loadoutByCategory[item.category];
        const availableRowWidth = viewportWidth - 32;
        const skinListWidth = Math.min(
            availableRowWidth,
            categoryWeapons.length * profileSkinRowCardWidth +
            Math.max(0, categoryWeapons.length - 1) * 8 +
            8
        );

        return (
            <View style={styles.profileSkinCategoryRow}>
              <View
                  style={styles.profileSkinCategoryTitleSwipeSurface}
                  {...skinWhitespacePagerPanResponder.panHandlers}
              >
                <Text
                    style={[
                      styles.profileSkinCategoryTitle,
                      { color: palette.textPrimary },
                    ]}
                >
                  {formatCategoryLabel(item.category)}
                </Text>
              </View>
              <View style={styles.profileSkinCardLane}>
                <FlatList
                    horizontal
                    style={{ width: skinListWidth, flexGrow: 0 }}
                    data={categoryWeapons}
                    keyExtractor={(weapon) => weapon.weaponId}
                    renderItem={renderSkinListItem}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.profileSkinRow}
                    onTouchStart={() => setPagerGestureEnabled(false)}
                    onTouchEnd={() => setPagerGestureEnabled(true)}
                    onTouchCancel={() => setPagerGestureEnabled(true)}
                    removeClippedSubviews
                    initialNumToRender={2}
                    maxToRenderPerBatch={2}
                    windowSize={3}
                    updateCellsBatchingPeriod={48}
                />
                {skinListWidth < availableRowWidth ? (
                    <View
                        collapsable={false}
                        style={styles.profileSkinRowWhitespace}
                        {...skinWhitespacePagerPanResponder.panHandlers}
                    />
                ) : null}
              </View>
              <View
                  collapsable={false}
                  style={styles.profileSkinCategorySpacer}
                  {...skinWhitespacePagerPanResponder.panHandlers}
              />
            </View>
        );
      }
      case "collection-row":
        return (
            <View style={styles.collectionRow}>
              {item.items.map(renderCollectionCard)}
            </View>
        );
      default:
        return null;
    }
  };
  // renderProfileListHeader: header từng tab (collection → search + filter).
  const renderProfileListHeader = (tab: TabKey) => (
      <>
        {tab === "collection" &&
        !loading &&
        !error &&
        loadoutSorted.length > 0
            ? renderCollectionControls()
            : null}
      </>
  );
  // renderProfileTabPage: 1 trang pager = swipe zone + FlatList dọc rows của tab.
  const renderProfileTabPage = (tab: TabKey) => (
      <View
          key={tab}
          style={[styles.profileTabPage, { width: viewportWidth }]}
      >
        {tab === "skins" ? (
            <View
                collapsable={false}
                style={styles.profilePageSwipeZone}
                {...skinWhitespacePagerPanResponder.panHandlers}
            />
        ) : (
            <View style={styles.profilePageSwipeZone} />
        )}
        <Animated.FlatList
            style={styles.pageScroll}
            data={profileListRowsByTab[tab]}
            keyExtractor={(item) => item.key}
            renderItem={renderProfileListRow}
            contentContainerStyle={[
              styles.pageScrollContent,
              { paddingBottom: getProfileContentBottomPadding(insets.bottom) },
            ]}
            onScroll={handleProfileContentScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={palette.accent}
                  colors={[palette.accent]}
              />
            }
            ListHeaderComponent={renderProfileListHeader(tab)}
            removeClippedSubviews={Platform.OS === "android"}
            initialNumToRender={1}
            maxToRenderPerBatch={1}
            windowSize={5}
            updateCellsBatchingPeriod={48}
        />
      </View>
  );

  return (
    <CollectionCheckerExportProvider
        items={ownedCollection}
        profile={collectionCheckerProfile}
        disabled={refreshing}
    >
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: isPlayerInfoMode
              ? PROFILE_INFO_COLORS.background
              : COLORS.PURE_WHITE,
          },
        ]}
      >
        {renderPageHeader()}
        <GestureDetector gesture={profileContentPanGesture}>
          <Animated.View
            style={[
              styles.profileBodyStack,
              {
                backgroundColor: isPlayerInfoMode
                  ? PROFILE_INFO_COLORS.background
                  : COLORS.PURE_WHITE,
              },
              collapsibleHeaderHeight > 0 && styles.profileBodyStackCollapsible,
              collapsibleHeaderHeight > 0 && {
                top: PROFILE_STICKY_SEGMENT_HEIGHT,
              },
              collapsibleHeaderHeight > 0 && collapsibleBodyAnimatedStyle,
            ]}
        >
          <Animated.View
              pointerEvents={isPlayerInfoMode ? "none" : "auto"}
              accessibilityElementsHidden={isPlayerInfoMode}
              importantForAccessibility={
                isPlayerInfoMode ? "no-hide-descendants" : "auto"
              }
              style={[styles.profileBodyLayer, legacyContentAnimatedStyle]}
          >
            <Animated.ScrollView
                key={`profile-pager:${Math.round(viewportWidth)}`}
                  ref={profilePagerRef}
                  removeClippedSubviews={Platform.OS === "android"}
                horizontal
                pagingEnabled
                bounces={false}
                disableIntervalMomentum
                directionalLockEnabled
                nestedScrollEnabled
                style={styles.profilePager}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                onScroll={handlePagerScroll}
                onMomentumScrollEnd={handlePagerMomentumEnd}
                scrollEventThrottle={16}
            >
              {PROFILE_TAB_KEYS.map(renderProfileTabPage)}
            </Animated.ScrollView>
          </Animated.View>
          {statsDashboardMounted ? (
              <Animated.View
                  pointerEvents={isPlayerInfoMode ? "auto" : "none"}
                  accessibilityElementsHidden={!isPlayerInfoMode}
                  importantForAccessibility={
                    isPlayerInfoMode ? "auto" : "no-hide-descendants"
                  }
                  style={[
                    styles.profileBodyLayer,
                    statsDashboardLayerAnimatedStyle,
                  ]}
              >
                <PlayerInfoView
                    key={`player-info:${authKey}`}
                    competitiveRank={competitiveRank}
                    loading={
                      isProfileDemo
                        ? false
                        : matchHistoryLoading || seasonStatsLoading
                    }
                    matches={dashboardMatches}
                    onSeasonChange={handleSeasonChange}
                    onRefresh={handleStatsRefresh}
                    refreshing={statsRefreshing}
                    seasonMatchesById={dashboardSeasonMatchesById}
                    seasonOptions={dashboardSeasonOptions}
                    seasonStats={dashboardSeasonStats}
                    seasonStatsById={dashboardSeasonStatsById}
                    tabProgress={statsTabProgress}
                />
              </Animated.View>
          ) : null}
          </Animated.View>
        </GestureDetector>
        <ProfilePickerModal
          activeWeaponChroma={activeWeaponChroma}
          handleDismissPicker={handleDismissPicker}
          handleEquipExpression={handleEquipExpression}
          handleEquipIdentity={handleEquipIdentity}
          handleEquipSpray={handleEquipSpray}
          handleEquipWeapon={handleEquipWeapon}
          handleOpenExpressionPicker={handleOpenExpressionPicker}
          identityDetails={identityDetails}
          identityPickerQuery={identityPickerQuery}
          palette={palette}
          pickerError={pickerError}
          pickerLoading={pickerLoading}
          pickerState={pickerState}
          setActiveWeaponChroma={setActiveWeaponChroma}
          setIdentityPickerQuery={setIdentityPickerQuery}
          updatingLoadout={updatingLoadout}
        />
      </Animated.View>
    </CollectionCheckerExportProvider>
  );
}

export default Profile;

