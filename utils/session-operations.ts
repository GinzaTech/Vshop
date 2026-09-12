/** Native networking and WebViews share one Riot cookie jar. */
let pendingOperation: Promise<unknown> = Promise.resolve();
let generation = 0;
let interactiveAuthentication = false;

export class SessionChangedError extends Error {
  readonly code = "SESSION_CHANGED";

  constructor() {
    super("The active Riot session changed while a request was running");
    this.name = "SessionChangedError";
  }
}

export const isSessionChangedError = (error: unknown) =>
  (error as { code?: string } | undefined)?.code === "SESSION_CHANGED";

export const getSessionGeneration = () => generation;
export const isInteractiveAuthentication = () => interactiveAuthentication;

export const setInteractiveAuthentication = (active: boolean) => {
  interactiveAuthentication = active;
  generation += 1;
};

export const invalidateSessionOperations = () => { generation += 1; };

export function runSessionOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = pendingOperation.then(operation);
  pendingOperation = result.catch(() => undefined);
  return result;
}
