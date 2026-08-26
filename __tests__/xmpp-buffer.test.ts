import {
  hasIncompleteRosterIq,
  trimXmppBuffer,
  XMPP_BUFFER_TAIL_BYTES,
  XMPP_MAX_INCOMPLETE_ROSTER_BYTES,
} from "../utils/xmpp-buffer";

const rosterStart =
  "<iq type='result' id='roster_1'><query xmlns='jabber:iq:riotgames:roster'>";

describe("XMPP buffer trimming", () => {
  it("keeps a large roster stanza until the closing IQ arrives", () => {
    const partialRoster = `${rosterStart}${"<item jid='friend@jp1.pvp.net'/>".repeat(2_000)}`;

    expect(partialRoster.length).toBeGreaterThan(XMPP_BUFFER_TAIL_BYTES);
    expect(hasIncompleteRosterIq(partialRoster)).toBe(true);
    expect(trimXmppBuffer(partialRoster)).toBe(partialRoster);
  });

  it("recognizes a completed roster stanza", () => {
    const completedRoster = `${rosterStart}<item jid='friend@jp1.pvp.net'/></query></iq>`;

    expect(hasIncompleteRosterIq(completedRoster)).toBe(false);
  });

  it("still caps an abnormally large incomplete roster", () => {
    const oversizedRoster = `${rosterStart}${"x".repeat(
      XMPP_MAX_INCOMPLETE_ROSTER_BYTES,
    )}`;
    const trimmed = trimXmppBuffer(oversizedRoster);

    expect(trimmed).toHaveLength(XMPP_BUFFER_TAIL_BYTES);
    expect(trimmed).toBe(oversizedRoster.slice(-XMPP_BUFFER_TAIL_BYTES));
  });

  it("trims unrelated accumulated data at the normal threshold", () => {
    const unrelatedBuffer = "presence".repeat(10_000);

    expect(trimXmppBuffer(unrelatedBuffer)).toBe(
      unrelatedBuffer.slice(-XMPP_BUFFER_TAIL_BYTES),
    );
  });
});
