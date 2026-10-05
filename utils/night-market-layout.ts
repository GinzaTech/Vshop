export const NIGHT_MARKET_CONTENT_PADDING = 20;
export const NIGHT_MARKET_GRID_GAP = 8;
export const NIGHT_MARKET_GRID_BOTTOM_GAP = 8;
const MIN_ART_HEIGHT = 56;
const CARD_BORDER_HEIGHT = 2;
const NORMAL_CONTENT_RESERVE = 96;

interface NightMarketGridInput {
  width: number;
  fontScale: number;
  viewportHeight: number;
  gridTop: number;
  footerHeight: number;
  bottomClearance: number;
  itemCount: number;
}

/** Budget the six offers from native measurements; never constrain text height. */
export function getNightMarketGridLayout(input: NightMarketGridInput) {
  const { fontScale, viewportHeight, gridTop, footerHeight, bottomClearance, itemCount } = input;
  const width = Number.isFinite(input.width) && input.width > 0 ? input.width : 0;
  const columns = width < 300 ? 1 : width >= 700 && fontScale < 1.3 ? 3 : 2;
  const cardWidth = Math.max(48, Math.floor(
    (width - NIGHT_MARKET_CONTENT_PADDING * 2 - NIGHT_MARKET_GRID_GAP * (columns - 1)) / columns,
  ));
  const rows = Math.ceil(itemCount / columns);
  const measured = [width, fontScale, viewportHeight, gridTop, footerHeight]
    .every((value) => Number.isFinite(value) && value > 0);
  const available = viewportHeight - gridTop - footerHeight - bottomClearance
    - NIGHT_MARKET_GRID_BOTTOM_GAP - NIGHT_MARKET_GRID_GAP * (rows - 1);
  const rowHeight = Math.floor(available / rows);
  const canFit = measured && Number.isFinite(bottomClearance) && bottomClearance >= 0
    && width >= 360 && fontScale < 1.3 && itemCount === 6
    && rowHeight >= MIN_ART_HEIGHT + NORMAL_CONTENT_RESERVE + CARD_BORDER_HEIGHT;
  return { columns, cardWidth, cardHeight: canFit ? rowHeight : undefined };
}

/** A long name/price keeps its natural height even when that requires scrolling. */
export function getNightMarketArtHeight(width: number, cardHeight: number | undefined, contentHeight: number) {
  if (!Number.isFinite(width) || width <= 0 || cardHeight === undefined || !Number.isFinite(cardHeight) || !Number.isFinite(contentHeight)
    || contentHeight <= 0) return undefined;
  const height = Math.floor(cardHeight - contentHeight - CARD_BORDER_HEIGHT);
  if (height < MIN_ART_HEIGHT) return undefined;
  return Math.min(width / 1.5, height);
}
