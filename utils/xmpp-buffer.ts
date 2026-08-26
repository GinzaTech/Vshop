const ROSTER_NAMESPACE = "jabber:iq:riotgames:roster";

export const XMPP_BUFFER_TRIM_THRESHOLD = 50_000;
export const XMPP_BUFFER_TAIL_BYTES = 10_000;
export const XMPP_MAX_INCOMPLETE_ROSTER_BYTES = 2_000_000;

/**
 * Riot can split a large friends roster across several TCP data events. Keep
 * the stanza intact until its closing IQ arrives; otherwise trimming the first
 * chunk makes the roster impossible to parse and the Friends screen times out.
 */
export function hasIncompleteRosterIq(buffer: string) {
  const namespaceIndex = buffer.indexOf(ROSTER_NAMESPACE);
  if (namespaceIndex < 0) return false;

  const iqStartIndex = buffer.lastIndexOf("<iq", namespaceIndex);
  if (iqStartIndex < 0) return false;

  return buffer.indexOf("</iq>", namespaceIndex) < 0;
}

export function trimXmppBuffer(buffer: string) {
  if (buffer.length <= XMPP_BUFFER_TRIM_THRESHOLD) return buffer;

  if (
    hasIncompleteRosterIq(buffer) &&
    buffer.length <= XMPP_MAX_INCOMPLETE_ROSTER_BYTES
  ) {
    return buffer;
  }

  return buffer.slice(-XMPP_BUFFER_TAIL_BYTES);
}
