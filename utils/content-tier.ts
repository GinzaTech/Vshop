export type ContentTierVisual = {
  label: string;
  accent: string;
  text: string;
  border: string;
  cardBackground: string;
  visualBackground: string;
  badgeBackground: string;
  overlayBackground: string;
};

export const DEFAULT_CONTENT_TIER: ContentTierVisual = {
  label: "Standard",
  accent: "#7b838f",
  text: "#2f343b",
  border: "rgba(123, 131, 143, 0.26)",
  cardBackground: "rgba(123, 131, 143, 0.10)",
  visualBackground: "rgba(123, 131, 143, 0.18)",
  badgeBackground: "rgba(123, 131, 143, 0.14)",
  overlayBackground: "rgba(47, 52, 59, 0.46)",
};

export const CONTENT_TIER_VISUALS: Record<string, ContentTierVisual> = {
  "12683d76-48d7-84a3-4e09-6985794f0445": {
    label: "Select",
    accent: "#5A9FE2",
    text: "#214b77",
    border: "rgba(90, 159, 226, 0.34)",
    cardBackground: "rgba(90, 159, 226, 0.10)",
    visualBackground: "rgba(90, 159, 226, 0.18)",
    badgeBackground: "rgba(90, 159, 226, 0.16)",
    overlayBackground: "rgba(33, 75, 119, 0.44)",
  },
  "0cebb8be-46d7-c12a-d306-e9907bfc5a25": {
    label: "Deluxe",
    accent: "#009587",
    text: "#0d5a54",
    border: "rgba(0, 149, 135, 0.34)",
    cardBackground: "rgba(0, 149, 135, 0.10)",
    visualBackground: "rgba(0, 149, 135, 0.18)",
    badgeBackground: "rgba(0, 149, 135, 0.16)",
    overlayBackground: "rgba(13, 90, 84, 0.44)",
  },
  "60bca009-4182-7998-dee7-b8a2558dc369": {
    label: "Premium",
    accent: "#D1548D",
    text: "#7f2952",
    border: "rgba(209, 84, 141, 0.34)",
    cardBackground: "rgba(209, 84, 141, 0.10)",
    visualBackground: "rgba(209, 84, 141, 0.18)",
    badgeBackground: "rgba(209, 84, 141, 0.16)",
    overlayBackground: "rgba(127, 41, 82, 0.44)",
  },
  "e046854e-406c-37f4-6607-19a9ba8426fc": {
    label: "Exclusive",
    accent: "#F5955B",
    text: "#88512a",
    border: "rgba(245, 149, 91, 0.34)",
    cardBackground: "rgba(245, 149, 91, 0.10)",
    visualBackground: "rgba(245, 149, 91, 0.18)",
    badgeBackground: "rgba(245, 149, 91, 0.16)",
    overlayBackground: "rgba(136, 81, 42, 0.46)",
  },
  "411e4a55-4e59-7757-41f0-86a53f101bb5": {
    label: "Ultra",
    accent: "#FAD663",
    text: "#7c6424",
    border: "rgba(250, 214, 99, 0.36)",
    cardBackground: "rgba(250, 214, 99, 0.12)",
    visualBackground: "rgba(250, 214, 99, 0.22)",
    badgeBackground: "rgba(250, 214, 99, 0.18)",
    overlayBackground: "rgba(124, 100, 36, 0.50)",
  },
};

export const getContentTierVisual = (
  contentTierUuid?: string,
  contentTierName?: string
) => {
  if (contentTierUuid && CONTENT_TIER_VISUALS[contentTierUuid]) {
    return CONTENT_TIER_VISUALS[contentTierUuid];
  }

  if (contentTierName) {
    const matchedTier = Object.values(CONTENT_TIER_VISUALS).find(
      (tier) => tier.label.toLowerCase() === contentTierName.toLowerCase()
    );

    if (matchedTier) {
      return matchedTier;
    }
  }

  return DEFAULT_CONTENT_TIER;
};
