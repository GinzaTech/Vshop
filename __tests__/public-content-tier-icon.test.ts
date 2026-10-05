import { getPublicContentTierIconUri } from "~/services/valorant/public-api";

const mockPublicGet = jest.fn();

jest.mock("~/services/http/clients", () => ({
  publicHttpClient: {
    get: (...args: unknown[]) => mockPublicGet(...args),
  },
}));

const SELECT_TIER_ID = "12683d76-48d7-84a3-4e09-6985794f0445";
const SELECT_TIER_ICON_URI =
  "https://media.valorant-api.com/contenttiers/12683d76-48d7-84a3-4e09-6985794f0445/displayicon.png";

describe("getPublicContentTierIconUri", () => {
  it.each([
    ["lowercase", SELECT_TIER_ID],
    ["uppercase", SELECT_TIER_ID.toUpperCase()],
    ["mixed case", "12683D76-48d7-84A3-4e09-6985794F0445"],
    ["surrounding spaces", `  ${SELECT_TIER_ID}  `],
    ["surrounding whitespace", `\t\n${SELECT_TIER_ID.toUpperCase()}\r\n`],
  ])("builds the canonical media URI for %s UUIDs", (_label, input) => {
    expect(getPublicContentTierIconUri(input)).toBe(SELECT_TIER_ICON_URI);
  });

  it("accepts any exact hexadecimal UUID without imposing a version or tier allowlist", () => {
    expect(
      getPublicContentTierIconUri("ABCDEF01-2345-6789-ABCD-EF0123456789"),
    ).toBe(
      "https://media.valorant-api.com/contenttiers/abcdef01-2345-6789-abcd-ef0123456789/displayicon.png",
    );
  });

  const invalidInputs: readonly (readonly [string, unknown])[] = [
    ["undefined", undefined],
    ["null", null],
    ["number", 123],
    ["NaN", NaN],
    ["boolean", true],
    ["object", { uuid: SELECT_TIER_ID }],
    ["array", [SELECT_TIER_ID]],
    ["symbol", Symbol("tier")],
    ["function", () => SELECT_TIER_ID],
    ["string-like object", { toString: () => SELECT_TIER_ID }],
    ["empty string", ""],
    ["whitespace", " \t\r\n"],
    ["tier label", "Select"],
    ["missing hyphens", SELECT_TIER_ID.replace(/-/g, "")],
    ["short first group", "12683d7-48d7-84a3-4e09-6985794f0445"],
    ["long first group", "12683d766-48d7-84a3-4e09-6985794f0445"],
    ["short second group", "12683d76-48d-84a3-4e09-6985794f0445"],
    ["long third group", "12683d76-48d7-84a33-4e09-6985794f0445"],
    ["short fourth group", "12683d76-48d7-84a3-4e0-6985794f0445"],
    ["short final group", "12683d76-48d7-84a3-4e09-6985794f044"],
    ["long final group", `${SELECT_TIER_ID}0`],
    ["non-hex character", "g2683d76-48d7-84a3-4e09-6985794f0445"],
    ["braces", `{${SELECT_TIER_ID}}`],
    ["URN", `urn:uuid:${SELECT_TIER_ID}`],
    ["embedded space", "12683d76-48d7-84a3-4e09-6985794f 0445"],
    ["embedded newline", "12683d76-48d7-84a3-\n4e09-6985794f0445"],
    ["URL", SELECT_TIER_ICON_URI],
    ["protocol-relative URL", `//example.com/${SELECT_TIER_ID}`],
    ["absolute path", `/${SELECT_TIER_ID}`],
    ["path traversal prefix", `../${SELECT_TIER_ID}`],
    ["path traversal suffix", `${SELECT_TIER_ID}/../other`],
    ["backslash path", `${SELECT_TIER_ID}\\other`],
    ["encoded traversal", `${SELECT_TIER_ID}%2F..%2Fother`],
    ["query", `${SELECT_TIER_ID}?size=100`],
    ["encoded query", `${SELECT_TIER_ID}%3Fsize=100`],
    ["fragment", `${SELECT_TIER_ID}#icon`],
    ["NUL suffix", `${SELECT_TIER_ID}\u0000`],
    ["zero-width suffix", `${SELECT_TIER_ID}\u200b`],
  ];

  it.each(invalidInputs)("rejects %s", (_label, input) => {
    expect(getPublicContentTierIconUri(input)).toBeUndefined();
  });

  it("builds URIs without making HTTP requests", () => {
    getPublicContentTierIconUri(SELECT_TIER_ID);
    getPublicContentTierIconUri(undefined);

    expect(mockPublicGet).not.toHaveBeenCalled();
  });
});
