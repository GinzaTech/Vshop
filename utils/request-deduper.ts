/**
 * Shares an in-flight request by a stable key and releases it as soon as the
 * request settles. It prevents duplicate network calls without turning a
 * failed request into a long-lived cache entry.
 */
export function createRequestDeduper<T>() {
  const requests = new Map<string, Promise<T>>();

  return {
    run(key: string, createRequest: () => Promise<T>): Promise<T> {
      const existing = requests.get(key);
      if (existing) {
        return existing;
      }

      const request = createRequest();
      requests.set(key, request);
      const release = () => {
        if (requests.get(key) === request) {
          requests.delete(key);
        }
      };
      void request.then(release, release);
      return request;
    },
    clear() {
      requests.clear();
    },
  };
}
