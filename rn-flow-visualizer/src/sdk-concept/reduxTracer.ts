import { flowTracer } from './flowTracer';

interface StoreLike {
  getState: () => unknown;
}

interface ActionLike {
  type: string;
  payload?: unknown;
}

export const flowTracerReduxMiddleware = (store: StoreLike) => (next: (action: ActionLike) => unknown) => (action: ActionLike) => {
  const before = store.getState();

  flowTracer.track({
    type: 'STATE_ACTION',
    label: `dispatch(${action.type})`,
    input: action,
    tool: 'Redux DevTools',
  });

  const result = next(action);
  const after = store.getState();

  flowTracer.track({
    type: 'STATE_UPDATE',
    label: `State updated after ${action.type}`,
    stateBefore: before,
    stateAfter: after,
    tool: 'Redux DevTools',
  });

  return result;
};
