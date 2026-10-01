import { extractBundleOwnedItemIds } from "~/utils/bundle-ownership";
import { VItemTypes } from "~/utils/misc";

const read = (response: unknown) => extractBundleOwnedItemIds(response, "account", VItemTypes.PlayerCard);

describe("Bundle inventory response validation", () => {
  it("accepts metadata-free legacy responses and validates supplied subject/type", () => {
    const Entitlements = [{ ItemID: "card" }, { ItemID: "card", InstanceID: "instance" }];
    expect(read({ Entitlements })).toEqual(["card"]);
    expect(read({ Subject: "account", ItemTypeID: VItemTypes.PlayerCard, Entitlements })).toEqual(["card"]);
  });

  it("combines only the requested groups and flat IDs, ignoring entitlement TypeID and InstanceID", () => {
    expect(read({ Entitlements: [{ ItemID: "flat" }], EntitlementsByTypes: [
      { ItemTypeID: VItemTypes.Buddy, Entitlements: [{ ItemID: "foreign" }] },
      { ItemTypeID: VItemTypes.PlayerCard, Entitlements: [{ ItemID: "card", TypeID: "entitlement-kind", InstanceID: "instance" }] },
      { ItemTypeID: VItemTypes.PlayerCard, Entitlements: [{ ItemID: "card" }, { ItemID: "second" }] },
    ] })).toEqual(["flat", "card", "second"]);
  });

  it.each([
    { Subject: "other", Entitlements: [{ ItemID: "bad" }] },
    { Subject: null, Entitlements: [{ ItemID: "bad" }] },
    { ItemTypeID: VItemTypes.Buddy, Entitlements: [{ ItemID: "bad" }] },
    { ItemTypeID: null, Entitlements: [{ ItemID: "bad" }] },
    { Subject: "other", EntitlementsByTypes: [{ ItemTypeID: VItemTypes.PlayerCard, Entitlements: [{ ItemID: "bad" }] }] },
    { ItemTypeID: VItemTypes.Buddy, EntitlementsByTypes: [{ ItemTypeID: VItemTypes.PlayerCard, Entitlements: [{ ItemID: "bad" }] }] },
  ])("rejects contradictory supplied response metadata %#", (response) => {
    expect(() => read(response)).toThrow("Invalid Bundle inventory response");
  });

  it("allows valid empty inventory and foreign groups without converting their IDs", () => {
    expect(read({ Entitlements: [] })).toEqual([]);
    expect(read({ EntitlementsByTypes: [] })).toEqual([]);
    expect(read({ EntitlementsByTypes: [{ ItemTypeID: VItemTypes.Spray, Entitlements: [{ ItemID: "foreign" }] }] })).toEqual([]);
  });

  it.each([null, undefined, [], "invalid", {}, { Entitlements: null }, { Entitlements: {} },
    { EntitlementsByTypes: {} }, { EntitlementsByTypes: [null] },
    { EntitlementsByTypes: [{ Entitlements: [{ ItemID: "ambiguous" }] }] },
    { EntitlementsByTypes: [{ ItemTypeID: VItemTypes.PlayerCard, Entitlements: null }] },
    { Entitlements: [null] }, { Entitlements: [{ ItemID: 123 }] }, { Entitlements: [{ ItemID: "" }] },
  ])("fails closed for malformed inventory %#", (response) => {
    expect(() => read(response)).toThrow("Invalid Bundle inventory response");
  });

  it("does not reveal supplied subjects or IDs through validation errors", () => {
    expect(() => read({ Subject: "private-subject", Entitlements: [{ ItemID: "private-id" }] }))
      .toThrow(new Error("Invalid Bundle inventory response"));
  });
});
