import { getSessionGeneration, SessionChangedError } from "~/utils/session-operations";

type RequestIdentity = {
  id: number;
  accessToken: string;
  entitlementsToken: string;
  generation: number;
};

/** Memory-only credentials select an opaque identity; keys never contain secrets.
 * Clearing or observing renewed credentials invalidates already running work.
 * Successful data remains separately keyed by its account/resource.
 */
export function createRequestScope() {
  const identities = new Map<string, RequestIdentity>();
  const latestRequests = new Map<string, object>();
  let nextId = 0;

  const clear = (resource?: string) => {
    if (resource !== undefined) {
      identities.delete(resource);
      latestRequests.delete(resource);
    } else {
      identities.clear();
      latestRequests.clear();
    }
  };

  const observe = (resource: string, accessToken: string, entitlementsToken: string) => {
    const generation = getSessionGeneration();
    const previous = identities.get(resource);
    const identity = previous?.accessToken === accessToken &&
      previous.entitlementsToken === entitlementsToken && previous.generation === generation
      ? previous
      : { id: ++nextId, accessToken, entitlementsToken, generation };
    // Bound credential retention even if callers visit many different resources.
    identities.delete(resource);
    identities.set(resource, identity);
    if (identities.size > 1000) {
      const oldest = identities.keys().next().value;
      if (oldest !== undefined) clear(oldest);
    }
    const assertCurrent = () => {
      if (identities.get(resource) !== identity || getSessionGeneration() !== generation) {
        throw new SessionChangedError();
      }
    };
    return {
      key: (variant = "") => JSON.stringify([resource, identity.id, variant]),
      assertCurrent,
      start: () => {
        const request = {};
        latestRequests.set(resource, request);
        return () => {
          assertCurrent();
          if (latestRequests.get(resource) !== request) throw new SessionChangedError();
        };
      },
    };
  };
  return { clear, observe };
}
