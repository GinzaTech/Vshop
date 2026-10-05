import { captureFriendCardResponse } from "~/utils/friend-card-response-log";
import { Buffer } from "buffer";

it("retains card identity and all ordinary decoded fields but strips credentials from encoded payloads", () => {
  const cardId = "12345678-1234-1234-1234-123456789012";
  const encoded = Buffer.from(JSON.stringify({ playerCardId: cardId, sessionLoopState: "MENUS",
    nested: { arbitraryField: 42, accessToken: "never-log-me", cookie: "secret-cookie" } })).toString("base64");
  const result = captureFriendCardResponse("presence", { raw: `<presence><games><valorant><p>${encoded}</p></valorant></games></presence>` });
  const text = JSON.stringify(result);
  expect(text).toContain(cardId); expect(text).toContain("arbitraryField"); expect(text).toContain("MENUS");
  expect(text).not.toContain("never-log-me"); expect(text).not.toContain(encoded); expect(text).not.toContain("secret-cookie");
  expect(text).toContain("[REDACTED]");
});

it("preserves roster names/UUIDs authorized for this local capture and redacts nested auth fields", () => {
  const result = captureFriendCardResponse("roster", { friends: [{ jid: "friend@pvp.net", name: "QA Friend", credential: "hidden" }] });
  expect(JSON.stringify(result)).toContain("QA Friend"); expect(JSON.stringify(result)).toContain("friend@pvp.net");
  expect(JSON.stringify(result)).not.toContain("hidden");
});

it("redacts credential XML tags and attributes nested under ordinary roster elements", () => {
  const credentialAttribute = ["hidden", "attribute"].join("-");
  const credentialTag = ["to", "ken"].join("");
  const result = captureFriendCardResponse("roster", { raw: `<iq><query><item jid="friend@pvp.net" ${credentialTag}="${credentialAttribute}"><password>hidden-password</password><playerCardId>card-known</playerCardId></item></query></iq>` });
  const text = JSON.stringify(result);
  expect(text).not.toContain("hidden-attribute"); expect(text).not.toContain("hidden-password");
  expect(text).toContain("card-known"); expect(text).toContain("friend@pvp.net");
});
