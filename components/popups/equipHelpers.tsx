import { getAssets } from "~/utils/valorant-assets";

// ─── EQUIPMENT_SECTIONS ────────────────────────────────────────────────────────
// Danh sách các danh mục trang bị (equipment) có sẵn.
// Mỗi mục gồm:
//   - key: định danh section (khớp với tên collection trong assets)
//   - labelKey: key i18n để lấy tên hiển thị
export const EQUIPMENT_SECTIONS = [
  { key: "buddies", labelKey: "equip_page.sections.buddies" },
  { key: "sprays", labelKey: "equip_page.sections.sprays" },
  { key: "cards", labelKey: "equip_page.sections.cards" },
  { key: "titles", labelKey: "equip_page.sections.titles" },
];

// ─── sanitizeQuery ─────────────────────────────────────────────────────────────
// Vệ sinh chuỗi tìm kiếm: trim, loại bỏ ký tự đặc biệt, chuyển về lower case.
//
// Tham số:
//   - value: string | undefined | null – chuỗi cần vệ sinh
// Return: string đã được làm sạch, hoặc "" nếu null/undefined
export const sanitizeQuery = (value: string | undefined | null) => {
  if (!value) return "";

  return value
    .trim()
    .replace(/[&/\\#,+()$~%.^'":*?<>{}]/g, "")
    .toLowerCase();
};

// ─── getCollectionBySection ────────────────────────────────────────────────────
// Lấy danh sách item của một section từ Valorant assets.
//
// Tham số:
//   - section: string – tên section ("sprays", "cards", "titles", "buddies")
// Return: mảng các item tương ứng (mặc định buddies nếu không match)
export const getCollectionBySection = (section: string) => {
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

// ─── filterEquipItems ──────────────────────────────────────────────────────────
// Lọc danh sách item dựa trên query tìm kiếm.
// Tìm kiếm trên cả displayName (primary) và titleText/category/level name (secondary).
//
// Tham số:
//   - items: any[] – mảng item cần lọc
//   - query: string – từ khoá tìm kiếm
// Return: mảng item đã lọc (hoặc items gốc nếu query rỗng)
export const filterEquipItems = (items: any[], query: string) => {
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

// ─── sortEquipItems ────────────────────────────────────────────────────────────
// Sắp xếp danh sách item theo thứ tự alphabet (dựa trên displayName hoặc titleText).
//
// Tham số:
//   - items: any[] – mảng item cần sắp xếp
// Return: mảng mới đã được sort (không mutate mảng gốc)
export const sortEquipItems = (items: any[]) => {
  return [...items].sort((a, b) => {
    const valueA = (a.displayName ?? a.titleText ?? "").toLowerCase();
    const valueB = (b.displayName ?? b.titleText ?? "").toLowerCase();

    return valueA.localeCompare(valueB);
  });
};

// ─── mapToDisplayItem ──────────────────────────────────────────────────────────
// Chuyển đổi raw item thành object hiển thị chuẩn hoá cho equip page.
//
// Tham số:
//   - item: any – item gốc từ assets
//   - section: string – danh mục của item
// Return: object { id, displayName, subtitle, item, section }
//   - id: UUID của item (hoặc fallback)
//   - subtitle: text phụ tuỳ theo section
//     - "titles": titleText
//     - "buddies": level[0].displayName
//     - "sprays": category hoặc level[0].displayName
//     - "cards": "" (rỗng)
export const mapToDisplayItem = (item: any, section: string) => {
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
    displayName: item.displayName ?? item.titleText ?? item.uuid ?? "",
    subtitle,
    item,
    section,
  };
};

// ─── buildEquipDisplayList ─────────────────────────────────────────────────────
// Helper: map một mảng item raw thành display list.
//
// Tham số:
//   - items: any[] – mảng item gốc
//   - section: string – danh mục
// Return: mảng display item đã qua mapToDisplayItem
export const buildEquipDisplayList = (items: any[], section: string) =>
  items.map((item) => mapToDisplayItem(item, section));

// ─── getEquipmentImage ─────────────────────────────────────────────────────────
// Lấy URI ảnh hiển thị cho một equipment item.
// Thứ tự ưu tiên URI khác nhau tuỳ theo section.
//
// Tham số:
//   - displayItem: any – object display (có trường item, section)
// Return: string | null – URI ảnh hoặc null nếu không có
//   - cards: displayIcon > smallArt > largeArt
//   - sprays: displayIcon > fullTransparentIcon > fullIcon
//   - titles: displayIcon
//   - buddies: displayIcon > level[0].displayIcon
export const getEquipmentImage = (displayItem: any) => {
  const { item, section } = displayItem;

  if (!item) return null;

  switch (section) {
    case "cards":
      return item.displayIcon ?? item.smallArt ?? item.largeArt ?? null;
    case "sprays":
      return item.displayIcon ?? item.fullTransparentIcon ?? item.fullIcon ?? null;
    case "titles":
      return item.displayIcon ?? null;
    case "buddies":
    default:
      return item.displayIcon ?? item.levels?.[0]?.displayIcon ?? null;
  }
};
