// ===== valorant-assets.d.ts – Kiểu dữ liệu asset Valorant từ valorant-api.com =====
// Các interface này phản chiếu schema của endpoint /agents, /weapons, /bundles...
// và được dùng chung cho toàn app (ambient declaration, không cần import).

/** ValorantSkin – Skin vũ khí (tên, icon, content tier, chromas, levels). */
interface ValorantSkin {
  uuid: string;
  displayName: string;
  themeUuid: string;
  contentTierUuid?: string;
  displayIcon?: string;
  wallpaper?: string;
  assetPath: string;
  chromas: ValorantSkinChroma[];
  levels: ValorantSkinLevel[];
}

/** ValorantAgent – Agent kèm ảnh chân dung, vai trò và danh sách kỹ năng. */
interface ValorantAgent {
  uuid: string;
  displayName: string;
  description?: string;
  displayIcon?: string;
  displayIconSmall?: string;
  bustPortrait?: string;
  fullPortrait?: string;
  fullPortraitV2?: string;
  killfeedPortrait?: string;
  background?: string;
  role: {
    uuid: string;
    displayName?: string;
    description: string;
    displayIcon: string;
  };
  abilities?: Ability[];
}

/** ValorantWeapon – Vũ khí rút gọn (uuid, tên, category, displayIcon). */
interface ValorantWeapon {
  uuid: string;
  displayName: string;
  category?: string;
  displayIcon?: string;
}

/** Ability – Một kỹ năng của agent (slot, tên, mô tả, icon). */
interface Ability {
  slot: string;
  displayName: string;
  description: string;
  displayIcon: string;
}
/** ValorantBuddyAccessory – Charm (buddy) treo súng kèm các cấp độ. */
interface ValorantBuddyAccessory {
  uuid: string;
  displayName: string;
  isHiddenIfNotOwned: boolean;
  themeUuid: string;
  displayIcon?: string;
  assetPath: string;
  levels: ValorantBuddyLevel[];
}

/** ValorantTitleAccessory – Danh hiệu người chơi (titleText hiển thị profile). */
interface ValorantTitleAccessory {
  uuid: string;
  displayName: string;
  isHiddenIfNotOwned: boolean;
  titleText: string;
  assetPath: string;
}

/** ValorantCardAccessory – Player card với 4 kích thước ảnh (icon/small/wide/large). */
interface ValorantCardAccessory {
  uuid: string;
  displayName: string;
  isHiddenIfNotOwned: boolean;
  themeUuid: string;
  displayIcon: string;
  smallArt: string;
  wideArt: string;
  largeArt: string;
  assetPath: string;
}

/** ValorantSprayAccessory – Spray (graffiti) kèm ảnh tĩnh/động và các cấp. */
interface ValorantSprayAccessory {
  uuid: string;
  displayName: string;
  category: string;
  themeUuid: string;
  isNullSpray: boolean;
  hideIfNotOwned: boolean;
  displayIcon: string;
  fullIcon: string;
  fullTransparentIcon: string;
  animationPng: string;
  animationGif: string;
  assetPath: string;
  levels: ValorantSprayLevel[];
}

/** ValorantFlexAccessory – Flex (biểu cảm animated) với icon hiển thị. */
interface ValorantFlexAccessory {
  uuid: string;
  displayName: string;
  displayNameAllCaps?: string;
  displayIcon?: string;
  assetPath: string;
}

/** ValorantBuddyLevel – Một cấp độ của charm (charmLevel + icon). */
interface ValorantBuddyLevel {
  uuid: string;
  charmLevel: number;
  hideIfNotOwned: boolean;
  displayName: string;
  displayIcon: string;
  assetPath: string;
}

/** ValorantSprayLevel – Một cấp độ của spray (sprayLevel + icon). */
interface ValorantSprayLevel {
  uuid: string;
  sprayLevel: number;
  displayName: string;
  displayIcon: string;
  assetPath: string;
}

/** ValorantBundle – Bundle cửa hàng: tên, mô tả, ảnh promo, logo. */
interface ValorantBundle {
  uuid: string;
  displayName: string;
  displayNameSubText?: string;
  description: string;
  extraDescription?: string;
  promoDescription?: string;
  useAdditionalContext: boolean;
  displayIcon: string;
  displayIcon2: string;
  logoIcon?: string;
  verticalPromoImage?: string;
  assetPath: string;
}

/** ValorantSkinChroma – Biến thể màu của skin (swatch nhỏ, fullRender lớn). */
interface ValorantSkinChroma {
  uuid: string;
  displayName: string;
  displayIcon?: string;
  fullRender: string;
  swatch?: string;
  streamedVideo?: string;
  assetPath: string;
}

/** ValorantSkinLevel – Cấp nâng cấp của skin (levelItem mô tả hiệu ứng). */
interface ValorantSkinLevel {
  uuid: string;
  displayName: string;
  levelItem?: string;
  displayIcon?: string;
  streamedVideo?: string;
  assetPath: string;
}
