import { getAssets } from "~/utils/valorant-assets";

export const EQUIPMENT_SECTIONS = [
  { key: "buddies", label: "Gun Buddies" },
  { key: "sprays", label: "Sprays" },
  { key: "cards", label: "Player Cards" },
  { key: "titles", label: "Player Titles" },
];

export const sanitizeQuery = (value) => {
  if (!value) return "";

  return value
    .trim()
    .replace(/[&/\\#,+()$~%.^'":*?<>{}]/g, "")
    .toLowerCase();
};

export const getCollectionBySection = (section) => {
  const assets = getAssets();

  switch (section) {
    case "sprays":
      return assets.sprays ?? [];
    case "cards":
      return assets.cards ?? [];
    case "titles":
      return assets.titles ?? [];
    case "buddies":
    default:
      return assets.buddies ?? [];
  }
};

export const filterEquipItems = (items, query) => {
  const normalized = sanitizeQuery(query);
  if (!normalized) return items;

  return items.filter((item) => {
    const primary = item.displayName ?? "";
    const secondary =
      item.titleText ??
      item.category ??
      item.levels?.[0]?.displayName ??
      "";

    return (
      primary.toLowerCase().includes(normalized) ||
      secondary.toLowerCase().includes(normalized)
    );
  });
};

export const sortEquipItems = (items) => {
  return [...items].sort((a, b) => {
    const valueA = (a.displayName ?? a.titleText ?? "").toLowerCase();
    const valueB = (b.displayName ?? b.titleText ?? "").toLowerCase();

    return valueA.localeCompare(valueB);
  });
};

export const mapToDisplayItem = (item, section) => {
  const id = item.uuid ?? item.levels?.[0]?.uuid ?? `${section}-${item.displayName}`;
  let subtitle = "";

  switch (section) {
    case "titles":
      subtitle = item.titleText ?? "";
      break;
    case "buddies":
      subtitle = item.levels?.[0]?.displayName ?? "";
      break;
    case "sprays":
      subtitle = item.category ?? item.levels?.[0]?.displayName ?? "";
      break;
    case "cards":
    default:
      subtitle = "";
      break;
  }

  return {
    id,
    displayName: item.displayName ?? item.titleText ?? "Unknown",
    subtitle,
    item,
    section,
  };
};

export const buildEquipDisplayList = (items, section) =>
  items.map((item) => mapToDisplayItem(item, section));

export const getEquipmentImage = (displayItem) => {
  const { item, section } = displayItem;

  if (!item) return null;

  switch (section) {
    case "cards":
      return item.largeArt ?? item.displayIcon ?? item.smallArt ?? null;
    case "sprays":
      return item.fullTransparentIcon ?? item.fullIcon ?? item.displayIcon ?? null;
    case "titles":
      return item.displayIcon ?? null;
    case "buddies":
    default:
      return item.displayIcon ?? item.levels?.[0]?.displayIcon ?? null;
  }
};